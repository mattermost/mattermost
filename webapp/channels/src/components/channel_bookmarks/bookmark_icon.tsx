// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';
import styled from 'styled-components';

import {FileGenericOutlineIcon, BookOutlineIcon} from '@mattermost/compass-icons/components';
import type {ChannelBookmark} from '@mattermost/types/channel_bookmarks';
import type {FileInfo} from '@mattermost/types/files';

import {getConfig} from 'mattermost-redux/selectors/entities/general';

import RenderEmoji from 'components/emoji/render_emoji';
import FileThumbnail from 'components/file_attachment/file_thumbnail';
import type {FilePreviewInfo} from 'components/file_preview/file_preview';

import {trimmedEmojiName} from 'utils/emoji_utils';
import {getImageSrc} from 'utils/post_utils';

import type {GlobalState} from 'types/store';

type Props = {
    type: ChannelBookmark['type'];
    emoji?: string;
    imageUrl?: string;
    fileInfo?: FileInfo | FilePreviewInfo;
    size?: 16 | 24;
}

const BookmarkIcon = ({
    type,
    emoji,
    imageUrl,
    fileInfo,
    size = 16,
}: Props) => {
    let icon = type === 'link' ? <BookOutlineIcon size={size}/> : <FileGenericOutlineIcon size={size}/>;
    const emojiName = emoji && trimmedEmojiName(emoji);
    const hasImageProxy = useSelector((state: GlobalState) => getConfig(state).HasImageProxy === 'true');

    if (emojiName) {
        icon = (
            <RenderEmoji
                emojiName={emojiName}
                size={size}
            />
        );
    } else if (imageUrl) {
        icon = (
            <BookmarkIconImg
                src={getImageSrc(imageUrl, hasImageProxy)}
                size={size}
            />
        );
    } else if (fileInfo) {
        icon = (
            <FileThumbnail
                fileInfo={fileInfo}
                disablePreview={true}
            />
        );
    }

    return (
        <Icon $size={size}>
            {icon}
        </Icon>
    );
};

export default BookmarkIcon;

const Icon = styled.div<{$size: number}>`
    padding: 3px 1px 3px 2px;
    flex-shrink: 0;
    display: flex;
    align-items: center;

    .file-icon {
        width: ${({$size: size}) => size}px;
        height: ${({$size: size}) => size}px;
        background-size: ${({$size: size}) => size * 0.8}px ${({$size: size}) => size}px;
        margin-top: 1px;
    }

`;

const BookmarkIconImg = styled.img<{size: number}>`
    width: ${({size}) => size}px;
    height: ${({size}) => size}px;
`;
