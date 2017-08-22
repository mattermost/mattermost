import PropTypes from 'prop-types';

// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import EmojiStore from 'stores/emoji_store.jsx';

export default class EmojiPickerItem extends React.PureComponent {
    static propTypes = {
        emoji: PropTypes.object.isRequired,
        onItemOver: PropTypes.func.isRequired,
        onItemOut: PropTypes.func.isRequired,
        onItemClick: PropTypes.func.isRequired,
        onItemUnmount: PropTypes.func.isRequired
    }

    constructor(props) {
        super(props);

        this.handleMouseOver = this.handleMouseOver.bind(this);
        this.handleMouseOut = this.handleMouseOut.bind(this);
        this.handleClick = this.handleClick.bind(this);
    }

    componentWillUnmount() {
        this.props.onItemUnmount(this.props.emoji);
    }

    handleMouseOver() {
        this.props.onItemOver(this.props.emoji);
    }

    handleMouseOut() {
        this.props.onItemOut();
    }

    handleClick() {
        this.props.onItemClick(this.props.emoji);
    }

    render() {
        return (
            <span
                onMouseOver={this.handleMouseOver}
                onMouseOut={this.handleMouseOut}
                onClick={this.handleClick}
                className='emoji-picker__item-wrapper'
            >
                <img
                    className='emoji-picker__item emoticon'
                    src={EmojiStore.getEmojiImageUrl(this.props.emoji)}
                />
            </span>
        );
    }
}
