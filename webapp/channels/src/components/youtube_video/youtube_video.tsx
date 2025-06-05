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

// State tracks whether the video is playing and the current thumbnail URL
type State = {
    playing: boolean;
    thumbnailUrl: string;
}

export default class YoutubeVideo extends React.PureComponent<Props, State> {
    static isYoutubeLink(link: string): boolean {
        return Boolean(link.trim().match(ytRegex));
    }

    constructor(props: Props) {
        super(props);
        this.state = {
            playing: false,
            thumbnailUrl: '', // Initialize empty, will be set in componentDidMount
        };
    }

    componentDidMount() {
        this.setThumbnailUrl();
    }

    componentDidUpdate(prevProps: Props) {
        if (prevProps.link !== this.props.link) {
            this.setThumbnailUrl();
        }
    }

    getMaxResUrl(link: string) {
        const videoId = getVideoId(link);
        return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    }

    getHQUrl(link: string) {
        const videoId = getVideoId(link);
        return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    }

    setThumbnailUrl = () => {
        this.setState({
            thumbnailUrl: this.getMaxResUrl(this.props.link),
        });
    };

    handleImageError = () => {
        this.setState({
            thumbnailUrl: this.getHQUrl(this.props.link),
        });
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
                <div className='video-playing'>
                    <iframe
                        src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0${time}`}
                        title={videoTitle}
                        width='100%'
                        height='100%'
                        frameBorder='0'
                        allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
                        allowFullScreen={true}
                        referrerPolicy={this.props.youtubeReferrerPolicy ? 'origin' : undefined}
                        sandbox='allow-scripts allow-same-origin allow-popups allow-presentation'
                    />
                </div>
            );
        } else {
            content = (
                <div
                    className='video-thumbnail__container'
                    onClick={this.play}
                    role='button'
                    aria-label={`Play ${videoTitle} on YouTube`}
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            this.play();
                        }
                    }}
                >
                    <img
                        className='video-thumbnail'
                        src={this.state.thumbnailUrl}
                        alt={`Thumbnail for ${videoTitle} on YouTube`}
                        onError={this.handleImageError}
                    />
                    <div
                        className='play-button'
                        role='img'
                        aria-label='Play video'
                    >
                        <i
                            className='icon-play'
                            aria-hidden='true'
                        />
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
