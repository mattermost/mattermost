// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * File encryption hooks for integrating with the file upload and post creation flow.
 *
 * The flow for encrypted files:
 * 1. User attaches file to message with encrypted priority
 * 2. encryptAndUploadFile() encrypts the file and uploads it
 * 3. Store file encryption metadata in cache keyed by fileId
 * 4. When post is created, attachFileEncryptionMetadata() adds metadata to post.props
 * 5. On receive, the metadata is extracted and stored in Redux for decryption
 */

import type {FileInfo} from '@mattermost/types/files';
import type {Post} from '@mattermost/types/posts';

import {encryptFile, ENCRYPTED_FILE_MIME_TYPE} from './file';
import type {EncryptedFileMetadata} from './file';
import {
    ensureEncryptionKeys,
    getChannelRecipientKeys,
    getSessionId,
} from './session';
import {getPublicKeyJwk} from './storage';

/**
 * Cache for file encryption metadata.
 * Supports both clientId (during upload) and fileId (after upload) lookups.
 */

// Cache TTL (10 minutes - longer than file upload timeout)
const CACHE_TTL_MS = 600000;

interface CacheEntry {
    metadata: EncryptedFileMetadata;
    timestamp: number;
    clientId?: string; // Original client ID if mapped
}

// Primary cache keyed by fileId or clientId
const metadataCacheWithTTL = new Map<string, CacheEntry>();

// Mapping from clientId to fileId (populated after upload completes)
const clientIdToFileId = new Map<string, string>();

/**
 * Cleans expired entries from the cache.
 */
function cleanExpiredEntries(): void {
    const now = Date.now();
    for (const [key, entry] of metadataCacheWithTTL.entries()) {
        if (now - entry.timestamp > CACHE_TTL_MS) {
            metadataCacheWithTTL.delete(key);
            if (entry.clientId) {
                clientIdToFileId.delete(entry.clientId);
            }
        }
    }
}

/**
 * Stores file encryption metadata in the cache using clientId.
 * Called during file upload before we have the server-assigned fileId.
 * @param clientId - The client-generated ID for the upload
 * @param metadata - The encryption metadata
 */
export function cacheFileEncryptionMetadataByClientId(clientId: string, metadata: EncryptedFileMetadata): void {
    cleanExpiredEntries();
    console.log('[cacheFileEncryptionMetadataByClientId] Caching metadata for clientId:', clientId, 'original name:', metadata.original.name);
    metadataCacheWithTTL.set(clientId, {
        metadata,
        timestamp: Date.now(),
        clientId,
    });
}

/**
 * Maps a clientId to a fileId after upload completes.
 * This allows looking up metadata by either ID.
 * @param clientId - The client-generated ID used during upload
 * @param fileId - The server-assigned file ID
 */
export function mapClientIdToFileId(clientId: string, fileId: string): void {
    console.log('[mapClientIdToFileId] Mapping clientId:', clientId, 'to fileId:', fileId);
    const entry = metadataCacheWithTTL.get(clientId);
    if (entry) {
        console.log('[mapClientIdToFileId] Found entry, storing under fileId');
        // Store under fileId as well
        metadataCacheWithTTL.set(fileId, {
            ...entry,
            clientId,
        });
        clientIdToFileId.set(clientId, fileId);
    } else {
        console.log('[mapClientIdToFileId] No entry found for clientId:', clientId);
    }
}

/**
 * Stores file encryption metadata in the cache.
 * @param fileId - The file ID (from server response after upload)
 * @param metadata - The encryption metadata
 */
export function cacheFileEncryptionMetadata(fileId: string, metadata: EncryptedFileMetadata): void {
    cleanExpiredEntries();
    metadataCacheWithTTL.set(fileId, {
        metadata,
        timestamp: Date.now(),
    });
}

/**
 * Gets file encryption metadata from the cache.
 * @param id - The file ID or client ID
 * @returns The metadata or null if not found/expired
 */
export function getCachedFileMetadata(id: string): EncryptedFileMetadata | null {
    console.log('[getCachedFileMetadata] Looking up id:', id);
    console.log('[getCachedFileMetadata] Cache size:', metadataCacheWithTTL.size, 'clientIdToFileId size:', clientIdToFileId.size);

    // First try direct lookup
    let entry = metadataCacheWithTTL.get(id);
    console.log('[getCachedFileMetadata] Direct lookup result:', entry ? 'found' : 'not found');

    // If not found and it looks like a clientId, try the mapping
    if (!entry) {
        const fileId = clientIdToFileId.get(id);
        console.log('[getCachedFileMetadata] clientIdToFileId lookup for', id, ':', fileId || 'not found');
        if (fileId) {
            entry = metadataCacheWithTTL.get(fileId);
            console.log('[getCachedFileMetadata] Lookup via mapped fileId:', entry ? 'found' : 'not found');
        }
    }

    if (!entry) {
        console.log('[getCachedFileMetadata] No entry found for:', id);
        return null;
    }

    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
        console.log('[getCachedFileMetadata] Entry expired for:', id);
        metadataCacheWithTTL.delete(id);
        if (entry.clientId) {
            clientIdToFileId.delete(entry.clientId);
            metadataCacheWithTTL.delete(entry.clientId);
        }
        return null;
    }

    console.log('[getCachedFileMetadata] Found metadata for:', id, 'original name:', entry.metadata.original.name);
    return entry.metadata;
}

/**
 * Removes file encryption metadata from the cache after it's been attached to a post.
 * @param fileIds - The file IDs to remove
 */
export function clearCachedFileMetadata(fileIds: string[]): void {
    for (const fileId of fileIds) {
        const entry = metadataCacheWithTTL.get(fileId);
        if (entry?.clientId) {
            clientIdToFileId.delete(entry.clientId);
            metadataCacheWithTTL.delete(entry.clientId);
        }
        metadataCacheWithTTL.delete(fileId);
    }
}

/**
 * Encrypts a file for a given channel.
 * Returns the encrypted blob and metadata.
 *
 * @param file - The original file to encrypt
 * @param channelId - The channel ID (for fetching recipient keys)
 * @param senderId - The sender's user ID
 * @returns Object with encrypted blob and metadata
 */
export async function encryptFileForChannel(
    file: File,
    channelId: string,
    senderId: string,
): Promise<{encryptedBlob: Blob; encryptedFile: File; metadata: EncryptedFileMetadata}> {
    // Ensure we have encryption keys
    await ensureEncryptionKeys();

    // Get all session keys for channel members
    const sessionKeys = await getChannelRecipientKeys(channelId);

    // Add sender's own session key
    const senderSessionId = getSessionId();
    const senderPublicKey = getPublicKeyJwk();
    if (senderSessionId && senderPublicKey) {
        sessionKeys.push({
            userId: senderId,
            sessionId: senderSessionId,
            publicKey: senderPublicKey,
        });
    }

    if (sessionKeys.length === 0) {
        throw new Error('No recipients with encryption keys found');
    }

    // Encrypt the file
    const {encryptedBlob, metadata} = await encryptFile(
        file,
        sessionKeys.map((k) => ({sessionId: k.sessionId, publicKey: k.publicKey})),
        senderId,
    );

    // Create a File object from the encrypted blob
    // Use obfuscated filename - original name is stored only in encrypted metadata
    // This prevents leaking filename to server/observers without decryption keys
    const obfuscatedName = `encrypted_${Date.now()}.penc`;
    const encryptedFile = new File(
        [encryptedBlob],
        obfuscatedName,
        {type: ENCRYPTED_FILE_MIME_TYPE},
    );

    return {encryptedBlob, encryptedFile, metadata};
}

/**
 * Attaches file encryption metadata to a post's props before it's sent.
 * Called from the message encryption hook when posting encrypted messages with files.
 *
 * @param post - The post being created
 * @param fileInfos - The file infos attached to the post
 * @returns Modified post with encrypted_files in props
 */
export function attachFileEncryptionMetadata(
    post: Post,
    fileInfos: FileInfo[],
): Post {
    console.log('[attachFileEncryptionMetadata] Called with', fileInfos.length, 'files');

    if (!fileInfos || fileInfos.length === 0) {
        return post;
    }

    const encryptedFilesProps: Record<string, EncryptedFileMetadata> = {};
    let hasEncryptedFiles = false;

    for (const fileInfo of fileInfos) {
        console.log('[attachFileEncryptionMetadata] Checking file:', fileInfo.id, fileInfo.name);
        const metadata = getCachedFileMetadata(fileInfo.id);
        if (metadata) {
            console.log('[attachFileEncryptionMetadata] Found metadata for file:', fileInfo.id, metadata.original.name);
            encryptedFilesProps[fileInfo.id] = metadata;
            hasEncryptedFiles = true;
        } else {
            console.log('[attachFileEncryptionMetadata] No metadata found for file:', fileInfo.id);
        }
    }

    if (!hasEncryptedFiles) {
        console.log('[attachFileEncryptionMetadata] No encrypted files found, returning original post');
        return post;
    }

    console.log('[attachFileEncryptionMetadata] Attaching encrypted_files props with', Object.keys(encryptedFilesProps).length, 'files');

    // Clear the cached metadata since it's now in the post
    const fileIds = fileInfos.map((f) => f.id);
    clearCachedFileMetadata(fileIds);

    return {
        ...post,
        props: {
            ...post.props,
            encrypted_files: encryptedFilesProps,
        },
    };
}

/**
 * Checks if any files in a post are encrypted.
 * @param post - The post to check
 * @returns true if any files have encryption metadata
 */
export function hasEncryptedFiles(post: Post): boolean {
    const encryptedFiles = post.props?.encrypted_files as Record<string, EncryptedFileMetadata> | undefined;
    return !!encryptedFiles && Object.keys(encryptedFiles).length > 0;
}

/**
 * Gets the number of encrypted files in a post.
 * @param post - The post to check
 * @returns The count of encrypted files
 */
export function getEncryptedFileCount(post: Post): number {
    const encryptedFiles = post.props?.encrypted_files as Record<string, EncryptedFileMetadata> | undefined;
    return encryptedFiles ? Object.keys(encryptedFiles).length : 0;
}
