/**
 * Utility to decrypt posts in a PostList before they enter Redux.
 * This ensures posts are decrypted on first render, not patched after.
 */
import type { Post, PostList } from '@mattermost/types/posts';
/**
 * Decrypts all encrypted posts in a PostList.
 * Returns a new PostList with decrypted messages.
 */
export declare function decryptPostsInList(posts: PostList, userId: string): Promise<PostList>;
/**
 * Decrypts a single post if it's encrypted.
 */
export declare function decryptPost(post: Post, userId: string): Promise<Post>;
