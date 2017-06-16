import PropTypes from 'prop-types';

// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import EmojiStore from 'stores/emoji_store.jsx';
import DeleteEmoji from './delete_emoji_modal.jsx';

import * as Utils from 'utils/utils.jsx';

import {FormattedMessage} from 'react-intl';

export default class EmojiListItem extends React.Component {
    static get propTypes() {
        return {
            emoji: PropTypes.object.isRequired,
            onDelete: PropTypes.func.isRequired,
            filter: PropTypes.string,
            creator: PropTypes.object.isRequired
        };
    }

    constructor(props) {
        super(props);

        this.handleDelete = this.handleDelete.bind(this);
    }

    handleDelete() {
        this.props.onDelete(this.props.emoji);
    }

    matchesFilter(emoji, creator, filter) {
        if (!filter) {
            return true;
        }

        if (emoji.name.toLowerCase().indexOf(filter) !== -1) {
            return true;
        }

        if (creator && creator.username && creator.username.toLowerCase().indexOf(filter) !== -1) {
            return true;
        }

        return false;
    }

    render() {
        const emoji = this.props.emoji;
        const creator = this.props.creator;
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
                <DeleteEmoji onDelete={this.handleDelete}/>
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
                        style={{backgroundImage: 'url(' + EmojiStore.getEmojiImageUrl(emoji) + ')'}}
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
