// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {useSelector} from 'react-redux';

import type {FileInfo} from '@mattermost/types/files';

import {sortFileInfos} from 'mattermost-redux/utils/file_utils';

import FileAttachment from 'components/file_attachment';
import FilePreviewModal from 'components/file_preview_modal';
import MultiImageView from 'components/multi_image_view';
import SingleImageView from 'components/single_image_view';
import VideoPlayer from 'components/video_player';

import {FileTypes, ModalIdentifiers} from 'utils/constants';
import {isEncryptedFile} from 'utils/encryption/file';
import {getFileTypeFromMime} from 'utils/file_utils';
import {getFileType} from 'utils/utils';

import type {GlobalState} from 'types/store';

import type {OwnProps, PropsFromRedux} from './index';

type Props = OwnProps & PropsFromRedux;

/**
 * Resolves the actual file type, taking encryption into account.
 * For encrypted files with decrypted originalInfo, uses the real MIME type.
 * For encrypted files not yet decrypted, returns null.
 * For normal files, uses extension-based detection.
 */
function resolveFileType(
    fileInfo: FileInfo,
    encryptedOriginalInfo: Record<string, {name: string; type: string; size: number}>,
    enableSVGs: boolean,
): string | null {
    if (isEncryptedFile(fileInfo)) {
        const origInfo = encryptedOriginalInfo[fileInfo.id];
        if (origInfo) {
            const mimeType = getFileTypeFromMime(origInfo.type);
            // Map getFileTypeFromMime results to FileTypes constants
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
        // Not yet decrypted - return null to indicate unknown
        return null;
    }
    return getFileType(fileInfo.extension);
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

    // Helper to get resolved file type for a file
    const getResolvedType = (fi: FileInfo) => resolveFileType(fi, encryptedOriginalInfo, enableSVGs);

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
