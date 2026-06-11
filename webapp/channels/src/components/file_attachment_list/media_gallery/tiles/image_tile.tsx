// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import type {CSSProperties} from 'react';
import {useIntl} from 'react-intl';

import type {FileInfo} from '@mattermost/types/files';

import {getFilePreviewUrl, getFileThumbnailUrl, getFileUrl} from 'mattermost-redux/utils/file_utils';

import {isGIFImage} from 'utils/utils';

import TileUtilityButtons from './tile_utility_buttons';

type Props = {
    fileInfo: FileInfo;
    index: number;
    total: number;
    width: number;
    height: number;
    enablePublicLink: boolean;
    onClick: (index: number) => void;
};

const ImageTile = ({fileInfo, index, total, width, height, enablePublicLink, onClick}: Props) => {
    const {formatMessage} = useIntl();

    const handleActivate = useCallback(() => {
        onClick(index);
    }, [onClick, index]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleActivate();
        }
    }, [handleActivate]);

    const src = isGIFImage(fileInfo.extension) ? getFileUrl(fileInfo.id) : getFilePreviewUrl(fileInfo.id) || getFileThumbnailUrl(fileInfo.id);

    const label = formatMessage(
        {id: 'media_gallery.image_label', defaultMessage: 'Image {current} of {total}: {name}'},
        {current: index + 1, total, name: fileInfo.name || ''},
    );

    const tileStyle: CSSProperties = {
        width: `${width}px`,
        height: `${height}px`,
        flex: `0 0 ${width}px`,
    };

    const imgStyle: CSSProperties = {};
    if (fileInfo.width && fileInfo.height) {
        imgStyle.maxWidth = `${fileInfo.width}px`;
        imgStyle.maxHeight = `${fileInfo.height}px`;
    }

    return (
        <div
            className='MediaGallery__tile'
            role='button'
            tabIndex={0}
            aria-label={label}
            data-testid='media-gallery-tile'
            data-file-name={fileInfo.name || ''}
            style={tileStyle}
            onClick={handleActivate}
            onKeyDown={handleKeyDown}
        >
            <img
                src={src}
                alt={fileInfo.name || ''}
                loading='lazy'
                style={imgStyle}
            />
            <TileUtilityButtons
                fileInfo={fileInfo}
                enablePublicLink={enablePublicLink}
            />
        </div>
    );
};

export default ImageTile;
