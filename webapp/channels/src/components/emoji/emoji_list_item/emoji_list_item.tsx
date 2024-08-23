// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';

import type {CustomEmoji} from '@mattermost/types/emojis';

import {Client4} from 'mattermost-redux/client';
import Permissions from 'mattermost-redux/constants/permissions';

import AnyTeamPermissionGate from 'components/permissions_gates/any_team_permission_gate';

import DeleteEmojiButton from './delete_emoji_button';

export type Props = {
    emoji?: CustomEmoji;
    emojiId?: string;
    currentUserId?: string;
    creatorDisplayName?: string;
    creatorUsername?: string;
    onDelete?: (emojiId: string) => void;
    actions: {
        deleteCustomEmoji: (emojiId: string) => void;
    };
};

const DELETE_PERMISSION = [Permissions.DELETE_EMOJIS];
const DELETE_OTHER_PERMISSION = [Permissions.DELETE_OTHERS_EMOJIS];

const EmojiListItem = ({
    actions: {
        deleteCustomEmoji,
    },
    onDelete,
    emoji = {} as CustomEmoji,
    creatorUsername,
    currentUserId = '',
    creatorDisplayName = '',
}: Props) => {
    const emoticonStyle = useMemo(() => {
        return {backgroundImage: `url(${Client4.getCustomEmojiImageUrl(emoji.id)})`};
    }, [emoji.id]);

    const handleDelete = useCallback((): void => {
        if (!emoji) {
            return;
        }
        if (onDelete) {
            onDelete(emoji.id);
        }
        deleteCustomEmoji(emoji.id);
    }, [deleteCustomEmoji, emoji, onDelete]);

    let displayName = creatorDisplayName;
    if (creatorUsername && creatorUsername !== displayName) {
        displayName += ' (@' + creatorUsername + ')';
    }

    let deleteButton = <DeleteEmojiButton onDelete={handleDelete}/>;

    if (emoji.creator_id === currentUserId) {
        deleteButton = (
            <AnyTeamPermissionGate permissions={DELETE_PERMISSION}>
                {deleteButton}
            </AnyTeamPermissionGate>
        );
    } else {
        deleteButton = (
            <AnyTeamPermissionGate permissions={DELETE_PERMISSION}>
                <AnyTeamPermissionGate permissions={DELETE_OTHER_PERMISSION}>
                    {deleteButton}
                </AnyTeamPermissionGate>
            </AnyTeamPermissionGate>
        );
    }

    return (
        <tr className='backstage-list__item'>
            <td className='emoji-list__name'>{':' + emoji.name + ':'}</td>
            <td className='emoji-list__image'>
                <span
                    className='emoticon'
                    style={emoticonStyle}
                />
            </td>
            <td className='emoji-list__creator'>{displayName}</td>
            <td className='emoji-list-item_actions'>{deleteButton}</td>
        </tr>
    );
};

export default React.memo(EmojiListItem);
