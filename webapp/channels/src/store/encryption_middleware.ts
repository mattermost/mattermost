import type {AnyAction, Middleware} from 'redux';
import {PostTypes} from 'mattermost-redux/action_types';
import {decryptPostsInList} from 'utils/encryption/decrypt_posts';
import {isEncryptedMessage} from 'utils/encryption/hybrid';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

// Queue to serialize async middleware processing
// This prevents interleaved dispatch calls from confusing React-Redux
let processingQueue: Promise<unknown> = Promise.resolve();

// Batch action types - redux-batched-actions uses different type names
const BATCH_ACTION_TYPES = new Set([
    'BATCHING_REDUCER.BATCH',
    'BATCH_CREATE_POST_INIT',  // Optimistic post when sending
    'BATCH_CREATE_POST',       // Server response after sending
    'BATCH_CREATE_POST_FAILED',
]);

const POST_ACTION_TYPES: Set<string> = new Set([
    PostTypes.RECEIVED_POSTS,
    PostTypes.RECEIVED_POSTS_SINCE,
    PostTypes.RECEIVED_POSTS_BEFORE,
    PostTypes.RECEIVED_POSTS_AFTER,
    PostTypes.RECEIVED_POSTS_IN_CHANNEL,
    PostTypes.RECEIVED_POSTS_IN_THREAD,
    PostTypes.RECEIVED_NEW_POST,
    PostTypes.RECEIVED_POST,
]);

async function decryptActionData(action: AnyAction, userId: string): Promise<void> {
    if (!action.data) {
        return;
    }

    if (action.data.posts) {
        // PostList
        const posts = action.data;
        const postsMap = posts.posts;
        let hasEncrypted = false;
        let encryptedCount = 0;
        for (const id in postsMap) {
            if (isEncryptedMessage(postsMap[id].message)) {
                hasEncrypted = true;
                encryptedCount++;
            }
        }
        console.log('[EncryptionMiddleware] PostList - total:', Object.keys(postsMap).length, 'encrypted:', encryptedCount);

        if (hasEncrypted) {
            console.log('[EncryptionMiddleware] Decrypting posts...');
            try {
                action.data = await decryptPostsInList(posts, userId);
                console.log('[EncryptionMiddleware] Decryption complete');
            } catch (e) {
                console.error('[EncryptionMiddleware] Failed to decrypt posts:', e);
            }
        }
    } else if (action.data.id && action.data.message) {
        // Single Post
        const post = action.data;
        const isEncrypted = isEncryptedMessage(post.message);
        console.log('[EncryptionMiddleware] Single post:', post.id, 'encrypted:', isEncrypted);
        if (isEncrypted) {
            console.log('[EncryptionMiddleware] Decrypting single post...');
            try {
                const result = await decryptPostsInList({
                    posts: {[post.id]: post},
                    order: [post.id],
                    next_post_id: '',
                    prev_post_id: '',
                    first_inaccessible_post_time: 0,
                }, userId);
                action.data = result.posts[post.id];
                console.log('[EncryptionMiddleware] Single post decryption complete');
            } catch (e) {
                console.error('[EncryptionMiddleware] Failed to decrypt post:', e);
            }
        }
    }
}

export function createEncryptionMiddleware(): Middleware {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (store) => (next) => (action: any) => {
        const state = store.getState();
        const userId = getCurrentUserId(state);

        // Check if this action needs async processing
        const needsDecryption = checkNeedsDecryption(action);

        if (!needsDecryption) {
            // Fast path: no decryption needed, pass through synchronously
            if (action.type && action.type.includes('POST')) {
                console.log('[EncryptionMiddleware] Pass-through action:', action.type);
            }
            return next(action);
        }

        // Slow path: queue the async decryption to prevent interleaving
        // This ensures only one decryption batch runs at a time
        const processAction = async () => {
            // Handle batch actions - process each action in the payload
            if (BATCH_ACTION_TYPES.has(action.type) && Array.isArray(action.payload)) {
                const actionTypes = action.payload.map((a: AnyAction) => a.type);
                console.log('[EncryptionMiddleware] Processing batch action with', action.payload.length, 'actions:', actionTypes);
                for (const innerAction of action.payload) {
                    if (POST_ACTION_TYPES.has(innerAction.type)) {
                        console.log('[EncryptionMiddleware] Found post action in batch:', innerAction.type);
                        await decryptActionData(innerAction, userId);
                    }
                }
            } else if (POST_ACTION_TYPES.has(action.type)) {
                console.log('[EncryptionMiddleware] Intercepted action:', action.type);
                await decryptActionData(action, userId);
            }

            // Now dispatch to reducers - this is the critical part
            // The action data has been decrypted, so the store update will have plaintext
            return next(action);
        };

        // Chain onto the queue so decryptions don't interleave
        processingQueue = processingQueue.then(processAction, processAction);
        return processingQueue;
    };
}

/**
 * Quick synchronous check if any action in this dispatch needs decryption.
 * This allows non-encrypted actions to pass through without queueing.
 */
function checkNeedsDecryption(action: AnyAction): boolean {
    if (BATCH_ACTION_TYPES.has(action.type) && Array.isArray(action.payload)) {
        for (const innerAction of action.payload as AnyAction[]) {
            if (POST_ACTION_TYPES.has(innerAction.type)) {
                if (hasEncryptedPosts(innerAction)) {
                    return true;
                }
            }
        }
        return false;
    }

    if (POST_ACTION_TYPES.has(action.type)) {
        return hasEncryptedPosts(action);
    }

    return false;
}

/**
 * Check if an action contains encrypted posts.
 */
function hasEncryptedPosts(action: AnyAction): boolean {
    if (!action.data) {
        return false;
    }

    if (action.data.posts) {
        // PostList - check all posts
        for (const id in action.data.posts) {
            if (isEncryptedMessage(action.data.posts[id].message)) {
                return true;
            }
        }
    } else if (action.data.id && action.data.message) {
        // Single post
        return isEncryptedMessage(action.data.message);
    }

    return false;
}
