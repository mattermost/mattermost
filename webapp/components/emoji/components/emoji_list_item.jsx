// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import EmojiStore from 'stores/emoji_store.jsx';
import UserStore from 'stores/user_store.jsx';
import * as Utils from 'utils/utils.jsx';

import {FormattedMessage} from 'react-intl';

export default class EmojiListItem extends React.Component {
    static get propTypes() {
        return {
            emoji: React.PropTypes.object.isRequired,
            onDelete: React.PropTypes.func.isRequired,
            filter: React.PropTypes.string
        };
    }

    constructor(props) {
        super(props);

        this.handleDelete = this.handleDelete.bind(this);

        this.state = {
            creator: UserStore.getProfile(this.props.emoji.creator_id)
        };
    }

    handleDelete(e) {
        e.preventDefault();

        this.props.onDelete(this.props.emoji);
    }

    matchesFilter(emoji, creator, filter) {
        if (!filter) {
            return true;
        }

        if (emoji.name.toLowerCase().indexOf(filter) !== -1) {
            return true;
        }

        if (creator) {
            if (creator.username.toLowerCase().indexOf(filter) !== -1 ||
                (creator.first_name && creator.first_name.toLowerCase().indexOf(filter) !== -1) ||
                (creator.last_name && creator.last_name.toLowerCase().indexOf(filter) !== -1) ||
                (creator.nickname && creator.nickname.toLowerCase().indexOf(filter) !== -1)) {
                return true;
            }
        }

        return false;
    }

    render() {
        const emoji = this.props.emoji;
        const creator = this.state.creator;
        const filter = this.props.filter ? this.props.filter.toLowerCase() : '';

        if (!this.matchesFilter(emoji, creator, filter)) {
            return null;
        }

        let creatorName;
        if (creator) {
            creatorName = Utils.displayUsernameForUser(creator);

            if (creatorName !== creator.username) {
                creatorName += ' (@' + creator.username + ')';
            }
        } else {
            creatorName = (
                <FormattedMessage
                    id='emoji_list.somebody'
                    defaultMessage='Somebody on another team'
                />
            );
        }

        let deleteButton = null;
        if (this.props.onDelete) {
            deleteButton = (
                <a
                    href='#'
                    onClick={this.handleDelete}
                >
                    <FormattedMessage
                        id='emoji_list.delete'
                        defaultMessage='Delete'
                    />
                </a>
            );
        }

        return (
            <tr className='backstage-list__item'>
                <td className='emoji-list__name'>
                    {':' + emoji.name + ':'}
                </td>
                <td className='emoji-list__image'>
                    <img
                        className='emoticon'
                        src={EmojiStore.getEmojiImageUrl(emoji)}
                    />
                </td>
                <td className='emoji-list__creator'>
                    {creatorName}
                </td>
                <td className='emoji-list-item_actions'>
                {deleteButton}
                </td>
            </tr>
        );
    }
}
