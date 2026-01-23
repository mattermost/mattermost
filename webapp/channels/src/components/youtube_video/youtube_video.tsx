// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import type {OpenGraphMetadata} from '@mattermost/types/posts';

import ExternalImage from 'components/external_image';
import ExternalLink from 'components/external_link';

import {getVideoId, ytRegex, handleYoutubeTime} from 'utils/youtube';

type Props = {
    link: string;
    show: boolean;
    metadata?: OpenGraphMetadata;
    youtubeReferrerPolicy?: boolean;
}

type State = {
    playing: boolean;
    useMaxResThumbnail: boolean;
    prevLink: string;
}

type YouTubeThumbnailProps = {
    play: () => void;
    videoTitle: string;
    onError: () => void;
    thumbnailUrl: string;
};

function YouTubeThumbnail({play, videoTitle, onError, thumbnailUrl}: YouTubeThumbnailProps) {
    const {formatMessage} = useIntl();

    return (
        <div
            className='video-thumbnail__container'
            onClick={play}
            role='button'
            aria-label={formatMessage({
                id: 'youtube_video.play.aria_label',
                defaultMessage: 'Play {videoTitle} on YouTube',
            }, {
                videoTitle,
            })}
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    play();
                }
            }}
        >
            <ExternalImage src={thumbnailUrl}>
                {(src) => (
                    <img
                        className='video-thumbnail'
                        src={src}
                        alt={formatMessage({
                            id: 'youtube_video.thumbnail.alt_text',
                            defaultMessage: 'Thumbnail for {videoTitle} on YouTube',
                        }, {
                            videoTitle,
                        })}
                        onError={onError}
                    />
                )}
            </ExternalImage>
            <div
                className='play-button'
                role='presentation'
                aria-label={formatMessage({
                    id: 'youtube_video.play_button.aria_label',
                    defaultMessage: 'Play video',
                })}
            >
                <i
                    className='icon-play'
                    aria-hidden='true'
                />
            </div>
        </div>
    );
}

export default class YoutubeVideo extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            playing: false,
            useMaxResThumbnail: true,
            prevLink: props.link,
        };
    }

    static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
        const nextState: Partial<State> = {};

        if (!props.show && state.playing) {
            nextState.playing = false;
        }

        if (props.link !== state.prevLink) {
            nextState.useMaxResThumbnail = true;
            nextState.prevLink = props.link;
        }

        return Object.keys(nextState).length > 0 ? nextState : null;
    }

    getMaxResUrl(link: string) {
        const videoId = getVideoId(link);
        return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    }

    getHQUrl(link: string) {
        const videoId = getVideoId(link);
        return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    }

    handleImageError = () => {
        this.setState({
            useMaxResThumbnail: false,
        });
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

        const thumbnailUrl = this.state.useMaxResThumbnail ? this.getMaxResUrl(link) : this.getHQUrl(link);

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
                        src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&fs=1&enablejsapi=1${time}`}
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
                <YouTubeThumbnail
                    play={this.play}
                    videoTitle={videoTitle}
                    onError={this.handleImageError}
                    thumbnailUrl={thumbnailUrl}
                />
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

    static isYoutubeLink(link: string): boolean {
        return Boolean(link.trim().match(ytRegex));
    }
}
