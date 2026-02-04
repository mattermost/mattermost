// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {generateKeyPair} from './keypair';
import {
    storeKeyPair,
    getPublicKeyJwk,
    getPrivateKey,
    getPublicKey,
    clearEncryptionKeys,
    clearAllEncryptionKeys,
    hasEncryptionKeys,
    storeSessionId,
    getSessionId,
    migrateFromV1,
    cleanupStaleKeys,
    getAllStoredSessionIds,
} from './storage';

describe('Encryption Key Storage', () => {
    // Skip tests if crypto.subtle is not available
    const hasCryptoSubtle = typeof crypto !== 'undefined' && crypto.subtle !== undefined;

    beforeEach(() => {
        // Clear storage before each test
        localStorage.clear();
        sessionStorage.clear();
    });

    afterEach(() => {
        // Clean up after each test
        localStorage.clear();
        sessionStorage.clear();
    });

    describe('storeSessionId / getSessionId', () => {
        test('stores session ID in sessionStorage', () => {
            storeSessionId('test-session-123');
            expect(getSessionId()).toBe('test-session-123');
        });

        test('returns null when no session stored', () => {
            expect(getSessionId()).toBeNull();
        });

        test('overwrites existing session ID', () => {
            storeSessionId('old-session');
            storeSessionId('new-session');
            expect(getSessionId()).toBe('new-session');
        });
    });

    describe('storeKeyPair', () => {
        (hasCryptoSubtle ? test : test.skip)('saves to localStorage with session namespace', async () => {
            const keyPair = await generateKeyPair();
            const sessionId = 'test-session';

            await storeKeyPair(sessionId, keyPair);

            // Check localStorage keys exist
            expect(localStorage.getItem(`mm_encryption_${sessionId}_private`)).not.toBeNull();
            expect(localStorage.getItem(`mm_encryption_${sessionId}_public`)).not.toBeNull();
            expect(localStorage.getItem(`mm_encryption_${sessionId}_meta`)).not.toBeNull();
        });

        (hasCryptoSubtle ? test : test.skip)('also stores session ID reference', async () => {
            const keyPair = await generateKeyPair();
            const sessionId = 'my-session';

            await storeKeyPair(sessionId, keyPair);

            expect(getSessionId()).toBe(sessionId);
        });

        (hasCryptoSubtle ? test : test.skip)('stores metadata with timestamp', async () => {
            const keyPair = await generateKeyPair();
            const sessionId = 'meta-test';

            const before = Date.now();
            await storeKeyPair(sessionId, keyPair);
            const after = Date.now();

            const metaJson = localStorage.getItem(`mm_encryption_${sessionId}_meta`);
            expect(metaJson).not.toBeNull();

            const meta = JSON.parse(metaJson!);
            expect(meta.sessionId).toBe(sessionId);
            expect(meta.createdAt).toBeGreaterThanOrEqual(before);
            expect(meta.createdAt).toBeLessThanOrEqual(after);
        });
    });

    describe('getPublicKeyJwk', () => {
        (hasCryptoSubtle ? test : test.skip)('retrieves public key for session', async () => {
            const keyPair = await generateKeyPair();
            const sessionId = 'jwk-test';

            await storeKeyPair(sessionId, keyPair);

            const jwk = getPublicKeyJwk(sessionId);
            expect(jwk).not.toBeNull();

            const parsed = JSON.parse(jwk!);
            expect(parsed.kty).toBe('RSA');
        });

        (hasCryptoSubtle ? test : test.skip)('uses current session when no sessionId provided', async () => {
            const keyPair = await generateKeyPair();
            const sessionId = 'current-session';

            await storeKeyPair(sessionId, keyPair);

            // getPublicKeyJwk should use the stored session reference
            const jwk = getPublicKeyJwk();
            expect(jwk).not.toBeNull();
        });

        test('returns null when no session set', () => {
            expect(getPublicKeyJwk()).toBeNull();
        });

        test('returns null for non-existent session', () => {
            storeSessionId('some-session');
            expect(getPublicKeyJwk('other-session')).toBeNull();
        });
    });

    describe('getPrivateKey', () => {
        (hasCryptoSubtle ? test : test.skip)('retrieves private key as CryptoKey', async () => {
            const keyPair = await generateKeyPair();
            const sessionId = 'private-key-test';

            await storeKeyPair(sessionId, keyPair);

            const privateKey = await getPrivateKey(sessionId);
            expect(privateKey).not.toBeNull();
            expect(privateKey?.type).toBe('private');
            expect(privateKey?.algorithm.name).toBe('RSA-OAEP');
        });

        (hasCryptoSubtle ? test : test.skip)('uses current session when no sessionId provided', async () => {
            const keyPair = await generateKeyPair();
            const sessionId = 'default-session';

            await storeKeyPair(sessionId, keyPair);

            const privateKey = await getPrivateKey();
            expect(privateKey).not.toBeNull();
        });

        test('returns null when no session set', async () => {
            const result = await getPrivateKey();
            expect(result).toBeNull();
        });

        test('returns null for non-existent session', async () => {
            storeSessionId('some-session');
            const result = await getPrivateKey('missing-session');
            expect(result).toBeNull();
        });
    });

    describe('getPublicKey', () => {
        (hasCryptoSubtle ? test : test.skip)('retrieves public key as CryptoKey', async () => {
            const keyPair = await generateKeyPair();
            const sessionId = 'public-key-test';

            await storeKeyPair(sessionId, keyPair);

            const publicKey = await getPublicKey(sessionId);
            expect(publicKey).not.toBeNull();
            expect(publicKey?.type).toBe('public');
            expect(publicKey?.algorithm.name).toBe('RSA-OAEP');
        });
    });

    describe('hasEncryptionKeys', () => {
        (hasCryptoSubtle ? test : test.skip)('returns true when keys exist', async () => {
            const keyPair = await generateKeyPair();
            const sessionId = 'has-keys-test';

            await storeKeyPair(sessionId, keyPair);

            expect(hasEncryptionKeys(sessionId)).toBe(true);
        });

        test('returns false when no keys', () => {
            storeSessionId('empty-session');
            expect(hasEncryptionKeys('empty-session')).toBe(false);
        });

        test('returns false when no session set', () => {
            expect(hasEncryptionKeys()).toBe(false);
        });

        (hasCryptoSubtle ? test : test.skip)('returns false when only partial keys exist', async () => {
            const sessionId = 'partial-session';
            localStorage.setItem(`mm_encryption_${sessionId}_public`, 'some-key');
            // Missing private key
            storeSessionId(sessionId);

            expect(hasEncryptionKeys(sessionId)).toBe(false);
        });
    });

    describe('clearEncryptionKeys', () => {
        (hasCryptoSubtle ? test : test.skip)('removes keys for specific session', async () => {
            const keyPair = await generateKeyPair();
            const sessionId = 'clear-test';

            await storeKeyPair(sessionId, keyPair);
            expect(hasEncryptionKeys(sessionId)).toBe(true);

            clearEncryptionKeys(sessionId);

            expect(hasEncryptionKeys(sessionId)).toBe(false);
            expect(localStorage.getItem(`mm_encryption_${sessionId}_private`)).toBeNull();
            expect(localStorage.getItem(`mm_encryption_${sessionId}_public`)).toBeNull();
            expect(localStorage.getItem(`mm_encryption_${sessionId}_meta`)).toBeNull();
        });

        (hasCryptoSubtle ? test : test.skip)('clears current session reference when clearing current session', async () => {
            const keyPair = await generateKeyPair();
            const sessionId = 'current-clear';

            await storeKeyPair(sessionId, keyPair);
            expect(getSessionId()).toBe(sessionId);

            clearEncryptionKeys(sessionId);

            expect(getSessionId()).toBeNull();
        });

        (hasCryptoSubtle ? test : test.skip)('does not clear other session references', async () => {
            const keyPair1 = await generateKeyPair();
            const keyPair2 = await generateKeyPair();

            await storeKeyPair('session1', keyPair1);
            await storeKeyPair('session2', keyPair2);

            // Current session is session2
            expect(getSessionId()).toBe('session2');

            // Clear session1 (not current)
            clearEncryptionKeys('session1');

            // Session2 should still be the current session
            expect(getSessionId()).toBe('session2');
            expect(hasEncryptionKeys('session2')).toBe(true);
        });
    });

    describe('clearAllEncryptionKeys', () => {
        (hasCryptoSubtle ? test : test.skip)('removes ALL encryption keys from localStorage', async () => {
            const keyPair1 = await generateKeyPair();
            const keyPair2 = await generateKeyPair();

            await storeKeyPair('session1', keyPair1);
            await storeKeyPair('session2', keyPair2);

            // Also store some non-encryption data
            localStorage.setItem('other_data', 'should remain');

            clearAllEncryptionKeys();

            expect(hasEncryptionKeys('session1')).toBe(false);
            expect(hasEncryptionKeys('session2')).toBe(false);
            expect(getSessionId()).toBeNull();

            // Non-encryption data should remain
            expect(localStorage.getItem('other_data')).toBe('should remain');
        });
    });

    describe('migrateFromV1', () => {
        test('returns false when no v1 keys found', () => {
            expect(migrateFromV1()).toBe(false);
        });

        test('migrates v1 keys to v2 format', () => {
            // Set up v1 format keys
            const v1PrivateKey = '{"kty":"RSA","d":"test-private"}';
            const v1PublicKey = '{"kty":"RSA","n":"test-public"}';
            const v1SessionId = 'legacy-session';

            sessionStorage.setItem('mm_encryption_private_key', v1PrivateKey);
            sessionStorage.setItem('mm_encryption_public_key', v1PublicKey);
            sessionStorage.setItem('mm_encryption_session_id', v1SessionId);

            const migrated = migrateFromV1();

            expect(migrated).toBe(true);

            // Check v2 format keys exist
            expect(localStorage.getItem(`mm_encryption_${v1SessionId}_private`)).toBe(v1PrivateKey);
            expect(localStorage.getItem(`mm_encryption_${v1SessionId}_public`)).toBe(v1PublicKey);

            // Check metadata
            const meta = JSON.parse(localStorage.getItem(`mm_encryption_${v1SessionId}_meta`)!);
            expect(meta.sessionId).toBe(v1SessionId);
            expect(meta.migratedFromV1).toBe(true);

            // Check v1 keys are cleared
            expect(sessionStorage.getItem('mm_encryption_private_key')).toBeNull();
            expect(sessionStorage.getItem('mm_encryption_public_key')).toBeNull();
            expect(sessionStorage.getItem('mm_encryption_session_id')).toBeNull();

            // Check session reference is set
            expect(getSessionId()).toBe(v1SessionId);
        });

        test('does not migrate if any v1 key is missing', () => {
            // Only private key (missing public and session)
            sessionStorage.setItem('mm_encryption_private_key', '{"kty":"RSA"}');

            expect(migrateFromV1()).toBe(false);
            expect(localStorage.length).toBe(0);
        });
    });

    describe('cleanupStaleKeys', () => {
        (hasCryptoSubtle ? test : test.skip)('removes keys older than maxAge', async () => {
            const keyPair = await generateKeyPair();
            const sessionId = 'old-session';

            await storeKeyPair(sessionId, keyPair);

            // Manually set old timestamp
            const meta = JSON.parse(localStorage.getItem(`mm_encryption_${sessionId}_meta`)!);
            meta.createdAt = Date.now() - (31 * 24 * 60 * 60 * 1000); // 31 days ago
            localStorage.setItem(`mm_encryption_${sessionId}_meta`, JSON.stringify(meta));

            // Clear session reference so it's not "current"
            sessionStorage.removeItem('mm_encryption_current_session_id');

            cleanupStaleKeys();

            expect(hasEncryptionKeys(sessionId)).toBe(false);
        });

        (hasCryptoSubtle ? test : test.skip)('does NOT remove current session keys', async () => {
            const keyPair = await generateKeyPair();
            const sessionId = 'current-old-session';

            await storeKeyPair(sessionId, keyPair);

            // Manually set old timestamp
            const meta = JSON.parse(localStorage.getItem(`mm_encryption_${sessionId}_meta`)!);
            meta.createdAt = Date.now() - (31 * 24 * 60 * 60 * 1000); // 31 days ago
            localStorage.setItem(`mm_encryption_${sessionId}_meta`, JSON.stringify(meta));

            // Keep as current session
            storeSessionId(sessionId);

            cleanupStaleKeys();

            // Should NOT be cleaned because it's the current session
            expect(hasEncryptionKeys(sessionId)).toBe(true);
        });

        (hasCryptoSubtle ? test : test.skip)('respects custom maxAge parameter', async () => {
            const keyPair = await generateKeyPair();
            const sessionId = 'custom-age-session';

            await storeKeyPair(sessionId, keyPair);

            // Set timestamp to 1 hour ago
            const meta = JSON.parse(localStorage.getItem(`mm_encryption_${sessionId}_meta`)!);
            meta.createdAt = Date.now() - (60 * 60 * 1000); // 1 hour ago
            localStorage.setItem(`mm_encryption_${sessionId}_meta`, JSON.stringify(meta));

            // Clear session reference
            sessionStorage.removeItem('mm_encryption_current_session_id');

            // Cleanup with 30 minute max age
            cleanupStaleKeys(30 * 60 * 1000);

            expect(hasEncryptionKeys(sessionId)).toBe(false);
        });
    });

    describe('getAllStoredSessionIds', () => {
        (hasCryptoSubtle ? test : test.skip)('returns all stored session IDs', async () => {
            const keyPair1 = await generateKeyPair();
            const keyPair2 = await generateKeyPair();

            await storeKeyPair('session-a', keyPair1);
            await storeKeyPair('session-b', keyPair2);

            const sessionIds = getAllStoredSessionIds();

            expect(sessionIds).toContain('session-a');
            expect(sessionIds).toContain('session-b');
            expect(sessionIds.length).toBe(2);
        });

        test('returns empty array when no sessions stored', () => {
            const sessionIds = getAllStoredSessionIds();
            expect(sessionIds).toEqual([]);
        });
    });
});
