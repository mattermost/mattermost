// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {CustomEmoji} from '@mattermost/types/emojis';
import React from 'react';

import {Client4} from 'mattermost-redux/client';
import Permissions from 'mattermost-redux/constants/permissions';
import {ActionFunc} from 'mattermost-redux/types/actions';

import AnyTeamPermissionGate from 'components/permissions_gates/any_team_permission_gate';

import DeleteEmojiButton from './delete_emoji_button';

export type Props = {
    emoji: CustomEmoji;
    emojiId?: string;
    currentUserId: string;
    creatorDisplayName: string;
    creatorUsername?: string;
    onDelete?: (emojiId: string) => void;
    actions: {
        deleteCustomEmoji: (emojiId: string) => ActionFunc;
    };
}

export default class EmojiListItem extends React.PureComponent<Props> {
    static defaultProps = {
        emoji: {} as CustomEmoji,
        currentUserId: '',
        creatorDisplayName: '',
    };

    handleDelete = (): void => {
        if (this.props.onDelete) {
            this.props.onDelete(this.props.emoji.id);
        }

        this.props.actions.deleteCustomEmoji(this.props.emoji.id);
    };

    render(): JSX.Element {
        const emoji = this.props.emoji;
        const creatorUsername = this.props.creatorUsername;
        let creatorDisplayName = this.props.creatorDisplayName;

        if (creatorUsername && creatorUsername !== creatorDisplayName) {
            creatorDisplayName += ' (@' + creatorUsername + ')';
        }

        let deleteButton = <DeleteEmojiButton onDelete={this.handleDelete}/>;

        if (emoji.creator_id === this.props.currentUserId) {
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
                <td className='emoji-list__name'>
                    {':' + emoji.name + ':'}
                </td>
                <td className='emoji-list__image'>
                    <span
                        className='emoticon'
                        style={{backgroundImage: 'url(' + Client4.getCustomEmojiImageUrl(emoji.id) + ')'}}
                    />
                </td>
                <td className='emoji-list__creator'>
                    {creatorDisplayName}
                </td>
                <td className='emoji-list-item_actions'>
                    {deleteButton}
                </td>
            </tr>
        );
    }
}
