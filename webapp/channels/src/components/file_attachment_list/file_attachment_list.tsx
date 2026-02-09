// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import {useSelector} from 'react-redux';

import type {FileInfo} from '@mattermost/types/files';

import {sortFileInfos} from 'mattermost-redux/utils/file_utils';

import FileAttachment from 'components/file_attachment';
import FilePreviewModal from 'components/file_preview_modal';
import MultiImageView from 'components/multi_image_view';
import SingleImageView from 'components/single_image_view';
import VideoPlayer from 'components/video_player';
import {useEncryptedFile} from 'components/file_attachment/use_encrypted_file';

import {FileTypes, ModalIdentifiers} from 'utils/constants';
import {isEncryptedFile} from 'utils/encryption/file';
import {getFileTypeFromMime} from 'utils/file_utils';
import {getFileType} from 'utils/utils';

import type {GlobalState} from 'types/store';

import type {OwnProps, PropsFromRedux} from './index';

type Props = OwnProps & PropsFromRedux;

/**
 * Wrapper for single encrypted files. Decrypts first to determine the actual
 * file type, then renders the appropriate view component (SingleImageView,
 * VideoPlayer, or FileAttachment).
 */
function EncryptedSingleFileView({
    fileInfo,
    postId,
    compactDisplay,
    isEmbedVisible,
    isInPermalink,
    disableActions,
    disableDownload,
    handleFileDropdownOpened,
    overrideGenerateFileDownloadUrl,
    openModal,
    enableSVGs,
    videoEmbedEnabled,
    maxVideoHeight,
}: {
    fileInfo: FileInfo;
    postId: string;
    compactDisplay?: boolean;
    isEmbedVisible?: boolean;
    isInPermalink?: boolean;
    disableActions?: boolean;
    disableDownload?: boolean;
    handleFileDropdownOpened?: (open: boolean) => void;
    overrideGenerateFileDownloadUrl?: (fileId: string) => string;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    openModal: (modalData: any) => void;
    enableSVGs: boolean;
    videoEmbedEnabled: boolean;
    maxVideoHeight?: number;
}) {
    const {
        originalFileInfo,
        status: decryptionStatus,
    } = useEncryptedFile(fileInfo, postId, true);

    const handleImageClick = useCallback((indexClicked: number) => {
        openModal({
            modalId: ModalIdentifiers.FILE_PREVIEW_MODAL,
            dialogType: FilePreviewModal,
            dialogProps: {
                postId,
                fileInfos: [fileInfo],
                startIndex: indexClicked,
            },
        });
    }, [fileInfo, postId, openModal]);

    // Decryption failed - show as encrypted file attachment
    if (decryptionStatus === 'failed') {
        return (
            <div
                data-testid='fileAttachmentList'
                className='post-image__columns clearfix'
            >
                <FileAttachment
                    fileInfo={fileInfo}
                    index={0}
                    handleImageClick={handleImageClick}
                    compactDisplay={compactDisplay}
                    handleFileDropdownOpened={handleFileDropdownOpened}
                    preventDownload={disableDownload}
                    disableActions={disableActions}
                    overrideGenerateFileDownloadUrl={overrideGenerateFileDownloadUrl}
                    postId={postId}
                />
            </div>
        );
    }

    // Still decrypting - show loading placeholder
    if (!originalFileInfo) {
        return (
            <div
                data-testid='fileAttachmentList'
                className='post-image__columns clearfix'
            >
                <div
                    className='post-image__column'
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '100px',
                    }}
                >
                    <span style={{color: 'rgba(var(--center-channel-color-rgb), 0.56)', fontSize: '14px'}}>
                        {'Loading...'}
                    </span>
                </div>
            </div>
        );
    }

    // Decrypted - render based on actual file type
    const mimeType = getFileTypeFromMime(originalFileInfo.type);

    if (videoEmbedEnabled && mimeType === 'video') {
        return (
            <VideoPlayer
                fileInfo={fileInfo}
                postId={postId}
                index={0}
                maxHeight={maxVideoHeight}
                compactDisplay={compactDisplay}
            />
        );
    }

    if (mimeType === 'image') {
        return (
            <SingleImageView
                fileInfo={fileInfo}
                isEmbedVisible={isEmbedVisible}
                postId={postId}
                compactDisplay={compactDisplay}
                isInPermalink={isInPermalink}
                disableActions={disableActions}
            />
        );
    }

    // Other file types (audio, documents, etc.)
    return (
        <div
            data-testid='fileAttachmentList'
            className='post-image__columns clearfix'
        >
            <FileAttachment
                fileInfo={fileInfo}
                index={0}
                handleImageClick={handleImageClick}
                compactDisplay={compactDisplay}
                handleFileDropdownOpened={handleFileDropdownOpened}
                preventDownload={disableDownload}
                disableActions={disableActions}
                overrideGenerateFileDownloadUrl={overrideGenerateFileDownloadUrl}
                postId={postId}
            />
        </div>
    );
}

export default function FileAttachmentList(props: Props) {
    // Get encryption state to resolve actual file types for encrypted files
    const encryptedOriginalInfo = useSelector((state: GlobalState) =>
        state.views.encryption?.encryptedFiles?.originalInfo || {},
    );

    const handleImageClick = (indexClicked: number) => {
        props.actions.openModal({
            modalId: ModalIdentifiers.FILE_PREVIEW_MODAL,
            dialogType: FilePreviewModal,
            dialogProps: {
                postId: props.post.id,
                fileInfos: props.fileInfos,
                startIndex: indexClicked,
            },
        });
    };

    const {
        compactDisplay,
        enableSVGs,
        fileInfos,
        fileCount,
        locale,
        isInPermalink,
        imageMultiEnabled,
        videoEmbedEnabled,
        maxVideoHeight,
    } = props;

    const sortedFileInfos = useMemo(() => sortFileInfos(fileInfos ? [...fileInfos] : [], locale), [fileInfos, locale]);

    if (fileInfos.length === 0) {
        return null;
    }

    // Comprehensive encrypted file check using all available indicators:
    // 1. MIME type (application/x-penc) - for files with correct server MIME
    // 2. Filename pattern (encrypted_*.penc) - for files with correct naming
    // 3. Post props metadata (post.props.encrypted_files) - definitive source
    const encryptedFilesProps = props.post?.props?.encrypted_files;
    const isFileEncrypted = (fi: FileInfo): boolean => {
        return isEncryptedFile(fi) ||
            Boolean(fi.name?.startsWith('encrypted_') && fi.name?.endsWith('.penc')) ||
            Boolean(encryptedFilesProps?.[fi.id]);
    };

    // Helper to get resolved file type for a file
    const getResolvedType = (fi: FileInfo): string | null => {
        if (isFileEncrypted(fi)) {
            const origInfo = encryptedOriginalInfo[fi.id];
            if (origInfo) {
                const mimeType = getFileTypeFromMime(origInfo.type);
                if (mimeType === 'video') {
                    return FileTypes.VIDEO;
                }
                if (mimeType === 'audio') {
                    return FileTypes.AUDIO;
                }
                if (mimeType === 'image') {
                    return FileTypes.IMAGE;
                }
                return FileTypes.OTHER;
            }
            // Not yet decrypted - type unknown
            return null;
        }
        return getFileType(fi.extension);
    };

    // Handle single encrypted file - type unknown until decrypted
    // Uses wrapper that decrypts first, then renders the correct view
    if (fileInfos && fileInfos.length === 1 && !fileInfos[0].archived && isFileEncrypted(fileInfos[0])) {
        return (
            <EncryptedSingleFileView
                fileInfo={fileInfos[0]}
                postId={props.post.id}
                compactDisplay={compactDisplay}
                isEmbedVisible={props.isEmbedVisible}
                isInPermalink={isInPermalink}
                disableActions={props.disableActions}
                disableDownload={props.disableDownload}
                handleFileDropdownOpened={props.handleFileDropdownOpened}
                overrideGenerateFileDownloadUrl={props.overrideGenerateFileDownloadUrl}
                openModal={props.actions.openModal}
                enableSVGs={enableSVGs}
                videoEmbedEnabled={videoEmbedEnabled}
                maxVideoHeight={maxVideoHeight}
            />
        );
    }

    // Handle single video file with VideoEmbed feature flag
    if (fileInfos && fileInfos.length === 1 && !fileInfos[0].archived && videoEmbedEnabled) {
        const fileType = getResolvedType(fileInfos[0]);
        if (fileType === FileTypes.VIDEO) {
            return (
                <VideoPlayer
                    fileInfo={fileInfos[0]}
                    postId={props.post.id}
                    index={0}
                    maxHeight={maxVideoHeight}
                    compactDisplay={compactDisplay}
                />
            );
        }
    }

    // Handle single image file
    if (fileInfos && fileInfos.length === 1 && !fileInfos[0].archived) {
        const fileType = getResolvedType(fileInfos[0]);

        if (fileType === FileTypes.IMAGE || (fileType === FileTypes.SVG && enableSVGs)) {
            return (
                <SingleImageView
                    fileInfo={fileInfos[0]}
                    isEmbedVisible={props.isEmbedVisible}
                    postId={props.post.id}
                    compactDisplay={compactDisplay}
                    isInPermalink={isInPermalink}
                    disableActions={props.disableActions}
                />
            );
        }

        // Encrypted file not yet decrypted - render as FileAttachment which will
        // auto-decrypt and trigger a re-render with the correct type
        if (fileType === null) {
            return (
                <div
                    data-testid='fileAttachmentList'
                    className='post-image__columns clearfix'
                >
                    <FileAttachment
                        key={fileInfos[0].id}
                        fileInfo={fileInfos[0]}
                        index={0}
                        handleImageClick={handleImageClick}
                        compactDisplay={compactDisplay}
                        handleFileDropdownOpened={props.handleFileDropdownOpened}
                        preventDownload={props.disableDownload}
                        disableActions={props.disableActions}
                        overrideGenerateFileDownloadUrl={props.overrideGenerateFileDownloadUrl}
                        postId={props.post.id}
                    />
                </div>
            );
        }
    } else if (fileCount === 1 && props.isEmbedVisible && !fileInfos?.[0]) {
        return (
            <div style={style.minHeightPlaceholder}/>
        );
    }

    // With ImageMulti enabled, check if we have multiple images to display full-size
    if (imageMultiEnabled && sortedFileInfos && sortedFileInfos.length > 1) {
        const imageFiles = sortedFileInfos.filter((fileInfo) => {
            if (fileInfo.archived) {
                return false;
            }
            const fileType = getResolvedType(fileInfo);
            return fileType === FileTypes.IMAGE || (fileType === FileTypes.SVG && enableSVGs);
        });

        const nonImageFiles = sortedFileInfos.filter((fileInfo) => {
            if (fileInfo.archived) {
                return true; // Keep archived files in the regular list
            }
            const fileType = getResolvedType(fileInfo);
            return !(fileType === FileTypes.IMAGE || (fileType === FileTypes.SVG && enableSVGs));
        });

        // If all files are images, use MultiImageView
        if (imageFiles.length === sortedFileInfos.length) {
            return (
                <MultiImageView
                    fileInfos={imageFiles}
                    postId={props.post.id}
                    compactDisplay={compactDisplay}
                    isInPermalink={isInPermalink}
                />
            );
        }

        // Mixed content: render images with MultiImageView and other files with FileAttachment
        if (imageFiles.length > 0) {
            const postFiles = [];

            // Add MultiImageView for images
            postFiles.push(
                <MultiImageView
                    key='multi-image-view'
                    fileInfos={imageFiles}
                    postId={props.post.id}
                    compactDisplay={compactDisplay}
                    isInPermalink={isInPermalink}
                />,
            );

            // Separate videos from other non-image files
            const videoFiles = nonImageFiles.filter((f) => getResolvedType(f) === FileTypes.VIDEO && !f.archived);
            const otherFiles = nonImageFiles.filter((f) => getResolvedType(f) !== FileTypes.VIDEO || f.archived);

            // Add other non-image files (not videos)
            for (let i = 0; i < otherFiles.length; i++) {
                const fileInfo = otherFiles[i];
                const originalIndex = sortedFileInfos.indexOf(fileInfo);
                const isDeleted = fileInfo.delete_at > 0;

                postFiles.push(
                    <FileAttachment
                        key={fileInfo.id}
                        fileInfo={fileInfo}
                        index={originalIndex}
                        handleImageClick={handleImageClick}
                        compactDisplay={compactDisplay}
                        handleFileDropdownOpened={props.handleFileDropdownOpened}
                        preventDownload={props.disableDownload}
                        disableActions={props.disableActions}
                        disableThumbnail={isDeleted}
                        disablePreview={isDeleted}
                        overrideGenerateFileDownloadUrl={props.overrideGenerateFileDownloadUrl}
                        postId={props.post.id}
                    />,
                );
            }

            // Add videos on their own lines (wrapped in a full-width container)
            if (videoEmbedEnabled && videoFiles.length > 0) {
                for (let i = 0; i < videoFiles.length; i++) {
                    const fileInfo = videoFiles[i];
                    const originalIndex = sortedFileInfos.indexOf(fileInfo);

                    postFiles.push(
                        <div
                            key={`video-wrapper-${fileInfo.id}`}
                            className='video-player-row'
                            style={{width: '100%', clear: 'both'}}
                        >
                            <VideoPlayer
                                fileInfo={fileInfo}
                                postId={props.post.id}
                                index={originalIndex}
                                maxHeight={maxVideoHeight}
                                compactDisplay={compactDisplay}
                            />
                        </div>,
                    );
                }
            }

            return (
                <div
                    data-testid='fileAttachmentList'
                    className='post-image__columns clearfix'
                >
                    {postFiles}
                </div>
            );
        }
    }

    // Default rendering
    const postFiles = [];
    if (sortedFileInfos && sortedFileInfos.length > 0) {
        for (let i = 0; i < sortedFileInfos.length; i++) {
            const fileInfo = sortedFileInfos[i];
            const isDeleted = fileInfo.delete_at > 0;
            const fileType = getResolvedType(fileInfo);

            // Use VideoPlayer for video files if VideoEmbed is enabled
            // Wrap in full-width container so videos go on their own line
            if (videoEmbedEnabled && fileType === FileTypes.VIDEO && !fileInfo.archived) {
                postFiles.push(
                    <div
                        key={`video-wrapper-${fileInfo.id}`}
                        className='video-player-row'
                        style={{width: '100%', clear: 'both'}}
                    >
                        <VideoPlayer
                            fileInfo={fileInfo}
                            postId={props.post.id}
                            index={i}
                            maxHeight={maxVideoHeight}
                            compactDisplay={compactDisplay}
                        />
                    </div>,
                );
            } else {
                postFiles.push(
                    <FileAttachment
                        key={fileInfo.id}
                        fileInfo={sortedFileInfos[i]}
                        index={i}
                        handleImageClick={handleImageClick}
                        compactDisplay={compactDisplay}
                        handleFileDropdownOpened={props.handleFileDropdownOpened}
                        preventDownload={props.disableDownload}
                        disableActions={props.disableActions}
                        disableThumbnail={isDeleted}
                        disablePreview={isDeleted}
                        overrideGenerateFileDownloadUrl={props.overrideGenerateFileDownloadUrl}
                        postId={props.post.id}
                    />,
                );
            }
        }
    } else if (fileCount > 0) {
        for (let i = 0; i < fileCount; i++) {
            // Add a placeholder to avoid pop-in once we get the file infos for this post
            postFiles.push(
                <div
                    key={`fileCount-${i}`}
                    className='post-image__column post-image__column--placeholder'
                />,
            );
        }
    }

    return (
        <div
            data-testid='fileAttachmentList'
            className='post-image__columns clearfix'
        >
            {postFiles}
        </div>
    );
}

const style = {
    minHeightPlaceholder: {minHeight: '385px'},
};
