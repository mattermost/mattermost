// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    generateKeyPair,
    exportPublicKey,
    exportPrivateKey,
    importPublicKey,
    importPrivateKey,
    rsaEncrypt,
    rsaDecrypt,
} from './keypair';

describe('RSA Key Pair Utilities', () => {
    // Skip tests if crypto.subtle is not available (older test environments)
    const hasCryptoSubtle = typeof crypto !== 'undefined' && crypto.subtle !== undefined;

    describe('generateKeyPair', () => {
        (hasCryptoSubtle ? test : test.skip)('creates valid 4096-bit RSA key pair', async () => {
            const keyPair = await generateKeyPair();

            expect(keyPair).toBeDefined();
            expect(keyPair.publicKey).toBeDefined();
            expect(keyPair.privateKey).toBeDefined();

            // Check key properties
            expect(keyPair.publicKey.type).toBe('public');
            expect(keyPair.privateKey.type).toBe('private');
            expect(keyPair.publicKey.algorithm.name).toBe('RSA-OAEP');
            expect(keyPair.privateKey.algorithm.name).toBe('RSA-OAEP');

            // Check key usages
            expect(keyPair.publicKey.usages).toContain('encrypt');
            expect(keyPair.privateKey.usages).toContain('decrypt');

            // Verify extractable
            expect(keyPair.publicKey.extractable).toBe(true);
            expect(keyPair.privateKey.extractable).toBe(true);
        });
    });

    describe('exportPublicKey', () => {
        (hasCryptoSubtle ? test : test.skip)('returns JWK format string', async () => {
            const keyPair = await generateKeyPair();
            const publicKeyJwk = await exportPublicKey(keyPair.publicKey);

            expect(typeof publicKeyJwk).toBe('string');

            // Parse and verify JWK structure
            const jwk = JSON.parse(publicKeyJwk);
            expect(jwk.kty).toBe('RSA');
            expect(jwk.alg).toBe('RSA-OAEP-256');
            expect(jwk.n).toBeDefined(); // modulus
            expect(jwk.e).toBeDefined(); // exponent
            expect(jwk.d).toBeUndefined(); // private exponent should not be present
        });
    });

    describe('exportPrivateKey', () => {
        (hasCryptoSubtle ? test : test.skip)('returns JWK format string with private components', async () => {
            const keyPair = await generateKeyPair();
            const privateKeyJwk = await exportPrivateKey(keyPair.privateKey);

            expect(typeof privateKeyJwk).toBe('string');

            // Parse and verify JWK structure
            const jwk = JSON.parse(privateKeyJwk);
            expect(jwk.kty).toBe('RSA');
            expect(jwk.alg).toBe('RSA-OAEP-256');
            expect(jwk.n).toBeDefined(); // modulus
            expect(jwk.e).toBeDefined(); // exponent
            expect(jwk.d).toBeDefined(); // private exponent
            expect(jwk.p).toBeDefined(); // first prime factor
            expect(jwk.q).toBeDefined(); // second prime factor
        });
    });

    describe('importPublicKey', () => {
        (hasCryptoSubtle ? test : test.skip)('loads JWK correctly', async () => {
            const keyPair = await generateKeyPair();
            const publicKeyJwk = await exportPublicKey(keyPair.publicKey);

            const importedKey = await importPublicKey(publicKeyJwk);

            expect(importedKey).toBeDefined();
            expect(importedKey.type).toBe('public');
            expect(importedKey.algorithm.name).toBe('RSA-OAEP');
            expect(importedKey.usages).toContain('encrypt');
        });

        (hasCryptoSubtle ? test : test.skip)('throws error for invalid JWK', async () => {
            await expect(importPublicKey('not valid json')).rejects.toThrow();
            await expect(importPublicKey('{}')).rejects.toThrow();
        });
    });

    describe('importPrivateKey', () => {
        (hasCryptoSubtle ? test : test.skip)('loads JWK correctly', async () => {
            const keyPair = await generateKeyPair();
            const privateKeyJwk = await exportPrivateKey(keyPair.privateKey);

            const importedKey = await importPrivateKey(privateKeyJwk);

            expect(importedKey).toBeDefined();
            expect(importedKey.type).toBe('private');
            expect(importedKey.algorithm.name).toBe('RSA-OAEP');
            expect(importedKey.usages).toContain('decrypt');
        });

        (hasCryptoSubtle ? test : test.skip)('throws error for invalid JWK', async () => {
            await expect(importPrivateKey('invalid')).rejects.toThrow();
        });
    });

    describe('rsaEncrypt/rsaDecrypt round-trip', () => {
        (hasCryptoSubtle ? test : test.skip)('encrypts and decrypts data correctly', async () => {
            const keyPair = await generateKeyPair();
            const testData = new TextEncoder().encode('Hello, World!');

            const encrypted = await rsaEncrypt(keyPair.publicKey, testData);
            expect(encrypted).toBeDefined();
            expect(encrypted instanceof ArrayBuffer).toBe(true);
            expect(encrypted.byteLength).toBeGreaterThan(0);

            const decrypted = await rsaDecrypt(keyPair.privateKey, encrypted);
            expect(decrypted).toBeDefined();

            const decryptedText = new TextDecoder().decode(decrypted);
            expect(decryptedText).toBe('Hello, World!');
        });

        (hasCryptoSubtle ? test : test.skip)('encrypted data differs from plaintext', async () => {
            const keyPair = await generateKeyPair();
            const testData = new TextEncoder().encode('Test message');

            const encrypted = await rsaEncrypt(keyPair.publicKey, testData);

            // Encrypted data should be different from original
            const encryptedBytes = new Uint8Array(encrypted);
            const originalBytes = new Uint8Array(testData);
            expect(encryptedBytes.length).not.toBe(originalBytes.length);
        });

        (hasCryptoSubtle ? test : test.skip)('fails to decrypt with wrong key', async () => {
            const keyPair1 = await generateKeyPair();
            const keyPair2 = await generateKeyPair();
            const testData = new TextEncoder().encode('Secret message');

            const encrypted = await rsaEncrypt(keyPair1.publicKey, testData);

            // Decryption with wrong key should fail
            await expect(rsaDecrypt(keyPair2.privateKey, encrypted)).rejects.toThrow();
        });

        (hasCryptoSubtle ? test : test.skip)('handles empty data', async () => {
            const keyPair = await generateKeyPair();
            const emptyData = new ArrayBuffer(0);

            const encrypted = await rsaEncrypt(keyPair.publicKey, emptyData);
            const decrypted = await rsaDecrypt(keyPair.privateKey, encrypted);

            expect(decrypted.byteLength).toBe(0);
        });

        (hasCryptoSubtle ? test : test.skip)('handles binary data', async () => {
            const keyPair = await generateKeyPair();
            const binaryData = new Uint8Array([0, 1, 2, 255, 254, 253, 128, 127]);

            const encrypted = await rsaEncrypt(keyPair.publicKey, binaryData.buffer);
            const decrypted = await rsaDecrypt(keyPair.privateKey, encrypted);

            const decryptedBytes = new Uint8Array(decrypted);
            expect(decryptedBytes).toEqual(binaryData);
        });
    });

    describe('key export/import round-trip', () => {
        (hasCryptoSubtle ? test : test.skip)('exported and re-imported keys work correctly', async () => {
            const originalKeyPair = await generateKeyPair();
            const testMessage = 'Testing key round-trip';
            const testData = new TextEncoder().encode(testMessage);

            // Export keys
            const publicKeyJwk = await exportPublicKey(originalKeyPair.publicKey);
            const privateKeyJwk = await exportPrivateKey(originalKeyPair.privateKey);

            // Import keys
            const importedPublicKey = await importPublicKey(publicKeyJwk);
            const importedPrivateKey = await importPrivateKey(privateKeyJwk);

            // Encrypt with imported public key
            const encrypted = await rsaEncrypt(importedPublicKey, testData);

            // Decrypt with imported private key
            const decrypted = await rsaDecrypt(importedPrivateKey, encrypted);
            const decryptedText = new TextDecoder().decode(decrypted);

            expect(decryptedText).toBe(testMessage);
        });

        (hasCryptoSubtle ? test : test.skip)('can encrypt with original key and decrypt with imported key', async () => {
            const originalKeyPair = await generateKeyPair();
            const testMessage = 'Cross-key test';
            const testData = new TextEncoder().encode(testMessage);

            // Export and re-import private key
            const privateKeyJwk = await exportPrivateKey(originalKeyPair.privateKey);
            const importedPrivateKey = await importPrivateKey(privateKeyJwk);

            // Encrypt with original public key
            const encrypted = await rsaEncrypt(originalKeyPair.publicKey, testData);

            // Decrypt with imported private key
            const decrypted = await rsaDecrypt(importedPrivateKey, encrypted);
            const decryptedText = new TextDecoder().decode(decrypted);

            expect(decryptedText).toBe(testMessage);
        });
    });
});
