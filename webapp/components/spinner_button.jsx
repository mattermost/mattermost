import PropTypes from 'prop-types';

// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import loadingGif from 'images/load.gif';

export default class SpinnerButton extends React.Component {
    static get propTypes() {
        return {
            children: PropTypes.node,
            spinning: PropTypes.bool.isRequired,
            onClick: PropTypes.func
        };
    }

    static get defaultProps() {
        return {
            spinning: false
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
