// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import PropTypes from 'prop-types';
import React from 'react';

import {postListScrollChange} from 'actions/global_actions.jsx';

const WAIT_FOR_HEIGHT_TIMEOUT = 100;

export default class MarkdownImage extends React.PureComponent {
    static propTypes = {

        /*
         * The href of the image to be loaded
         */
        href: PropTypes.string
    }

    constructor(props) {
        super(props);

        this.heightTimeout = 0;
    }

    componentDidMount() {
        this.waitForHeight();
    }

    componentDidUpdate(prevProps) {
        if (this.props.href !== prevProps.href) {
            this.waitForHeight();
        }
    }

    componentWillUnmount() {
        this.stopWaitingForHeight();
    }

    waitForHeight = () => {
        if (this.refs.image.height) {
            setTimeout(postListScrollChange, 0);

            this.heightTimeout = 0;
        } else {
            this.heightTimeout = setTimeout(this.waitForHeight, WAIT_FOR_HEIGHT_TIMEOUT);
        }
    }

    stopWaitingForHeight = () => {
        if (this.heightTimeout !== 0) {
            clearTimeout(this.heightTimeout);
            this.heightTimeout = 0;
        }
    }

    render() {
        return (
            <img
                {...this.props}
                ref='image'
                onLoad={this.stopWaitingForHeight}
                onError={this.stopWaitingForHeight}
            />
        );
    }
}
