import {Middleware} from 'redux';
import {PostTypes} from 'mattermost-redux/action_types';
import {decryptPostsInList} from 'utils/encryption/decrypt_posts';
import {isEncryptedMessage} from 'utils/encryption/hybrid';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

export function createEncryptionMiddleware(): Middleware {
    return (store) => (next) => async (action) => {
        if (action.type === PostTypes.RECEIVED_POSTS ||
            action.type === PostTypes.RECEIVED_POSTS_SINCE ||
            action.type === PostTypes.RECEIVED_POSTS_BEFORE ||
            action.type === PostTypes.RECEIVED_POSTS_AFTER ||
            action.type === PostTypes.RECEIVED_POSTS_IN_CHANNEL ||
            action.type === PostTypes.RECEIVED_POSTS_IN_THREAD ||
            action.type === PostTypes.RECEIVED_NEW_POST ||
            action.type === PostTypes.RECEIVED_POST
        ) {
            const state = store.getState();
            const userId = getCurrentUserId(state);

            if (action.data) {
                if (action.data.posts) { // PostList
                    const posts = action.data;
                    const postsMap = posts.posts;
                    let hasEncrypted = false;
                    for (const id in postsMap) {
                        if (isEncryptedMessage(postsMap[id].message)) {
                            hasEncrypted = true;
                            break;
                        }
                    }

                    if (hasEncrypted) {
                         try {
                             action.data = await decryptPostsInList(posts, userId);
                         } catch (e) {
                             console.error('Failed to decrypt posts in middleware', e);
                         }
                    }
                } else if (action.data.id && action.data.message) { // Single Post
                    const post = action.data;
                    if (isEncryptedMessage(post.message)) {
                        try {
                            const result = await decryptPostsInList({posts: {[post.id]: post}, order: [post.id]}, userId);
                            action.data = result.posts[post.id];
                        } catch (e) {
                             console.error('Failed to decrypt post in middleware', e);
                        }
                    }
                }
            }
        }
        return next(action);
    };
}
