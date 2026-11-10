// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useContext} from 'react';
import type {CSSProperties, KeyboardEvent, MouseEvent} from 'react';
import {useDispatch} from 'react-redux';

import type {MmImageBlock} from '@mattermost/types/mm_blocks';

import {secureGetFromRecord} from 'mattermost-redux/utils/post_utils';

import {openModal} from 'actions/views/modals';

import ExternalImage from 'components/external_image';
import FilePreviewModal from 'components/file_preview_modal';
import SizeAwareImage from 'components/size_aware_image';

import {ModalIdentifiers} from 'utils/constants';

import {MmBlocksImagesMetadataContext} from './context';
import {MM_IMAGE_ALIGN_JUSTIFY, resolveMmImageCaps} from './utils/image';

type ImageBlockProps = {
    block: MmImageBlock;
    postId: string;
};

function extensionFromImageURL(src: string): string {
    let pathForExt = src;
    try {
        pathForExt = new URL(src, window.location.href).pathname;
    } catch {
        // Relative or malformed URLs: fall back to parsing src as-is.
    }
    const index = pathForExt.lastIndexOf('.');
    return index > 0 ? pathForExt.substring(index + 1) : '';
}

export const ImageBlock = ({block, postId}: ImageBlockProps) => {
    const dispatch = useDispatch();
    const imagesMetadata = useContext(MmBlocksImagesMetadataContext);
    const url = block.url.trim();
    const imageMetadata = secureGetFromRecord(imagesMetadata, url);
    const caps = resolveMmImageCaps(block);

    const showModal = useCallback((
        e: KeyboardEvent<HTMLImageElement> | MouseEvent<HTMLImageElement | HTMLDivElement>,
        link = '',
    ) => {
        const src = link || url;
        const extension = extensionFromImageURL(src);

        e.preventDefault();

        dispatch(openModal({
            modalId: ModalIdentifiers.FILE_PREVIEW_MODAL,
            dialogType: FilePreviewModal,
            dialogProps: {
                startIndex: 0,
                postId,
                fileInfos: [{
                    has_preview_image: false,
                    link: src,
                    extension: imageMetadata?.format ?? extension,
                    name: block.alt_text || src,
                }],
            },
        }));
    }, [dispatch, postId, url, block.alt_text, imageMetadata?.format]);

    if (!url) {
        return null;
    }

    const imgClass = classNames('mm-blocks-image__img', {
        'mm-blocks-image__img--person': block.image_style === 'person',
    });

    const imageConstraintStyle: CSSProperties = {
        width: 'auto',
        height: 'auto',
        objectFit: block.image_style === 'person' ? 'cover' : 'contain',
    };
    if (caps.maxWidth !== undefined) {
        imageConstraintStyle.maxWidth = caps.maxWidth;
    }
    if (caps.maxHeight !== undefined) {
        imageConstraintStyle.maxHeight = caps.maxHeight;
    }

    const align = block.horizontal_alignment ?? 'left';
    const justifyContent = MM_IMAGE_ALIGN_JUSTIFY[align];

    return (
        <div
            className='mm-blocks-image'
            style={{display: 'flex', justifyContent}}
        >
            <div
                className='mm-blocks-image__frame'
                style={{
                    maxWidth: caps.maxWidth,
                    maxHeight: caps.maxHeight,
                }}
            >
                <ExternalImage
                    src={url}
                    imageMetadata={imageMetadata}
                >
                    {(safeSrc) => (
                        <SizeAwareImage
                            src={safeSrc}
                            dimensions={imageMetadata}
                            alt={block.alt_text}
                            title={block.title}
                            className={imgClass}
                            style={imageConstraintStyle}
                            onClick={showModal}
                            showLoader={true}
                            hideUtilities={true}
                        />
                    )}
                </ExternalImage>
            </div>
        </div>
    );
};
