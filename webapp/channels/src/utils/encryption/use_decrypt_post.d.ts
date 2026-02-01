import type { Post } from '@mattermost/types/posts';
/**
 * Hook that attempts to decrypt an encrypted post on-the-fly.
 * When decryption succeeds, it dispatches an action to update Redux.
 *
 * @param post - The post to potentially decrypt
 * @param userId - The current user's ID
 */
export declare function useDecryptPost(post: Post, userId: string): void;
/**
 * Clears the failed posts cache. Call this when user logs out or
 * re-initializes encryption keys.
 */
export declare function clearDecryptionCache(): void;
