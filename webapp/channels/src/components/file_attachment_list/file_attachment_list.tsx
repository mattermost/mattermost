// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import {useSelector} from 'react-redux';

import {getFeatureFlagValue} from 'mattermost-redux/selectors/entities/general';
import {sortFileInfos} from 'mattermost-redux/utils/file_utils';

import FileAttachment from 'components/file_attachment';
import FilePreviewModal from 'components/file_preview_modal';
import SingleImageView from 'components/single_image_view';

import {FileTypes, ModalIdentifiers} from 'utils/constants';
import {getFileType} from 'utils/utils';

import type {GlobalState} from 'types/store';

import MediaGallery from './media_gallery';

import type {OwnProps, PropsFromRedux} from './index';

type Props = OwnProps & PropsFromRedux;

export default function FileAttachmentList(props: Props) {
    const mediaGalleryEnabled = useSelector((state: GlobalState) =>
        getFeatureFlagValue(state, 'MediaGallery') === 'true');

    const handleImageClick = useCallback((indexClicked: number) => {
        props.actions.openModal({
            modalId: ModalIdentifiers.FILE_PREVIEW_MODAL,
            dialogType: FilePreviewModal,
            dialogProps: {
                postId: props.post.id,
                fileInfos: props.fileInfos,
                startIndex: indexClicked,
            },
        });
    }, [props.actions, props.post.id, props.fileInfos]);

    const {
        compactDisplay,
        enableSVGs,
        fileInfos,
        fileCount,
        locale,
        isInPermalink,
    } = props;

    const sortedFileInfos = useMemo(() => sortFileInfos(fileInfos ? [...fileInfos] : [], locale), [fileInfos, locale]);

    if (fileInfos.length === 0) {
        return null;
    }

    if (mediaGalleryEnabled && !isInPermalink && !props.firstFileRejected) {
        const isMulti = fileInfos.length > 1;
        const isSingleVideo = fileInfos.length === 1 &&
            !fileInfos[0].archived &&
            getFileType(fileInfos[0].extension) === FileTypes.VIDEO;

        if (isMulti || isSingleVideo) {
            const galleryEligible = sortedFileInfos.some((f) => {
                const t = getFileType(f.extension);
                return t === FileTypes.IMAGE || t === FileTypes.VIDEO;
            });
            if (galleryEligible) {
                return (
                    <MediaGallery
                        fileInfos={sortedFileInfos}
                        postId={props.post.id}
                        compactDisplay={compactDisplay}
                        onItemClick={handleImageClick}
                    />
                );
            }
        }
    }

    // For single image files, use SingleImageView UNLESS the file is rejected
    // If rejected, we want to show the file attachment card instead
    if (fileInfos && fileInfos.length === 1 && !fileInfos[0].archived && !props.firstFileRejected) {
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

    const postFiles = [];
    if (sortedFileInfos && sortedFileInfos.length > 0) {
        for (let i = 0; i < sortedFileInfos.length; i++) {
            const fileInfo = sortedFileInfos[i];
            const isDeleted = fileInfo.delete_at > 0;
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
                />,
            );
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
