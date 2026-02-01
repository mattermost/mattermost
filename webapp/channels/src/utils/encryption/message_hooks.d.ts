/**
 * Encryption hooks for message sending and receiving.
 * These integrate with Mattermost's plugin hook system.
 */
import type { Post } from '@mattermost/types/posts';
/**
 * Hook to encrypt a message before it's posted.
 * Called by the MessageWillBePosted hook system.
 */
export declare function encryptMessageHook(post: Post, senderId: string): Promise<{
    post: Post;
} | {
    error: string;
}>;
/**
 * Hook to decrypt a message when it's received.
 * Called by the MessageWillBeReceived hook system.
 */
export declare function decryptMessageHook(post: Post, userId: string): Promise<{
    post: Post;
}>;
/**
 * Checks if a post's encryption could not be decrypted.
 */
export declare function isEncryptionFailed(post: Post): boolean;
/**
 * Gets the encryption status of a post.
 */
export declare function getPostEncryptionStatus(post: Post): 'none' | 'decrypted' | 'no_keys' | 'no_access' | 'decrypt_error';
