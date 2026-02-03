// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';

import {sortFileInfos} from 'mattermost-redux/utils/file_utils';

import FileAttachment from 'components/file_attachment';
import FilePreviewModal from 'components/file_preview_modal';
import MultiImageView from 'components/multi_image_view';
import SingleImageView from 'components/single_image_view';
import VideoPlayer from 'components/video_player';

import {FileTypes, ModalIdentifiers} from 'utils/constants';
import {isEncryptedFile} from 'utils/encryption/file';
import {getFileType} from 'utils/utils';

import type {OwnProps, PropsFromRedux} from './index';

type Props = OwnProps & PropsFromRedux;

export default function FileAttachmentList(props: Props) {
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

    // Handle single video file with VideoEmbed feature flag
    if (fileInfos && fileInfos.length === 1 && !fileInfos[0].archived && videoEmbedEnabled) {
        const fileType = getFileType(fileInfos[0].extension);
        if (fileType === FileTypes.VIDEO) {
            return (
                <VideoPlayer
                    fileInfo={fileInfos[0]}
                    postId={props.post.id}
                    index={0}
                    maxHeight={maxVideoHeight}
                    compactDisplay={compactDisplay}
                    handleImageClick={handleImageClick}
                />
            );
        }
    }

    // Handle single image file
    if (fileInfos && fileInfos.length === 1 && !fileInfos[0].archived) {
        const fileType = getFileType(fileInfos[0].extension);

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
            const fileType = getFileType(fileInfo.extension);
            return fileType === FileTypes.IMAGE || (fileType === FileTypes.SVG && enableSVGs);
        });

        const nonImageFiles = sortedFileInfos.filter((fileInfo) => {
            if (fileInfo.archived) {
                return true; // Keep archived files in the regular list
            }
            const fileType = getFileType(fileInfo.extension);
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

            // Add non-image files
            for (let i = 0; i < nonImageFiles.length; i++) {
                const fileInfo = nonImageFiles[i];
                const originalIndex = sortedFileInfos.indexOf(fileInfo);
                const isDeleted = fileInfo.delete_at > 0;
                const fileType = getFileType(fileInfo.extension);

                // Use VideoPlayer for video files if VideoEmbed is enabled
                if (videoEmbedEnabled && fileType === FileTypes.VIDEO) {
                    postFiles.push(
                        <VideoPlayer
                            key={fileInfo.id}
                            fileInfo={fileInfo}
                            postId={props.post.id}
                            index={originalIndex}
                            maxHeight={maxVideoHeight}
                            compactDisplay={compactDisplay}
                            handleImageClick={handleImageClick}
                        />,
                    );
                } else {
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
            const fileType = getFileType(fileInfo.extension);

            // Use VideoPlayer for video files if VideoEmbed is enabled
            if (videoEmbedEnabled && fileType === FileTypes.VIDEO && !fileInfo.archived) {
                postFiles.push(
                    <VideoPlayer
                        key={fileInfo.id}
                        fileInfo={fileInfo}
                        postId={props.post.id}
                        index={i}
                        maxHeight={maxVideoHeight}
                        compactDisplay={compactDisplay}
                        handleImageClick={handleImageClick}
                    />,
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
