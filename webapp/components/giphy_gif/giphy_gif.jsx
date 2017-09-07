// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {postListScrollChange} from 'actions/global_actions.jsx';
import giphyIcon from 'images/icons/giphy.png';

import React from 'react';
import PropTypes from 'prop-types';

const giphyRegex = /(?:http|https):\/\/(?:www|media\d*\.)?(?:giphy\.com|gph\.is).*\.gif/;

export default class GiphyGif extends React.PureComponent {
    static propTypes = {

        /**
         * The link to load the image from
         */
        link: PropTypes.string.isRequired,

        /**
         * Function to call when image is loaded
         */
        onLinkLoaded: PropTypes.func,

        /**
         * The function to call if image load fails
         */
        onLinkLoadError: PropTypes.func
    }

    constructor(props) {
        super(props);

        this.handleLoadComplete = this.handleLoadComplete.bind(this);
        this.handleLoadError = this.handleLoadError.bind(this);

        this.state = {
            loaded: false,
            errored: false
        };
    }

    componentWillMount() {
        this.loadImg(this.props.link);
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.link !== this.props.link) {
            this.setState({
                loaded: false,
                errored: false
            });
        }
    }

    componentDidUpdate(prevProps) {
        if (!this.state.loaded && prevProps.link !== this.props.link) {
            this.loadImg(this.props.link);
        }
    }

    loadImg(src) {
        const img = new Image();
        img.onload = this.handleLoadComplete;
        img.onerror = this.handleLoadError;
        img.src = src;
    }

    handleLoadComplete() {
        this.setState({
            loaded: true,
            errored: false
        });

        postListScrollChange();

        if (this.props.onLinkLoaded) {
            this.props.onLinkLoaded();
        }
    }

    handleLoadError() {
        this.setState({
            errored: true,
            loaded: true
        });
        if (this.props.onLinkLoadError) {
            this.props.onLinkLoadError();
        }
    }

    render() {
        if (this.state.errored || !this.state.loaded) {
            return null;
        }

        return (
            <div className='post__embed-container giphy'>
                <img
                    className='gif-div'
                    src={this.props.link}
                />
                <div className='giphy-logo'>
                    <img
                        width={200}
                        height={22}
                        src={giphyIcon}
                    />
                </div>
            </div>
        );
    }

    static isGiphyLink(link) {
        return link.trim().match(giphyRegex);
    }
}