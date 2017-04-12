// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import EmojiStore from 'stores/emoji_store.jsx';

export default class EmojiPickerItem extends React.Component {
    static propTypes = {
        emoji: React.PropTypes.object.isRequired,
        onItemOver: React.PropTypes.func.isRequired,
        onItemOut: React.PropTypes.func.isRequired,
        onItemClick: React.PropTypes.func.isRequired,
        onItemUnmount: React.PropTypes.func.isRequired,
        category: React.PropTypes.string.isRequired
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
        this.props.onItemOut(this.props.emoji);
    }

    handleClick() {
        this.props.onItemClick(this.props.emoji);
    }

    render() {
        let item = null;

        if (this.props.category === 'recent' || this.props.category === 'custom') {
            item =
                (<span>
                    <img
                        className='emoji-picker__item emoticon'
                        onMouseOver={this.handleMouseOver}
                        onMouseOut={this.handleMouseOut}
                        onClick={this.handleClick}
                        src={EmojiStore.getEmojiImageUrl(this.props.emoji)}
                    />
                </span>);
        } else {
            item =
                (<div >
                    <img
                        src='/static/emoji/img_trans.gif'
                        className={'  emojisprite emoji-' + this.props.emoji.filename + ' '}
                        onMouseOver={this.handleMouseOver}
                        onMouseOut={this.handleMouseOut}
                        onClick={this.handleClick}
                    />
                </div>);
        }
        return item;
    }
}
