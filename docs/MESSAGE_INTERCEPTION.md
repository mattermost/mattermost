# Message Interception - Processing Posts Before Rendering

This document explains how to intercept and process messages BEFORE they are rendered in the UI or sent to the server. This is critical for features like encryption, content filtering, or message transformation.

## Overview

Mattermost posts enter the system through several paths. To ensure posts are processed before rendering or sending, you must intercept them at the Redux layer using either **Hooks** (for active user actions) or **Middleware** (for bulk loading/background updates).

## Interception via Hooks

The most common way to process messages is using the hook system in `webapp/channels/src/actions/hooks.ts`.

### 1. WebSocket (Incoming Messages from Others)

When another user sends a message, it arrives via WebSocket:

```
WebSocket → handleNewPost() → completePostReceive() → runMessageWillBeReceivedHooks() → dispatch(RECEIVED_NEW_POST)
```

**File:** `webapp/channels/src/actions/new_post.ts`

The `runMessageWillBeReceivedHooks` function handles decryption for incoming messages before they are added to the Redux store.

### 2. Sending Messages (Your Own Posts)

When YOU send a message:

```
User submits → onSubmit() → submitPost() → runMessageWillBePostedHooks() → dispatch(CREATE_POST)
```

**Files:**
- `webapp/channels/src/actions/views/create_comment.tsx` (Logic)
- `webapp/channels/src/actions/hooks.ts` (`runMessageWillBePostedHooks`)

This is where messages are encrypted before being sent to the server.

### 3. Editing Messages

When you edit an existing message:

```
User saves edit → editPost() → runMessageWillBeUpdatedHooks() → PostActions.editPost()
```

**Files:**
- `webapp/channels/src/actions/views/posts.js` (`editPost` wrapper)
- `webapp/channels/src/actions/hooks.ts` (`runMessageWillBeUpdatedHooks`)

**Note:** This is a critical point for ensuring edited content is encrypted before being sent to the server.

### 4. Forwarding Messages

When you forward a post:

```
User forwards → forwardPost() → runMessageWillBePostedHooks() → PostActions.createPost()
```

**File:** `webapp/channels/src/actions/views/posts.js`

## Interception via Redux Middleware

Redux middleware is used to intercept posts during bulk loading (page load, scrolling, search) or when they are updated in the background.

**File:** `webapp/channels/src/store/encryption_middleware.ts`

### Key Action Types

Middleware should watch for both direct post actions and batched actions:

```typescript
const BATCH_ACTION_TYPES = new Set([
    'BATCHING_REDUCER.BATCH',      // Generic batch
    'BATCH_CREATE_POST_INIT',       // Optimistic post when sending
    'BATCH_CREATE_POST',            // Server response after sending
    'BATCH_CREATE_POST_FAILED',     // Failed post
]);

const POST_ACTION_TYPES = new Set([
    PostTypes.RECEIVED_POSTS,
    PostTypes.RECEIVED_POSTS_SINCE,
    PostTypes.RECEIVED_POSTS_BEFORE,
    PostTypes.RECEIVED_POSTS_AFTER,
    PostTypes.RECEIVED_POSTS_IN_CHANNEL,
    PostTypes.RECEIVED_POSTS_IN_THREAD,
    PostTypes.RECEIVED_NEW_POST,
    PostTypes.RECEIVED_POST,
]);
```

### Implementation Details

The implementation in `encryption_middleware.ts` uses a `processingQueue` to ensure that asynchronous decryptions do not interleave, which prevents race conditions in the UI.

```typescript
let processingQueue: Promise<unknown> = Promise.resolve();

export function createEncryptionMiddleware(): Middleware {
    return (store) => (next) => (action) => {
        // ... check if action needs processing ...

        const processAction = async () => {
            // ... process action data (e.g., decrypt) ...
            return next(action);
        };

        processingQueue = processingQueue.then(processAction, processAction);
        return processingQueue;
    };
}
```

## Avoiding Flash of Unprocessed Content

To prevent users from seeing unprocessed (e.g., encrypted) content:

1. **Process synchronously when possible** - Check local caches before falling back to async processing.
2. **Await before next()** - Middleware MUST complete processing before calling `next(action)`.
3. **Handle ALL entry points** - Ensure both hooks and middleware are implemented. Missing `editPost` or a specific `RECEIVED_POSTS_*` type will cause flashes of raw content.
4. **Use processingQueue** - Prevent interleaved dispatches by serializing async operations in the middleware.

## Data Structures

### PostList (multiple posts)
Found in `RECEIVED_POSTS`, `RECEIVED_POSTS_*`. Data is at `action.data`.

### Single Post
Found in `RECEIVED_POST`, `RECEIVED_NEW_POST`. Data is at `action.data`.
