// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as AsyncClient from 'utils/async_client.jsx';
import EmojiStore from 'stores/emoji_store.jsx';
import * as Utils from 'utils/utils.jsx';

import {FormattedMessage} from 'react-intl';
import EmojiListItem from './emoji_list_item.jsx';
import {Link} from 'react-router';
import LoadingScreen from 'components/loading_screen.jsx';

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

        this.updateFilter = this.updateFilter.bind(this);

        this.state = {
            emojis: EmojiStore.getCustomEmojiMap(),
            loading: !EmojiStore.hasReceivedCustomEmojis(),
            filter: ''
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

    updateFilter(e) {
        this.setState({
            filter: e.target.value
        });
    }

    deleteEmoji(emoji) {
        AsyncClient.deleteEmoji(emoji.id);
    }

    render() {
        const filter = this.state.filter.toLowerCase();
        const isSystemAdmin = Utils.isSystemAdmin(this.props.user.roles);

        let emojis = [];
        if (this.state.loading) {
            emojis.push(
                <LoadingScreen key='loading'/>
            );
        } else if (this.state.emojis.length === 0) {
            emojis.push(
                <tr className='backstage-list__item backstage-list__empty'>
                    <td colSpan='4'>
                        <FormattedMessage
                            id='emoji_list.empty'
                            defaultMessage='No custom emoji found'
                        />
                    </td>
                </tr>
            );
        } else {
            for (const [, emoji] of this.state.emojis) {
                let onDelete = null;
                if (isSystemAdmin || this.props.user.id === emoji.creator_id) {
                    onDelete = this.deleteEmoji;
                }

                emojis.push(
                    <EmojiListItem
                        key={emoji.id}
                        emoji={emoji}
                        onDelete={onDelete}
                        filter={filter}
                    />
                );
            }
        }

        return (
            <div className='backstage-content emoji-list'>
                <div className='backstage-header'>
                    <h1>
                        <FormattedMessage
                            id='emoji_list.header'
                            defaultMessage='Custom Emoji'
                        />
                    </h1>
                    <Link
                        className='add-link'
                        to={'/' + this.props.team.name + '/emoji/add'}
                    >
                        <button
                            type='button'
                            className='btn btn-primary'
                        >
                            <FormattedMessage
                                id='emoji_list.add'
                                defaultMessage='Add Custom Emoji'
                            />
                        </button>
                    </Link>
                </div>
                <div className='backstage-filters'>
                    <div className='backstage-filter__search'>
                        <i className='fa fa-search'></i>
                        <input
                            type='search'
                            className='form-control'
                            placeholder={Utils.localizeMessage('emoji_list.search', 'Search Custom Emoji')}
                            value={this.state.filter}
                            onChange={this.updateFilter}
                            style={{flexGrow: 0, flexShrink: 0}}
                        />
                    </div>
                </div>
                <span className='backstage-list__help'>
                    <p>
                        <FormattedMessage
                            id='emoji_list.help'
                            defaultMessage="Custom emoji are available to everyone on your server. Type ':' in a message box to bring up the emoji selection menu. Other users may need to refresh the page before new emojis appear."
                        />
                    </p>
                    <p>
                        <FormattedMessage
                            id='emoji_list.help2'
                            defaultMessage="Tip: If you add #, ##, or ### as the first character on a new line containing emoji, you can use larger sized emoji. To try it out, send a message such as: '# :smile:'."
                        />
                    </p>
                </span>
                <div className='backstage-list'>
                    <table className='emoji-list__table'>
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
                </div>
            </div>
        );
    }
}
