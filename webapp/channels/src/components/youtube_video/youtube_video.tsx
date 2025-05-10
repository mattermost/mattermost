// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {defineMessages, FormattedMessage} from 'react-intl';

import {ArrowCollapseIcon, ArrowExpandIcon} from '@mattermost/compass-icons/components';
import type {OpenGraphMetadata} from '@mattermost/types/posts';

import ExternalImage from 'components/external_image';
import ExternalLink from 'components/external_link';
import WithTooltip from 'components/with_tooltip';

import {getIsShortsVideoLink, getVideoId, handleYoutubeTime, ytRegex} from 'utils/youtube';

type Props = {
    postId: string;
    link: string;
    show: boolean;
    metadata?: OpenGraphMetadata;
    youtubeReferrerPolicy?: boolean;
}

type State = {
    playing: boolean;
    shortsExpanded: boolean;
}

export default class YoutubeVideo extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            playing: false,
            shortsExpanded: false,
        };
    }

    static getDerivedStateFromProps(props: Props, state: State): State | null {
        if (!props.show && state.playing) {
            return {playing: false, shortsExpanded: false};
        }
        return null;
    }

    play = () => {
        this.setState({playing: true});
    };

    stop = () => {
        this.setState({playing: false});
    };

    toggleShortsExpanded = () => {
        this.setState({shortsExpanded: !this.state.shortsExpanded});
    };

    render() {
        const {metadata, link} = this.props;

        const videoId = getVideoId(link);
        const isShorts = getIsShortsVideoLink(link);
        const videoType = isShorts ? messages.shorts : messages.youtube;
        const videoTitle = metadata?.title || 'unknown';
        const time = handleYoutubeTime(link);

        const header = (
            <h4>
                <FormattedMessage
                    {...videoType}
                    values={{
                        title: (
                            <span className='video-title'>
                                <ExternalLink
                                    href={this.props.link}
                                    location='youtube_video'
                                >
                                    {videoTitle}
                                </ExternalLink>
                            </span>
                        ),
                        type: (v) => (<span className='video-type'>{v}</span>),
                    }}
                />
                {isShorts && (
                    <WithTooltip
                        id={`${this.props.postId}_expand_shorts`}
                        title={this.state.shortsExpanded ? messages.shrink : messages.expand}
                        placement='right'
                    >
                        <i
                            data-testid='youtube-expand-shorts'
                            className='video-expand-shorts'
                            onClick={this.toggleShortsExpanded}
                        >
                            {this.state.shortsExpanded ? <ArrowCollapseIcon/> : <ArrowExpandIcon/>}
                        </i>
                    </WithTooltip>
                )}
            </h4>
        );

        let content;

        if (this.state.playing) {
            content = (
                <iframe
                    src={'https://www.youtube.com/embed/' + videoId + '?autoplay=1&autohide=1&border=0&wmode=opaque&fs=1&enablejsapi=1' + time}
                    width='480px'
                    height='360px'
                    frameBorder='0'
                    allowFullScreen={true}
                    allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
                    referrerPolicy={this.props.youtubeReferrerPolicy ? 'strict-origin-when-cross-origin' : 'no-referrer'}
                    title={videoTitle}
                    sandbox='allow-scripts allow-same-origin allow-popups allow-presentation'
                />
            );
        } else {
            const image = metadata?.images[0];

            content = (
                <div className='embed-responsive video-div__placeholder'>
                    <div className='video-thumbnail__container'>
                        <ExternalImage src={image?.secure_url || image?.url || ''}>
                            {(safeUrl) => (
                                <img
                                    src={safeUrl}
                                    alt='youtube video thumbnail'
                                    className='video-thumbnail'
                                />
                            )}
                        </ExternalImage>
                        <div className='block'>
                            <span className='play-button'><span/></span>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div
                className='post__embed-container'
            >
                <div>
                    {header}
                    <div
                        data-testid='youtube-video'
                        className={classNames(
                            'video-div',
                            'embed-responsive-item',
                            {
                                'video-shorts-expanded': this.state.shortsExpanded,
                                'video-shorts': isShorts && !this.state.shortsExpanded,
                            },
                        )}
                        onClick={this.play}
                    >
                        {content}
                    </div>
                </div>
            </div>
        );
    }

    public static isYoutubeLink(link: string): boolean {
        return Boolean(link.trim().match(ytRegex));
    }
}

const messages = defineMessages({
    youtube: {
        id: 'youtube_video.type.youtube',
        defaultMessage: '<type>YouTube - </type>{title}',
    },
    shorts: {
        id: 'youtube_video.type.shorts',
        defaultMessage: '<type>YouTube Shorts - </type>{title}',
    },

    shrink: {
        id: 'youtube_video.shorts.shrink',
        defaultMessage: 'Shrink',
    },
    expand: {
        id: 'youtube_video.shorts.expand',
        defaultMessage: 'Expand Horizontally',
    },
});
