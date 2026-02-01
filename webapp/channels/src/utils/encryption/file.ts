// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * File encryption using AES-256-GCM.
 * Uses the same hybrid encryption scheme as messages:
 * - AES-256-GCM for file content encryption
 * - RSA-OAEP for encrypting the AES key per recipient session
 */

import type {FileInfo} from '@mattermost/types/files';

import {rsaEncrypt, rsaDecrypt, importPublicKey} from './keypair';
import {arrayBufferToBase64, base64ToArrayBuffer} from './hybrid';
import type {SessionKey} from './hybrid';

const AES_ALGORITHM = 'AES-GCM';
const AES_KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for AES-GCM

// MIME type used to identify encrypted files
export const ENCRYPTED_FILE_MIME_TYPE = 'application/x-penc';

/**
 * Metadata stored with encrypted files.
 */
export interface EncryptedFileMetadata {
    v: number;           // Version (1)
    iv: string;          // Base64-encoded 12-byte IV for AES-GCM
    keys: Record<string, string>;  // sessionId → Base64 RSA-encrypted AES key
    sender: string;      // Sender's user ID
    original: {
        name: string;    // Original filename
        type: string;    // Original MIME type
        size: number;    // Original file size
    };
}

/**
 * Result of encrypting a file.
 */
export interface EncryptedFileResult {
    encryptedBlob: Blob;
    metadata: EncryptedFileMetadata;
}

/**
 * Generates a random AES-256 key for file encryption.
 */
async function generateAesKey(): Promise<CryptoKey> {
    return crypto.subtle.generateKey(
        {name: AES_ALGORITHM, length: AES_KEY_LENGTH},
        true, // extractable
        ['encrypt', 'decrypt'],
    );
}

/**
 * Generates a random IV for AES-GCM.
 */
function generateIv(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(IV_LENGTH));
}

/**
 * Encrypts a file for multiple recipients using hybrid encryption.
 * @param file - The file to encrypt
 * @param sessionKeys - Array of session keys (sessionId + publicKey)
 * @param senderId - The sender's user ID
 * @returns The encrypted blob and metadata
 */
export async function encryptFile(
    file: File,
    sessionKeys: SessionKey[],
    senderId: string,
): Promise<EncryptedFileResult> {
    // Generate a random AES key for this file
    const aesKey = await generateAesKey();
    const rawAesKey = await crypto.subtle.exportKey('raw', aesKey);

    // Generate random IV
    const iv = generateIv();

    // Read file as ArrayBuffer
    const fileData = await file.arrayBuffer();

    // Encrypt the file with AES-GCM
    const encryptedData = await crypto.subtle.encrypt(
        {name: AES_ALGORITHM, iv},
        aesKey,
        fileData,
    );

    // Create encrypted blob
    const encryptedBlob = new Blob([encryptedData], {type: ENCRYPTED_FILE_MIME_TYPE});

    // Encrypt the AES key for each session using their public key
    const encryptedKeys: Record<string, string> = {};
    for (const {sessionId, publicKey: publicKeyJwk} of sessionKeys) {
        try {
            const publicKey = await importPublicKey(publicKeyJwk);
            const encryptedAesKey = await rsaEncrypt(publicKey, rawAesKey);
            encryptedKeys[sessionId] = arrayBufferToBase64(encryptedAesKey);
        } catch (error) {
            // Skip sessions whose keys can't be imported
            console.warn(`[encryptFile] Failed to encrypt for session ${sessionId}:`, error);
        }
    }

    const metadata: EncryptedFileMetadata = {
        v: 1,
        iv: arrayBufferToBase64(iv.buffer),
        keys: encryptedKeys,
        sender: senderId,
        original: {
            name: file.name,
            type: file.type || 'application/octet-stream',
            size: file.size,
        },
    };

    return {encryptedBlob, metadata};
}

/**
 * Decrypts an encrypted file using the recipient's private key.
 * @param encryptedBlob - The encrypted file blob
 * @param metadata - The encryption metadata
 * @param privateKey - The recipient's private CryptoKey
 * @param sessionId - The session ID to find the encrypted key for
 * @returns The decrypted file as a Blob with original MIME type
 */
export async function decryptFile(
    encryptedBlob: Blob,
    metadata: EncryptedFileMetadata,
    privateKey: CryptoKey,
    sessionId: string,
): Promise<Blob> {
    // Find the encrypted AES key for this session
    const encryptedAesKeyBase64 = metadata.keys[sessionId];
    if (!encryptedAesKeyBase64) {
        throw new Error('No encrypted key found for this session');
    }

    // Decrypt the AES key using RSA
    const encryptedAesKey = base64ToArrayBuffer(encryptedAesKeyBase64);
    const rawAesKey = await rsaDecrypt(privateKey, encryptedAesKey);

    // Import the AES key
    const aesKey = await crypto.subtle.importKey(
        'raw',
        rawAesKey,
        {name: AES_ALGORITHM},
        false,
        ['decrypt'],
    );

    // Read encrypted blob as ArrayBuffer
    const encryptedData = await encryptedBlob.arrayBuffer();

    // Decrypt the file using AES-GCM
    const iv = base64ToArrayBuffer(metadata.iv);
    const decryptedData = await crypto.subtle.decrypt(
        {name: AES_ALGORITHM, iv},
        aesKey,
        encryptedData,
    );

    // Return as Blob with original MIME type
    return new Blob([decryptedData], {type: metadata.original.type});
}

/**
 * Checks if a file is encrypted based on its MIME type.
 * @param fileInfo - The FileInfo object to check
 * @returns true if the file is encrypted
 */
export function isEncryptedFile(fileInfo: FileInfo | undefined): boolean {
    if (!fileInfo) {
        return false;
    }
    return fileInfo.mime_type === ENCRYPTED_FILE_MIME_TYPE;
}

/**
 * Parses encrypted file metadata from post props.
 * @param postProps - The post.props object
 * @param fileId - The file ID to get metadata for
 * @returns The metadata or null if not found
 */
export function getEncryptedFileMetadata(
    postProps: Record<string, unknown> | undefined,
    fileId: string,
): EncryptedFileMetadata | null {
    if (!postProps) {
        return null;
    }

    const encryptedFiles = postProps.encrypted_files as Record<string, EncryptedFileMetadata> | undefined;
    if (!encryptedFiles) {
        return null;
    }

    return encryptedFiles[fileId] || null;
}

/**
 * Creates the encrypted_files props entry for a set of encrypted files.
 * @param filesMetadata - Map of fileId to metadata
 * @returns Object to merge into post.props
 */
export function createEncryptedFilesProps(
    filesMetadata: Record<string, EncryptedFileMetadata>,
): Record<string, unknown> {
    return {
        encrypted_files: filesMetadata,
    };
}

/**
 * Fetches an encrypted file from the server and decrypts it.
 * @param fileUrl - URL to fetch the encrypted file from
 * @param metadata - The encryption metadata
 * @param privateKey - The recipient's private CryptoKey
 * @param sessionId - The session ID for decryption
 * @returns Decrypted blob and blob URL
 */
export async function fetchAndDecryptFile(
    fileUrl: string,
    metadata: EncryptedFileMetadata,
    privateKey: CryptoKey,
    sessionId: string,
): Promise<{blob: Blob; blobUrl: string}> {
    // Fetch the encrypted file
    const response = await fetch(fileUrl, {
        credentials: 'include',
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch encrypted file: ${response.status} ${response.statusText}`);
    }

    const encryptedBlob = await response.blob();

    // Decrypt the file
    const decryptedBlob = await decryptFile(encryptedBlob, metadata, privateKey, sessionId);

    // Create blob URL
    const blobUrl = URL.createObjectURL(decryptedBlob);

    return {blob: decryptedBlob, blobUrl};
}

/**
 * Creates a File object from a Blob with proper naming.
 * Useful for displaying decrypted files.
 * @param blob - The blob to convert
 * @param metadata - The encryption metadata containing original file info
 * @returns A File object with original name
 */
export function createFileFromDecryptedBlob(
    blob: Blob,
    metadata: EncryptedFileMetadata,
): File {
    return new File([blob], metadata.original.name, {
        type: metadata.original.type,
    });
}

/**
 * Generates a thumbnail from a decrypted image blob.
 * Used for encrypted images since server can't generate thumbnails.
 * @param imageBlob - The decrypted image blob
 * @param maxWidth - Maximum thumbnail width (default 120)
 * @param maxHeight - Maximum thumbnail height (default 120)
 * @returns Thumbnail as blob URL or null if not an image
 */
export async function generateThumbnail(
    imageBlob: Blob,
    maxWidth: number = 120,
    maxHeight: number = 120,
): Promise<string | null> {
    // Check if it's an image
    if (!imageBlob.type.startsWith('image/')) {
        return null;
    }

    return new Promise((resolve) => {
        const img = new Image();
        const blobUrl = URL.createObjectURL(imageBlob);

        img.onload = () => {
            // Calculate thumbnail dimensions maintaining aspect ratio
            let width = img.width;
            let height = img.height;

            if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
            }
            if (height > maxHeight) {
                width = (width * maxHeight) / height;
                height = maxHeight;
            }

            // Create canvas and draw thumbnail
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                URL.revokeObjectURL(blobUrl);
                resolve(null);
                return;
            }

            ctx.drawImage(img, 0, 0, width, height);

            // Convert to blob URL
            canvas.toBlob((thumbnailBlob) => {
                URL.revokeObjectURL(blobUrl);
                if (thumbnailBlob) {
                    resolve(URL.createObjectURL(thumbnailBlob));
                } else {
                    resolve(null);
                }
            }, 'image/jpeg', 0.85);
        };

        img.onerror = () => {
            URL.revokeObjectURL(blobUrl);
            resolve(null);
        };

        img.src = blobUrl;
    });
}
