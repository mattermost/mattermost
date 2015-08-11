// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var Client = require('../utils/client.jsx');
var utils = require('../utils/utils.jsx');

module.exports = React.createClass({
    displayName: 'ViewImageModal',
    canSetState: false,
    handleNext: function() {
        var id = this.state.imgId + 1;
        if (id > this.props.filenames.length - 1) {
            id = 0;
        }
        this.setState({imgId: id});
        this.loadImage(id);
    },
    handlePrev: function() {
        var id = this.state.imgId - 1;
        if (id < 0) {
            id = this.props.filenames.length - 1;
        }
        this.setState({imgId: id});
        this.loadImage(id);
    },
    handleKeyPress: function handleKeyPress(e) {
        if (!e) {
            return;
        } else if (e.keyCode === 39) {
            this.handleNext();
        } else if (e.keyCode === 37) {
            this.handlePrev();
        }
    },
    componentWillReceiveProps: function(nextProps) {
        this.setState({imgId: nextProps.startId});
    },
    loadImage: function(id) {
        var imgHeight = $(window).height() - 100;
        if (this.state.loaded[id] || this.state.images[id]) {
            $('.modal .modal-image .image-wrapper img').css('max-height', imgHeight);
            return;
        }

        var filename = this.props.filenames[id];

        var fileInfo = utils.splitFileLocation(filename);
        var fileType = utils.getFileType(fileInfo.ext);

        if (fileType === 'image') {
            var self = this;
            var img = new Image();
            img.load(this.getPreviewImagePath(filename),
                function() {
                    var progress = self.state.progress;
                    progress[id] = img.completedPercentage;
                    self.setState({progress: progress});
                });
            img.onload = function(imgid) {
                return function() {
                    var loaded = self.state.loaded;
                    loaded[imgid] = true;
                    self.setState({loaded: loaded});
                    $(self.refs.image.getDOMNode()).css('max-height', imgHeight);
                };
            }(id);
            var images = this.state.images;
            images[id] = img;
            this.setState({images: images});
        } else {
            // there's nothing to load for non-image files
            var loaded = this.state.loaded;
            loaded[id] = true;
            this.setState({loaded: loaded});
        }
    },
    componentDidUpdate: function() {
        if (this.state.loaded[this.state.imgId]) {
            if (this.refs.imageWrap) {
                $(this.refs.imageWrap.getDOMNode()).removeClass('default');
            }
        }
    },
    componentDidMount: function() {
        var self = this;
        $('#' + this.props.modalId).on('shown.bs.modal', function() {
            self.setState({viewed: true});
            self.loadImage(self.state.imgId);
        });

        $(this.refs.modal.getDOMNode()).click(function(e) {
            if (e.target === this || e.target === self.refs.imageBody.getDOMNode()) {
                $('.image_modal').modal('hide');
            }
        });

        $(this.refs.imageWrap.getDOMNode()).hover(
            function() {
                $(self.refs.imageFooter.getDOMNode()).addClass('footer--show');
            }, function() {
                $(self.refs.imageFooter.getDOMNode()).removeClass('footer--show');
            }
        );

        $(window).on('keyup', this.handleKeyPress);

        // keep track of whether or not this component is mounted so we can safely set the state asynchronously
        this.canSetState = true;
    },
    componentWillUnmount: function() {
        this.canSetState = false;
        $(window).off('keyup', this.handleKeyPress);
    },
    getPublicLink: function() {
        var data = {};
        data.channel_id = this.props.channelId;
        data.user_id = this.props.userId;
        data.filename = this.props.filenames[this.state.imgId];
        Client.getPublicLink(data,
            function(serverData) {
                window.open(serverData.public_link);
            },
            function() {
            }
        );
    },
    getPreviewImagePath: function(filename) {
        // Returns the path to a preview image that can be used to represent a file.
        var fileInfo = utils.splitFileLocation(filename);
        var fileType = utils.getFileType(fileInfo.ext);

        if (fileType === 'image') {
            // This is a temporary patch to fix issue with old files using absolute paths
            if (fileInfo.path.indexOf('/api/v1/files/get') !== -1) {
                fileInfo.path = fileInfo.path.split('/api/v1/files/get')[1];
            }
            fileInfo.path = utils.getWindowLocationOrigin() + '/api/v1/files/get' + fileInfo.path;

            return fileInfo.path + '_preview.jpg';
        }

        // only images have proper previews, so just use a placeholder icon for non-images
        return utils.getPreviewImagePathForFileType(fileType);
    },
    getInitialState: function() {
        var loaded = [];
        var progress = [];
        for (var i = 0; i < this.props.filenames.length; i ++) {
            loaded.push(false);
            progress.push(0);
        }
        return {imgId: this.props.startId, viewed: false, loaded: loaded, progress: progress, images: {}, fileSizes: {}};
    },
    render: function() {
        if (this.props.filenames.length < 1 || this.props.filenames.length - 1 < this.state.imgId) {
            return <div/>;
        }

        var filename = this.props.filenames[this.state.imgId];
        var fileUrl = utils.getFileUrl(filename);

        var name = decodeURIComponent(utils.getFileName(filename));

        var content;
        var bgClass = '';
        if (this.state.loaded[this.state.imgId]) {
            var fileInfo = utils.splitFileLocation(filename);
            var fileType = utils.getFileType(fileInfo.ext);

            if (fileType === 'image') {
                // image files just show a preview of the file
                content = (
                    <a href={fileUrl} target='_blank'>
                        <img ref='image' src={this.getPreviewImagePath(filename)}/>
                    </a>
                );
            } else {
                // non-image files include a section providing details about the file
                var infoString = 'File type ' + fileInfo.ext.toUpperCase();
                if (this.state.fileSizes[filename] && this.state.fileSizes[filename] >= 0) {
                    infoString += ', Size ' + utils.fileSizeToString(this.state.fileSizes[filename]);
                }

                content = (
                    <div className='file-details__container'>
                        <a className={'file-details__preview'} href={fileUrl} target='_blank'>
                            <span className='file-details__preview-helper' />
                            <img ref='image' src={this.getPreviewImagePath(filename)} />
                        </a>
                        <div className='file-details'>
                            <div className='file-details__name'>{name}</div>
                            <div className='file-details__info'>{infoString}</div>
                        </div>
                    </div>
                );

                // asynchronously request the actual size of this file
                if (!(filename in this.state.fileSizes)) {
                    var self = this;

                    utils.getFileSize(utils.getFileUrl(filename), function(fileSize) {
                        if (self.canSetState) {
                            var fileSizes = self.state.fileSizes;
                            fileSizes[filename] = fileSize;
                            self.setState(fileSizes);
                        }
                    });
                }
            }
        } else {
            // display a progress indicator when the preview for an image is still loading
            var percentage = Math.floor(this.state.progress[this.state.imgId]);
            content = (
                <div>
                    <img className='loader-image' src='/static/images/load.gif' />
                    { percentage > 0 ?
                    <span className='loader-percent' >{'Previewing ' + percentage + '%'}</span>
                    : ''}
                </div>
            );
            bgClass = 'black-bg';
        }

        var publicLink = '';
        if (config.AllowPublicLink) {
            publicLink = (
                <div>
                    <a href='#' className='public-link text' data-title='Public Image' onClick={this.getPublicLink}>Get Public Link</a>
                    <span className='text'> | </span>
                </div>
            );
        }

        var leftArrow = '';
        var rightArrow = '';
        if (this.props.filenames.length > 1) {
            leftArrow = (
                <a className='modal-prev-bar' href='#' onClick={this.handlePrev}>
                    <i className='image-control image-prev'/>
                </a>
            );

            rightArrow = (
                <a className='modal-next-bar' href='#' onClick={this.handleNext}>
                    <i className='image-control image-next'/>
                </a>
            );
        }

        return (
            <div className='modal fade image_modal' ref='modal' id={this.props.modalId} tabIndex='-1' role='dialog' aria-hidden='true'>
                <div className='modal-dialog modal-image'>
                    <div className='modal-content image-content'>
                        <div ref='imageBody' className='modal-body image-body'>
                            <div ref='imageWrap' className={'image-wrapper default ' + bgClass}>
                                <div className='modal-close' data-dismiss='modal'></div>
                                {content}
                                <div ref='imageFooter' className='modal-button-bar'>
                                    <span className='pull-left text'>{'Image ' + (this.state.imgId + 1) + ' of ' + this.props.filenames.length}</span>
                                    <div className='image-links'>
                                        {publicLink}
                                        <a href={fileUrl} download={name} className='text'>Download</a>
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
});
