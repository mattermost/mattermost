// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Client from '../utils/client.jsx';
import * as Utils from '../utils/utils.jsx';
import Constants from '../utils/constants.jsx';
import ViewImagePopoverBar from './view_image_popover_bar.jsx';
const Modal = ReactBootstrap.Modal;
const KeyCodes = Constants.KeyCodes;

export default class ViewImageModal extends React.Component {
    constructor(props) {
        super(props);

        this.canSetState = false;

        this.loadImage = this.loadImage.bind(this);
        this.handleNext = this.handleNext.bind(this);
        this.handlePrev = this.handlePrev.bind(this);
        this.handleKeyPress = this.handleKeyPress.bind(this);
        this.getPublicLink = this.getPublicLink.bind(this);
        this.getPreviewImagePath = this.getPreviewImagePath.bind(this);
        this.onModalShown = this.onModalShown.bind(this);
        this.onModalHidden = this.onModalHidden.bind(this);
        this.onMouseEnterImage = this.onMouseEnterImage.bind(this);
        this.onMouseLeaveImage = this.onMouseLeaveImage.bind(this);

        var loaded = [];
        var progress = [];
        for (var i = 0; i < this.props.filenames.length; i++) {
            loaded.push(false);
            progress.push(0);
        }
        this.state = {
            imgId: this.props.startId,
            imgHeight: '100%',
            loaded: loaded,
            progress: progress,
            images: {},
            fileSizes: {},
            fileMimes: {},
            showFooter: false,
            isPlaying: {},
            isLoading: {}
        };
    }
    handleNext(e) {
        if (e) {
            e.stopPropagation();
        }
        var id = this.state.imgId + 1;
        if (id > this.props.filenames.length - 1) {
            id = 0;
        }
        this.setState({imgId: id});
        this.loadImage(id);
    }
    handlePrev(e) {
        if (e) {
            e.stopPropagation();
        }
        var id = this.state.imgId - 1;
        if (id < 0) {
            id = this.props.filenames.length - 1;
        }
        this.setState({imgId: id});
        this.loadImage(id);
    }
    handleKeyPress(e) {
        if (!e || !this.props.show) {
            return;
        } else if (e.keyCode === KeyCodes.RIGHT) {
            this.handleNext();
        } else if (e.keyCode === KeyCodes.LEFT) {
            this.handlePrev();
        }
    }
    onModalShown(nextProps) {
        this.setState({imgId: nextProps.startId});
        this.loadImage(nextProps.startId);
    }
    onModalHidden() {
        if (this.refs.video) {
            var video = ReactDOM.findDOMNode(this.refs.video);
            video.pause();
            video.currentTime = 0;
        }
    }
    componentWillReceiveProps(nextProps) {
        if (nextProps.show === true && this.props.show === false) {
            this.onModalShown(nextProps);
        } else if (nextProps.show === false && this.props.show === true) {
            this.onModalHidden();
        }
    }
    loadImage(id) {
        var imgHeight = $(window).height() - 100;
        this.setState({imgHeight});

        var filename = this.props.filenames[id];

        var fileInfo = Utils.splitFileLocation(filename);
        var fileType = Utils.getFileType(fileInfo.ext);

        if (fileType === 'image') {
            var img = new Image();
            img.load(this.getPreviewImagePath(filename),
                     () => {
                         const progress = this.state.progress;
                         progress[id] = img.completedPercentage;
                         this.setState({progress});
                     });
            img.onload = () => {
                const loaded = this.state.loaded;
                loaded[id] = true;
                this.setState({loaded});
            };
            var images = this.state.images;
            images[id] = img;
            this.setState({images});
        } else {
            // there's nothing to load for non-image files
            var loaded = this.state.loaded;
            loaded[id] = true;
            this.setState({loaded});
        }
    }
    playGif(e, filename, fileUrl) {
        var isLoading = this.state.isLoading;
        var isPlaying = this.state.isPlaying;

        isLoading[filename] = fileUrl;
        this.setState({isLoading});

        var img = new Image();
        img.load(fileUrl);
        img.onload = () => {
            delete isLoading[filename];
            isPlaying[filename] = fileUrl;
            this.setState({isPlaying, isLoading});
        };
        img.onError = () => {
            delete isLoading[filename];
            this.setState({isLoading});
        };

        e.stopPropagation();
        e.preventDefault();
    }
    stopGif(e, filename) {
        var isPlaying = this.state.isPlaying;
        delete isPlaying[filename];
        this.setState({isPlaying});

        e.stopPropagation();
        e.preventDefault();
    }
    componentDidMount() {
        $(window).on('keyup', this.handleKeyPress);

        // keep track of whether or not this component is mounted so we can safely set the state asynchronously
        this.canSetState = true;
    }
    componentWillUnmount() {
        this.canSetState = false;
        $(window).off('keyup', this.handleKeyPress);
    }
    getPublicLink() {
        var data = {};
        data.channel_id = this.props.channelId;
        data.user_id = this.props.userId;
        data.filename = this.props.filenames[this.state.imgId];
        Client.getPublicLink(data,
            function sucess(serverData) {
                if (Utils.isMobile()) {
                    window.location.href = serverData.public_link;
                } else {
                    window.open(serverData.public_link);
                }
            },
            function error() {}
        );
    }
    getPreviewImagePath(filename) {
        // Returns the path to a preview image that can be used to represent a file.
        var fileInfo = Utils.splitFileLocation(filename);
        var fileType = Utils.getFileType(fileInfo.ext);

        if (fileType === 'image') {
            if (filename in this.state.isPlaying) {
                return this.state.isPlaying[filename];
            }

            // This is a temporary patch to fix issue with old files using absolute paths
            if (fileInfo.path.indexOf('/api/v1/files/get') !== -1) {
                fileInfo.path = fileInfo.path.split('/api/v1/files/get')[1];
            }
            fileInfo.path = Utils.getWindowLocationOrigin() + '/api/v1/files/get' + fileInfo.path;

            return fileInfo.path + '_preview.jpg' + '?' + Utils.getSessionIndex();
        }

        // only images have proper previews, so just use a placeholder icon for non-images
        return Utils.getPreviewImagePathForFileType(fileType);
    }
    onMouseEnterImage() {
        this.setState({showFooter: true});
    }
    onMouseLeaveImage() {
        this.setState({showFooter: false});
    }
    render() {
        if (this.props.filenames.length < 1 || this.props.filenames.length - 1 < this.state.imgId) {
            return <div/>;
        }

        var filename = this.props.filenames[this.state.imgId];
        var fileUrl = Utils.getFileUrl(filename);

        var name = decodeURIComponent(Utils.getFileName(filename));

        var content;
        var bgClass = '';
        if (this.state.loaded[this.state.imgId]) {
            var fileInfo = Utils.splitFileLocation(filename);
            var fileType = Utils.getFileType(fileInfo.ext);

            if (fileType === 'image') {
                if (!(filename in this.state.fileMimes)) {
                    Client.getFileInfo(
                        filename,
                        (data) => {
                            if (this.canSetState) {
                                var fileMimes = this.state.fileMimes;
                                fileMimes[filename] = data.mime;
                                this.setState(fileMimes);
                            }
                        },
                        () => {}
                    );
                }

                var playbackControls = '';
                if (this.state.fileMimes[filename] === 'image/gif' && !(filename in this.state.isLoading)) {
                    if (filename in this.state.isPlaying) {
                        playbackControls = (
                            <div
                                className='file-playback-controls stop'
                                onClick={(e) => this.stopGif(e, filename)}
                            >
                                {"■"}
                            </div>
                        );
                    } else {
                        playbackControls = (
                            <div
                                className='file-playback-controls play'
                                onClick={(e) => this.playGif(e, filename, fileUrl)}
                            >
                                {"►"}
                            </div>
                        );
                    }
                }

                var loadingIndicator = '';
                if (this.state.isLoading[filename] === fileUrl) {
                    loadingIndicator = (
                        <img
                            className='spinner file__loading'
                            src='/static/images/load.gif'
                        />
                    );
                    playbackControls = '';
                }

                // image files just show a preview of the file
                content = (
                    <a
                        href={fileUrl}
                        target='_blank'
                    >
                        {loadingIndicator}
                        {playbackControls}
                        <img
                            style={{maxHeight: this.state.imgHeight}}
                            ref='image'
                            src={this.getPreviewImagePath(filename)}
                        />
                    </a>
                );
            } else if (fileType === 'video' || fileType === 'audio') {
                let width = Constants.WEB_VIDEO_WIDTH;
                let height = Constants.WEB_VIDEO_HEIGHT;
                if (Utils.isMobile()) {
                    width = Constants.MOBILE_VIDEO_WIDTH;
                    height = Constants.MOBILE_VIDEO_HEIGHT;
                }

                content = (
                    <video
                        style={{maxHeight: this.state.imgHeight}}
                        ref='video'
                        data-setup='{}'
                        controls='controls'
                        width={width}
                        height={height}
                    >
                        <source src={Utils.getWindowLocationOrigin() + '/api/v1/files/get' + filename + '?' + Utils.getSessionIndex()} />
                    </video>
                );
            } else {
                // non-image files include a section providing details about the file
                var infoString = 'File type ' + fileInfo.ext.toUpperCase();
                if (this.state.fileSizes[filename] && this.state.fileSizes[filename] >= 0) {
                    infoString += ', Size ' + Utils.fileSizeToString(this.state.fileSizes[filename]);
                }

                content = (
                    <div className='file-details__container'>
                        <a
                            className={'file-details__preview'}
                            href={fileUrl}
                            target='_blank'
                        >
                            <span className='file-details__preview-helper' />
                            <img
                                ref='image'
                                src={this.getPreviewImagePath(filename)}
                            />
                        </a>
                        <div className='file-details'>
                            <div className='file-details__name'>{name}</div>
                            <div className='file-details__info'>{infoString}</div>
                        </div>
                    </div>
                );
                bgClass = 'white-bg';

                // asynchronously request the actual size of this file
                if (!(filename in this.state.fileSizes)) {
                    Client.getFileInfo(
                        filename,
                        function success(data) {
                            if (this.canSetState) {
                                var fileSizes = this.state.fileSizes;
                                fileSizes[filename] = parseInt(data.size, 10);
                                this.setState(fileSizes);
                            }
                        }.bind(this),
                        function fail() {}
                    );
                }
            }
        } else {
            // display a progress indicator when the preview for an image is still loading
            var percentage = Math.floor(this.state.progress[this.state.imgId]);
            if (percentage) {
                content = (
                    <div>
                        <img
                            className='loader-image'
                            src='/static/images/load.gif'
                        />
                        <span className='loader-percent'>
                            {'Previewing ' + percentage + '%'}
                        </span>
                    </div>
                );
            } else {
                content = (
                    <div>
                        <img
                            className='loader-image'
                            src='/static/images/load.gif'
                        />
                    </div>
                );
            }
            bgClass = 'black-bg';
        }

        var leftArrow = '';
        var rightArrow = '';
        if (this.props.filenames.length > 1) {
            leftArrow = (
                <a
                    ref='previewArrowLeft'
                    className='modal-prev-bar'
                    href='#'
                    onClick={this.handlePrev}
                >
                    <i className='image-control image-prev'/>
                </a>
            );

            rightArrow = (
                <a
                    ref='previewArrowRight'
                    className='modal-next-bar'
                    href='#'
                    onClick={this.handleNext}
                >
                    <i className='image-control image-next'/>
                </a>
            );
        }

        let closeButtonClass = 'modal-close';
        if (this.state.showFooter) {
            closeButtonClass += ' modal-close--show';
        }

        return (
            <Modal
                show={this.props.show}
                onHide={this.props.onModalDismissed}
                className='image_modal'
                dialogClassName='modal-image'
            >
                <Modal.Body
                    modalClassName='image-body'
                    onClick={this.props.onModalDismissed}
                >
                    <div
                        className={'image-wrapper'}
                        onClick={this.props.onModalDismissed}
                    >
                        <div
                            className={bgClass}
                            onMouseEnter={this.onMouseEnterImage}
                            onMouseLeave={this.onMouseLeaveImage}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div
                                className={closeButtonClass}
                                onClick={this.props.onModalDismissed}
                            />
                            {content}
                            <ViewImagePopoverBar
                                show={this.state.showFooter}
                                fileId={this.state.imgId}
                                totalFiles={this.props.filenames.length}
                                filename={name}
                                fileURL={fileUrl}
                                getPublicLink={this.getPublicLink}
                            />
                        </div>
                    </div>
                    {leftArrow}
                    {rightArrow}
                </Modal.Body>
            </Modal>
        );
    }
}

ViewImageModal.defaultProps = {
    show: false,
    filenames: [],
    channelId: '',
    userId: '',
    startId: 0
};
ViewImageModal.propTypes = {
    show: React.PropTypes.bool.isRequired,
    onModalDismissed: React.PropTypes.func.isRequired,
    filenames: React.PropTypes.array,
    modalId: React.PropTypes.string,
    channelId: React.PropTypes.string,
    userId: React.PropTypes.string,
    startId: React.PropTypes.number
};
