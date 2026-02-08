// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {generateKeyPair, exportPublicKey} from 'utils/encryption/keypair';
import {storeKeyPair, storeSessionId, hasEncryptionKeys, clearAllEncryptionKeys} from 'utils/encryption/storage';
import {
    ensureEncryptionKeys,
    checkEncryptionStatus,
    getCurrentPublicKey,
    getCurrentPrivateKey,
    isEncryptionInitialized,
    ensureSessionIdRestored,
    clearEncryptionSession,
    clearAllEncryptionData,
    getChannelRecipientKeys,
    getChannelEncryptionInfo,
    getSessionId,
} from 'utils/encryption/session';

// Mock the API module
jest.mock('utils/encryption/api', () => ({
    getEncryptionStatus: jest.fn(),
    registerPublicKey: jest.fn(),
    getChannelMemberKeys: jest.fn(),
}));

// Mock the use_decrypt_post module
jest.mock('utils/encryption/use_decrypt_post', () => ({
    clearDecryptionCache: jest.fn(),
}));

const {getEncryptionStatus, registerPublicKey, getChannelMemberKeys} = require('utils/encryption/api');
const {clearDecryptionCache} = require('utils/encryption/use_decrypt_post');

describe('Encryption Session Management', () => {
    // Skip tests if crypto.subtle is not available
    const hasCryptoSubtle = typeof crypto !== 'undefined' && crypto.subtle !== undefined;

    beforeEach(() => {
        // Clear storage and mocks
        localStorage.clear();
        sessionStorage.clear();
        jest.clearAllMocks();
    });

    afterEach(() => {
        localStorage.clear();
        sessionStorage.clear();
    });

    describe('getSessionId', () => {
        test('returns null when no session', () => {
            expect(getSessionId()).toBeNull();
        });

        test('returns stored session ID', () => {
            storeSessionId('test-session');
            expect(getSessionId()).toBe('test-session');
        });
    });

    describe('isEncryptionInitialized', () => {
        test('returns false when no keys', () => {
            expect(isEncryptionInitialized()).toBe(false);
        });

        (hasCryptoSubtle ? test : test.skip)('returns true when keys exist', async () => {
            const keyPair = await generateKeyPair();
            await storeKeyPair('test-session', keyPair);

            expect(isEncryptionInitialized()).toBe(true);
        });
    });

    describe('checkEncryptionStatus', () => {
        test('calls API and returns status', async () => {
            const mockStatus = {
                enabled: true,
                session_id: 'api-session',
                has_key: true,
            };
            getEncryptionStatus.mockResolvedValue(mockStatus);

            const status = await checkEncryptionStatus();

            expect(getEncryptionStatus).toHaveBeenCalled();
            expect(status).toEqual(mockStatus);
        });
    });

    describe('ensureEncryptionKeys', () => {
        (hasCryptoSubtle ? test : test.skip)('generates keys when none exist', async () => {
            getEncryptionStatus.mockResolvedValue({
                enabled: true,
                session_id: 'new-session',
                has_key: false,
            });
            registerPublicKey.mockResolvedValue({});

            await ensureEncryptionKeys();

            expect(registerPublicKey).toHaveBeenCalled();
            expect(hasEncryptionKeys('new-session')).toBe(true);
        });

        (hasCryptoSubtle ? test : test.skip)('re-registers existing keys when server missing', async () => {
            // Pre-store keys
            const keyPair = await generateKeyPair();
            await storeKeyPair('existing-session', keyPair);

            getEncryptionStatus.mockResolvedValue({
                enabled: true,
                session_id: 'existing-session',
                has_key: false, // Server doesn't have the key
            });
            registerPublicKey.mockResolvedValue({});

            await ensureEncryptionKeys();

            expect(registerPublicKey).toHaveBeenCalled();
        });

        (hasCryptoSubtle ? test : test.skip)('skips registration when server has keys', async () => {
            // Pre-store keys
            const keyPair = await generateKeyPair();
            await storeKeyPair('session-with-keys', keyPair);

            getEncryptionStatus.mockResolvedValue({
                enabled: true,
                session_id: 'session-with-keys',
                has_key: true,
            });

            await ensureEncryptionKeys();

            expect(registerPublicKey).not.toHaveBeenCalled();
        });

        (hasCryptoSubtle ? test : test.skip)('throws when session ID not available', async () => {
            getEncryptionStatus.mockResolvedValue({
                enabled: true,
                session_id: null,
                has_key: false,
            });

            await expect(ensureEncryptionKeys()).rejects.toThrow('Could not determine Mattermost session ID');
        });

        (hasCryptoSubtle ? test : test.skip)('clears keys and throws when registration fails', async () => {
            getEncryptionStatus.mockResolvedValue({
                enabled: true,
                session_id: 'fail-session',
                has_key: false,
            });
            registerPublicKey.mockRejectedValue(new Error('Network error'));

            await expect(ensureEncryptionKeys()).rejects.toThrow('Failed to register encryption key');
            expect(hasEncryptionKeys('fail-session')).toBe(false);
        });
    });

    describe('getCurrentPublicKey', () => {
        (hasCryptoSubtle ? test : test.skip)('returns public key JWK', async () => {
            const keyPair = await generateKeyPair();
            await storeKeyPair('pk-session', keyPair);

            getEncryptionStatus.mockResolvedValue({
                enabled: true,
                session_id: 'pk-session',
                has_key: true,
            });

            const jwk = await getCurrentPublicKey();

            expect(jwk).not.toBeNull();
            const parsed = JSON.parse(jwk!);
            expect(parsed.kty).toBe('RSA');
        });
    });

    describe('getCurrentPrivateKey', () => {
        (hasCryptoSubtle ? test : test.skip)('returns private CryptoKey', async () => {
            const keyPair = await generateKeyPair();
            await storeKeyPair('priv-session', keyPair);

            const privateKey = await getCurrentPrivateKey();

            expect(privateKey).not.toBeNull();
            expect(privateKey?.type).toBe('private');
        });

        test('returns null when no keys', async () => {
            const result = await getCurrentPrivateKey();
            expect(result).toBeNull();
        });
    });

    describe('ensureSessionIdRestored', () => {
        (hasCryptoSubtle ? test : test.skip)('returns cached session ID when available', async () => {
            const keyPair = await generateKeyPair();
            await storeKeyPair('cached-session', keyPair);

            const sessionId = await ensureSessionIdRestored();

            expect(sessionId).toBe('cached-session');
            expect(getEncryptionStatus).not.toHaveBeenCalled();
        });

        (hasCryptoSubtle ? test : test.skip)('restores from server when cache missing', async () => {
            // Store keys but clear session cache
            const keyPair = await generateKeyPair();
            await storeKeyPair('restore-session', keyPair);
            sessionStorage.clear();

            getEncryptionStatus.mockResolvedValue({
                enabled: true,
                session_id: 'restore-session',
                has_key: true,
            });

            const sessionId = await ensureSessionIdRestored();

            expect(sessionId).toBe('restore-session');
            expect(getEncryptionStatus).toHaveBeenCalled();
        });

        test('returns null when no keys available', async () => {
            getEncryptionStatus.mockResolvedValue({
                enabled: true,
                session_id: 'no-keys-session',
                has_key: false,
            });

            const sessionId = await ensureSessionIdRestored();

            expect(sessionId).toBeNull();
        });
    });

    describe('clearEncryptionSession', () => {
        (hasCryptoSubtle ? test : test.skip)('clears keys and decryption cache', async () => {
            const keyPair = await generateKeyPair();
            await storeKeyPair('clear-session', keyPair);

            clearEncryptionSession();

            expect(hasEncryptionKeys('clear-session')).toBe(false);
            expect(clearDecryptionCache).toHaveBeenCalled();
        });
    });

    describe('clearAllEncryptionData', () => {
        (hasCryptoSubtle ? test : test.skip)('clears all keys and cache', async () => {
            const keyPair1 = await generateKeyPair();
            const keyPair2 = await generateKeyPair();
            await storeKeyPair('session1', keyPair1);
            await storeKeyPair('session2', keyPair2);

            clearAllEncryptionData();

            expect(hasEncryptionKeys('session1')).toBe(false);
            expect(hasEncryptionKeys('session2')).toBe(false);
            expect(clearDecryptionCache).toHaveBeenCalled();
        });
    });

    describe('getChannelRecipientKeys', () => {
        test('returns session keys for channel members', async () => {
            getChannelMemberKeys.mockResolvedValue([
                {user_id: 'user1', session_id: 'session1', public_key: 'key1'},
                {user_id: 'user1', session_id: 'session2', public_key: 'key2'},
                {user_id: 'user2', session_id: 'session3', public_key: 'key3'},
            ]);

            const keys = await getChannelRecipientKeys('channel123');

            expect(getChannelMemberKeys).toHaveBeenCalledWith('channel123');
            expect(keys.length).toBe(3);
            expect(keys[0]).toEqual({
                userId: 'user1',
                sessionId: 'session1',
                publicKey: 'key1',
            });
        });

        test('filters out entries without keys', async () => {
            getChannelMemberKeys.mockResolvedValue([
                {user_id: 'user1', session_id: 'session1', public_key: 'key1'},
                {user_id: 'user2', session_id: null, public_key: null},
                {user_id: 'user3', session_id: 'session3', public_key: ''},
            ]);

            const keys = await getChannelRecipientKeys('channel123');

            expect(keys.length).toBe(1);
            expect(keys[0].userId).toBe('user1');
        });
    });

    describe('getChannelEncryptionInfo', () => {
        test('returns unique recipients excluding current user', async () => {
            getChannelMemberKeys.mockResolvedValue([
                {user_id: 'user1', session_id: 's1', public_key: 'k1'},
                {user_id: 'user1', session_id: 's2', public_key: 'k2'}, // Same user, different session
                {user_id: 'user2', session_id: 's3', public_key: 'k3'},
                {user_id: 'current-user', session_id: 's4', public_key: 'k4'}, // Current user
            ]);

            const info = await getChannelEncryptionInfo('channel123', 'current-user');

            // Should have 2 unique recipients (user1 once, user2 once)
            expect(info.recipients.length).toBe(2);
            expect(info.recipients.find((r) => r.user_id === 'current-user')).toBeUndefined();
        });

        test('deduplicates users with multiple sessions', async () => {
            getChannelMemberKeys.mockResolvedValue([
                {user_id: 'multi-device-user', session_id: 's1', public_key: 'k1'},
                {user_id: 'multi-device-user', session_id: 's2', public_key: 'k2'},
                {user_id: 'multi-device-user', session_id: 's3', public_key: 'k3'},
            ]);

            const info = await getChannelEncryptionInfo('channel123', 'other-user');

            // Should only appear once despite 3 sessions
            expect(info.recipients.length).toBe(1);
        });
    });
});
