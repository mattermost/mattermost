// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

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
    const handleDelete = (): void => {
        if (!emoji) {
            return;
        }
        if (onDelete) {
            onDelete(emoji.id);
        }
        deleteCustomEmoji(emoji.id);
    };

    if (creatorUsername && creatorUsername !== creatorDisplayName) {
        // eslint-disable-next-line no-param-reassign
        creatorDisplayName += ' (@' + creatorUsername + ')';
    }

    let deleteButton = <DeleteEmojiButton onDelete={handleDelete}/>;

    if (emoji.creator_id === currentUserId) {
        deleteButton = (
            <AnyTeamPermissionGate permissions={[Permissions.DELETE_EMOJIS]}>
                {deleteButton}
            </AnyTeamPermissionGate>
        );
    } else {
        deleteButton = (
            <AnyTeamPermissionGate permissions={[Permissions.DELETE_EMOJIS]}>
                <AnyTeamPermissionGate permissions={[Permissions.DELETE_OTHERS_EMOJIS]}>
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
                    style={{
                        backgroundImage:
                            'url(' +
                            Client4.getCustomEmojiImageUrl(emoji.id) +
                            ')',
                    }}
                />
            </td>
            <td className='emoji-list__creator'>{creatorDisplayName}</td>
            <td className='emoji-list-item_actions'>{deleteButton}</td>
        </tr>
    );
};

export default React.memo(EmojiListItem);
