// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useMemo} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import type {FileInfo} from '@mattermost/types/files';

import {getConfig} from 'mattermost-redux/selectors/entities/general';

import {FileTypes} from 'utils/constants';
import {getFileType} from 'utils/utils';

import type {GlobalState} from 'types/store';

import ImageTile from './tiles/image_tile';
import VideoTile from './tiles/video_tile';
import type {ClassifiedFile, TileKind} from './types';

import './media_gallery.scss';

type Props = {
    fileInfos: FileInfo[];
    postId: string;
    compactDisplay?: boolean;
    onItemClick: (index: number) => void;
};

function tileKindFor(fileInfo: FileInfo): TileKind | null {
    const type = getFileType(fileInfo.extension);
    if (type === FileTypes.IMAGE) {
        return 'image';
    }
    if (type === FileTypes.VIDEO) {
        return 'video';
    }
    return null;
}

const MediaGallery = ({fileInfos, postId, compactDisplay, onItemClick}: Props) => {
    const {formatMessage} = useIntl();
    const enablePublicLink = useSelector((state: GlobalState) => getConfig(state).EnablePublicLink === 'true');

    const tiles: ClassifiedFile[] = useMemo(() => {
        const out: ClassifiedFile[] = [];
        for (const file of fileInfos) {
            const kind = tileKindFor(file);
            if (kind) {
                out.push({file, kind});
            }
        }
        return out;
    }, [fileInfos]);

    const handleClick = useCallback((index: number) => {
        const file = tiles[index]?.file;
        if (!file) {
            return;
        }
        const original = fileInfos.findIndex((f) => f.id === file.id);
        onItemClick(original >= 0 ? original : index);
    }, [tiles, fileInfos, onItemClick]);

    if (tiles.length === 0) {
        return null;
    }

    const groupLabel = formatMessage(
        {id: 'media_gallery.list_label', defaultMessage: 'Media gallery with {count} items'},
        {count: tiles.length},
    );

    const isSingle = tiles.length === 1;

    return (
        <div
            className={classNames('MediaGallery', {
                'MediaGallery--compact': compactDisplay,
                'MediaGallery--single': isSingle,
            })}
            data-testid='fileAttachmentList'
            data-post-id={postId}
        >
            <div
                className='MediaGallery__grid'
                role='list'
                aria-label={groupLabel}
            >
                {tiles.map((tile, idx) => (tile.kind === 'image' ? (
                    <ImageTile
                        key={tile.file.id}
                        fileInfo={tile.file}
                        index={idx}
                        total={tiles.length}
                        enablePublicLink={enablePublicLink}
                        onClick={handleClick}
                    />
                ) : (
                    <VideoTile
                        key={tile.file.id}
                        fileInfo={tile.file}
                        index={idx}
                        total={tiles.length}
                        enablePublicLink={enablePublicLink}
                        onClick={handleClick}
                    />
                )))}
            </div>
        </div>
    );
};

export default MediaGallery;
