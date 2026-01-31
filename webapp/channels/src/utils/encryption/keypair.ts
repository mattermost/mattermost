// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * RSA-OAEP key pair generation and management utilities.
 * Uses Web Crypto API for cryptographic operations.
 */

const RSA_ALGORITHM = {
    name: 'RSA-OAEP',
    modulusLength: 4096,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: 'SHA-256',
};

/**
 * Generates a new RSA-OAEP key pair for encryption.
 * @returns Promise containing the generated CryptoKeyPair
 */
export async function generateKeyPair(): Promise<CryptoKeyPair> {
    return crypto.subtle.generateKey(
        RSA_ALGORITHM,
        true, // extractable
        ['encrypt', 'decrypt'],
    );
}

/**
 * Exports a public key to JWK format for storage/transmission.
 * @param publicKey - The CryptoKey to export
 * @returns Promise containing the JWK string
 */
export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
    const jwk = await crypto.subtle.exportKey('jwk', publicKey);
    return JSON.stringify(jwk);
}

/**
 * Exports a private key to JWK format for storage.
 * @param privateKey - The CryptoKey to export
 * @returns Promise containing the JWK string
 */
export async function exportPrivateKey(privateKey: CryptoKey): Promise<string> {
    const jwk = await crypto.subtle.exportKey('jwk', privateKey);
    return JSON.stringify(jwk);
}

/**
 * Imports a public key from JWK format.
 * @param jwkString - The JWK string to import
 * @returns Promise containing the imported CryptoKey
 */
export async function importPublicKey(jwkString: string): Promise<CryptoKey> {
    const jwk = JSON.parse(jwkString);
    return crypto.subtle.importKey(
        'jwk',
        jwk,
        RSA_ALGORITHM,
        true,
        ['encrypt'],
    );
}

/**
 * Imports a private key from JWK format.
 * @param jwkString - The JWK string to import
 * @returns Promise containing the imported CryptoKey
 */
export async function importPrivateKey(jwkString: string): Promise<CryptoKey> {
    const jwk = JSON.parse(jwkString);
    return crypto.subtle.importKey(
        'jwk',
        jwk,
        RSA_ALGORITHM,
        true,
        ['decrypt'],
    );
}

/**
 * Encrypts data using RSA-OAEP with the given public key.
 * @param publicKey - The public key to encrypt with
 * @param data - The data to encrypt (must be smaller than key size - padding)
 * @returns Promise containing the encrypted data as ArrayBuffer
 */
export async function rsaEncrypt(publicKey: CryptoKey, data: ArrayBuffer): Promise<ArrayBuffer> {
    return crypto.subtle.encrypt(
        {name: 'RSA-OAEP'},
        publicKey,
        data,
    );
}

/**
 * Decrypts data using RSA-OAEP with the given private key.
 * @param privateKey - The private key to decrypt with
 * @param encryptedData - The encrypted data
 * @returns Promise containing the decrypted data as ArrayBuffer
 */
export async function rsaDecrypt(privateKey: CryptoKey, encryptedData: ArrayBuffer): Promise<ArrayBuffer> {
    return crypto.subtle.decrypt(
        {name: 'RSA-OAEP'},
        privateKey,
        encryptedData,
    );
}
