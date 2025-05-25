// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useState} from 'react';
import {useIntl} from 'react-intl';

import {DownloadOutlineIcon, MenuDownIcon, MenuRightIcon} from '@mattermost/compass-icons/components';
import type {FileInfo} from '@mattermost/types/files';

import SingleImageView from '../../../components/single_image_view';

import type {PropsFromRedux} from './index';

import './image_gallery.scss';

type Props = PropsFromRedux & {
    fileInfos: FileInfo[];
    enablePublicLink?: boolean;
    canDownloadFiles?: boolean;
    onToggleCollapse?: (collapsed: boolean) => void;
    isEmbedVisible?: boolean;
    postId: string;
};

const ImageGallery = (props: Props) => {
    const {
        fileInfos,
        canDownloadFiles = true,
        handleImageClick,
        onToggleCollapse,
        isEmbedVisible = true,
        postId,
    } = props;

    // Use the allFilesForPost from props (either passed explicitly or from Redux)
    const allFilesForPost = props.allFilesForPost;

    const [isCollapsed, setIsCollapsed] = useState(!isEmbedVisible);
    const [isDownloading, setIsDownloading] = useState(false);
    const {formatMessage} = useIntl();

    // Calculate the dynamic gallery height based on the tallest image, up to 216px max
    // For small images (< 216px), add 16px padding to their height in the calculation
    const galleryHeight = Math.min(
        Math.max(
            ...fileInfos.map((fileInfo) => {
                const imageHeight = fileInfo.height || 0;

                // If it's a small image, add padding to the height for gallery calculation
                return imageHeight < 216 ? imageHeight + 16 : imageHeight;
            }),
            48, // Minimum height to ensure usability
        ),
        216, // Maximum height
    );

    const toggleGallery = () => {
        const newCollapsed = !isCollapsed;
        setIsCollapsed(newCollapsed);
        onToggleCollapse?.(newCollapsed);
    };

    const handleDownloadAll = async () => {
        if (isDownloading || !canDownloadFiles) {
            return;
        }
        setIsDownloading(true);
        try {
            fileInfos.forEach((fileInfo) => {
                const link = document.createElement('a');
                link.href = fileInfo.link || '';
                link.download = fileInfo.name;
                link.click();
            });
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className='image-gallery'>
            <div className='image-gallery__header'>
                <button
                    className='image-gallery__toggle'
                    onClick={toggleGallery}
                >
                    {isCollapsed ? (
                        <>
                            <MenuRightIcon size={16}/>
                            {formatMessage(
                                {
                                    id: 'image_gallery.show_images',
                                    defaultMessage: 'Show {count} images',
                                },
                                {count: fileInfos.length},
                            )}
                        </>
                    ) : (
                        <>
                            <MenuDownIcon size={16}/>
                            {formatMessage(
                                {
                                    id: 'image_gallery.hide_images',
                                    defaultMessage: '{count} images',
                                },
                                {count: fileInfos.length},
                            )}
                        </>
                    )}
                </button>
                <span className='image-gallery__separator'/>
                <button
                    className='image-gallery__download-all'
                    onClick={handleDownloadAll}
                    disabled={isDownloading || !canDownloadFiles}
                >
                    <DownloadOutlineIcon size={12}/>
                    {formatMessage({
                        id: 'image_gallery.download_all',
                        defaultMessage: 'Download All',
                    })}
                </button>
            </div>
            <div
                className={classNames('image-gallery__body', {
                    collapsed: isCollapsed,
                })}
            >
                {fileInfos.map((fileInfo) => {
                    // Calculate the width based on the image's aspect ratio
                    const aspectRatio = fileInfo.width && fileInfo.height ? fileInfo.width / fileInfo.height : 1;

                    // For small images (height < 216px), use their natural width but gallery height for container
                    // For larger images, calculate width based on dynamic gallery height
                    const isSmallImage = (fileInfo.height || 0) < 216;
                    const itemWidth = isSmallImage ? (fileInfo.width || 0) + 16 : galleryHeight * aspectRatio; // Add 16px for left/right padding

                    // For height: if small image and it's the tallest, use natural height + padding
                    // Otherwise, use gallery height to match other taller images
                    const naturalHeightWithPadding = (fileInfo.height || 0) + 16;
                    const itemHeight = isSmallImage && naturalHeightWithPadding === galleryHeight ? naturalHeightWithPadding : galleryHeight;

                    return (
                        <div
                            key={fileInfo.id}
                            className={`image-gallery__item ${isSmallImage ? 'image-gallery__item--small' : ''}`}
                            style={{
                                width: `${itemWidth}px`,
                                height: `${itemHeight}px`,
                            }}
                        >
                            <SingleImageView
                                fileInfo={fileInfo}
                                fileInfos={allFilesForPost}
                                isEmbedVisible={isEmbedVisible}
                                postId={postId}
                                compactDisplay={false}
                                isInPermalink={false}
                                disableActions={false}
                                smallImageThreshold={216}
                                handleImageClick={() => {
                                    const startIndex = allFilesForPost?.findIndex((f) => f.id === fileInfo.id) ?? -1;
                                    if (startIndex >= 0 && allFilesForPost) {
                                        handleImageClick(startIndex, allFilesForPost);
                                    }
                                }}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ImageGallery;
