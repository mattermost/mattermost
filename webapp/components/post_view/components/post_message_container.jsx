// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import ChannelStore from 'stores/channel_store.jsx';
import EmojiStore from 'stores/emoji_store.jsx';
import PreferenceStore from 'stores/preference_store.jsx';
import {Preferences} from 'utils/constants.jsx';
import TeamStore from 'stores/team_store.jsx';
import UserStore from 'stores/user_store.jsx';

import PostMessageView from './post_message_view.jsx';

export default class PostMessageContainer extends React.Component {
    static propTypes = {
        post: React.PropTypes.object.isRequired,
        options: React.PropTypes.object
    };

    static defaultProps = {
        options: {}
    };

    constructor(props) {
        super(props);

        this.onEmojiChange = this.onEmojiChange.bind(this);
        this.onPreferenceChange = this.onPreferenceChange.bind(this);
        this.onUserChange = this.onUserChange.bind(this);
        this.onChannelChange = this.onChannelChange.bind(this);

        const mentionKeys = UserStore.getCurrentMentionKeys();
        mentionKeys.push('@here');

        this.state = {
            emojis: EmojiStore.getEmojis(),
            enableFormatting: PreferenceStore.getBool(Preferences.CATEGORY_ADVANCED_SETTINGS, 'formatting', true),
            mentionKeys,
            usernameMap: UserStore.getProfilesUsernameMap(),
            channelNamesMap: ChannelStore.getChannelNamesMap(),
            team: TeamStore.getCurrent()
        };
    }

    componentDidMount() {
        EmojiStore.addChangeListener(this.onEmojiChange);
        PreferenceStore.addChangeListener(this.onPreferenceChange);
        UserStore.addChangeListener(this.onUserChange);
        ChannelStore.addChangeListener(this.onChannelChange);
    }

    componentWillUnmount() {
        EmojiStore.removeChangeListener(this.onEmojiChange);
        PreferenceStore.removeChangeListener(this.onPreferenceChange);
        UserStore.removeChangeListener(this.onUserChange);
        ChannelStore.removeChangeListener(this.onChannelChange);
    }

    onEmojiChange() {
        this.setState({
            emojis: EmojiStore.getEmojis()
        });
    }

    onPreferenceChange() {
        this.setState({
            enableFormatting: PreferenceStore.getBool(Preferences.CATEGORY_ADVANCED_SETTINGS, 'formatting', true)
        });
    }

    onUserChange() {
        const mentionKeys = UserStore.getCurrentMentionKeys();
        mentionKeys.push('@here');

        this.setState({
            mentionKeys,
            usernameMap: UserStore.getProfilesUsernameMap()
        });
    }

    onChannelChange() {
        this.setState({
            channelNamesMap: ChannelStore.getChannelNamesMap()
        });
    }

    render() {
        return (
            <PostMessageView
                options={this.props.options}
                message={this.props.post.message}
                emojis={this.state.emojis}
                enableFormatting={this.state.enableFormatting}
                mentionKeys={this.state.mentionKeys}
                usernameMap={this.state.usernameMap}
                channelNamesMap={this.state.channelNamesMap}
                team={this.state.team}
            />
        );
    }
}
