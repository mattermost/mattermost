// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useState, useEffect, useCallback, useMemo} from 'react';

import {LockOutlineIcon} from '@mattermost/compass-icons/components';
import type {FileInfo} from '@mattermost/types/files';

import {getFilePreviewUrl, getFileUrl} from 'mattermost-redux/utils/file_utils';

import FilePreviewModal from 'components/file_preview_modal';
import SizeAwareImage from 'components/size_aware_image';
import {useEncryptedFile} from 'components/file_attachment/use_encrypted_file';

import {FileTypes, ModalIdentifiers} from 'utils/constants';
import {getFileExtensionFromType} from 'utils/file_utils';
import {
    getFileType,
} from 'utils/utils';

import type {PropsFromRedux} from './index';

const PREVIEW_IMAGE_MIN_DIMENSION = 50;
const DISPROPORTIONATE_HEIGHT_RATIO = 20;

export interface Props extends PropsFromRedux {
    postId: string;
    fileInfo: FileInfo;
    isRhsOpen: boolean;
    enablePublicLink: boolean;
    compactDisplay?: boolean;
    isEmbedVisible?: boolean;
    isInPermalink?: boolean;
    disableActions?: boolean;
}

export default function SingleImageView(props: Props) {
    const {fileInfo, compactDisplay, isInPermalink, postId} = props;

    const [loaded, setLoaded] = useState(false);
    const [dimensions, setDimensions] = useState({
        width: fileInfo?.width || 0,
        height: fileInfo?.height || 0,
    });

    // Check if file is encrypted and get decryption info (mattermost-extended)
    const {
        isEncrypted,
        fileUrl: decryptedFileUrl,
        thumbnailUrl: decryptedThumbnailUrl,
        status: decryptionStatus,
        originalFileInfo,
        decrypt,
    } = useEncryptedFile(fileInfo, postId, true); // autoDecrypt=true for images

    // Update dimensions when fileInfo changes
    useEffect(() => {
        if (fileInfo?.width !== dimensions.width || fileInfo?.height !== dimensions.height) {
            setDimensions({
                width: fileInfo?.width || 0,
                height: fileInfo?.height || 0,
            });
        }
    }, [fileInfo?.width, fileInfo?.height]);

    const imageLoaded = useCallback(() => {
        setLoaded(true);
    }, []);

    const handleImageClick = useCallback((e: React.KeyboardEvent | React.MouseEvent) => {
        e.preventDefault();

        // For encrypted files, use decrypted info in modal
        const modalFileInfo = isEncrypted && originalFileInfo ? {
            ...fileInfo,
            name: originalFileInfo.name,
            extension: originalFileInfo.name.split('.').pop() || getFileExtensionFromType(originalFileInfo.type),
            mime_type: originalFileInfo.type,
            size: originalFileInfo.size,
        } : fileInfo;

        props.actions.openModal({
            modalId: ModalIdentifiers.FILE_PREVIEW_MODAL,
            dialogType: FilePreviewModal,
            dialogProps: {
                fileInfos: [modalFileInfo],
                postId: props.postId,
                startIndex: 0,
            },
        });
    }, [fileInfo, isEncrypted, originalFileInfo, postId, props.actions]);

    const toggleEmbedVisibility = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        props.actions.toggleEmbedVisibility(props.postId);
    }, [props.actions, props.postId]);

    const getFilePublicLink = useCallback(() => {
        return props.actions.getFilePublicLink(fileInfo.id);
    }, [props.actions, fileInfo.id]);

    // Get display info - use decrypted metadata for encrypted files
    const displayFileInfo = useMemo(() => {
        if (!isEncrypted || !originalFileInfo) {
            return fileInfo;
        }
        const ext = originalFileInfo.name.split('.').pop() || getFileExtensionFromType(originalFileInfo.type);
        return {
            ...fileInfo,
            name: originalFileInfo.name,
            extension: ext,
            mime_type: originalFileInfo.type,
            size: originalFileInfo.size,
        };
    }, [fileInfo, isEncrypted, originalFileInfo]);

    // Determine URLs to use
    const {fileURL, previewURL} = useMemo(() => {
        if (isEncrypted) {
            // For encrypted files, use decrypted blob URLs
            const decryptedUrl = decryptedFileUrl || '';
            const decryptedPreview = decryptedThumbnailUrl || decryptedUrl;
            return {
                fileURL: decryptedUrl,
                previewURL: decryptedPreview,
            };
        }
        // Normal files use server URLs
        const {has_preview_image: hasPreviewImage, id} = fileInfo;
        const normalFileUrl = getFileUrl(id);
        const normalPreviewUrl = hasPreviewImage ? getFilePreviewUrl(id) : normalFileUrl;
        return {
            fileURL: normalFileUrl,
            previewURL: normalPreviewUrl,
        };
    }, [fileInfo, isEncrypted, decryptedFileUrl, decryptedThumbnailUrl]);

    if (fileInfo === undefined) {
        return <></>;
    }

    const previewHeight = displayFileInfo.height || fileInfo.height;
    const previewWidth = displayFileInfo.width || fileInfo.width;

    const hasDisproportionateHeight = previewHeight / previewWidth > DISPROPORTIONATE_HEIGHT_RATIO;
    let minPreviewClass = '';
    if (
        (previewWidth < PREVIEW_IMAGE_MIN_DIMENSION ||
        previewHeight < PREVIEW_IMAGE_MIN_DIMENSION) && !hasDisproportionateHeight
    ) {
        minPreviewClass = 'min-preview ';

        if (previewHeight > previewWidth) {
            minPreviewClass += 'min-preview--portrait ';
        }
    }

    if (compactDisplay) {
        minPreviewClass += ' compact-display';
    }

    const toggle = (
        <button
            key='toggle'
            className='style--none single-image-view__toggle'
            data-expanded={props.isEmbedVisible}
            aria-label='Toggle Embed Visibility'
            onClick={toggleEmbedVisibility}
        >
            <span
                className={classNames('icon', {
                    'icon-menu-down': props.isEmbedVisible,
                    'icon-menu-right': !props.isEmbedVisible,
                })}
            />
        </button>
    );

    // For encrypted files without decryption, show generic name
    const displayName = isEncrypted && !originalFileInfo ? 'Encrypted file' : displayFileInfo.name;

    const fileHeader = (
        <div
            className={classNames('image-header', {
                'image-header--expanded': props.isEmbedVisible,
            })}
        >
            {toggle}
            {!props.isEmbedVisible && (
                <div
                    data-testid='image-name'
                    className={classNames('image-name', {
                        'compact-display': compactDisplay,
                        'image-name--encrypted': isEncrypted && !originalFileInfo,
                    })}
                >
                    <div
                        id='image-name-text'
                        onClick={handleImageClick}
                    >
                        {displayName}
                    </div>
                </div>
            )}
        </div>
    );

    let fadeInClass = '';
    let permalinkClass = '';

    const fileType = getFileType(displayFileInfo.extension);
    let styleIfSvgWithDimensions = {};
    let imageContainerStyle = {};
    let svgClass = '';
    if (fileType === FileTypes.SVG) {
        svgClass = 'svg';
        if (dimensions.height) {
            styleIfSvgWithDimensions = {
                width: '100%',
            };
        } else {
            imageContainerStyle = {
                height: 350,
                maxWidth: '100%',
            };
        }
    }

    if (loaded) {
        fadeInClass = 'image-fade-in';
    }

    if (isInPermalink) {
        permalinkClass = 'image-permalink';
    }

    // Show encrypted placeholder if file is encrypted but not yet decrypted
    const showEncryptedPlaceholder = isEncrypted && !decryptedFileUrl;

    // Render encrypted placeholder while decrypting
    if (showEncryptedPlaceholder) {
        return (
            <div
                className={classNames('file-view--single', permalinkClass, 'file-view--encrypted')}
            >
                <div className='file__image'>
                    {fileHeader}
                    {props.isEmbedVisible && (
                        <div
                            className={classNames('image-container', 'image-container--encrypted', permalinkClass)}
                            onClick={decrypt}
                            role='button'
                            tabIndex={0}
                        >
                            <div className='encrypted-image-placeholder'>
                                <LockOutlineIcon
                                    size={48}
                                    color={'rgba(var(--encrypted-color), 1)'}
                                />
                                <span className='encrypted-image-placeholder__text'>
                                    {decryptionStatus === 'decrypting' ? 'Decrypting...' : 'Encrypted file'}
                                </span>
                                {decryptionStatus === 'failed' && (
                                    <span className='encrypted-image-placeholder__error'>
                                        Click to retry
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div
            className={classNames('file-view--single', permalinkClass, {'file-view--encrypted': isEncrypted})}
        >
            <div
                className='file__image'
            >
                {fileHeader}
                {props.isEmbedVisible &&
                <div
                    className={classNames('image-container', permalinkClass)}
                    style={imageContainerStyle}
                >
                    <div
                        className={classNames('image-loaded', fadeInClass, svgClass)}
                        style={styleIfSvgWithDimensions}
                    >
                        <div className={classNames(permalinkClass)}>
                            <SizeAwareImage
                                onClick={handleImageClick}
                                className={classNames(minPreviewClass, permalinkClass)}
                                src={previewURL}
                                dimensions={dimensions}
                                fileInfo={displayFileInfo}
                                fileURL={fileURL}
                                onImageLoaded={imageLoaded}
                                showLoader={props.isEmbedVisible}
                                handleSmallImageContainer={true}
                                enablePublicLink={!isEncrypted && props.enablePublicLink}
                                getFilePublicLink={getFilePublicLink}
                                hideUtilities={props.disableActions}
                            />
                        </div>
                    </div>
                </div>
                }
            </div>
        </div>
    );
}
