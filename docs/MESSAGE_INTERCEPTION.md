# Message Interception - Processing Posts Before Rendering

This document explains how to intercept and process messages BEFORE they are rendered in the UI. This is critical for features like encryption, content filtering, or message transformation.

## Overview

Mattermost posts enter Redux through several paths. To ensure posts are processed before rendering, you must intercept them at the Redux middleware layer.

## Post Entry Points

### 1. WebSocket (Incoming Messages from Others)

When another user sends a message, it arrives via WebSocket:

```
WebSocket → handleNewPost() → completePostReceive() → dispatch(RECEIVED_NEW_POST)
```

**File:** `webapp/channels/src/actions/new_post.ts`

The `completePostReceive` function is the ideal place to process incoming WebSocket posts:

```typescript
export function completePostReceive(post: Post, ...): ActionFuncAsync<boolean> {
    return async (dispatch, getState) => {
        // Process the post BEFORE dispatching
        let processedPost = post;
        if (needsProcessing(post)) {
            processedPost = await processPost(post);
        }

        // Now dispatch with processed post
        dispatch(batchActions([
            PostActions.receivedNewPost(processedPost, ...),
            ...
        ]));
    };
}
```

### 2. Sending Messages (Your Own Posts)

When YOU send a message, it goes through optimistic updates:

```
User submits → createPost() → dispatch(BATCH_CREATE_POST_INIT) → Server → dispatch(BATCH_CREATE_POST)
```

**File:** `webapp/channels/src/packages/mattermost-redux/src/actions/posts.ts`

**Critical Batch Action Types:**
- `BATCH_CREATE_POST_INIT` - Optimistic post (shows immediately)
- `BATCH_CREATE_POST` - Server response
- `BATCH_CREATE_POST_FAILED` - Error case

### 3. Loading Posts (Page Load, Scrolling)

When posts are loaded from the API:

```
getPosts() → Client4.getPosts() → dispatch(RECEIVED_POSTS)
```

These come through various action types:
- `RECEIVED_POSTS`
- `RECEIVED_POSTS_SINCE`
- `RECEIVED_POSTS_BEFORE`
- `RECEIVED_POSTS_AFTER`
- `RECEIVED_POSTS_IN_CHANNEL`
- `RECEIVED_POSTS_IN_THREAD`
- `RECEIVED_NEW_POST`
- `RECEIVED_POST`

## Redux Middleware Approach

The most reliable way to intercept ALL posts is via Redux middleware.

**File:** `webapp/channels/src/store/encryption_middleware.ts`

### Key Batch Action Types

When `batchActions(actions, 'NAME')` is called, the action type becomes the NAME:

```typescript
const BATCH_ACTION_TYPES = new Set([
    'BATCHING_REDUCER.BATCH',      // Generic batch
    'BATCH_CREATE_POST_INIT',       // Optimistic post when sending
    'BATCH_CREATE_POST',            // Server response after sending
    'BATCH_CREATE_POST_FAILED',     // Failed post
]);
```

### Post Action Types

```typescript
import {PostTypes} from 'mattermost-redux/action_types';

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

### Middleware Template

```typescript
import type {AnyAction, Middleware} from 'redux';
import {PostTypes} from 'mattermost-redux/action_types';

const BATCH_ACTION_TYPES = new Set([
    'BATCHING_REDUCER.BATCH',
    'BATCH_CREATE_POST_INIT',
    'BATCH_CREATE_POST',
]);

const POST_ACTION_TYPES = new Set([
    PostTypes.RECEIVED_POSTS,
    PostTypes.RECEIVED_NEW_POST,
    PostTypes.RECEIVED_POST,
    // ... other types as needed
]);

async function processPost(post: Post): Promise<Post> {
    // Your processing logic here
    return post;
}

async function processActionData(action: AnyAction): Promise<void> {
    if (!action.data) return;

    if (action.data.posts) {
        // PostList - multiple posts
        const posts = action.data.posts;
        for (const id in posts) {
            posts[id] = await processPost(posts[id]);
        }
    } else if (action.data.id && action.data.message) {
        // Single post
        action.data = await processPost(action.data);
    }
}

export function createProcessingMiddleware(): Middleware {
    return (store) => (next) => async (action) => {
        // Handle batch actions
        if (BATCH_ACTION_TYPES.has(action.type) && Array.isArray(action.payload)) {
            for (const innerAction of action.payload) {
                if (POST_ACTION_TYPES.has(innerAction.type)) {
                    await processActionData(innerAction);
                }
            }
        }
        // Handle direct post actions
        else if (POST_ACTION_TYPES.has(action.type)) {
            await processActionData(action);
        }

        // IMPORTANT: Only call next() AFTER processing is complete
        return next(action);
    };
}
```

### Registering Middleware

**File:** `webapp/channels/src/store/index.ts`

```typescript
import {createProcessingMiddleware} from './processing_middleware';

// In configureStore:
const store = configureServiceStore({
    appReducers: reducers,
    preloadedState,
    userMiddleware: [createProcessingMiddleware()],
});
```

**File:** `webapp/channels/src/packages/mattermost-redux/src/store/configureStore.ts`

The `configureStore` function accepts `userMiddleware`:

```typescript
export default function configureStore<S extends GlobalState>({
    appReducers,
    preloadedState,
    userMiddleware = [],
}: {
    appReducers: Record<string, Reducer>;
    preloadedState: Partial<S>;
    userMiddleware?: any[];
}): Store {
    const middleware = applyMiddleware(
        thunkWithExtraArgument({loaders: {}}),
        ...userMiddleware,  // Your middleware goes here
    );
    // ...
}
```

## Avoiding Flash of Unprocessed Content

To prevent users from seeing unprocessed content:

1. **Process synchronously when possible** - If you can cache results, check cache first (synchronous) before async processing.

2. **Await before next()** - The middleware must complete processing BEFORE calling `next(action)`.

3. **Handle ALL entry points** - Posts come through multiple batch action types. Missing one causes flash.

4. **Cache sent messages** - For your own sent messages, cache the processed version when sending so it's instantly available when the optimistic post is dispatched.

## Data Structures

### PostList (multiple posts)

```typescript
interface PostList {
    posts: Record<string, Post>;
    order: string[];
    next_post_id?: string;
    prev_post_id?: string;
}
```

Actions with PostList in `action.data`: `RECEIVED_POSTS`, `RECEIVED_POSTS_*`

### Single Post

```typescript
interface Post {
    id: string;
    message: string;
    user_id: string;
    channel_id: string;
    // ... other fields
}
```

Actions with single Post in `action.data`: `RECEIVED_POST`, `RECEIVED_NEW_POST`

## Debugging

Add logging to see all actions:

```typescript
if (action.type && action.type.includes('POST')) {
    console.log('[Middleware] Action:', action.type, action);
}
```

This will show any POST-related actions you might be missing.
