// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import classNames from 'classnames';

import type {FileInfo} from '@mattermost/types/files';

import {getFilePreviewUrl, getFileUrl} from 'mattermost-redux/utils/file_utils';

import FilePreviewModal from 'components/file_preview_modal';
import SizeAwareImage from 'components/size_aware_image';
import {useEncryptedFile} from 'components/file_attachment/use_encrypted_file';

import {ModalIdentifiers} from 'utils/constants';
import {isEncryptedFile} from 'utils/encryption/file';

import type {PropsFromRedux} from './index';

import './multi_image_view.scss';

export interface Props extends PropsFromRedux {
    fileInfos: FileInfo[];
    postId: string;
    compactDisplay?: boolean;
    isInPermalink?: boolean;
    spoilerFileIds?: string[];
}

/**
 * Wrapper for a single image item that may be encrypted.
 * Hooks can't be called in loops, so each image needs its own component.
 */
function MultiImageItem({
    fileInfo,
    postId,
    index,
    compactDisplay,
    isInPermalink,
    isLoaded,
    isSpoilered,
    onImageClick,
    onImageLoaded,
    maxImageHeight,
    maxImageWidth,
}: {
    fileInfo: FileInfo;
    postId: string;
    index: number;
    compactDisplay?: boolean;
    isInPermalink?: boolean;
    isLoaded: boolean;
    isSpoilered?: boolean;
    onImageClick: (index: number) => void;
    onImageLoaded: (fileId: string) => void;
    maxImageHeight?: number;
    maxImageWidth?: number;
}) {
    const [spoilerRevealed, setSpoilerRevealed] = useState(false);
    const showSpoilerOverlay = isSpoilered && !spoilerRevealed;
    const isEncrypted = isEncryptedFile(fileInfo) ||
        Boolean(fileInfo.name?.startsWith('encrypted_') && fileInfo.name?.endsWith('.penc'));

    const {
        fileUrl: decryptedFileUrl,
        status: decryptionStatus,
    } = useEncryptedFile(fileInfo, postId, isEncrypted);

    const {has_preview_image: hasPreviewImage, id} = fileInfo;

    let fileUrl: string;
    let previewUrl: string;

    if (isEncrypted) {
        // Use the full decrypted blob URL for both display and download
        const url = decryptedFileUrl || '';
        fileUrl = url;
        previewUrl = url;
    } else {
        fileUrl = getFileUrl(id);
        previewUrl = hasPreviewImage ? getFilePreviewUrl(id) : fileUrl;
    }

    const dimensions = {
        width: fileInfo.width || 0,
        height: fileInfo.height || 0,
    };

    // Show placeholder while encrypted file is decrypting
    if (isEncrypted && !decryptedFileUrl) {
        const isDecrypting = decryptionStatus !== 'failed';
        return (
            <div
                className={classNames('multi-image-view__item')}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '100px',
                    minWidth: '100px',
                    background: 'rgba(var(--center-channel-color-rgb), 0.04)',
                    borderRadius: '4px',
                }}
            >
                <span style={{color: 'rgba(var(--center-channel-color-rgb), 0.56)', fontSize: '13px'}}>
                    {isDecrypting ? 'Loading...' : 'Encrypted file'}
                </span>
            </div>
        );
    }

    return (
        <div
            className={classNames('multi-image-view__item', {
                'multi-image-view__item--loaded': isLoaded,
            })}
        >
            <div
                className={classNames('multi-image-spoiler-wrapper', {
                    'multi-image-spoiler-wrapper--blurred': showSpoilerOverlay,
                })}
                onClick={showSpoilerOverlay ? (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSpoilerRevealed(true);
                } : undefined}
            >
                <SizeAwareImage
                    onClick={showSpoilerOverlay ? undefined : () => onImageClick(index)}
                    className={classNames('multi-image-view__image', {
                        'compact-display': compactDisplay,
                        'is-permalink': isInPermalink,
                    })}
                    src={previewUrl}
                    dimensions={dimensions}
                    fileInfo={fileInfo}
                    fileURL={fileUrl}
                    onImageLoaded={() => onImageLoaded(id)}
                    showLoader={true}
                    handleSmallImageContainer={true}
                    maxHeight={maxImageHeight}
                    maxWidth={maxImageWidth}
                />
                {showSpoilerOverlay && (
                    <div className='spoiler-overlay'>
                        <span className='spoiler-overlay__text'>{'SPOILER'}</span>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function MultiImageView(props: Props) {
    const {fileInfos, postId, compactDisplay, isInPermalink} = props;
    const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});

    const handleImageClick = useCallback((index: number) => {
        props.actions.openModal({
            modalId: ModalIdentifiers.FILE_PREVIEW_MODAL,
            dialogType: FilePreviewModal,
            dialogProps: {
                fileInfos,
                postId,
                startIndex: index,
            },
        });
    }, [fileInfos, postId, props.actions]);

    const handleImageLoaded = useCallback((fileId: string) => {
        setLoadedImages((prev) => ({
            ...prev,
            [fileId]: true,
        }));
    }, []);

    if (!fileInfos || fileInfos.length === 0) {
        return null;
    }

    return (
        <div
            className={classNames('multi-image-view', {
                'compact-display': compactDisplay,
                'is-permalink': isInPermalink,
            })}
            data-testid='multiImageView'
        >
            {fileInfos.map((fileInfo, index) => {
                if (!fileInfo || fileInfo.archived) {
                    return null;
                }

                return (
                    <MultiImageItem
                        key={fileInfo.id}
                        fileInfo={fileInfo}
                        postId={postId}
                        index={index}
                        compactDisplay={compactDisplay}
                        isInPermalink={isInPermalink}
                        isLoaded={loadedImages[fileInfo.id]}
                        isSpoilered={props.spoilerFileIds?.includes(fileInfo.id)}
                        onImageClick={handleImageClick}
                        onImageLoaded={handleImageLoaded}
                        maxImageHeight={props.maxImageHeight || undefined}
                        maxImageWidth={props.maxImageWidth || undefined}
                    />
                );
            })}
        </div>
    );
}
