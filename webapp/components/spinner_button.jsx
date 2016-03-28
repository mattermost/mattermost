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

    render() {
        const {spinning, children, ...props} = this.props; // eslint-disable-line no-use-before-define

        if (spinning) {
            return (
                <img
                    className='spinner-button__gif'
                    src={loadingGif}
                />
            );
        }

        return (
            <button
                className='btn btn-primary'
                {...props}
            >
                {children}
            </button>
        );
    }
}
