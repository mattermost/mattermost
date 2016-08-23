// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import EmojiStore from 'stores/emoji_store.jsx';
import PreferenceStore from 'stores/preference_store.jsx';
import {Preferences} from 'utils/constants.jsx';

import PostMessageView from './post_message_view.jsx';

export default class PostMessageContainer extends React.Component {
    static propTypes = {
        post: React.PropTypes.object.isRequired
    };

    constructor(props) {
        super(props);

        this.onEmojiChange = this.onEmojiChange.bind(this);
        this.onPreferenceChange = this.onPreferenceChange.bind(this);

        this.state = {
            emojis: EmojiStore.getEmojis(),
            enableFormatting: PreferenceStore.getBool(Preferences.CATEGORY_ADVANCED_SETTINGS, 'formatting', true)
        };
    }

    componentDidMount() {
        EmojiStore.addChangeListener(this.onEmojiChange);
        PreferenceStore.addChangeListener(this.onPreferenceChange);
    }

    componentWillUnmount() {
        EmojiStore.removeChangeListener(this.onEmojiChange);
        PreferenceStore.removeChangeListener(this.onPreferenceChange);
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

    render() {
        return (
            <PostMessageView
                message={this.props.post.message}
                emojis={this.state.emojis}
                enableFormatting={this.state.enableFormatting}
                profiles={this.state.profiles}
            />
        );
    }
}