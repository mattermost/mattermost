import type {AnyAction, Middleware} from 'redux';
import {PostTypes} from 'mattermost-redux/action_types';
import {decryptPostsInList} from 'utils/encryption/decrypt_posts';
import {isEncryptedMessage} from 'utils/encryption/hybrid';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

// Batch action types - redux-batched-actions uses different type names
const BATCH_ACTION_TYPES = new Set([
    'BATCHING_REDUCER.BATCH',
    'BATCH_CREATE_POST_INIT',  // Optimistic post when sending
    'BATCH_CREATE_POST',       // Server response after sending
    'BATCH_CREATE_POST_FAILED',
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
                const result = await decryptPostsInList({posts: {[post.id]: post}, order: [post.id]}, userId);
                action.data = result.posts[post.id];
                console.log('[EncryptionMiddleware] Single post decryption complete');
            } catch (e) {
                console.error('[EncryptionMiddleware] Failed to decrypt post:', e);
            }
        }
    }
}

export function createEncryptionMiddleware(): Middleware {
    return (store) => (next) => async (action) => {
        const state = store.getState();
        const userId = getCurrentUserId(state);

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
        } else {
            // Log all other actions to see what we might be missing
            if (action.type && action.type.includes('POST')) {
                console.log('[EncryptionMiddleware] Unhandled POST action:', action.type);
            }
        }

        return next(action);
    };
}
