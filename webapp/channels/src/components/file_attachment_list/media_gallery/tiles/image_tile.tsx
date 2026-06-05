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
    enablePublicLink: boolean;
    onClick: (index: number) => void;
};

const DEFAULT_RATIO = 1.5;

const ImageTile = ({fileInfo, index, total, enablePublicLink, onClick}: Props) => {
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

    const ratio = (fileInfo.width && fileInfo.height) ? fileInfo.width / fileInfo.height : DEFAULT_RATIO;

    const tileStyle = {'--tile-ratio': ratio} as CSSProperties;

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
            />
            <TileUtilityButtons
                fileInfo={fileInfo}
                enablePublicLink={enablePublicLink}
            />
        </div>
    );
};

export default ImageTile;
