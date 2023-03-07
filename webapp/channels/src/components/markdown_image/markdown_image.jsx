// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import PropTypes from 'prop-types';
import React from 'react';

import Constants, {ModalIdentifiers} from 'utils/constants';

import MarkdownImageExpand from 'components/markdown_image_expand';
import ExternalImage from 'components/external_image';
import SizeAwareImage from 'components/size_aware_image';
import FilePreviewModal from 'components/file_preview_modal';

import brokenImageIcon from 'images/icons/brokenimage.png';

export default class MarkdownImage extends React.PureComponent {
    static defaultProps = {
        imageMetadata: {},
    };

    static propTypes = {
        alt: PropTypes.string,
        imageMetadata: PropTypes.object,
        src: PropTypes.string.isRequired,

        // height and width come from the Markdown renderer as either "auto" or a string containing a number.
        height: PropTypes.string,
        width: PropTypes.string,

        title: PropTypes.string,
        className: PropTypes.string.isRequired,
        postId: PropTypes.string.isRequired,
        imageIsLink: PropTypes.bool.isRequired,
        onImageLoaded: PropTypes.func,
        onImageHeightChanged: PropTypes.func,
        postType: PropTypes.string,

        actions: PropTypes.shape({
            openModal: PropTypes.func,
        }).isRequired,
        hideUtilities: PropTypes.bool,
    }

    constructor(props) {
        super(props);

        this.state = {
            loadFailed: false,
            loaded: false,
        };
    }

    getHeight = () => {
        const {
            height,
            imageMetadata,
            width,
        } = this.props;

        if (!height) {
            return imageMetadata.height;
        }

        if (height === 'auto') {
            const widthNumber = parseInt(width, 10);

            return (imageMetadata.height / imageMetadata.width) * widthNumber;
        }

        return parseInt(height, 10);
    }

    getFileExtensionFromUrl = (url) => {
        const index = url.lastIndexOf('.');
        return index > 0 ? url.substring(index + 1) : null;
    };

    showModal = (e, link) => {
        const extension = this.getFileExtensionFromUrl(link);

        if (!this.props.imageIsLink && extension) {
            e.preventDefault();

            this.props.actions.openModal({
                modalId: ModalIdentifiers.FILE_PREVIEW_MODAL,
                dialogType: FilePreviewModal,
                dialogProps: {
                    postId: this.props.postId,
                    fileInfos: [{
                        has_preview_image: false,
                        link,
                        extension: this.props.imageMetadata.format || extension,
                        name: this.props.alt,
                    }],
                },
            });
        }
    }

    handleLoadFail = () => {
        this.setState({loadFailed: true});
    }

    isHeaderChangeMessage = () => {
        return this.props.postType &&
            this.props.postType === Constants.PostTypes.HEADER_CHANGE;
    }

    componentDidUpdate(prevProps) {
        this.onUpdated(prevProps.src);
    }

    onUpdated = (prevSrc) => {
        if (this.props.src && this.props.src !== prevSrc) {
            this.setState({loadFailed: false});
        }
    }

    handleImageLoaded = ({height, width}) => {
        this.setState({
            loaded: true,
        }, () => { // Call onImageLoaded prop only after state has already been set
            if (this.props.onImageLoaded) {
                this.props.onImageLoaded({height, width});
            }
        });
    }

    render() {
        const {imageMetadata, src, alt, imageIsLink} = this.props;
        if (src === '' || this.state.loadFailed) {
            let className = 'markdown-inline-img broken-image';
            if (this.isHeaderChangeMessage()) {
                className += ' broken-image--scaled-down';
            }

            return (
                <div style={{display: 'inline-block'}}>
                    <img
                        className={className}
                        alt={alt}
                        src={brokenImageIcon}
                    />
                </div>
            );
        }
        return (
            <ExternalImage
                src={src}
                imageMetadata={imageMetadata}
            >
                {(safeSrc) => {
                    if (!safeSrc) {
                        return (
                            <a
                                className='theme markdown__link'
                                href={src}
                                rel='noopener noreferrer'
                                target='_blank'
                                title={this.props.title}
                            >
                                {alt}
                            </a>
                        );
                    }

                    const extension = this.getFileExtensionFromUrl(safeSrc);

                    let className = '';
                    if (this.state.loaded) {
                        className = imageIsLink || !extension ? `${this.props.className} markdown-inline-img--hover markdown-inline-img--no-border` : `${this.props.className} markdown-inline-img--hover cursor--pointer a11y--active`;

                        if (this.isHeaderChangeMessage()) {
                            className += ' markdown-inline-img--scaled-down';
                        }
                    } else {
                        const loadingClass = this.isHeaderChangeMessage() ? 'markdown-inline-img--scaled-down-loading' : 'markdown-inline-img--loading';
                        className = `${this.props.className} ${loadingClass}`;
                    }

                    const {height, width, title, postId, onImageHeightChanged} = this.props;
                    const hideUtilities = this.isHeaderChangeMessage() || this.props.hideUtilities;

                    let imageElement = (
                        <SizeAwareImage
                            alt={alt}
                            className={className}
                            src={safeSrc}
                            height={height === 'auto' ? undefined : height}
                            width={width === 'auto' ? undefined : width}
                            title={title}
                            dimensions={imageMetadata}
                            showLoader={false}
                            onClick={this.showModal}
                            hideUtilities={hideUtilities}
                            onImageLoadFail={this.handleLoadFail}
                            onImageLoaded={this.handleImageLoaded}
                        />
                    );

                    const actualHeight = this.getHeight();
                    if (actualHeight >= Constants.EXPANDABLE_INLINE_IMAGE_MIN_HEIGHT) {
                        imageElement = (
                            <MarkdownImageExpand
                                alt={alt || safeSrc}
                                postId={postId}
                                imageKey={safeSrc}
                                onToggle={onImageHeightChanged}
                            >
                                {imageElement}
                            </MarkdownImageExpand>
                        );
                    }

                    return imageElement;
                }}
            </ExternalImage>
        );
    }
}
