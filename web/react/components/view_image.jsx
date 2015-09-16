// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var Client = require('../utils/client.jsx');
var Utils = require('../utils/utils.jsx');

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

        var loaded = [];
        var progress = [];
        for (var i = 0; i < this.props.filenames.length; i++) {
            loaded.push(false);
            progress.push(0);
        }
        this.state = {imgId: this.props.startId, viewed: false, loaded: loaded, progress: progress, images: {}, fileSizes: {}};
    }
    handleNext() {
        var id = this.state.imgId + 1;
        if (id > this.props.filenames.length - 1) {
            id = 0;
        }
        this.setState({imgId: id});
        this.loadImage(id);
    }
    handlePrev() {
        var id = this.state.imgId - 1;
        if (id < 0) {
            id = this.props.filenames.length - 1;
        }
        this.setState({imgId: id});
        this.loadImage(id);
    }
    handleKeyPress(e) {
        if (!e) {
            return;
        } else if (e.keyCode === 39) {
            this.handleNext();
        } else if (e.keyCode === 37) {
            this.handlePrev();
        }
    }
    componentWillReceiveProps(nextProps) {
        this.setState({imgId: nextProps.startId});
    }
    loadImage(id) {
        var imgHeight = $(window).height() - 100;
        if (this.state.loaded[id] || this.state.images[id]) {
            $('.modal .modal-image .image-wrapper img').css('max-height', imgHeight);
            return;
        }

        var filename = this.props.filenames[id];

        var fileInfo = Utils.splitFileLocation(filename);
        var fileType = Utils.getFileType(fileInfo.ext);

        if (fileType === 'image') {
            var img = new Image();
            img.load(this.getPreviewImagePath(filename),
                function load() {
                    var progress = this.state.progress;
                    progress[id] = img.completedPercentage;
                    this.setState({progress: progress});
                }.bind(this));
            img.onload = (function onload(imgid) {
                return function onloadReturn() {
                    var loaded = this.state.loaded;
                    loaded[imgid] = true;
                    this.setState({loaded: loaded});
                    $(React.findDOMNode(this.refs.image)).css('max-height', imgHeight);
                }.bind(this);
            }.bind(this)(id));
            var images = this.state.images;
            images[id] = img;
            this.setState({images: images});
        } else {
            // there's nothing to load for non-image files
            var loaded = this.state.loaded;
            loaded[id] = true;
            this.setState({loaded: loaded});
        }
    }
    componentDidUpdate() {
        if (this.state.loaded[this.state.imgId]) {
            if (this.refs.imageWrap) {
                $(React.findDOMNode(this.refs.imageWrap)).removeClass('default');
            }
        }
    }
    componentDidMount() {
        $('#' + this.props.modalId).on('shown.bs.modal', function onModalShow() {
            this.setState({viewed: true});
            this.loadImage(this.state.imgId);
        }.bind(this));

        $('#' + this.props.modalId).on('hidden.bs.modal', function onModalHide() {
            if (this.refs.video) {
                var video = React.findDOMNode(this.refs.video);
                video.pause();
                video.currentTime = 0;
            }
        }.bind(this));

        $(React.findDOMNode(this.refs.modal)).click(function onModalClick(e) {
            if (e.target === this || e.target === React.findDOMNode(this.refs.imageBody)) {
                $('.image_modal').modal('hide');
            }
        }.bind(this));

        $(React.findDOMNode(this.refs.imageWrap)).hover(
            function onModalHover() {
                $(React.findDOMNode(this.refs.imageFooter)).addClass('footer--show');
            }.bind(this), function offModalHover() {
                $(React.findDOMNode(this.refs.imageFooter)).removeClass('footer--show');
            }.bind(this)
        );

        if (this.refs.previewArrowLeft) {
            $(React.findDOMNode(this.refs.previewArrowLeft)).hover(
                function onModalHover() {
                    $(React.findDOMNode(this.refs.imageFooter)).addClass('footer--show');
                }.bind(this), function offModalHover() {
                    $(React.findDOMNode(this.refs.imageFooter)).removeClass('footer--show');
                }.bind(this)
            );
        }

        if (this.refs.previewArrowRight) {
            $(React.findDOMNode(this.refs.previewArrowRight)).hover(
                function onModalHover() {
                    $(React.findDOMNode(this.refs.imageFooter)).addClass('footer--show');
                }.bind(this), function offModalHover() {
                    $(React.findDOMNode(this.refs.imageFooter)).removeClass('footer--show');
                }.bind(this)
            );
        }

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
            // This is a temporary patch to fix issue with old files using absolute paths
            if (fileInfo.path.indexOf('/api/v1/files/get') !== -1) {
                fileInfo.path = fileInfo.path.split('/api/v1/files/get')[1];
            }
            fileInfo.path = Utils.getWindowLocationOrigin() + '/api/v1/files/get' + fileInfo.path;

            return fileInfo.path + '_preview.jpg';
        }

        // only images have proper previews, so just use a placeholder icon for non-images
        return Utils.getPreviewImagePathForFileType(fileType);
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
                // image files just show a preview of the file
                content = (
                    <a
                        href={fileUrl}
                        target='_blank'
                    >
                        <img
                            ref='image'
                            src={this.getPreviewImagePath(filename)}
                        />
                    </a>
                );
            } else if (fileType === 'video' || fileType === 'audio') {
                content = (
                    <video
                        ref='video'
                        data-setup='{}'
                        controls='controls'
                    >
                        <source src={Utils.getWindowLocationOrigin() + '/api/v1/files/get' + filename} />
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

        var publicLink = '';
        if (global.window.config.AllowPublicLink) {
            publicLink = (
                <div>
                    <a
                        href='#'
                        className='public-link text'
                        data-title='Public Image'
                        onClick={this.getPublicLink}
                    >
                        Get Public Link
                    </a>
                    <span className='text'> | </span>
                </div>
            );
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

        return (
            <div
                className='modal fade image_modal'
                ref='modal'
                id={this.props.modalId}
                tabIndex='-1'
                role='dialog'
                aria-hidden='true'
            >
                <div className='modal-dialog modal-image'>
                    <div className='modal-content image-content'>
                        <div
                            ref='imageBody'
                            className='modal-body image-body'
                        >
                            <div
                                ref='imageWrap'
                                className={'image-wrapper default ' + bgClass}
                            >
                                <div
                                    className='modal-close'
                                    data-dismiss='modal'
                                />
                                {content}
                                <div
                                    ref='imageFooter'
                                    className='modal-button-bar'
                                >
                                <span className='pull-left text'>{'File ' + (this.state.imgId + 1) + ' of ' + this.props.filenames.length}</span>
                                    <div className='image-links'>
                                        {publicLink}
                                        <a
                                            href={fileUrl}
                                            download={name}
                                            className='text'
                                        >
                                            Download
                                        </a>
                                    </div>
                                </div>
                            </div>
                            {leftArrow}
                            {rightArrow}
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

ViewImageModal.defaultProps = {
    filenames: [],
    modalId: '',
    channelId: '',
    userId: '',
    startId: 0
};
ViewImageModal.propTypes = {
    filenames: React.PropTypes.array,
    modalId: React.PropTypes.string,
    channelId: React.PropTypes.string,
    userId: React.PropTypes.string,
    startId: React.PropTypes.number
};
