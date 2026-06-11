// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useMemo, useRef} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import type {FileInfo} from '@mattermost/types/files';

import {getConfig} from 'mattermost-redux/selectors/entities/general';

import {FileTypes} from 'utils/constants';
import {getFileType} from 'utils/utils';

import type {GlobalState} from 'types/store';

import {packRows} from './pack_rows';
import ImageTile from './tiles/image_tile';
import VideoTile from './tiles/video_tile';
import type {ClassifiedFile, TileKind} from './types';
import {useContainerWidth} from './use_container_width';

import './media_gallery.scss';

type Props = {
    fileInfos: FileInfo[];
    postId: string;
    compactDisplay?: boolean;
    isEmbedVisible?: boolean;
    onItemClick: (index: number) => void;
    onToggleCollapse?: (postId: string) => void;
};

const ROW_HEIGHT = 216;
const COMPACT_ROW_HEIGHT = 144;
const MIN_TILE_WIDTH = 50;
const MAX_TILE_WIDTH = 500;
const GAP = 8;
const FALLBACK_WIDTH = 700;

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

const MediaGallery = ({fileInfos, postId, compactDisplay, isEmbedVisible = true, onItemClick, onToggleCollapse}: Props) => {
    const {formatMessage} = useIntl();
    const enablePublicLink = useSelector((state: GlobalState) => getConfig(state).EnablePublicLink === 'true');

    const containerRef = useRef<HTMLDivElement | null>(null);
    const containerWidth = useContainerWidth(containerRef);

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

    const rows = useMemo(() => {
        const effectiveWidth = containerWidth > 0 ? containerWidth : FALLBACK_WIDTH;
        return packRows(tiles, {
            containerWidth: effectiveWidth,
            rowHeight: compactDisplay ? COMPACT_ROW_HEIGHT : ROW_HEIGHT,
            minTileWidth: MIN_TILE_WIDTH,
            maxTileWidth: MAX_TILE_WIDTH,
            gap: GAP,
        });
    }, [tiles, containerWidth, compactDisplay]);

    const handleClick = useCallback((index: number) => {
        const file = tiles[index]?.file;
        if (!file) {
            return;
        }
        const original = fileInfos.findIndex((f) => f.id === file.id);
        onItemClick(original >= 0 ? original : index);
    }, [tiles, fileInfos, onItemClick]);

    const handleToggle = useCallback(() => {
        if (onToggleCollapse) {
            onToggleCollapse(postId);
        }
    }, [onToggleCollapse, postId]);

    if (tiles.length === 0) {
        return null;
    }

    const groupLabel = formatMessage(
        {id: 'media_gallery.list_label', defaultMessage: 'Media gallery with {count} items'},
        {count: tiles.length},
    );

    const isSingle = tiles.length === 1;
    const showHeader = !isSingle && Boolean(onToggleCollapse);

    let tileIdx = 0;

    return (
        <div
            ref={containerRef}
            className={classNames('MediaGallery', {
                'MediaGallery--compact': compactDisplay,
                'MediaGallery--single': isSingle,
                'MediaGallery--collapsed': !isEmbedVisible,
            })}
            data-testid='fileAttachmentList'
            data-post-id={postId}
        >
            {showHeader && (
                <div
                    className={classNames('MediaGallery__header', {
                        'MediaGallery__header--collapsed': !isEmbedVisible,
                    })}
                >
                    <button
                        type='button'
                        className='style--none MediaGallery__toggle'
                        data-expanded={isEmbedVisible}
                        aria-expanded={isEmbedVisible}
                        aria-label={formatMessage(
                            {id: 'media_gallery.toggle_label', defaultMessage: 'Toggle media gallery with {count} items'},
                            {count: tiles.length},
                        )}
                        onClick={handleToggle}
                    >
                        <span
                            className={classNames('icon', {
                                'icon-menu-down': isEmbedVisible,
                                'icon-menu-right': !isEmbedVisible,
                            })}
                        />
                    </button>
                    <span className='MediaGallery__header_label'>
                        <FormattedMessage
                            id='media_gallery.count_label'
                            defaultMessage='{count, plural, one {# image} other {# images}}'
                            values={{count: tiles.length}}
                        />
                    </span>
                </div>
            )}
            {isEmbedVisible && (
                <div
                    className='MediaGallery__rows'
                    role='list'
                    aria-label={groupLabel}
                >
                    {rows.map((row, rIdx) => (
                        <div
                            key={`row-${rIdx}`}
                            className='MediaGallery__row'
                            style={{height: `${row.height}px`}}
                        >
                            {row.tiles.map((packed) => {
                                const current = tileIdx;
                                tileIdx += 1;
                                const tile = packed.tile;
                                return tile.kind === 'image' ? (
                                    <ImageTile
                                        key={tile.file.id}
                                        fileInfo={tile.file}
                                        index={current}
                                        total={tiles.length}
                                        width={packed.width}
                                        height={row.height}
                                        enablePublicLink={enablePublicLink}
                                        onClick={handleClick}
                                    />
                                ) : (
                                    <VideoTile
                                        key={tile.file.id}
                                        fileInfo={tile.file}
                                        index={current}
                                        total={tiles.length}
                                        width={packed.width}
                                        height={row.height}
                                        enablePublicLink={enablePublicLink}
                                        onClick={handleClick}
                                    />
                                );
                            })}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MediaGallery;
