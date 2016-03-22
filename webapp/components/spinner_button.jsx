// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import loadingGif from 'images/load.gif';

export default class SpinnerButton extends React.Component {
    static get propTypes() {
        return {
            children: React.PropTypes.node,
            spinning: React.PropTypes.bool.isRequired,
            onClick: React.PropTypes.func
        };
    }

    constructor(props) {
        super(props);

        this.handleClick = this.handleClick.bind(this);
    }

    handleClick(e) {
        if (this.props.onClick) {
            this.props.onClick(e);
        }
    }

    render() {
        if (this.props.spinning) {
            return (
                <img
                    className='spinner-button__gif'
                    src={loadingGif}
                />
            );
        }

        return (
            <button
                onClick={this.handleClick}
                className='btn btn-sm btn-primary'
            >
                {this.props.children}
            </button>
        );
    }
}
