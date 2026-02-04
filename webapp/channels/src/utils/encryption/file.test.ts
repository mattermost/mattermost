// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {FileInfo} from '@mattermost/types/files';

import {generateKeyPair, exportPublicKey} from './keypair';
import {
    encryptFile,
    decryptFile,
    isEncryptedFile,
    getEncryptedFileMetadata,
    createEncryptedFilesProps,
    createFileFromDecryptedBlob,
    ENCRYPTED_FILE_MIME_TYPE,
    type EncryptedFileMetadata,
    type SessionKey,
} from './file';

// Mock the file_hooks module to avoid circular dependency issues
jest.mock('./file_hooks', () => ({
    getCachedFileMetadata: jest.fn().mockReturnValue(null),
}));

describe('File Encryption Utilities', () => {
    // Skip tests if crypto.subtle is not available
    const hasCryptoSubtle = typeof crypto !== 'undefined' && crypto.subtle !== undefined;

    // Helper to create a test file
    function createTestFile(content: string, name: string = 'test.txt', type: string = 'text/plain'): File {
        const blob = new Blob([content], {type});
        return new File([blob], name, {type});
    }

    describe('ENCRYPTED_FILE_MIME_TYPE', () => {
        test('has correct value', () => {
            expect(ENCRYPTED_FILE_MIME_TYPE).toBe('application/x-penc');
        });
    });

    describe('encryptFile', () => {
        (hasCryptoSubtle ? test : test.skip)('produces encrypted blob with correct MIME type', async () => {
            const keyPair = await generateKeyPair();
            const publicKeyJwk = await exportPublicKey(keyPair.publicKey);
            const sessionKeys: SessionKey[] = [{
                sessionId: 'test-session',
                publicKey: publicKeyJwk,
            }];

            const file = createTestFile('Hello, World!', 'hello.txt', 'text/plain');
            const result = await encryptFile(file, sessionKeys, 'sender-user');

            expect(result.encryptedBlob).toBeDefined();
            expect(result.encryptedBlob.type).toBe(ENCRYPTED_FILE_MIME_TYPE);
            expect(result.encryptedBlob.size).toBeGreaterThan(0);
        });

        (hasCryptoSubtle ? test : test.skip)('produces valid metadata', async () => {
            const keyPair = await generateKeyPair();
            const publicKeyJwk = await exportPublicKey(keyPair.publicKey);
            const sessionKeys: SessionKey[] = [{
                sessionId: 'my-session',
                publicKey: publicKeyJwk,
            }];

            const file = createTestFile('Test content', 'document.pdf', 'application/pdf');
            const result = await encryptFile(file, sessionKeys, 'user123');

            expect(result.metadata.v).toBe(2);
            expect(result.metadata.sender).toBe('user123');
            expect(result.metadata.iv).toBeDefined();
            expect(result.metadata.keys['my-session']).toBeDefined();
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

            const file = createTestFile('Multi-recipient file');
            const result = await encryptFile(file, sessionKeys, 'sender');

            expect(Object.keys(result.metadata.keys).length).toBe(2);
            expect(result.metadata.keys.session1).toBeDefined();
            expect(result.metadata.keys.session2).toBeDefined();
        });

        (hasCryptoSubtle ? test : test.skip)('encrypted blob is different from original', async () => {
            const keyPair = await generateKeyPair();
            const publicKeyJwk = await exportPublicKey(keyPair.publicKey);
            const sessionKeys: SessionKey[] = [{
                sessionId: 'session',
                publicKey: publicKeyJwk,
            }];

            const originalContent = 'Original file content';
            const file = createTestFile(originalContent);
            const result = await encryptFile(file, sessionKeys, 'sender');

            // Read encrypted content
            const encryptedText = await result.encryptedBlob.text();
            expect(encryptedText).not.toBe(originalContent);
        });

        (hasCryptoSubtle ? test : test.skip)('handles binary files', async () => {
            const keyPair = await generateKeyPair();
            const publicKeyJwk = await exportPublicKey(keyPair.publicKey);
            const sessionKeys: SessionKey[] = [{
                sessionId: 'session',
                publicKey: publicKeyJwk,
            }];

            // Create binary file
            const binaryData = new Uint8Array([0, 1, 2, 255, 254, 253]);
            const blob = new Blob([binaryData], {type: 'application/octet-stream'});
            const file = new File([blob], 'binary.bin', {type: 'application/octet-stream'});

            const result = await encryptFile(file, sessionKeys, 'sender');
            expect(result.encryptedBlob.size).toBeGreaterThan(0);
        });

        (hasCryptoSubtle ? test : test.skip)('handles empty files', async () => {
            const keyPair = await generateKeyPair();
            const publicKeyJwk = await exportPublicKey(keyPair.publicKey);
            const sessionKeys: SessionKey[] = [{
                sessionId: 'session',
                publicKey: publicKeyJwk,
            }];

            const file = createTestFile('', 'empty.txt');
            const result = await encryptFile(file, sessionKeys, 'sender');

            expect(result.encryptedBlob).toBeDefined();
            expect(result.metadata.iv).toBeDefined();
        });
    });

    describe('decryptFile', () => {
        (hasCryptoSubtle ? test : test.skip)('recovers original file content', async () => {
            const keyPair = await generateKeyPair();
            const publicKeyJwk = await exportPublicKey(keyPair.publicKey);
            const sessionKeys: SessionKey[] = [{
                sessionId: 'decrypt-session',
                publicKey: publicKeyJwk,
            }];

            const originalContent = 'This is the original content!';
            const originalName = 'important.doc';
            const originalType = 'application/msword';
            const file = createTestFile(originalContent, originalName, originalType);

            const {encryptedBlob, metadata} = await encryptFile(file, sessionKeys, 'sender');
            const result = await decryptFile(encryptedBlob, metadata, keyPair.privateKey, 'decrypt-session');

            const decryptedText = await result.blob.text();
            expect(decryptedText).toBe(originalContent);
        });

        (hasCryptoSubtle ? test : test.skip)('extracts original file info', async () => {
            const keyPair = await generateKeyPair();
            const publicKeyJwk = await exportPublicKey(keyPair.publicKey);
            const sessionKeys: SessionKey[] = [{
                sessionId: 'session',
                publicKey: publicKeyJwk,
            }];

            const file = createTestFile('Content', 'report.pdf', 'application/pdf');
            const {encryptedBlob, metadata} = await encryptFile(file, sessionKeys, 'sender');
            const result = await decryptFile(encryptedBlob, metadata, keyPair.privateKey, 'session');

            expect(result.originalInfo.name).toBe('report.pdf');
            expect(result.originalInfo.type).toBe('application/pdf');
            expect(result.originalInfo.size).toBe(7); // "Content".length
        });

        (hasCryptoSubtle ? test : test.skip)('restores correct MIME type on decrypted blob', async () => {
            const keyPair = await generateKeyPair();
            const publicKeyJwk = await exportPublicKey(keyPair.publicKey);
            const sessionKeys: SessionKey[] = [{
                sessionId: 'session',
                publicKey: publicKeyJwk,
            }];

            const file = createTestFile('Image data', 'photo.jpg', 'image/jpeg');
            const {encryptedBlob, metadata} = await encryptFile(file, sessionKeys, 'sender');
            const result = await decryptFile(encryptedBlob, metadata, keyPair.privateKey, 'session');

            expect(result.blob.type).toBe('image/jpeg');
        });

        (hasCryptoSubtle ? test : test.skip)('each recipient can decrypt', async () => {
            const keyPair1 = await generateKeyPair();
            const keyPair2 = await generateKeyPair();
            const publicKey1 = await exportPublicKey(keyPair1.publicKey);
            const publicKey2 = await exportPublicKey(keyPair2.publicKey);

            const sessionKeys: SessionKey[] = [
                {sessionId: 'session1', publicKey: publicKey1},
                {sessionId: 'session2', publicKey: publicKey2},
            ];

            const originalContent = 'Shared file';
            const file = createTestFile(originalContent);
            const {encryptedBlob, metadata} = await encryptFile(file, sessionKeys, 'sender');

            // Both recipients should be able to decrypt
            const result1 = await decryptFile(encryptedBlob, metadata, keyPair1.privateKey, 'session1');
            const result2 = await decryptFile(encryptedBlob, metadata, keyPair2.privateKey, 'session2');

            expect(await result1.blob.text()).toBe(originalContent);
            expect(await result2.blob.text()).toBe(originalContent);
        });

        (hasCryptoSubtle ? test : test.skip)('throws error when session key not found', async () => {
            const keyPair = await generateKeyPair();
            const publicKeyJwk = await exportPublicKey(keyPair.publicKey);
            const sessionKeys: SessionKey[] = [{
                sessionId: 'existing-session',
                publicKey: publicKeyJwk,
            }];

            const file = createTestFile('Test');
            const {encryptedBlob, metadata} = await encryptFile(file, sessionKeys, 'sender');

            await expect(
                decryptFile(encryptedBlob, metadata, keyPair.privateKey, 'wrong-session'),
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

            const file = createTestFile('Secret file');
            const {encryptedBlob, metadata} = await encryptFile(file, sessionKeys, 'sender');

            await expect(
                decryptFile(encryptedBlob, metadata, wrongKeyPair.privateKey, 'session'),
            ).rejects.toThrow();
        });

        (hasCryptoSubtle ? test : test.skip)('handles binary files', async () => {
            const keyPair = await generateKeyPair();
            const publicKeyJwk = await exportPublicKey(keyPair.publicKey);
            const sessionKeys: SessionKey[] = [{
                sessionId: 'session',
                publicKey: publicKeyJwk,
            }];

            const binaryData = new Uint8Array([0, 1, 2, 128, 255]);
            const blob = new Blob([binaryData], {type: 'application/octet-stream'});
            const file = new File([blob], 'data.bin', {type: 'application/octet-stream'});

            const {encryptedBlob, metadata} = await encryptFile(file, sessionKeys, 'sender');
            const result = await decryptFile(encryptedBlob, metadata, keyPair.privateKey, 'session');

            const decryptedArray = new Uint8Array(await result.blob.arrayBuffer());
            expect(decryptedArray).toEqual(binaryData);
        });

        (hasCryptoSubtle ? test : test.skip)('handles files with unicode names', async () => {
            const keyPair = await generateKeyPair();
            const publicKeyJwk = await exportPublicKey(keyPair.publicKey);
            const sessionKeys: SessionKey[] = [{
                sessionId: 'session',
                publicKey: publicKeyJwk,
            }];

            const file = createTestFile('Content', '文档.txt', 'text/plain');
            const {encryptedBlob, metadata} = await encryptFile(file, sessionKeys, 'sender');
            const result = await decryptFile(encryptedBlob, metadata, keyPair.privateKey, 'session');

            expect(result.originalInfo.name).toBe('文档.txt');
        });
    });

    describe('isEncryptedFile', () => {
        test('detects encrypted file by MIME type', () => {
            const fileInfo: FileInfo = {
                id: 'file1',
                mime_type: ENCRYPTED_FILE_MIME_TYPE,
            } as FileInfo;

            expect(isEncryptedFile(fileInfo)).toBe(true);
        });

        test('returns false for non-encrypted MIME types', () => {
            const fileInfo: FileInfo = {
                id: 'file1',
                mime_type: 'text/plain',
            } as FileInfo;

            expect(isEncryptedFile(fileInfo)).toBe(false);
        });

        test('returns false for undefined', () => {
            expect(isEncryptedFile(undefined)).toBe(false);
        });

        test('returns false for empty MIME type', () => {
            const fileInfo: FileInfo = {
                id: 'file1',
                mime_type: '',
            } as FileInfo;

            expect(isEncryptedFile(fileInfo)).toBe(false);
        });
    });

    describe('getEncryptedFileMetadata', () => {
        test('returns metadata for file', () => {
            const metadata: EncryptedFileMetadata = {
                v: 2,
                iv: 'test-iv',
                keys: {session1: 'key1'},
                sender: 'user1',
            };

            const postProps = {
                encrypted_files: {
                    file123: metadata,
                },
            };

            const result = getEncryptedFileMetadata(postProps, 'file123');
            expect(result).toEqual(metadata);
        });

        test('returns null when file not in encrypted_files', () => {
            const postProps = {
                encrypted_files: {
                    other_file: {} as EncryptedFileMetadata,
                },
            };

            expect(getEncryptedFileMetadata(postProps, 'missing_file')).toBeNull();
        });

        test('returns null when no encrypted_files prop', () => {
            const postProps = {
                some_other_prop: 'value',
            };

            expect(getEncryptedFileMetadata(postProps, 'file1')).toBeNull();
        });

        test('returns null for undefined props', () => {
            expect(getEncryptedFileMetadata(undefined, 'file1')).toBeNull();
        });
    });

    describe('createEncryptedFilesProps', () => {
        test('creates correct props structure', () => {
            const filesMetadata: Record<string, EncryptedFileMetadata> = {
                file1: {
                    v: 2,
                    iv: 'iv1',
                    keys: {s1: 'k1'},
                    sender: 'user1',
                },
                file2: {
                    v: 2,
                    iv: 'iv2',
                    keys: {s2: 'k2'},
                    sender: 'user1',
                },
            };

            const props = createEncryptedFilesProps(filesMetadata);

            expect(props.encrypted_files).toEqual(filesMetadata);
        });

        test('handles empty metadata', () => {
            const props = createEncryptedFilesProps({});
            expect(props.encrypted_files).toEqual({});
        });
    });

    describe('createFileFromDecryptedBlob', () => {
        test('creates File with original name and type', () => {
            const blob = new Blob(['content'], {type: 'text/plain'});
            const originalInfo = {
                name: 'document.txt',
                type: 'text/plain',
                size: 7,
            };

            const file = createFileFromDecryptedBlob(blob, originalInfo);

            expect(file.name).toBe('document.txt');
            expect(file.type).toBe('text/plain');
            expect(file instanceof File).toBe(true);
        });

        test('uses type from originalInfo', () => {
            const blob = new Blob(['data'], {type: 'application/octet-stream'});
            const originalInfo = {
                name: 'image.png',
                type: 'image/png',
                size: 4,
            };

            const file = createFileFromDecryptedBlob(blob, originalInfo);

            expect(file.type).toBe('image/png');
        });
    });
});
