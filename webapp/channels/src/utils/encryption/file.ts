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
 * Metadata stored with encrypted files (in post.props).
 * NOTE: Original file info (name, type, size) is NOT stored here.
 * It is encrypted inside the file payload and only available after decryption.
 */
export interface EncryptedFileMetadata {
    v: number;           // Version (2 = metadata inside payload)
    iv: string;          // Base64-encoded 12-byte IV for AES-GCM
    keys: Record<string, string>;  // sessionId → Base64 RSA-encrypted AES key
    sender: string;      // Sender's user ID
    // NOTE: 'original' field removed - now encrypted inside the file payload
}

/**
 * Original file info, stored encrypted inside the file payload.
 * Only available after successful decryption.
 */
export interface OriginalFileInfo {
    name: string;    // Original filename
    type: string;    // Original MIME type
    size: number;    // Original file size
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
 *
 * The encrypted payload format (v2):
 * [4 bytes: header length as uint32 LE]
 * [header bytes: JSON with original file info]
 * [rest: original file content]
 *
 * This ensures original filename, type, and size are encrypted
 * and only available after successful decryption.
 *
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

    // Create header with original file info (will be encrypted)
    const originalInfo: OriginalFileInfo = {
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
    };
    const headerJson = JSON.stringify(originalInfo);
    const headerBytes = new TextEncoder().encode(headerJson);

    // Read file as ArrayBuffer
    const fileData = await file.arrayBuffer();

    // Create payload: [4-byte header length][header][file content]
    const headerLength = new Uint32Array([headerBytes.length]);
    const payload = new Uint8Array(4 + headerBytes.length + fileData.byteLength);
    payload.set(new Uint8Array(headerLength.buffer), 0);
    payload.set(headerBytes, 4);
    payload.set(new Uint8Array(fileData), 4 + headerBytes.length);

    // Encrypt the entire payload with AES-GCM
    const encryptedData = await crypto.subtle.encrypt(
        {name: AES_ALGORITHM, iv},
        aesKey,
        payload,
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

    // Metadata stored in post.props - does NOT contain original file info
    const metadata: EncryptedFileMetadata = {
        v: 2, // Version 2: original info encrypted inside payload
        iv: arrayBufferToBase64(iv.buffer),
        keys: encryptedKeys,
        sender: senderId,
    };

    return {encryptedBlob, metadata};
}

/**
 * Result of decrypting a file (v2 format).
 */
export interface DecryptedFileResult {
    blob: Blob;
    originalInfo: OriginalFileInfo;
}

/**
 * Decrypts an encrypted file using the recipient's private key.
 *
 * For v2 format, extracts original file info from the encrypted payload.
 * For v1 format (legacy), uses metadata.original if available.
 *
 * @param encryptedBlob - The encrypted file blob
 * @param metadata - The encryption metadata
 * @param privateKey - The recipient's private CryptoKey
 * @param sessionId - The session ID to find the encrypted key for
 * @returns The decrypted file blob and original file info
 */
export async function decryptFile(
    encryptedBlob: Blob,
    metadata: EncryptedFileMetadata,
    privateKey: CryptoKey,
    sessionId: string,
): Promise<DecryptedFileResult> {
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

    // Decrypt the payload using AES-GCM
    const iv = base64ToArrayBuffer(metadata.iv);
    const decryptedPayload = await crypto.subtle.decrypt(
        {name: AES_ALGORITHM, iv},
        aesKey,
        encryptedData,
    );

    // Handle v2 format: extract header with original file info
    if (metadata.v === 2) {
        const payloadArray = new Uint8Array(decryptedPayload);

        // Read header length (first 4 bytes, uint32 LE)
        const headerLengthView = new DataView(payloadArray.buffer, 0, 4);
        const headerLength = headerLengthView.getUint32(0, true); // little endian

        // Extract and parse header
        const headerBytes = payloadArray.slice(4, 4 + headerLength);
        const headerJson = new TextDecoder().decode(headerBytes);
        const originalInfo: OriginalFileInfo = JSON.parse(headerJson);

        // Extract file content (after header)
        const fileContent = payloadArray.slice(4 + headerLength);
        const blob = new Blob([fileContent], {type: originalInfo.type});

        return {blob, originalInfo};
    }

    // Legacy v1 format: original info was in metadata (for backwards compatibility)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const legacyMetadata = metadata as any;
    if (legacyMetadata.original) {
        return {
            blob: new Blob([decryptedPayload], {type: legacyMetadata.original.type}),
            originalInfo: legacyMetadata.original,
        };
    }

    // Fallback: unknown format, return as binary
    return {
        blob: new Blob([decryptedPayload], {type: 'application/octet-stream'}),
        originalInfo: {
            name: 'decrypted_file',
            type: 'application/octet-stream',
            size: decryptedPayload.byteLength,
        },
    };
}

/**
 * Checks if a file is encrypted based on its MIME type or cached metadata.
 * @param fileInfo - The FileInfo object to check
 * @returns true if the file is encrypted
 */
export function isEncryptedFile(fileInfo: FileInfo | undefined): boolean {
    if (!fileInfo) {
        return false;
    }

    // Check MIME type first (for files from server with correct type)
    if (fileInfo.mime_type === ENCRYPTED_FILE_MIME_TYPE) {
        return true;
    }

    // Check cached metadata (for files just uploaded where server may not preserve mime_type)
    // Import dynamically to avoid circular dependency
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const {getCachedFileMetadata} = require('./file_hooks');
    const cachedMetadata = getCachedFileMetadata(fileInfo.id);
    if (cachedMetadata) {
        return true;
    }

    return false;
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
 * @returns Decrypted blob, blob URL, and original file info
 */
export async function fetchAndDecryptFile(
    fileUrl: string,
    metadata: EncryptedFileMetadata,
    privateKey: CryptoKey,
    sessionId: string,
): Promise<{blob: Blob; blobUrl: string; originalInfo: OriginalFileInfo}> {
    // Fetch the encrypted file
    const response = await fetch(fileUrl, {
        credentials: 'include',
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch encrypted file: ${response.status} ${response.statusText}`);
    }

    const encryptedBlob = await response.blob();

    // Decrypt the file (returns blob and original info)
    const {blob, originalInfo} = await decryptFile(encryptedBlob, metadata, privateKey, sessionId);

    // Create blob URL
    const blobUrl = URL.createObjectURL(blob);

    return {blob, blobUrl, originalInfo};
}

/**
 * Creates a File object from a Blob with proper naming.
 * Useful for displaying decrypted files.
 * @param blob - The blob to convert
 * @param originalInfo - The original file info extracted after decryption
 * @returns A File object with original name
 */
export function createFileFromDecryptedBlob(
    blob: Blob,
    originalInfo: OriginalFileInfo,
): File {
    return new File([blob], originalInfo.name, {
        type: originalInfo.type,
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
