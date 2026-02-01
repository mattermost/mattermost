import type { EncryptionStatus, EncryptionPublicKey } from './api';
/**
 * Ensures encryption keys are available for the current session.
 * If no keys exist, generates them and registers the public key with the server.
 * This is called automatically on first encrypted message send.
 */
export declare function ensureEncryptionKeys(): Promise<void>;
/**
 * Gets the encryption status from the server.
 */
export declare function checkEncryptionStatus(): Promise<EncryptionStatus>;
/**
 * Gets the current session's public key JWK, initializing if necessary.
 */
export declare function getCurrentPublicKey(): Promise<string | null>;
/**
 * Gets the current session's private key for decryption.
 */
export declare function getCurrentPrivateKey(): Promise<CryptoKey | null>;
/**
 * Checks if the current session has encryption keys initialized.
 */
export declare function isEncryptionInitialized(): boolean;
/**
 * Clears encryption keys and decryption cache (called on logout).
 */
export declare function clearEncryptionSession(): void;
/**
 * Gets public keys for all channel members who have active encryption sessions.
 * @param channelId - The channel ID
 * @returns Map of userId -> public key JWK
 */
export declare function getChannelRecipientKeys(channelId: string): Promise<Record<string, string>>;
/**
 * Gets information about which channel members can receive encrypted messages.
 * @param channelId - The channel ID
 * @param currentUserId - The current user's ID (to exclude from list)
 * @returns Object with recipients array and users without keys
 */
export declare function getChannelEncryptionInfo(channelId: string, currentUserId: string): Promise<{
    recipients: EncryptionPublicKey[];
    usersWithoutKeys: string[];
}>;
