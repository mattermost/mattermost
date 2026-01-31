// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Session-based key storage using sessionStorage.
 * Keys are stored only for the current session and cleared on logout/tab close.
 * This provides maximum security - keys never persist to disk.
 */

import {importPrivateKey, importPublicKey, exportPrivateKey, exportPublicKey} from './keypair';

const PRIVATE_KEY_STORAGE_KEY = 'mm_encryption_private_key';
const PUBLIC_KEY_STORAGE_KEY = 'mm_encryption_public_key';

/**
 * Stores the key pair in sessionStorage.
 * @param keyPair - The CryptoKeyPair to store
 */
export async function storeKeyPair(keyPair: CryptoKeyPair): Promise<void> {
    const privateKeyJwk = await exportPrivateKey(keyPair.privateKey);
    const publicKeyJwk = await exportPublicKey(keyPair.publicKey);

    sessionStorage.setItem(PRIVATE_KEY_STORAGE_KEY, privateKeyJwk);
    sessionStorage.setItem(PUBLIC_KEY_STORAGE_KEY, publicKeyJwk);
}

/**
 * Retrieves the private key from sessionStorage.
 * @returns The private CryptoKey or null if not found
 */
export async function getPrivateKey(): Promise<CryptoKey | null> {
    const privateKeyJwk = sessionStorage.getItem(PRIVATE_KEY_STORAGE_KEY);
    if (!privateKeyJwk) {
        return null;
    }

    try {
        return await importPrivateKey(privateKeyJwk);
    } catch {
        return null;
    }
}

/**
 * Retrieves the public key from sessionStorage.
 * @returns The public CryptoKey or null if not found
 */
export async function getPublicKey(): Promise<CryptoKey | null> {
    const publicKeyJwk = sessionStorage.getItem(PUBLIC_KEY_STORAGE_KEY);
    if (!publicKeyJwk) {
        return null;
    }

    try {
        return await importPublicKey(publicKeyJwk);
    } catch {
        return null;
    }
}

/**
 * Retrieves the public key JWK string from sessionStorage.
 * @returns The JWK string or null if not found
 */
export function getPublicKeyJwk(): string | null {
    return sessionStorage.getItem(PUBLIC_KEY_STORAGE_KEY);
}

/**
 * Checks if encryption keys are available in the current session.
 * @returns True if keys are available
 */
export function hasEncryptionKeys(): boolean {
    return sessionStorage.getItem(PRIVATE_KEY_STORAGE_KEY) !== null &&
           sessionStorage.getItem(PUBLIC_KEY_STORAGE_KEY) !== null;
}

/**
 * Clears all encryption keys from sessionStorage.
 * Called on logout or when user explicitly clears keys.
 */
export function clearEncryptionKeys(): void {
    sessionStorage.removeItem(PRIVATE_KEY_STORAGE_KEY);
    sessionStorage.removeItem(PUBLIC_KEY_STORAGE_KEY);
}
