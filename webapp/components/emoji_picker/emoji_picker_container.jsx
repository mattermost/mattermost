// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import EmojiStore from 'stores/emoji_store.jsx';

import EmojiPicker from './emoji_picker.jsx';

export default class EmojiPickerContainer extends React.Component {
    static propTypes = {
        onEmojiClick: React.PropTypes.func.isRequred
    }

    constructor(props) {
        super(props);

        this.handleEmojiChange = this.handleEmojiChange.bind(this);

        this.state = {
            customEmojis: EmojiStore.getCustomEmojiMap()
        };
    }

    componentDidMount() {
        EmojiStore.addChangeListener(this.handleEmojiChange);
    }

    componentWillUnount() {
        EmojiStore.removeChangeListener(this.handleEmojiChange);
    }

    handleEmojiChange() {
        this.setState({
            customEmojis: EmojiStore.getCustomEmojiMap()
        });
    }

    render() {
        return (
            <EmojiPicker
                customEmojis={this.state.customEmojis}
                onEmojiClick={this.props.onEmojiClick}
            />
        );
    }
}