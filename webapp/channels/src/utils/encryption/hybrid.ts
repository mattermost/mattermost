// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Hybrid encryption using RSA-OAEP + AES-GCM.
 * - AES-256-GCM for message encryption (fast, supports large data)
 * - RSA-OAEP for encrypting the AES key per recipient
 */

import {rsaEncrypt, rsaDecrypt, importPublicKey} from './keypair';

const AES_ALGORITHM = 'AES-GCM';
const AES_KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for AES-GCM

export interface EncryptedPayload {
    iv: string; // Base64 encoded 12-byte IV
    ct: string; // Base64 encoded AES ciphertext
    keys: Record<string, string>; // userId -> Base64 RSA-encrypted AES key
    sender: string; // Sender's user ID
    v: number; // Version number
}

/**
 * Generates a random AES-256 key for message encryption.
 */
async function generateAesKey(): Promise<CryptoKey> {
    return crypto.subtle.generateKey(
        {name: AES_ALGORITHM, length: AES_KEY_LENGTH},
        true, // extractable
        ['encrypt', 'decrypt'],
    );
}

/**
 * Generates a random IV for AES-GCM.
 */
function generateIv(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(IV_LENGTH));
}

/**
 * Converts ArrayBuffer to Base64 string.
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Converts Base64 string to ArrayBuffer.
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

/**
 * Encrypts a message for multiple recipients using hybrid encryption.
 * @param message - The plaintext message to encrypt
 * @param recipientKeys - Map of userId -> public key JWK string
 * @param senderId - The sender's user ID
 * @returns The encrypted payload
 */
export async function encryptMessage(
    message: string,
    recipientKeys: Record<string, string>,
    senderId: string,
): Promise<EncryptedPayload> {
    // Generate a random AES key for this message
    const aesKey = await generateAesKey();
    const rawAesKey = await crypto.subtle.exportKey('raw', aesKey);

    // Generate random IV
    const iv = generateIv();

    // Encrypt the message with AES-GCM
    const encoder = new TextEncoder();
    const messageData = encoder.encode(message);
    const encryptedMessage = await crypto.subtle.encrypt(
        {name: AES_ALGORITHM, iv},
        aesKey,
        messageData,
    );

    // Encrypt the AES key for each recipient using their public key
    const encryptedKeys: Record<string, string> = {};
    for (const [userId, publicKeyJwk] of Object.entries(recipientKeys)) {
        try {
            const publicKey = await importPublicKey(publicKeyJwk);
            const encryptedAesKey = await rsaEncrypt(publicKey, rawAesKey);
            encryptedKeys[userId] = arrayBufferToBase64(encryptedAesKey);
        } catch (error) {
            // Skip users whose keys can't be imported
            console.warn(`Failed to encrypt for user ${userId}:`, error);
        }
    }

    return {
        iv: arrayBufferToBase64(iv.buffer),
        ct: arrayBufferToBase64(encryptedMessage),
        keys: encryptedKeys,
        sender: senderId,
        v: 1,
    };
}

/**
 * Decrypts a message using the recipient's private key.
 * @param payload - The encrypted payload
 * @param privateKey - The recipient's private CryptoKey
 * @param userId - The user's ID to find their encrypted key
 * @returns The decrypted plaintext message
 */
export async function decryptMessage(
    payload: EncryptedPayload,
    privateKey: CryptoKey,
    userId: string,
): Promise<string> {
    // Find the encrypted AES key for this user
    const encryptedAesKeyBase64 = payload.keys[userId];
    if (!encryptedAesKeyBase64) {
        throw new Error('No encrypted key found for this user');
    }

    // Decrypt the AES key using RSA
    const encryptedAesKey = base64ToArrayBuffer(encryptedAesKeyBase64);
    const rawAesKey = await rsaDecrypt(privateKey, encryptedAesKey);

    // Import the AES key
    const aesKey = await crypto.subtle.importKey(
        'raw',
        rawAesKey,
        {name: AES_ALGORITHM},
        false,
        ['decrypt'],
    );

    // Decrypt the message using AES-GCM
    const iv = base64ToArrayBuffer(payload.iv);
    const ciphertext = base64ToArrayBuffer(payload.ct);
    const decryptedData = await crypto.subtle.decrypt(
        {name: AES_ALGORITHM, iv},
        aesKey,
        ciphertext,
    );

    // Decode the plaintext
    const decoder = new TextDecoder();
    return decoder.decode(decryptedData);
}

/**
 * Parses an encrypted message string.
 * Format: PENC:v1:{base64_json_payload}
 */
export function parseEncryptedMessage(message: string): EncryptedPayload | null {
    if (!message.startsWith('PENC:v1:')) {
        return null;
    }

    try {
        const base64Payload = message.slice(8);
        const jsonPayload = atob(base64Payload);
        return JSON.parse(jsonPayload);
    } catch {
        return null;
    }
}

/**
 * Formats an encrypted payload into the message format.
 * Format: PENC:v1:{base64_json_payload}
 */
export function formatEncryptedMessage(payload: EncryptedPayload): string {
    const jsonPayload = JSON.stringify(payload);
    const base64Payload = btoa(jsonPayload);
    return `PENC:v1:${base64Payload}`;
}

/**
 * Checks if a message is encrypted.
 */
export function isEncryptedMessage(message: string): boolean {
    return message.startsWith('PENC:v1:');
}
