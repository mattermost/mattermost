export interface EncryptedPayload {
    iv: string;
    ct: string;
    keys: Record<string, string>;
    sender: string;
    v: number;
}
/**
 * Converts ArrayBuffer to Base64 string.
 */
export declare function arrayBufferToBase64(buffer: ArrayBuffer): string;
/**
 * Converts Base64 string to ArrayBuffer.
 */
export declare function base64ToArrayBuffer(base64: string): ArrayBuffer;
/**
 * Encrypts a message for multiple recipients using hybrid encryption.
 * @param message - The plaintext message to encrypt
 * @param recipientKeys - Map of userId -> public key JWK string
 * @param senderId - The sender's user ID
 * @returns The encrypted payload
 */
export declare function encryptMessage(message: string, recipientKeys: Record<string, string>, senderId: string): Promise<EncryptedPayload>;
/**
 * Decrypts a message using the recipient's private key.
 * @param payload - The encrypted payload
 * @param privateKey - The recipient's private CryptoKey
 * @param userId - The user's ID to find their encrypted key
 * @returns The decrypted plaintext message
 */
export declare function decryptMessage(payload: EncryptedPayload, privateKey: CryptoKey, userId: string): Promise<string>;
/**
 * Parses an encrypted message string.
 * Format: PENC:v1:{base64_json_payload}
 */
export declare function parseEncryptedMessage(message: string): EncryptedPayload | null;
/**
 * Formats an encrypted payload into the message format.
 * Format: PENC:v1:{base64_json_payload}
 */
export declare function formatEncryptedMessage(payload: EncryptedPayload): string;
/**
 * Checks if a message is encrypted.
 */
export declare function isEncryptedMessage(message: string): boolean;
