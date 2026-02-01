"use strict";
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
Object.defineProperty(exports, "__esModule", { value: true });
exports.arrayBufferToBase64 = arrayBufferToBase64;
exports.base64ToArrayBuffer = base64ToArrayBuffer;
exports.encryptMessage = encryptMessage;
exports.decryptMessage = decryptMessage;
exports.parseEncryptedMessage = parseEncryptedMessage;
exports.formatEncryptedMessage = formatEncryptedMessage;
exports.isEncryptedMessage = isEncryptedMessage;
/**
 * Hybrid encryption using RSA-OAEP + AES-GCM.
 * - AES-256-GCM for message encryption (fast, supports large data)
 * - RSA-OAEP for encrypting the AES key per recipient
 */
const keypair_1 = require("./keypair");
const AES_ALGORITHM = 'AES-GCM';
const AES_KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for AES-GCM
/**
 * Generates a random AES-256 key for message encryption.
 */
async function generateAesKey() {
    return crypto.subtle.generateKey({ name: AES_ALGORITHM, length: AES_KEY_LENGTH }, true, // extractable
    ['encrypt', 'decrypt']);
}
/**
 * Generates a random IV for AES-GCM.
 */
function generateIv() {
    return crypto.getRandomValues(new Uint8Array(IV_LENGTH));
}
/**
 * Converts ArrayBuffer to Base64 string.
 */
function arrayBufferToBase64(buffer) {
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
function base64ToArrayBuffer(base64) {
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
async function encryptMessage(message, recipientKeys, senderId) {
    // Generate a random AES key for this message
    const aesKey = await generateAesKey();
    const rawAesKey = await crypto.subtle.exportKey('raw', aesKey);
    // Generate random IV
    const iv = generateIv();
    // Encrypt the message with AES-GCM
    const encoder = new TextEncoder();
    const messageData = encoder.encode(message);
    const encryptedMessage = await crypto.subtle.encrypt({ name: AES_ALGORITHM, iv }, aesKey, messageData);
    // Encrypt the AES key for each recipient using their public key
    const encryptedKeys = {};
    for (const [userId, publicKeyJwk] of Object.entries(recipientKeys)) {
        try {
            const publicKey = await (0, keypair_1.importPublicKey)(publicKeyJwk);
            const encryptedAesKey = await (0, keypair_1.rsaEncrypt)(publicKey, rawAesKey);
            encryptedKeys[userId] = arrayBufferToBase64(encryptedAesKey);
        }
        catch (error) {
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
async function decryptMessage(payload, privateKey, userId) {
    // Find the encrypted AES key for this user
    const encryptedAesKeyBase64 = payload.keys[userId];
    if (!encryptedAesKeyBase64) {
        throw new Error('No encrypted key found for this user');
    }
    // Decrypt the AES key using RSA
    const encryptedAesKey = base64ToArrayBuffer(encryptedAesKeyBase64);
    const rawAesKey = await (0, keypair_1.rsaDecrypt)(privateKey, encryptedAesKey);
    // Import the AES key
    const aesKey = await crypto.subtle.importKey('raw', rawAesKey, { name: AES_ALGORITHM }, false, ['decrypt']);
    // Decrypt the message using AES-GCM
    const iv = base64ToArrayBuffer(payload.iv);
    const ciphertext = base64ToArrayBuffer(payload.ct);
    const decryptedData = await crypto.subtle.decrypt({ name: AES_ALGORITHM, iv }, aesKey, ciphertext);
    // Decode the plaintext
    const decoder = new TextDecoder();
    return decoder.decode(decryptedData);
}
/**
 * Parses an encrypted message string.
 * Format: PENC:v1:{base64_json_payload}
 */
function parseEncryptedMessage(message) {
    if (!message.startsWith('PENC:v1:')) {
        return null;
    }
    try {
        const base64Payload = message.slice(8);
        const jsonPayload = atob(base64Payload);
        return JSON.parse(jsonPayload);
    }
    catch {
        return null;
    }
}
/**
 * Formats an encrypted payload into the message format.
 * Format: PENC:v1:{base64_json_payload}
 */
function formatEncryptedMessage(payload) {
    const jsonPayload = JSON.stringify(payload);
    const base64Payload = btoa(jsonPayload);
    return `PENC:v1:${base64Payload}`;
}
/**
 * Checks if a message is encrypted.
 */
function isEncryptedMessage(message) {
    return message.startsWith('PENC:v1:');
}
