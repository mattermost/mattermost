// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as AsyncClient from 'utils/async_client.jsx';
import EmojiStore from 'stores/emoji_store.jsx';
import * as Utils from 'utils/utils.jsx';

import BackstageList from 'components/backstage/components/backstage_list.jsx';
import {FormattedMessage} from 'react-intl';
import EmojiListItem from './emoji_list_item.jsx';

export default class EmojiList extends React.Component {
    static get propTypes() {
        return {
            team: React.propTypes.object.isRequired,
            user: React.propTypes.object.isRequired
        };
    }

    constructor(props) {
        super(props);

        this.handleEmojiChange = this.handleEmojiChange.bind(this);

        this.deleteEmoji = this.deleteEmoji.bind(this);

        this.state = {
            emojis: EmojiStore.getCustomEmojiMap(),
            loading: !EmojiStore.hasReceivedCustomEmojis()
        };
    }

    componentDidMount() {
        EmojiStore.addChangeListener(this.handleEmojiChange);

        if (window.mm_config.EnableCustomEmoji === 'true') {
            AsyncClient.listEmoji();
        }
    }

    componentWillUnmount() {
        EmojiStore.removeChangeListener(this.handleEmojiChange);
    }

    handleEmojiChange() {
        this.setState({
            emojis: EmojiStore.getCustomEmojiMap(),
            loading: !EmojiStore.hasReceivedCustomEmojis()
        });
    }

    deleteEmoji(emoji) {
        AsyncClient.deleteEmoji(emoji.id);
    }

    render() {
        let emojis = [];
        for (const [, emoji] of this.state.emojis) {
            emojis.push(
                <EmojiListItem
                    key={emoji.id}
                    emoji={emoji}
                    onDelete={this.deleteEmoji}
                />
            );
        }

        if (emojis.length === 0) {
            emojis = (
                <tr className='backstage-list__item backstage-list__empty'>
                    <td colSpan='4'>
                        <FormattedMessage
                            id='emoji_list.empty'
                            defaultMessage='No custom emoji found'
                        />
                    </td>
                </tr>
            );
        }

        let addText = null;
        let addLink = null;
        if (window.mm_config.RestrictCustomEmojiCreation === 'all' || Utils.isSystemAdmin(this.props.user.roles)) {
            addText = (
                <FormattedMessage
                    id='emoji_list.add'
                    defaultMessage='Add Custom Emoji'
                />
            );
            addLink = '/' + this.props.team.name + '/emoji/add';
        }

        return (
            <BackstageList
                listClassName='emoji-list'
                header={
                    <FormattedMessage
                        id='emoji_list.header'
                        defaultMessage='Custom Emoji'
                    />
                }
                addText={addText}
                addLink={addLink}
                searchPlaceholder={Utils.localizeMessage('emoji_list.search', 'Search Custom Emoji')}
                loading={this.state.loading}
            >
                <table>
                    <tr className='backstage-list__item emoji-list__table-header'>
                        <th className='emoji-list__name'>
                            <FormattedMessage
                                id='emoji_list.name'
                                defaultMessage='Name'
                            />
                        </th>
                        <th className='emoji-list__image'>
                            <FormattedMessage
                                id='emoji_list.image'
                                defaultMessage='Image'
                            />
                        </th>
                        <th className='emoji-list__creator'>
                            <FormattedMessage
                                id='emoji_list.creator'
                                defaultMessage='Creator'
                            />
                        </th>
                        <th className='emoji-list_actions'>
                            <FormattedMessage
                                id='emoji_list.actions'
                                defaultMessage='Actions'
                            />
                        </th>
                    </tr>
                    {emojis}
                </table>
            </BackstageList>
        );
    }
}
