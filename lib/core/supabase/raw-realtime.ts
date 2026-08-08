/**
 * Raw Supabase Realtime API (WebSocket/Phoenix Protocol)
 * Multiplexed version: Shares a single WebSocket across multiple channels
 */

import { getValidAccessToken } from './raw-auth';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface PostgresChange {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  schema: string;
  record?: any;
  old_record?: any;
}

interface ChannelConfig {
  presence?: {
    key?: string;
  };
  postgres_changes?: Array<{
    event: '*' | 'INSERT' | 'UPDATE' | 'DELETE';
    schema: string;
    table: string;
    filter?: string;
  }>;
}

interface ChannelOptions {
  channelName: string;
  config?: ChannelConfig;
  onPostgresChange?: (change: PostgresChange) => void;
  onPresenceSync?: (state: any) => void;
  onBroadcast?: (payload: any) => void;
}

/**
 * Shared Socket class to manage a single WebSocket connection
 */
class RealtimeSocket {
  private ws: WebSocket | null = null;
  private ref: number = 0;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private channels = new Map<string, RealtimeChannel>();
  private pendingJoins = new Map<number, { resolve: () => void, reject: (err: any) => void, topic: string }>();
  private channelRejoinTimers = new Map<string, NodeJS.Timeout>();
  private channelRejoinAttempts = new Map<string, number>();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private isConnecting: boolean = false;
  private connectPromise: Promise<void> | null = null;
  private shouldRejoinOnConnect: boolean = false;

  constructor() {
    this.setupAuthListener();
  }

  private setupAuthListener() {
    if (typeof window === 'undefined') return;

    import('./raw-auth').then(({ onAuthStateChange }) => {
      onAuthStateChange((event, session) => {
        if (event === 'TOKEN_REFRESHED' && session?.access_token) {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.updateAccessToken(session.access_token);
            return;
          }
        }

        this.disconnect();
        if (this.channels.size > 0) {
          this.shouldRejoinOnConnect = true;
          this.connect().catch(() => {});
        }
      });
    });
  }

  private updateAccessToken(accessToken: string) {
    this.channels.forEach((channel) => {
      this.send({
        topic: channel.topic,
        event: 'access_token',
        payload: { access_token: accessToken },
        ref: this.nextRef(),
      });
    });
  }

  private disconnect() {
    this.stopHeartbeat();
    this.clearAllChannelRejoins();
    this.isConnecting = false;
    this.connectPromise = null;
    this.pendingJoins.forEach(({ reject }) => {
      reject(new Error('Realtime socket disconnected'));
    });
    this.pendingJoins.clear();

    if (this.ws) {
      // Remove handlers before closing to prevent unwanted reconnects/errors
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }

  private async getUrl(): Promise<string> {
    const wsUrl = SUPABASE_URL
      .replace('https://', 'wss://')
      .replace('http://', 'ws://')
      .replace(/\/$/, '');

    const accessToken = await getValidAccessToken();
    const socketUrl = `${wsUrl}/realtime/v1/websocket?apikey=${encodeURIComponent(SUPABASE_ANON_KEY)}&vsn=2.0.0`;

    return accessToken
      ? `${socketUrl}&access_token=${encodeURIComponent(accessToken)}`
      : socketUrl;
  }

  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    if (this.connectPromise) return this.connectPromise;

    this.isConnecting = true;
    this.connectPromise = (async () => {
      const finalUrl = await this.getUrl();

      return new Promise<void>((resolve, reject) => {
      try {
        let settled = false;

        const settle = (fn: (value?: any) => void, value?: any) => {
          if (settled) return;
          settled = true;
          this.isConnecting = false;
          this.connectPromise = null;
          fn(value);
        };

        this.ws = new WebSocket(finalUrl);

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          settle(resolve);

          if (this.shouldRejoinOnConnect) {
            this.shouldRejoinOnConnect = false;
            this.channels.forEach(channel => {
              this.joinChannel(channel).catch(() => {});
            });
          }
        };

        this.ws.onmessage = (event) => {
          const raw = JSON.parse(event.data);
          const msg = Array.isArray(raw)
            ? { join_ref: raw[0], ref: raw[1], topic: raw[2], event: raw[3], payload: raw[4] }
            : raw;
          this.dispatch(msg);
        };

        this.ws.onerror = (error) => {
          console.error('[RawRealtime] Shared WebSocket error:', error);
          settle(reject, error);
        };

        this.ws.onclose = () => {
          this.stopHeartbeat();
          if (!settled) {
            settle(reject, new Error('Realtime socket closed before connection was established'));
          }
          this.scheduleReconnect();
        };
      } catch (error) {
        this.isConnecting = false;
        this.connectPromise = null;
        reject(error);
      }
      });
    })().catch((error) => {
      this.isConnecting = false;
      this.connectPromise = null;
      throw error;
    });

    return this.connectPromise as Promise<void>;
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectAttempts++;
      this.shouldRejoinOnConnect = true;
      this.connect().catch(() => {});
    }, delay);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      this.send({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: this.nextRef() });
    }, 30000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = null;
  }

  nextRef(): number {
    return ++this.ref;
  }

  send(message: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private dispatch(msg: any) {
    // Handle joins
    if (msg.event === 'phx_reply') {
      const ref = Number(msg.ref);
      const pending = this.pendingJoins.get(ref);
      if (pending) {
        if (msg.payload?.status === 'ok') {
          this.clearChannelRejoin(pending.topic);
          pending.resolve();
        } else {
          console.error(`[RawRealtime] Channel join failed: ${pending.topic}`, msg.payload?.response);
          this.scheduleChannelRejoin(pending.topic);
          pending.reject(new Error(msg.payload?.response?.reason || 'Join failed'));
        }
        this.pendingJoins.delete(ref);
      }
    }

    if (msg.event === 'phx_error' || msg.event === 'phx_close') {
      this.scheduleChannelRejoin(msg.topic);
    }

    // Route message to channel
    const channel = this.channels.get(msg.topic);
    if (channel) {
      channel.onMessage(msg);
    }
  }

  registerChannel(channel: RealtimeChannel) {
    this.clearChannelRejoin(channel.topic);
    this.channels.set(channel.topic, channel);
  }

  unregisterChannel(topic: string) {
    this.clearChannelRejoin(topic);
    this.channels.delete(topic);
  }

  private clearChannelRejoin(topic: string) {
    const timer = this.channelRejoinTimers.get(topic);
    if (timer) {
      clearTimeout(timer);
      this.channelRejoinTimers.delete(topic);
    }
    this.channelRejoinAttempts.delete(topic);
  }

  private clearAllChannelRejoins() {
    this.channelRejoinTimers.forEach((timer) => clearTimeout(timer));
    this.channelRejoinTimers.clear();
    this.channelRejoinAttempts.clear();
  }

  private scheduleChannelRejoin(topic: string) {
    if (!topic) return;
    if (this.channelRejoinTimers.has(topic)) return;

    const channel = this.channels.get(topic);
    if (!channel) return;

    const attempt = this.channelRejoinAttempts.get(topic) || 0;
    const delay = Math.min(1000 * Math.pow(2, attempt), 15000);

    const timer = setTimeout(() => {
      this.channelRejoinTimers.delete(topic);
      const activeChannel = this.channels.get(topic);
      if (!activeChannel) {
        this.channelRejoinAttempts.delete(topic);
        return;
      }

      this.joinChannel(activeChannel)
        .then(() => {
          this.clearChannelRejoin(topic);
        })
        .catch(() => {
          this.channelRejoinAttempts.set(topic, attempt + 1);
          this.scheduleChannelRejoin(topic);
        });
    }, delay);

    this.channelRejoinTimers.set(topic, timer);
  }

  async joinChannel(channel: RealtimeChannel): Promise<void> {
    await this.connect();

    const accessToken = await getValidAccessToken();

    return new Promise((resolve, reject) => {
      const ref = this.nextRef();

      const timeout = setTimeout(() => {
        this.pendingJoins.delete(ref);
        reject(new Error(`Channel join timed out: ${channel.topic}`));
      }, 15000);

      this.pendingJoins.set(ref, {
        resolve: () => {
          clearTimeout(timeout);
          resolve();
        },
        reject: (err) => {
          clearTimeout(timeout);
          reject(err);
        },
        topic: channel.topic
      });
      
      this.send({
        topic: channel.topic,
        event: 'phx_join',
        payload: {
          ...channel.getConfig(),
          access_token: accessToken
        },
        ref
      });
    });
  }

  leaveChannel(topic: string) {
    this.send({
      topic,
      event: 'phx_leave',
      payload: {},
      ref: this.nextRef()
    });
  }
}

// Global socket instance
const globalSocket = new RealtimeSocket();

class RealtimeChannel {
  public topic: string;
  private config: ChannelConfig;
  private onPostgresChangeCb?: (change: PostgresChange) => void;
  private onPresenceSyncCb?: (state: any) => void;
  private onBroadcastCb?: (payload: any) => void;

  constructor(options: ChannelOptions) {
    this.topic = options.channelName;
    this.config = options.config || {};
    this.onPostgresChangeCb = options.onPostgresChange;
    this.onPresenceSyncCb = options.onPresenceSync;
    this.onBroadcastCb = options.onBroadcast;
  }

  getConfig() { return this.config; }

  async subscribe(): Promise<void> {
    globalSocket.registerChannel(this);
    return globalSocket.joinChannel(this);
  }

  unsubscribe() {
    globalSocket.leaveChannel(this.topic);
    globalSocket.unregisterChannel(this.topic);
  }

  onMessage(msg: any) {
    if (msg.event === 'postgres_changes') {
      const payloadData = msg.payload?.data || msg.payload || {};
      const eventType = payloadData.type || payloadData.eventType;
      const record = payloadData.record || payloadData.new;
      const oldRecord = payloadData.old_record || payloadData.old;

      const change: PostgresChange = {
        type: eventType,
        table: payloadData.table,
        schema: payloadData.schema,
        record,
        old_record: oldRecord,
      };

      if (change.type && change.table && change.schema) {
        this.onPostgresChangeCb?.(change);
      } else {
        console.warn('[RawRealtime] Unrecognized postgres_changes payload shape:', msg.payload);
      }
    }
    
    if (msg.event === 'presence_state' || msg.event === 'presence_diff') {
      this.onPresenceSyncCb?.(msg.payload);
    }
    
    if (msg.event === 'broadcast') {
      this.onBroadcastCb?.(msg.payload);
    }
  }

  broadcast(event: string, payload: any) {
    globalSocket.send({
      topic: this.topic,
      event: 'broadcast',
      payload: { type: 'broadcast', event, payload },
      ref: globalSocket.nextRef()
    });
  }

  track(payload: any) {
    globalSocket.send({
      topic: this.topic,
      event: 'presence',
      payload: { type: 'presence', event: 'track', payload },
      ref: globalSocket.nextRef()
    });
  }
}

/**
 * Subscribe to postgres changes on a table
 */
export function subscribeToTable(
  table: string,
  options: {
    event?: '*' | 'INSERT' | 'UPDATE' | 'DELETE';
    schema?: string;
    filter?: string;
    onChange: (change: PostgresChange) => void;
  }
): () => void {
  // Ensure each subscriber gets an isolated topic to avoid callback collisions in shared maps.
  // Keep topic characters conservative; raw filter strings can include symbols such as '=' and '.'
  // which may break topic validation on some Realtime deployments.
  const schema = options.schema || 'public';
  const filterHash = options.filter
    ? Array.from(options.filter).reduce((hash, char) => ((hash * 31) + char.charCodeAt(0)) >>> 0, 0).toString(36)
    : 'nofilter';
  const channelName = `realtime:${schema}:${table}:${filterHash}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

  const channel = new RealtimeChannel({
    channelName,
    config: {
      postgres_changes: [
        {
          event: options.event || '*',
          schema,
          table,
          filter: options.filter,
        },
      ],
    },
    onPostgresChange: options.onChange,
  });

  let isActive = true;
  let retryAttempt = 0;
  const maxRetryAttempts = 8;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const subscribeWithRetry = () => {
    if (!isActive) return;

    channel.subscribe()
      .then(() => {
        retryAttempt = 0;
      })
      .catch((error) => {
        if (!isActive) return;
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isJoinTimeout = errorMessage.includes('Channel join timed out');

        if (retryAttempt >= maxRetryAttempts) {
          console.warn(
            `[RawRealtime] Giving up subscription after ${maxRetryAttempts} retries: ${channelName}`
          );
          return;
        }

        if (isJoinTimeout) {
          console.warn('[RawRealtime] Channel join timed out, retrying:', channelName);
        } else {
          console.error('[RawRealtime] Failed to subscribe:', error);
        }

        const retryDelayMs = Math.min(1000 * Math.pow(2, retryAttempt), 15000);
        retryAttempt++;
        retryTimer = setTimeout(() => {
          retryTimer = null;
          subscribeWithRetry();
        }, retryDelayMs);
      });
  };

  subscribeWithRetry();

  return () => {
    isActive = false;
    if (retryTimer) clearTimeout(retryTimer);
    channel.unsubscribe();
  };
}

/**
 * Create a custom channel
 */
export function createChannel(options: ChannelOptions): {
  subscribe: () => Promise<void>;
  unsubscribe: () => void;
  broadcast: (event: string, payload: any) => void;
  track: (payload: any) => void;
} {
  const channel = new RealtimeChannel(options);
  
  return {
    subscribe: () => channel.subscribe(),
    unsubscribe: () => channel.unsubscribe(),
    broadcast: (event, payload) => channel.broadcast(event, payload),
    track: (payload) => channel.track(payload),
  };
}

/**
 * Subscribe to thread events (convenience wrapper)
 */
export function subscribeToThread(
  threadId: string,
  callbacks: {
    onMessageInsert?: (message: any) => void;
    onMessageUpdate?: (message: any) => void;
    onMessageDelete?: (message: any) => void;
    onThreadUpdate?: (thread: any) => void;
  }
): () => void {
  const unsubscribers: Array<() => void> = [];

  // Subscribe to messages
  if (callbacks.onMessageInsert || callbacks.onMessageUpdate || callbacks.onMessageDelete) {
    const unsubMessages = subscribeToTable('messages', {
      filter: `thread_id=eq.${threadId}`,
      onChange: (change) => {
        if (change.type === 'INSERT' && callbacks.onMessageInsert) {
          callbacks.onMessageInsert(change.record);
        } else if (change.type === 'UPDATE' && callbacks.onMessageUpdate) {
          callbacks.onMessageUpdate(change.record);
        } else if (change.type === 'DELETE' && callbacks.onMessageDelete) {
          callbacks.onMessageDelete(change.old_record);
        }
      },
    });
    unsubscribers.push(unsubMessages);
  }

  // Subscribe to thread updates
  if (callbacks.onThreadUpdate) {
    const unsubThread = subscribeToTable('threads', {
      filter: `id=eq.${threadId}`,
      onChange: (change) => {
        if (change.type === 'UPDATE' && callbacks.onThreadUpdate) {
          callbacks.onThreadUpdate(change.record);
        }
      },
    });
    unsubscribers.push(unsubThread);
  }

  return () => {
    unsubscribers.forEach((unsub) => unsub());
  };
}

