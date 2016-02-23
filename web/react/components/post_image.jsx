// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

export default class PostImageEmbed extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            loaded: false
        };
    }

    componentWillMount() {
        this.loadImg(this.props.link);
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.link !== this.props.link) {
            this.setState({
                loaded: false
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
        img.onload = () => {
            this.setState({
                loaded: true
            });
        };
        img.src = src;
    }

    render() {
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
