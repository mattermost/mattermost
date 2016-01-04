// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

const ytRegex = /(?:http|https):\/\/(?:www\.)?(?:(?:youtube\.com\/(?:(?:v\/)|(\/u\/\w\/)|(?:(?:watch|embed\/watch)(?:\/|.*v=))|(?:embed\/)|(?:user\/[^\/]+\/u\/[0-9]\/)))|(?:youtu\.be\/))([^#\&\?]*)/;

export default class YoutubeVideo extends React.Component {
    constructor(props) {
        super(props);

        this.updateStateFromProps = this.updateStateFromProps.bind(this);
        this.handleReceivedMetadata = this.handleReceivedMetadata.bind(this);

        this.play = this.play.bind(this);
        this.stop = this.stop.bind(this);

        this.state = {
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
        if (global.window.mm_config.GoogleDeveloperKey) {
            $.ajax({
                async: true,
                url: 'https://www.googleapis.com/youtube/v3/videos',
                type: 'GET',
                data: {part: 'snippet', id: this.state.videoId, key: global.window.mm_config.GoogleDeveloperKey},
                success: this.handleReceivedMetadata
            });
        }
    }

    handleReceivedMetadata(data) {
        if (!data.items.length || !data.items[0].snippet) {
            return null;
        }
        var metadata = data.items[0].snippet;
        this.setState({
            receivedYoutubeData: true,
            title: metadata.title
        });
    }

    play() {
        this.setState({playing: true});
    }

    stop() {
        this.setState({playing: false});
    }

    render() {
        let header = 'Youtube';
        if (this.state.title) {
            header = header + ' - ';
        }

        let content;
        if (this.state.playing) {
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
                            src={'https://i.ytimg.com/vi/' + this.state.videoId + '/hqdefault.jpg'}
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
                <h4>
                    <span className='video-type'>{header}</span>
                    <span className='video-title'><a href={this.props.link}>{this.state.title}</a></span>
                </h4>
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
    link: React.PropTypes.string.isRequired
};
