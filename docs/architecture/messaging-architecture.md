# Messaging Architecture Documentation

This document provides a comprehensive overview of the messaging architecture within WhisprSpace, covering both Thread Messaging and Direct Messaging (DM), their underlying data models, lifecycle management, and real-time infrastructure.

## 1. High-Level Overview

The messaging system is built on a **React + Supabase** stack, leveraging:
- **Supabase Realtime (v2)**: For live updates via Phoenix Channels.
- **TanStack React Query**: For caching, optimistic updates, and state synchronization.
- **Zustand**: For global state management (specifically `threadStore`).
- **PostgreSQL**: As the persistent data store with Row Level Security (RLS).

The core infrastructure layer (`lib/core/supabase/raw-realtime.ts`) manages a single WebSocket connection that multiplexes subscriptions for both threads and DMs.

---

## 2. Thread Messaging Architecture

Thread messaging is designed for topic-based, group-like communication where users can join, participate, and leave.

### 2.1 Data Models (Database Schema)

- **`threads`**: The central entity.
  - `id`: UUID.
  - `type`: 'text', 'poll', 'premium'.
  - `privacy`: 'public', 'private', 'invite_only'.
  - `creator_id`: Owner of the thread.
  - `expires_at`: Timestamp for thread expiration logic.
  
- **`thread_participants`**: Associative table tracking joined users.
  - `thread_id`: FK to `threads`.
  - `user_id`: FK to `users`.
  - *Key Role*: Determines access for private threads and populates the sidebar participant list.

- **`messages`**: The content within a thread.
  - `thread_id`: FK to `threads`.
  - `sender_id`: FK to `users`.
  - `content`: Text content.
  - `type`: 'text', 'image', 'file', etc.
  - `parent_message_id`: Supports threading/replies.
  - `attachments`: JSONB array for file metadata.

- **`thread_invites`**: Manages access codes for private threads.
- **`thread_bans`**: Tracks users banned from specific threads.

### 2.2 Participation Lifecycle

1.  **Creation**:
    - User creates a thread via `createThread` (RPC/Insert).
    - System automatically inserts the creator into `thread_participants`.

2.  **Joining**:
    - **Public**: Users free to join via `joinThread` service, which calls the `join_thread` database RPC.
    - **Private/Invite-Only**: Requires a valid invite code processed by `redeemThreadInvite` RPC or manual approval (future).
    - **Validation**: The DB RPC handles checks like "is user banned?" and "is thread expired?".

3.  **Leaving**:
    - User triggers `leaveThread`, calling the `leave_thread` RPC.
    - Removes the record from `thread_participants`.

4.  **Banning**:
    - Creators can ban users via `is_thread_banned` checks and `removeThreadParticipant` RPC.

### 2.3 Messaging Flow

1.  **Sending**:
    - User submits message via UI (`ThreadInput`).
    - **Service**: `addMessage` in `lib/threads/thread-service.ts`.
    - **Step 1 (Insert)**: A minimal INSERT operation is performed on the `messages` table.
    - **Step 2 (Fetch)**: Immediately after insertion, a robust SELECT query fetches the full message details, joining `users` (sender), `message_reactions`, and `parent_message` to return a fully hydrated object for the UI.

2.  **Storage**:
    - Attachments are uploaded to Supabase Storage bucket `thread-attachments` under `messages/{threadId}` before the message record is created.

### 2.4 Real-time Updates (Threads)

- **Hook**: `useRealtimeThread` (`lib/core/realtime/useRealtimeThread.ts`).
- **Subscription**:
    - Connects to a channel: `realtime:thread:{threadId}`.
    - Listens for `postgres_changes` on:
        - `messages` (INSERT, UPDATE, DELETE).
        - `thread_participants` (INSERT, DELETE).
        - `message_reactions`, `message_likes`, `thread_likes`.
- **Handling**:
    - **Incoming Message**: Triggers `onMessageInsert`.
    - **Cache Update**: Uses `queryClient.setQueryData` to immediately inject the new/updated record into the React Query cache, ensuring instant UI updates without refetching the entire list.
    - **Typing Indicators**: Uses temporary `broadcast` events to show "User is typing..." status.

---

## 3. Direct Messaging (DM) Architecture

Direct messaging is designed for 1-on-1 private conversations.

### 3.1 Data Models

- **`conversations`**: Represents the connection between users.
  - `id`: UUID.
  - `type`: 'direct' or 'one_time'.
  - `last_message_at`: Optimized timestamp for sorting inbox.

- **`conversation_participants`**: Tracks users in a conversation.
  - `conversation_id`: FK.
  - `user_id`: FK.
  - `is_muted`: Boolean.
  - `last_read_at`: Timestamp for unread counts.

- **`direct_messages`**: The content.
  - `conversation_id`: FK.
  - `sender_id`: FK.
  - `content`, `type`, `is_edited`, `is_deleted`.

- **`message_read_receipts`** & **`message_delivery_receipts`**: Granular status tracking per message.

### 3.2 Conversation Lifecycle

1.  **Initiation**:
    - `getOrCreateConversation` (RPC): Checks if a `direct` conversation exists between User A and User B. returns existing ID or creates new.
    - `createOneTimeConversation` (RPC): Explicitly creates a specialized 'one_time' conversation (e.g. for marketplace inquiries).

2.  **Discovery**:
    - `fetchConversations`: Uses a specialized join query (`conversation_participants` -> `conversations`) to list all active chats, sorted by `last_message_at`.

### 3.3 Messaging Flow

1.  **Sending**:
    - **Service**: `sendMessage` in `lib/messaging/messaging-service.ts`.
    - **Process**: Inserts to `direct_messages`.
    - **Side Effect**: Database triggers update `conversations.last_message_at` automatically.

### 3.4 Real-time Updates (DMs)

- **Hook**: `useMessagesQuery` (`lib/messaging/hooks/useMessagesQuery.ts`).
- **Mechanism**:
    - Uses generic `useRealtimeSync` hook.
    - Subscribes to `direct_messages` where `conversation_id=eq.{currentId}`.
    - **Events**:
        - `INSERT`: Adds new message to infinite query cache.
        - `UPDATE`: Updates content/status in place.
        - `DELETE`: Removes from cache.
    - **Receipts**: Also subscribes to `message_read_receipts` and `message_delivery_receipts` to update tick marks in real-time.

---

## 4. Core Infrastructure & Fixes

### 4.1 Raw Realtime Layer (`lib/core/supabase/raw-realtime.ts`)
This is the singleton service managing the WebSocket connection.
- **Connection**: Establishes a standard WebSocket to Supabase/Phoenix.
- **Authenticaton**: Passes the user's access token in the connection URL.
- **Channel Multiplexing**: Manages a registry of active subscriptions (`RealtimeChannel`) to prevent duplicate connections.

### 4.2 Protocol Format Fix (Critical)
A critical issue was identified and fixed in the WebSocket message parsing logic.
- **The Issue**: Supabase Realtime V2 (`vsn=2.0.0`) sends messages as **JSON Arrays** (`[join_ref, ref, topic, event, payload]`). The previous code treated them as **JSON Objects**, causing all real-time events to be silently dropped (properties were `undefined`).
- **The Fix**: The `onmessage` handler now detects if the incoming data is an array and normalizes it into a standard object format before dispatching it to listeners.

### 4.3 State Management Strategy
- **React Query**: Acts as the "source of truth" for UI data. Real-time events strictly update this cache (`queryClient.setQueryData`).
- **Zustand**: Used for transient UI state (e.g., `isSidebarOpen`) and some global session data (`userStore`).
