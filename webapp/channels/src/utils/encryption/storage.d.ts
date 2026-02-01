/**
 * Stores the key pair in sessionStorage.
 * @param keyPair - The CryptoKeyPair to store
 */
export declare function storeKeyPair(keyPair: CryptoKeyPair): Promise<void>;
/**
 * Retrieves the private key from sessionStorage.
 * @returns The private CryptoKey or null if not found
 */
export declare function getPrivateKey(): Promise<CryptoKey | null>;
/**
 * Retrieves the public key from sessionStorage.
 * @returns The public CryptoKey or null if not found
 */
export declare function getPublicKey(): Promise<CryptoKey | null>;
/**
 * Retrieves the public key JWK string from sessionStorage.
 * @returns The JWK string or null if not found
 */
export declare function getPublicKeyJwk(): string | null;
/**
 * Checks if encryption keys are available in the current session.
 * @returns True if keys are available
 */
export declare function hasEncryptionKeys(): boolean;
/**
 * Clears all encryption keys from sessionStorage.
 * Called on logout or when user explicitly clears keys.
 */
export declare function clearEncryptionKeys(): void;
