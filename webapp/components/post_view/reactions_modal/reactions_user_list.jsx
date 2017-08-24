// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import PropTypes from 'prop-types';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import {getEmojiImageUrl} from 'mattermost-redux/utils/emoji_utils';
import UserStore from 'stores/user_store.jsx';

import ReactionUserListRow from './reaction_user_list_row.jsx';
import LoadingScreen from 'components/loading_screen.jsx';

import * as Utils from 'utils/utils.jsx';
import * as Emoji from 'utils/emoji.jsx';

export default class ReactionsUserList extends React.Component {
    static propTypes = {
        post: PropTypes.object.isRequired,
        reactions: PropTypes.arrayOf(PropTypes.object).isRequired,
        users: PropTypes.arrayOf(PropTypes.object).isRequired,
        reactionsByName: PropTypes.object.isRequired,
        emojiNames: PropTypes.array.isRequired,
        customEmojis: PropTypes.object
    };

    static defaultProps = {
        users: []
    };

    constructor(props) {
        super(props);

        const emojis = this.generateEmojis();
        const emojiName = 'All';

        this.state = {
            emojis,
            reactions: props.reactions,
            users: props.users,
            emojiName
        };
    }

    componentWillReceiveProps(nextProps) {
        if (!Utils.areObjectsEqual(nextProps.users, this.state.users)) {
            this.setState({users: nextProps.users});
        }

        if (!Utils.areObjectsEqual(nextProps.reactions, this.props.reactions)) {
            const emojis = this.generateEmojis();
            this.setState({emojis});
        }
    }

    generateEmojis() {
        const emojis = {
            All: {
                className: 'active',
                count: this.props.reactions.length
            }
        };

        this.props.emojiNames.forEach((name) => {
            emojis[name] = {
                url: this.getEmojiUrl(name, this.props.customEmojis),
                className: '',
                reactions: this.props.reactionsByName.get(name),
                count: this.props.reactionsByName.get(name).length
            };
        });

        return emojis;
    }

    getEmojiUrl(name, customEmojis) {
        let emoji;
        if (Emoji.EmojiIndicesByAlias.has(name)) {
            emoji = Emoji.Emojis[Emoji.EmojiIndicesByAlias.get(name)];
        } else {
            emoji = customEmojis.get(name);
        }

        if (emoji) {
            return getEmojiImageUrl(emoji);
        }

        return '';
    }

    handleFilter = (emojiName) => {
        const {emojis} = this.state;
        Object.keys(emojis).map((name) => {
            emojis[name].className = '';

            if (emojiName === name) {
                emojis[name].className = 'active';
            }

            return name;
        });

        let reactions = this.props.reactionsByName.get(emojiName);
        if (!reactions) {
            reactions = this.props.reactions;
        }

        const users = reactions.
            map((reaction) => reaction.user_id).
            sort().
            filter((id, index, arr) => !index || id !== arr[index - 1]).
            map((id) => UserStore.getProfile(id));

        this.setState({
            emojis,
            reactions,
            users,
            emojiName
        });
    }

    scrollToTop = () => {
        if (this.refs.container) {
            this.refs.container.scrollTop = 0;
        }
    }

    generateTabs() {
        const {emojis} = this.state;
        const tabs = Object.keys(emojis).map((name) => {
            let emojiImage;
            if (emojis[name].url) {
                emojiImage = (
                    <span className='emoji-picker__item-wrapper'>
                        <img
                            className='emoji-picker__item emoticon'
                            src={emojis[name].url}
                        />
                    </span>
                );
            }
            return (
                <li
                    key={name}
                    className={emojis[name].className}
                >
                    <a
                        href='#'
                        onClick={(e) => {
                            e.preventDefault();
                            this.handleFilter(name);
                        }}
                    >
                        {emojiImage || <span>{name}  </span>}
                        <span>  {emojis[name].count}</span>
                    </a>
                </li>
            );
        });

        return (
            <div className='nav nav-tabs'>
                {tabs}
            </div>
        );
    }

    render() {
        const {users} = this.state;

        let content;
        if (users == null) {
            return <LoadingScreen/>;
        } else if (users.length > 0) {
            content = users.map((user) => {
                const userReactions = this.state.reactions.
                    filter((reaction) => reaction.user_id === user.id).
                    map((reaction) => {
                        return {name: reaction.emoji_name, url: this.getEmojiUrl(reaction.emoji_name, this.props.customEmojis)};
                    });

                return (
                    <ReactionUserListRow
                        key={user.id}
                        user={user}
                        reactions={userReactions}
                        post={this.props.post}
                        emojiName={this.state.emojiName}
                    />
                );
            });
        } else {
            content = (
                <div
                    key='no-users-found'
                    className='more-modal__placeholder-row'
                >
                    <p>
                        <FormattedMessage
                            id='user_list.notFound'
                            defaultMessage='No users found'
                        />
                    </p>
                </div>
            );
        }

        return (
            <div className='filtered-user-list'>
                <div className='filter-row filter-row--full'>
                    {this.generateTabs()}
                </div>
                <div
                    className='more-modal__list'
                >
                    <div ref='container'>
                        {content}
                    </div>
                </div>
            </div>
        );
    }
}
