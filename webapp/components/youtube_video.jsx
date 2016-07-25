// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import ChannelStore from 'stores/channel_store.jsx';
import WebClient from 'client/web_client.jsx';
import * as Utils from 'utils/utils.jsx';

const ytRegex = /(?:http|https):\/\/(?:www\.)?(?:(?:youtube\.com\/(?:(?:v\/)|(\/u\/\w\/)|(?:(?:watch|embed\/watch)(?:\/|.*v=))|(?:embed\/)|(?:user\/[^\/]+\/u\/[0-9]\/)))|(?:youtu\.be\/))([^#&\?]*)/;

import React from 'react';

export default class YoutubeVideo extends React.Component {
    constructor(props) {
        super(props);

        this.updateStateFromProps = this.updateStateFromProps.bind(this);
        this.handleReceivedMetadata = this.handleReceivedMetadata.bind(this);
        this.handleMetadataError = this.handleMetadataError.bind(this);
        this.loadWithoutKey = this.loadWithoutKey.bind(this);

        this.play = this.play.bind(this);
        this.stop = this.stop.bind(this);
        this.stopOnChannelChange = this.stopOnChannelChange.bind(this);

        this.state = {
            loaded: false,
            failed: false,
            playing: false,
            title: ''
        };
    }

    componentWillMount() {
        this.updateStateFromProps(this.props);
    }

    componentWillReceiveProps(nextProps) {
        this.updateStateFromProps(nextProps);
    }

    updateStateFromProps(props) {
        const link = props.link;

        const match = link.trim().match(ytRegex);
        if (!match || match[2].length !== 11) {
            return;
        }

        if (props.show === false) {
            this.stop();
        }

        this.setState({
            videoId: match[2],
            time: this.handleYoutubeTime(link)
        });
    }

    handleYoutubeTime(link) {
        const timeRegex = /[\\?&]t=([0-9hms]+)/;

        const time = link.match(timeRegex);
        if (!time || !time[1]) {
            return '';
        }

        const hours = time[1].match(/([0-9]+)h/);
        const minutes = time[1].match(/([0-9]+)m/);
        const seconds = time[1].match(/([0-9]+)s/);

        let ticks = 0;

        if (hours && hours[1]) {
            ticks += parseInt(hours[1], 10) * 3600;
        }

        if (minutes && minutes[1]) {
            ticks += parseInt(minutes[1], 10) * 60;
        }

        if (seconds && seconds[1]) {
            ticks += parseInt(seconds[1], 10);
        }

        return '&start=' + ticks.toString();
    }

    componentDidMount() {
        const key = global.window.mm_config.GoogleDeveloperKey;
        if (key) {
            WebClient.getYoutubeVideoInfo(key, this.state.videoId,
                this.handleReceivedMetadata, this.handleMetadataError);
        } else {
            this.loadWithoutKey();
        }
    }

    loadWithoutKey() {
        this.setState({
            loaded: true,
            thumb: 'https://i.ytimg.com/vi/' + this.state.videoId + '/hqdefault.jpg'
        });
    }

    handleMetadataError() {
        this.setState({
            failed: true,
            loaded: true,
            title: Utils.localizeMessage('youtube_video.notFound', 'Video not found')
        });
    }

    handleReceivedMetadata(data) {
        if (!data || !data.items || !data.items.length || !data.items[0].snippet) {
            this.setState({
                failed: true,
                loaded: true,
                title: Utils.localizeMessage('youtube_video.notFound', 'Video not found')
            });
            return null;
        }
        const metadata = data.items[0].snippet;
        let thumb = 'https://i.ytimg.com/vi/' + this.state.videoId + '/hqdefault.jpg';
        if (metadata.liveBroadcastContent === 'live') {
            thumb = 'https://i.ytimg.com/vi/' + this.state.videoId + '/hqdefault_live.jpg';
        }

        this.setState({
            loaded: true,
            receivedYoutubeData: true,
            title: metadata.title,
            thumb
        });
        return null;
    }

    play() {
        this.setState({playing: true});

        if (ChannelStore.getCurrentId() === this.props.channelId) {
            ChannelStore.addChangeListener(this.stopOnChannelChange);
        }
    }

    stop() {
        this.setState({playing: false});
    }

    stopOnChannelChange() {
        if (ChannelStore.getCurrentId() !== this.props.channelId) {
            this.stop();
        }
    }

    render() {
        if (!this.state.loaded) {
            return <div className='video-loading'/>;
        }

        let header;
        if (this.state.title) {
            header = (
                <h4>
                    <span className='video-type'>{'Youtube - '}</span>
                    <span className='video-title'>
                        <a
                            href={this.props.link}
                            target='blank'
                            rel='noopener noreferrer'
                        >
                            {this.state.title}
                        </a>
                    </span>
                </h4>
            );
        }

        let content;
        if (this.state.failed) {
            content = (
                <div>
                    <div className='video-thumbnail__container'>
                        <div className='video-thumbnail__error'>
                            <div><i className='fa fa-warning fa-2x'/></div>
                            <div>{Utils.localizeMessage('youtube_video.notFound', 'Video not found')}</div>
                        </div>
                    </div>
                </div>
            );
        } else if (this.state.playing) {
            content = (
                <iframe
                    src={'https://www.youtube.com/embed/' + this.state.videoId + '?autoplay=1&autohide=1&border=0&wmode=opaque&fs=1&enablejsapi=1' + this.state.time}
                    width='480px'
                    height='360px'
                    type='text/html'
                    frameBorder='0'
                    allowFullScreen='allowfullscreen'
                />
            );
        } else {
            content = (
                <div className='embed-responsive embed-responsive-4by3 video-div__placeholder'>
                    <div className='video-thumbnail__container'>
                        <img
                            className='video-thumbnail'
                            src={this.state.thumb}
                        />
                        <div className='block'>
                            <span className='play-button'><span/></span>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div>
                {header}
                <div
                    className='video-div embed-responsive-item'
                    onClick={this.play}
                >
                    {content}
                </div>
            </div>
        );
    }

    static isYoutubeLink(link) {
        return link.trim().match(ytRegex);
    }
}

YoutubeVideo.propTypes = {
    channelId: React.PropTypes.string.isRequired,
    link: React.PropTypes.string.isRequired,
    show: React.PropTypes.bool.isRequired
};
