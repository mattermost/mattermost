// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as AsyncClient from '../utils/async_client.jsx';
import * as Client from '../utils/client.jsx';
import * as Utils from '../utils/utils.jsx';
import AudioVideoPreview from './audio_video_preview.jsx';
import Constants from '../utils/constants.jsx';
import FileInfoPreview from './file_info_preview.jsx';
import FileStore from '../stores/file_store.jsx';
import ViewImagePopoverBar from './view_image_popover_bar.jsx';

import {intlShape, injectIntl, defineMessages} from 'mm-intl';

const Modal = ReactBootstrap.Modal;
const KeyCodes = Constants.KeyCodes;

const holders = defineMessages({
    loading: {
        id: 'view_image.loading',
        defaultMessage: 'Loading '
    }
});

class ViewImageModal extends React.Component {
    constructor(props) {
        super(props);

        this.showImage = this.showImage.bind(this);
        this.loadImage = this.loadImage.bind(this);

        this.handleNext = this.handleNext.bind(this);
        this.handlePrev = this.handlePrev.bind(this);
        this.handleKeyPress = this.handleKeyPress.bind(this);

        this.onModalShown = this.onModalShown.bind(this);
        this.onModalHidden = this.onModalHidden.bind(this);

        this.onFileStoreChange = this.onFileStoreChange.bind(this);

        this.getPublicLink = this.getPublicLink.bind(this);
        this.onMouseEnterImage = this.onMouseEnterImage.bind(this);
        this.onMouseLeaveImage = this.onMouseLeaveImage.bind(this);

        this.state = {
            imgId: this.props.startId,
            fileInfo: null,
            imgHeight: '100%',
            loaded: Utils.fillArray(false, this.props.filenames.length),
            progress: Utils.fillArray(0, this.props.filenames.length),
            showFooter: false
        };
    }

    handleNext(e) {
        if (e) {
            e.stopPropagation();
        }
        let id = this.state.imgId + 1;
        if (id > this.props.filenames.length - 1) {
            id = 0;
        }
        this.showImage(id);
    }

    handlePrev(e) {
        if (e) {
            e.stopPropagation();
        }
        let id = this.state.imgId - 1;
        if (id < 0) {
            id = this.props.filenames.length - 1;
        }
        this.showImage(id);
    }

    handleKeyPress(e) {
        if (e.keyCode === KeyCodes.RIGHT) {
            this.handleNext();
        } else if (e.keyCode === KeyCodes.LEFT) {
            this.handlePrev();
        }
    }

    onModalShown(nextProps) {
        $(window).on('keyup', this.handleKeyPress);

        this.showImage(nextProps.startId);

        FileStore.addChangeListener(this.onFileStoreChange);
    }

    onModalHidden() {
        $(window).off('keyup', this.handleKeyPress);

        if (this.refs.video) {
            this.refs.video.stop();
        }

        FileStore.removeChangeListener(this.onFileStoreChange);
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.show === true && this.props.show === false) {
            this.onModalShown(nextProps);
        } else if (nextProps.show === false && this.props.show === true) {
            this.onModalHidden();
        }

        if (!Utils.areObjectsEqual(this.props.filenames, nextProps.filenames)) {
            this.setState({
                loaded: Utils.fillArray(false, nextProps.filenames.length),
                progress: Utils.fillArray(0, nextProps.filenames.length)
            });
        }
    }

    onFileStoreChange(filename) {
        const id = this.props.filenames.indexOf(filename);

        if (id !== -1) {
            if (id === this.state.imgId) {
                this.setState({
                    fileInfo: FileStore.getInfo(filename)
                });
            }

            if (!this.state.loaded[id]) {
                this.loadImage(id, filename);
            }
        }
    }

    showImage(id) {
        this.setState({imgId: id});

        const imgHeight = $(window).height() - 100;
        this.setState({imgHeight});

        const filename = this.props.filenames[id];

        if (!FileStore.hasInfo(filename)) {
            // the image will actually be loaded once we know what we need to load
            AsyncClient.getFileInfo(filename);
            return;
        }

        this.setState({
            fileInfo: FileStore.getInfo(filename)
        });

        if (!this.state.loaded[id]) {
            this.loadImage(id, filename);
        }
    }

    loadImage(id, filename) {
        const fileInfo = FileStore.getInfo(filename);
        const fileType = Utils.getFileType(fileInfo.extension);

        if (fileType === 'image') {
            let previewUrl;
            if (fileInfo.has_image_preview) {
                previewUrl = Utils.getPreviewImagePath(filename);
            } else {
                // some images (eg animated gifs) just show the file itself and not a preview
                previewUrl = Utils.getFileUrl(filename);
            }

            const img = new Image();
            img.load(
                previewUrl,
                () => {
                    const progress = this.state.progress;
                    progress[id] = img.completedPercentage;
                    this.setState({progress});
                }
            );
            img.onload = () => {
                const loaded = this.state.loaded;
                loaded[id] = true;
                this.setState({loaded});
            };
        } else {
            // there's nothing to load for non-image files
            var loaded = this.state.loaded;
            loaded[id] = true;
            this.setState({loaded});
        }
    }

    getPublicLink() {
        var data = {};
        data.channel_id = this.props.channelId;
        data.user_id = this.props.userId;
        data.filename = this.props.filenames[this.state.imgId];
        Client.getPublicLink(
            data,
            (serverData) => {
                if (Utils.isMobile()) {
                    window.location.href = serverData.public_link;
                } else {
                    window.open(serverData.public_link);
                }
            },
            () => {}
        );
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

        const filename = this.props.filenames[this.state.imgId];
        const fileUrl = Utils.getFileUrl(filename, true);

        var content;
        if (this.state.loaded[this.state.imgId]) {
            // this.state.fileInfo is for the current image and we shoudl have it before we load the image
            const fileInfo = this.state.fileInfo;
            const fileType = Utils.getFileType(fileInfo.extension);

            if (fileType === 'image') {
                content = (
                    <ImagePreview
                        filename={filename}
                        fileUrl={fileUrl}
                        fileInfo={fileInfo}
                        maxHeight={this.state.imgHeight}
                    />
                );
            } else if (fileType === 'video' || fileType === 'audio') {
                content = (
                    <AudioVideoPreview
                        filename={filename}
                        fileUrl={fileUrl}
                        fileInfo={this.state.fileInfo}
                        maxHeight={this.state.imgHeight}
                        formatMessage={this.props.intl.formatMessage}
                    />
                );
            } else {
                content = (
                    <FileInfoPreview
                        filename={filename}
                        fileUrl={fileUrl}
                        fileInfo={fileInfo}
                        formatMessage={this.props.intl.formatMessage}
                    />
                );
            }
        } else {
            // display a progress indicator when the preview for an image is still loading
            const progress = Math.floor(this.state.progress[this.state.imgId]);

            content = (
                <LoadingImagePreview
                    progress={progress}
                    loading={this.props.intl.formatMessage(holders.loading)}
                />
            );
        }

        let leftArrow = null;
        let rightArrow = null;
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
    intl: intlShape.isRequired,
    show: React.PropTypes.bool.isRequired,
    onModalDismissed: React.PropTypes.func.isRequired,
    filenames: React.PropTypes.array,
    modalId: React.PropTypes.string,
    channelId: React.PropTypes.string,
    userId: React.PropTypes.string,
    startId: React.PropTypes.number
};

function LoadingImagePreview({progress, loading}) {
    let progressView = null;
    if (progress) {
        progressView = (
            <span className='loader-percent'>
                {loading + progress + '%'}
            </span>
        );
    }

    return (
        <div className='view-image__loading'>
            <img
                className='loader-image'
                src='/static/images/load.gif'
            />
            {progressView}
        </div>
    );
}

function ImagePreview({filename, fileUrl, fileInfo, maxHeight}) {
    let previewUrl;
    if (fileInfo.has_preview_image) {
        previewUrl = Utils.getPreviewImagePath(filename);
    } else {
        previewUrl = fileUrl;
    }

    return (
        <a
            href={fileUrl}
            target='_blank'
            download={true}
        >
            <img
                style={{maxHeight}}
                src={previewUrl}
            />
        </a>
    );
}

export default injectIntl(ViewImageModal);