// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {OpenGraphMetadata} from '@mattermost/types/posts';

import ExternalLink from 'components/external_link';

import {getVideoId, ytRegex, handleYoutubeTime} from 'utils/youtube';

type Props = {
    postId: string;
    link: string;
    show: boolean;
    metadata?: OpenGraphMetadata;
    youtubeReferrerPolicy?: boolean;
}

// State tracks whether we're using maxresdefault (true) or hqdefault (false)
// and whether the video is currently playing
type State = {
    playing: boolean;
    isMaxRes: boolean;
}

export default class YouTubeVideo extends React.PureComponent<Props, State> {
    static isYoutubeLink(link: string): boolean {
        return Boolean(link.trim().match(ytRegex));
    }

    constructor(props: Props) {
        super(props);

        this.state = {
            playing: false,
            isMaxRes: false, // Start with hqdefault by default
        };
    }

    componentDidMount() {
        this.checkMaxResImage();
    }

    componentDidUpdate(prevProps: Props) {
        if (prevProps.link !== this.props.link) {
            this.checkMaxResImage();
        }
    }

    // Check if maxresdefault image exists for this video
    // If it does, switch to using it; otherwise stay with hqdefault
    checkMaxResImage = async () => {
        const videoId = getVideoId(this.props.link);
        const maxResUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

        try {
            const response = await fetch(maxResUrl, {method: 'HEAD'});
            if (response.ok) {
                this.setState({isMaxRes: true});
            }
        } catch (error) {
            // Stay with hqdefault if maxresdefault doesn't exist or fails to load
            this.setState({isMaxRes: false});
        }
    };

    static getDerivedStateFromProps(props: Props, state: State): State | null {
        if (!props.show && state.playing) {
            return {
                ...state,
                playing: false,
            };
        }
        return null;
    }

    // Fallback to hqdefault if maxresdefault fails to load
    handleImageError = () => {
        if (this.state.isMaxRes) {
            this.setState({isMaxRes: false});
        }
    };

    play = () => {
        this.setState({playing: true});
    };

    stop = () => {
        this.setState({playing: false});
    };

    render() {
        const {metadata, link} = this.props;
        const videoId = getVideoId(link);
        const videoTitle = metadata?.title || 'unknown';
        const time = handleYoutubeTime(link);

        // Use hqdefault by default, switch to maxresdefault if available
        const hqUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        const maxResUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        const thumbnailUrl = this.state.isMaxRes ? maxResUrl : hqUrl;
        const aspectRatioClass = this.state.isMaxRes ? 'maxres' : 'hq';

        const header = (
            <h4>
                <span className='video-type'>{'YouTube - '}</span>
                <span className='video-title'>
                    <ExternalLink
                        href={this.props.link}
                        location='youtube_video'
                    >
                        {videoTitle}
                    </ExternalLink>
                </span>
            </h4>
        );

        let content;

        if (this.state.playing) {
            content = (
                <div className={`video-thumbnail__container ${aspectRatioClass}`}>
                    <iframe
                        src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0${time}`}
                        frameBorder='0'
                        allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
                        allowFullScreen={true}
                        title={videoTitle}
                    />
                </div>
            );
        } else {
            content = (
                <div
                    className={`video-thumbnail__container ${aspectRatioClass}`}
                    onClick={this.play}
                >
                    <img
                        className='video-thumbnail'
                        src={thumbnailUrl}
                        alt=''
                        onError={this.handleImageError}
                    />
                    <div className='play-button'>
                        <i className='icon-play'/>
                    </div>
                </div>
            );
        }

        return (
            <div className='post__embed-container'>
                <div>
                    {header}
                    <div className='video-div embed-responsive-item'>
                        {content}
                    </div>
                </div>
            </div>
        );
    }
}
