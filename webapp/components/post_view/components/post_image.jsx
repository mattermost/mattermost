// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

export default class PostImageEmbed extends React.Component {
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
            loaded: true
        });
    }

    handleLoadError() {
        this.setState({
            errored: true,
            loaded: true
        });
    }

    render() {
        if (this.state.errored) {
            return null;
        }

        if (!this.state.loaded) {
            return (
                <img
                    className='img-div placeholder'
                    height='500px'
                />
            );
        }

        return (
            <img
                className='img-div'
                src={this.props.link}
            />
        );
    }
}

PostImageEmbed.propTypes = {
    link: React.PropTypes.string.isRequired
};
