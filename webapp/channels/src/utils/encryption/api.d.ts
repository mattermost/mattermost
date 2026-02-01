export interface EncryptionPublicKey {
    user_id: string;
    public_key: string;
    create_at?: number;
    update_at?: number;
}
export interface EncryptionStatus {
    enabled: boolean;
    can_encrypt: boolean;
    has_key: boolean;
}
/**
 * Gets the encryption status for the current user.
 */
export declare function getEncryptionStatus(): Promise<EncryptionStatus>;
/**
 * Gets the current user's public encryption key.
 */
export declare function getMyPublicKey(): Promise<EncryptionPublicKey>;
/**
 * Registers or updates the current user's public encryption key.
 * @param publicKey - The public key in JWK format
 */
export declare function registerPublicKey(publicKey: string): Promise<EncryptionPublicKey>;
/**
 * Gets public keys for multiple users.
 * @param userIds - Array of user IDs
 */
export declare function getPublicKeysByUserIds(userIds: string[]): Promise<EncryptionPublicKey[]>;
/**
 * Gets public keys for all members of a channel.
 * @param channelId - The channel ID
 */
export declare function getChannelMemberKeys(channelId: string): Promise<EncryptionPublicKey[]>;
