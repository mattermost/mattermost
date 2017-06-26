// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import EmojiListItem from './emoji_list_item.jsx';
import LoadingScreen from 'components/loading_screen.jsx';

import EmojiStore from 'stores/emoji_store.jsx';
import UserStore from 'stores/user_store.jsx';

import * as EmojiActions from 'actions/emoji_actions.jsx';

import * as Utils from 'utils/utils.jsx';

import React from 'react';
import PropTypes from 'prop-types';
import {Link} from 'react-router';
import {FormattedMessage} from 'react-intl';

export default class EmojiList extends React.Component {
    static get propTypes() {
        return {
            team: PropTypes.object,
            user: PropTypes.object
        };
    }

    constructor(props) {
        super(props);

        this.updateTitle = this.updateTitle.bind(this);

        this.handleEmojiChange = this.handleEmojiChange.bind(this);
        this.handleUserChange = this.handleUserChange.bind(this);
        this.deleteEmoji = this.deleteEmoji.bind(this);
        this.updateFilter = this.updateFilter.bind(this);

        this.state = {
            emojis: EmojiStore.getCustomEmojiMap(),
            loading: true,
            filter: '',
            users: UserStore.getProfiles()
        };
    }

    componentDidMount() {
        EmojiStore.addChangeListener(this.handleEmojiChange);
        UserStore.addChangeListener(this.handleUserChange);

        if (window.mm_config.EnableCustomEmoji === 'true') {
            EmojiActions.loadEmoji().then(() => this.setState({loading: false}));
        }

        this.updateTitle();
    }

    updateTitle() {
        let currentSiteName = '';
        if (global.window.mm_config.SiteName != null) {
            currentSiteName = global.window.mm_config.SiteName;
        }

        document.title = Utils.localizeMessage('custom_emoji.header', 'Custom Emoji') + ' - ' + this.props.team.display_name + ' ' + currentSiteName;
    }

    componentWillUnmount() {
        EmojiStore.removeChangeListener(this.handleEmojiChange);
        UserStore.removeChangeListener(this.handleUserChange);
    }

    handleEmojiChange() {
        this.setState({
            emojis: EmojiStore.getCustomEmojiMap()
        });
    }

    handleUserChange() {
        this.setState({users: UserStore.getProfiles()});
    }

    updateFilter(e) {
        this.setState({
            filter: e.target.value
        });
    }

    deleteEmoji(emoji) {
        EmojiActions.deleteEmoji(emoji.id);
    }

    render() {
        const filter = this.state.filter.toLowerCase();
        const isSystemAdmin = Utils.isSystemAdmin(this.props.user.roles);

        const emojis = [];
        if (this.state.loading) {
            emojis.push(
                <tr
                    key='loading'
                    className='backstage-list__item backstage-list__empty'
                >
                    <td colSpan='4'>
                        <LoadingScreen key='loading'/>
                    </td>
                </tr>
            );
        } else if (this.state.emojis.size === 0) {
            emojis.push(
                <tr
                    key='empty'
                    className='backstage-list__item backstage-list__empty'
                >
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
                        creator={this.state.users[emoji.creator_id] || {}}
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
                        <i className='fa fa-search'/>
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
                        <thead>
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
                        </thead>
                        <tbody>
                            {emojis}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }
}
