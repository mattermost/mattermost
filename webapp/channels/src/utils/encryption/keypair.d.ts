/**
 * Generates a new RSA-OAEP key pair for encryption.
 * @returns Promise containing the generated CryptoKeyPair
 */
export declare function generateKeyPair(): Promise<CryptoKeyPair>;
/**
 * Exports a public key to JWK format for storage/transmission.
 * @param publicKey - The CryptoKey to export
 * @returns Promise containing the JWK string
 */
export declare function exportPublicKey(publicKey: CryptoKey): Promise<string>;
/**
 * Exports a private key to JWK format for storage.
 * @param privateKey - The CryptoKey to export
 * @returns Promise containing the JWK string
 */
export declare function exportPrivateKey(privateKey: CryptoKey): Promise<string>;
/**
 * Imports a public key from JWK format.
 * @param jwkString - The JWK string to import
 * @returns Promise containing the imported CryptoKey
 */
export declare function importPublicKey(jwkString: string): Promise<CryptoKey>;
/**
 * Imports a private key from JWK format.
 * @param jwkString - The JWK string to import
 * @returns Promise containing the imported CryptoKey
 */
export declare function importPrivateKey(jwkString: string): Promise<CryptoKey>;
/**
 * Encrypts data using RSA-OAEP with the given public key.
 * @param publicKey - The public key to encrypt with
 * @param data - The data to encrypt (must be smaller than key size - padding)
 * @returns Promise containing the encrypted data as ArrayBuffer
 */
export declare function rsaEncrypt(publicKey: CryptoKey, data: ArrayBuffer): Promise<ArrayBuffer>;
/**
 * Decrypts data using RSA-OAEP with the given private key.
 * @param privateKey - The private key to decrypt with
 * @param encryptedData - The encrypted data
 * @returns Promise containing the decrypted data as ArrayBuffer
 */
export declare function rsaDecrypt(privateKey: CryptoKey, encryptedData: ArrayBuffer): Promise<ArrayBuffer>;
