// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

export default class EmojiPickerCategory extends React.Component {
    static propTypes = {
        category: React.PropTypes.string.isRequired,
        icon: React.PropTypes.node.isRequired,
        onCategoryClick: React.PropTypes.func.isRequired,
        selected: React.PropTypes.bool.isRequired
    }

    constructor(props) {
        super(props);

        this.handleClick = this.handleClick.bind(this);
    }

    handleClick(e) {
        e.preventDefault();

        this.props.onCategoryClick(this.props.category);
    }

    render() {
        let className = 'emoji-picker__category';
        if (this.props.selected) {
            className += ' emoji-picker__category--selected';
        }

        return (
            <a
                className={className}
                href='#'
                onClick={this.handleClick}
            >
                {this.props.icon}
            </a>
        );
    }
}
