import PropTypes from 'prop-types';

// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import EmojiStore from 'stores/emoji_store.jsx';

import EmojiPicker from './emoji_picker.jsx';

export default class EmojiPickerContainer extends React.Component {
    static propTypes = {
        onEmojiClick: PropTypes.func.isRequred
    }

    constructor(props) {
        super(props);
        this.handleEmojiChange = this.handleEmojiChange.bind(this);

        this.state = {
            customEmojis: EmojiStore.getCustomEmojiMap().values() ? EmojiStore.getCustomEmojiMap().values() : []
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
            customEmojis: EmojiStore.getCustomEmojiMap().values()
        });
    }

    render() {
        return (
            <EmojiPicker
                customEmojis={EmojiStore.getCustomEmojiMap().values()}
                onEmojiClick={this.props.onEmojiClick}
            />
        );
    }
}
