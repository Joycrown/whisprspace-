# Real-time Thread Scaling Guide

## Current Architecture Capacity

The current implementation can comfortably handle **50-100 concurrent users** per thread without any modifications.

## How Supabase Realtime Scales

### Per User
- **1 WebSocket connection** per user to Supabase
- All channels multiplex over this single connection
- Low memory footprint per user

### Per Thread
- Each thread has a unique channel: `thread:${threadId}`
- **Thousands of concurrent subscribers** per channel (Supabase limit)
- Server-side broadcasting (not peer-to-peer)

### Message Flow
1. User A sends message → Postgres INSERT
2. Postgres → Realtime publication event
3. Supabase Realtime Server → Broadcasts to all subscribers
4. Each client → Receives event and updates UI

## Optimization Strategies for 100+ Users

### 1. Message Pagination
**Problem**: Loading all messages for a thread with 10,000+ messages is slow

**Solution**:
```typescript
// Load recent messages only
const { data } = await supabase
  .from('messages')
  .select('*')
  .eq('thread_id', threadId)
  .order('created_at', { ascending: false })
  .limit(50); // Only load last 50 messages

// Lazy-load history on scroll
const loadMore = async (offset: number) => {
  const { data } = await supabase
    .from('messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: false })
    .range(offset, offset + 49);
  
  return data;
};
```

### 2. Debounce UI Updates
**Problem**: 100 users typing simultaneously causes 100 re-renders/second

**Solution**:
```typescript
import { useMemo } from 'react';
import debounce from 'lodash/debounce';

// Batch incoming messages
const debouncedInvalidate = useMemo(
  () => debounce(() => {
    queryClient.invalidateQueries({ 
      queryKey: queryKeys.threads.detail(threadId) 
    });
  }, 300), // Wait 300ms before updating UI
  [threadId]
);

// In realtime handler
onMessageInsert: (payload) => {
  debouncedInvalidate();
}
```

### 3. Presence Throttling
**Problem**: Tracking 100+ users' online status is expensive

**Solution**:
```typescript
// Only track "recent active" users
const recentActiveThreshold = 50;

onSync: (state) => {
  const allUsers = Object.values(state).flat();
  
  // Sort by last activity and limit
  const recentUsers = allUsers
    .sort((a, b) => 
      new Date(b.online_at).getTime() - new Date(a.online_at).getTime()
    )
    .slice(0, recentActiveThreshold);
  
  setOnlineUsers(recentUsers);
}
```

### 4. Message Compression
**Problem**: Large message payloads slow down broadcast

**Solution**:
```typescript
// Use compact field names in realtime payloads
// Instead of full joins, send minimal data and fetch details client-side

onMessageInsert: async (payload) => {
  // Payload only contains: { id, content, sender_id, timestamp }
  // Fetch full message with joins separately if needed
  const { data } = await supabase
    .from('messages')
    .select('*, sender:users(*)')
    .eq('id', payload.new.id)
    .single();
  
  // Update cache with full message
  updateCache(data);
}
```

## Advanced Scaling (1000+ Users)

### Message Clustering
Split very large threads into sub-channels:

```typescript
const channelShard = Math.floor(messageCount / 1000);
const channel = supabase.channel(`thread:${threadId}:shard:${channelShard}`);
```

### Read Replicas
For read-heavy threads, use Supabase read replicas to distribute load.

### CDN Caching
Cache thread metadata and old messages in a CDN for faster initial loads.

## Performance Monitoring

Track these metrics to know when to optimize:

- **Messages per second** → If > 10/sec, enable debouncing
- **Concurrent users** → If > 100, enable presence throttling  
- **Message history size** → If > 500, implement pagination
- **Client memory usage** → If > 100MB, implement message cleanup

## Troubleshooting

### Issue: Messages not appearing
**Check**: Is RLS policy causing INSERT hang? (See `20260124000000_fix_messages_insert_rls.sql`)

### Issue: Other users disconnected when one refreshes
**Fix**: Use `channel.unsubscribe()` not `removeChannel()` (See `realtime-service.ts` line 196)

### Issue: Duplicate messages
**Fix**: Filter own messages in realtime handler (See `useRealtimeThread.ts` line 39-42)

---

## Current Implementation Status

✅ Multi-user support (tested up to 100 concurrent)  
✅ Realtime message broadcasting  
✅ Optimistic UI updates  
✅ Own-message filtering  
✅ Independent user subscriptions  
⚠️ Pagination (not yet implemented)  
⚠️ Debouncing (not yet implemented)  
⚠️ Presence throttling (not yet implemented)
