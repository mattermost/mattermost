// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {generateKeyPair, exportPublicKey, importPrivateKey, exportPrivateKey} from './keypair';
import {
    encryptMessage,
    decryptMessage,
    parseEncryptedMessage,
    formatEncryptedMessage,
    isEncryptedMessage,
    arrayBufferToBase64,
    base64ToArrayBuffer,
    type EncryptedPayload,
    type SessionKey,
} from './hybrid';

describe('Hybrid Encryption Utilities', () => {
    // Skip tests if crypto.subtle is not available
    const hasCryptoSubtle = typeof crypto !== 'undefined' && crypto.subtle !== undefined;

    describe('arrayBufferToBase64', () => {
        test('converts ArrayBuffer to Base64 string', () => {
            const data = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
            const base64 = arrayBufferToBase64(data.buffer);
            expect(base64).toBe('SGVsbG8=');
        });

        test('handles empty buffer', () => {
            const data = new Uint8Array([]);
            const base64 = arrayBufferToBase64(data.buffer);
            expect(base64).toBe('');
        });

        test('handles binary data with all byte values', () => {
            const data = new Uint8Array([0, 127, 128, 255]);
            const base64 = arrayBufferToBase64(data.buffer);
            expect(typeof base64).toBe('string');
            expect(base64.length).toBeGreaterThan(0);
        });
    });

    describe('base64ToArrayBuffer', () => {
        test('converts Base64 string to ArrayBuffer', () => {
            const base64 = 'SGVsbG8='; // "Hello"
            const buffer = base64ToArrayBuffer(base64);
            const bytes = new Uint8Array(buffer);
            expect(bytes).toEqual(new Uint8Array([72, 101, 108, 108, 111]));
        });

        test('handles empty string', () => {
            const buffer = base64ToArrayBuffer('');
            expect(buffer.byteLength).toBe(0);
        });

        test('round-trip with arrayBufferToBase64', () => {
            const original = new Uint8Array([1, 2, 3, 4, 5, 255, 0, 128]);
            const base64 = arrayBufferToBase64(original.buffer);
            const restored = new Uint8Array(base64ToArrayBuffer(base64));
            expect(restored).toEqual(original);
        });
    });

    describe('isEncryptedMessage', () => {
        test('detects PENC format', () => {
            expect(isEncryptedMessage('PENC:v1:somepayload')).toBe(true);
            expect(isEncryptedMessage('PENC:v1:')).toBe(true);
        });

        test('returns false for non-encrypted messages', () => {
            expect(isEncryptedMessage('Hello world')).toBe(false);
            expect(isEncryptedMessage('')).toBe(false);
            expect(isEncryptedMessage('PENC:v2:wrong version')).toBe(false);
            expect(isEncryptedMessage('penc:v1:lowercase')).toBe(false);
        });
    });

    describe('parseEncryptedMessage', () => {
        test('extracts payload from PENC format', () => {
            const payload: EncryptedPayload = {
                iv: 'dGVzdGl2MTIzNDU2',
                ct: 'Y2lwaGVydGV4dA==',
                keys: {session1: 'encryptedkey1'},
                sender: 'user123',
                v: 1,
            };
            const formatted = formatEncryptedMessage(payload);
            const parsed = parseEncryptedMessage(formatted);

            expect(parsed).not.toBeNull();
            expect(parsed?.iv).toBe(payload.iv);
            expect(parsed?.ct).toBe(payload.ct);
            expect(parsed?.keys).toEqual(payload.keys);
            expect(parsed?.sender).toBe(payload.sender);
            expect(parsed?.v).toBe(1);
        });

        test('returns null for non-encrypted messages', () => {
            expect(parseEncryptedMessage('Hello world')).toBeNull();
            expect(parseEncryptedMessage('')).toBeNull();
        });

        test('returns null for invalid base64 payload', () => {
            expect(parseEncryptedMessage('PENC:v1:not-valid-base64!!!')).toBeNull();
        });

        test('returns null for invalid JSON in payload', () => {
            const invalidJson = btoa('not valid json');
            expect(parseEncryptedMessage(`PENC:v1:${invalidJson}`)).toBeNull();
        });
    });

    describe('formatEncryptedMessage', () => {
        test('creates correct PENC format', () => {
            const payload: EncryptedPayload = {
                iv: 'testiv',
                ct: 'testciphertext',
                keys: {session1: 'key1'},
                sender: 'sender123',
                v: 1,
            };

            const formatted = formatEncryptedMessage(payload);

            expect(formatted.startsWith('PENC:v1:')).toBe(true);
            expect(isEncryptedMessage(formatted)).toBe(true);

            // Verify round-trip
            const parsed = parseEncryptedMessage(formatted);
            expect(parsed).toEqual(payload);
        });

        test('handles multiple session keys', () => {
            const payload: EncryptedPayload = {
                iv: 'testiv',
                ct: 'testct',
                keys: {
                    session1: 'key1',
                    session2: 'key2',
                    session3: 'key3',
                },
                sender: 'user1',
                v: 1,
            };

            const formatted = formatEncryptedMessage(payload);
            const parsed = parseEncryptedMessage(formatted);

            expect(Object.keys(parsed?.keys || {}).length).toBe(3);
            expect(parsed?.keys.session1).toBe('key1');
            expect(parsed?.keys.session2).toBe('key2');
            expect(parsed?.keys.session3).toBe('key3');
        });
    });

    describe('encryptMessage', () => {
        (hasCryptoSubtle ? test : test.skip)('produces PENC format payload', async () => {
            const keyPair = await generateKeyPair();
            const publicKeyJwk = await exportPublicKey(keyPair.publicKey);
            const sessionKeys: SessionKey[] = [{
                sessionId: 'test-session',
                publicKey: publicKeyJwk,
            }];

            const payload = await encryptMessage('Hello, World!', sessionKeys, 'sender-user');

            expect(payload.v).toBe(1);
            expect(payload.sender).toBe('sender-user');
            expect(payload.iv).toBeDefined();
            expect(payload.ct).toBeDefined();
            expect(payload.keys['test-session']).toBeDefined();
        });

        (hasCryptoSubtle ? test : test.skip)('encrypts for multiple recipients', async () => {
            const keyPair1 = await generateKeyPair();
            const keyPair2 = await generateKeyPair();
            const publicKey1 = await exportPublicKey(keyPair1.publicKey);
            const publicKey2 = await exportPublicKey(keyPair2.publicKey);

            const sessionKeys: SessionKey[] = [
                {sessionId: 'session1', publicKey: publicKey1},
                {sessionId: 'session2', publicKey: publicKey2},
            ];

            const payload = await encryptMessage('Multi-recipient test', sessionKeys, 'sender');

            expect(Object.keys(payload.keys).length).toBe(2);
            expect(payload.keys.session1).toBeDefined();
            expect(payload.keys.session2).toBeDefined();
            // Each key should be different (encrypted with different public keys)
            expect(payload.keys.session1).not.toBe(payload.keys.session2);
        });

        (hasCryptoSubtle ? test : test.skip)('produces different ciphertext for same message', async () => {
            const keyPair = await generateKeyPair();
            const publicKeyJwk = await exportPublicKey(keyPair.publicKey);
            const sessionKeys: SessionKey[] = [{
                sessionId: 'session',
                publicKey: publicKeyJwk,
            }];

            const payload1 = await encryptMessage('Same message', sessionKeys, 'sender');
            const payload2 = await encryptMessage('Same message', sessionKeys, 'sender');

            // IV should be different each time
            expect(payload1.iv).not.toBe(payload2.iv);
            // Ciphertext should be different due to different IV
            expect(payload1.ct).not.toBe(payload2.ct);
        });

        (hasCryptoSubtle ? test : test.skip)('handles empty message', async () => {
            const keyPair = await generateKeyPair();
            const publicKeyJwk = await exportPublicKey(keyPair.publicKey);
            const sessionKeys: SessionKey[] = [{
                sessionId: 'session',
                publicKey: publicKeyJwk,
            }];

            const payload = await encryptMessage('', sessionKeys, 'sender');

            expect(payload.ct).toBeDefined();
            expect(payload.iv).toBeDefined();
        });

        (hasCryptoSubtle ? test : test.skip)('skips sessions with invalid public keys', async () => {
            const validKeyPair = await generateKeyPair();
            const validPublicKey = await exportPublicKey(validKeyPair.publicKey);

            const sessionKeys: SessionKey[] = [
                {sessionId: 'valid-session', publicKey: validPublicKey},
                {sessionId: 'invalid-session', publicKey: 'not a valid key'},
            ];

            // Should not throw, just skip the invalid session
            const payload = await encryptMessage('Test message', sessionKeys, 'sender');

            expect(payload.keys['valid-session']).toBeDefined();
            expect(payload.keys['invalid-session']).toBeUndefined();
        });
    });

    describe('decryptMessage', () => {
        (hasCryptoSubtle ? test : test.skip)('recovers original text', async () => {
            const keyPair = await generateKeyPair();
            const publicKeyJwk = await exportPublicKey(keyPair.publicKey);
            const sessionKeys: SessionKey[] = [{
                sessionId: 'my-session',
                publicKey: publicKeyJwk,
            }];

            const originalMessage = 'Hello, this is a secret message!';
            const payload = await encryptMessage(originalMessage, sessionKeys, 'sender');
            const decrypted = await decryptMessage(payload, keyPair.privateKey, 'my-session');

            expect(decrypted).toBe(originalMessage);
        });

        (hasCryptoSubtle ? test : test.skip)('each recipient can decrypt with their key', async () => {
            const keyPair1 = await generateKeyPair();
            const keyPair2 = await generateKeyPair();
            const publicKey1 = await exportPublicKey(keyPair1.publicKey);
            const publicKey2 = await exportPublicKey(keyPair2.publicKey);

            const sessionKeys: SessionKey[] = [
                {sessionId: 'session1', publicKey: publicKey1},
                {sessionId: 'session2', publicKey: publicKey2},
            ];

            const message = 'Multi-recipient decryption test';
            const payload = await encryptMessage(message, sessionKeys, 'sender');

            // Both recipients should be able to decrypt
            const decrypted1 = await decryptMessage(payload, keyPair1.privateKey, 'session1');
            const decrypted2 = await decryptMessage(payload, keyPair2.privateKey, 'session2');

            expect(decrypted1).toBe(message);
            expect(decrypted2).toBe(message);
        });

        (hasCryptoSubtle ? test : test.skip)('throws error when session key not found', async () => {
            const keyPair = await generateKeyPair();
            const publicKeyJwk = await exportPublicKey(keyPair.publicKey);
            const sessionKeys: SessionKey[] = [{
                sessionId: 'existing-session',
                publicKey: publicKeyJwk,
            }];

            const payload = await encryptMessage('Test', sessionKeys, 'sender');

            await expect(
                decryptMessage(payload, keyPair.privateKey, 'non-existent-session'),
            ).rejects.toThrow('No encrypted key found for this session');
        });

        (hasCryptoSubtle ? test : test.skip)('fails with wrong private key', async () => {
            const encryptKeyPair = await generateKeyPair();
            const wrongKeyPair = await generateKeyPair();
            const publicKeyJwk = await exportPublicKey(encryptKeyPair.publicKey);

            const sessionKeys: SessionKey[] = [{
                sessionId: 'session',
                publicKey: publicKeyJwk,
            }];

            const payload = await encryptMessage('Secret', sessionKeys, 'sender');

            // Decryption with wrong key should fail
            await expect(
                decryptMessage(payload, wrongKeyPair.privateKey, 'session'),
            ).rejects.toThrow();
        });

        (hasCryptoSubtle ? test : test.skip)('handles unicode characters', async () => {
            const keyPair = await generateKeyPair();
            const publicKeyJwk = await exportPublicKey(keyPair.publicKey);
            const sessionKeys: SessionKey[] = [{
                sessionId: 'session',
                publicKey: publicKeyJwk,
            }];

            const unicodeMessage = '你好世界 🌍 Привет мир 日本語';
            const payload = await encryptMessage(unicodeMessage, sessionKeys, 'sender');
            const decrypted = await decryptMessage(payload, keyPair.privateKey, 'session');

            expect(decrypted).toBe(unicodeMessage);
        });

        (hasCryptoSubtle ? test : test.skip)('handles long messages', async () => {
            const keyPair = await generateKeyPair();
            const publicKeyJwk = await exportPublicKey(keyPair.publicKey);
            const sessionKeys: SessionKey[] = [{
                sessionId: 'session',
                publicKey: publicKeyJwk,
            }];

            // Create a long message (10KB)
            const longMessage = 'x'.repeat(10000);
            const payload = await encryptMessage(longMessage, sessionKeys, 'sender');
            const decrypted = await decryptMessage(payload, keyPair.privateKey, 'session');

            expect(decrypted).toBe(longMessage);
        });
    });

    describe('full encryption round-trip with key persistence', () => {
        (hasCryptoSubtle ? test : test.skip)('works with exported and re-imported keys', async () => {
            // Simulate storing keys
            const keyPair = await generateKeyPair();
            const publicKeyJwk = await exportPublicKey(keyPair.publicKey);
            const privateKeyJwk = await exportPrivateKey(keyPair.privateKey);

            // Encrypt with public key
            const sessionKeys: SessionKey[] = [{
                sessionId: 'stored-session',
                publicKey: publicKeyJwk,
            }];
            const message = 'Persistent key test';
            const payload = await encryptMessage(message, sessionKeys, 'sender');

            // Simulate loading keys from storage
            const loadedPrivateKey = await importPrivateKey(privateKeyJwk);

            // Decrypt with loaded private key
            const decrypted = await decryptMessage(payload, loadedPrivateKey, 'stored-session');

            expect(decrypted).toBe(message);
        });
    });
});
