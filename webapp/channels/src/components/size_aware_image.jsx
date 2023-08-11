// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable mattermost/use-external-link */

import React from 'react';
import {FormattedMessage} from 'react-intl';

import classNames from 'classnames';
import PropTypes from 'prop-types';

import {DownloadOutlineIcon, LinkVariantIcon, CheckIcon} from '@mattermost/compass-icons/components';

import {getFileMiniPreviewUrl} from 'mattermost-redux/utils/file_utils';

import LoadingImagePreview from 'components/loading_image_preview';
import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';

import {t} from 'utils/i18n';
import {localizeMessage, copyToClipboard} from 'utils/utils';

const MIN_IMAGE_SIZE = 48;
const MIN_IMAGE_SIZE_FOR_INTERNAL_BUTTONS = 100;
const MAX_IMAGE_HEIGHT = 350;

// SizeAwareImage is a component used for rendering images where the dimensions of the image are important for
// ensuring that the page is laid out correctly.
export default class SizeAwareImage extends React.PureComponent {
    static propTypes = {

        /*
         * The source URL of the image
         */
        src: PropTypes.string.isRequired,

        /*
         * dimensions object to create empty space required to prevent scroll pop
         */
        dimensions: PropTypes.object,
        fileInfo: PropTypes.object,

        /**
         * fileURL of the original image
         */
        fileURL: PropTypes.string,

        /*
         * Boolean value to pass for showing a loader when image is being loaded
         */
        showLoader: PropTypes.bool,

        /*
         * A callback that is called as soon as the image component has a height value
         */
        onImageLoaded: PropTypes.func,

        /*
         * A callback that is called when image load fails
         */
        onImageLoadFail: PropTypes.func,

        /*
         * Fetch the onClick function
         */
        onClick: PropTypes.func,

        /*
         * css classes that can added to the img as well as parent div on svg for placeholder
         */
        className: PropTypes.string,

        /*
         * Enables the logic of surrounding small images with a bigger container div for better click/tap targeting
         */
        handleSmallImageContainer: PropTypes.bool,

        /**
         * Enables copy URL functionality through a button on image hover.
         */
        enablePublicLink: PropTypes.bool,

        /**
         * Action to fetch public link of an image from server.
         */
        getFilePublicLink: PropTypes.func,

        /*
         * Prevents display of utility buttons when image in a location that makes them inappropriate
         */
        hideUtilities: PropTypes.bool,
    };

    constructor(props) {
        super(props);
        const {dimensions} = props;

        this.state = {
            loaded: false,
            isSmallImage: this.dimensionsAvailable(dimensions) ? this.isSmallImage(
                dimensions.width, dimensions.height) : false,
            linkCopiedRecently: false,
            linkCopyInProgress: false,
        };

        this.heightTimeout = 0;
    }

    componentDidMount() {
        this.mounted = true;
    }

    componentWillUnmount() {
        this.mounted = false;
    }

    dimensionsAvailable = (dimensions) => {
        return dimensions && dimensions.width && dimensions.height;
    };

    isSmallImage = (width, height) => {
        return width < MIN_IMAGE_SIZE || height < MIN_IMAGE_SIZE;
    };

    handleLoad = (event) => {
        if (this.mounted) {
            const image = event.target;
            const isSmallImage = this.isSmallImage(image.naturalWidth, image.naturalHeight);
            this.setState({
                loaded: true,
                error: false,
                isSmallImage,
                imageWidth: image.naturalWidth,
            }, () => { // Call onImageLoaded prop only after state has already been set
                if (this.props.onImageLoaded && image.naturalHeight) {
                    this.props.onImageLoaded({height: image.naturalHeight, width: image.naturalWidth});
                }
            });
        }
    };

    handleError = () => {
        if (this.mounted) {
            if (this.props.onImageLoadFail) {
                this.props.onImageLoadFail();
            }
            this.setState({error: true});
        }
    };

    handleImageClick = (e) => {
        this.props.onClick?.(e, this.props.src);
    };

    onEnterKeyDown = (e) => {
        if (e.key === 'Enter') {
            this.handleImageClick(e);
        }
    };

    renderImageLoaderIfNeeded = () => {
        if (!this.state.loaded && this.props.showLoader && !this.state.error) {
            return (
                <div style={{position: 'absolute', top: '50%', transform: 'translate(-50%, -50%)', left: '50%'}}>
                    <LoadingImagePreview
                        containerClass={'file__image-loading'}
                    />
                </div>
            );
        }
        return null;
    };

    renderImageWithContainerIfNeeded = () => {
        const {
            fileInfo,
            src,
            fileURL,
            enablePublicLink,
            ...props
        } = this.props;
        Reflect.deleteProperty(props, 'showLoader');
        Reflect.deleteProperty(props, 'onImageLoaded');
        Reflect.deleteProperty(props, 'onImageLoadFail');
        Reflect.deleteProperty(props, 'dimensions');
        Reflect.deleteProperty(props, 'handleSmallImageContainer');
        Reflect.deleteProperty(props, 'enablePublicLink');
        Reflect.deleteProperty(props, 'onClick');
        Reflect.deleteProperty(props, 'hideUtilities');
        Reflect.deleteProperty(props, 'getFilePublicLink');

        let ariaLabelImage = localizeMessage('file_attachment.thumbnail', 'file thumbnail');
        if (fileInfo) {
            ariaLabelImage += ` ${fileInfo.name}`.toLowerCase();
        }

        const image = (
            <img
                {...props}
                aria-label={ariaLabelImage}
                tabIndex='0'
                onClick={this.handleImageClick}
                onKeyDown={this.onEnterKeyDown}
                className={
                    this.props.className +
                    (this.props.handleSmallImageContainer &&
                        this.state.isSmallImage ? ' small-image--inside-container' : '')}
                src={src}
                onError={this.handleError}
                onLoad={this.handleLoad}
            />
        );

        // copyLink, download are two buttons overlayed on image preview
        // copyLinkTooltip, downloadTooltip are tooltips for the buttons respectively.
        // if linkCopiedRecently is true, defaultMessage would be 'Copy Link', else 'Copied!'

        const copyLinkTooltip = (
            <Tooltip
                id='copy-link-tooltip'
                className='hidden-xs'
            >
                {this.state.linkCopiedRecently ? (
                    <FormattedMessage
                        id={t('single_image_view.copied_link_tooltip')}
                        defaultMessage={'Copied'}
                    />
                ) : (
                    <FormattedMessage
                        id={t('single_image_view.copy_link_tooltip')}
                        defaultMessage={'Copy link'}
                    />
                )}
            </Tooltip>
        );
        const copyLink = (
            <OverlayTrigger
                className='hidden-xs'
                delayShow={500}
                placement='top'
                overlay={copyLinkTooltip}
                rootClose={true}
            >
                <button
                    className={classNames('style--none', 'size-aware-image__copy_link', {
                        'size-aware-image__copy_link--recently_copied': this.state.linkCopiedRecently,
                    })}
                    aria-label={localizeMessage('single_image_view.copy_link_tooltip', 'Copy link')}
                    onClick={this.copyLinkToAsset}
                >
                    {this.state.linkCopiedRecently ? (
                        <CheckIcon
                            className={'svg-check style--none'}
                            size={20}
                        />
                    ) : (
                        <LinkVariantIcon
                            className={'style--none'}
                            size={20}
                        />
                    )}
                </button>
            </OverlayTrigger>
        );

        const downloadTooltip = (
            <Tooltip
                id='download-preview-tooltip'
                className='hidden-xs'
            >
                <FormattedMessage
                    id='single_image_view.download_tooltip'
                    defaultMessage='Download'
                />
            </Tooltip>
        );

        const download = (
            <OverlayTrigger
                className='hidden-xs'
                delayShow={500}
                placement='top'
                overlay={downloadTooltip}
                rootClose={true}
            >
                <a
                    target='_blank'
                    rel='noopener noreferrer'
                    href={this.isInternalImage ? fileURL : src}
                    className='style--none size-aware-image__download'
                    download={true}
                    role={this.isInternalImage ? 'button' : undefined}
                    aria-label={localizeMessage('single_image_view.download_tooltip', 'Download')}
                >
                    <DownloadOutlineIcon
                        className={'style--none'}
                        size={20}
                    />
                </a>
            </OverlayTrigger>
        );

        if (this.props.handleSmallImageContainer && this.state.isSmallImage) {
            let className = 'small-image__container cursor--pointer a11y--active';
            if (this.state.imageWidth < MIN_IMAGE_SIZE) {
                className += ' small-image__container--min-width';
            }

            // 24 is the offset on a 48px wide image, for every pixel added to the width of the image, it's added to the left offset to buttons
            const wideImageButtonsOffset = (24 + this.state.imageWidth) - MIN_IMAGE_SIZE;

            /**
             * creation of left offset for 2 nested cases
             *  - if a small image with larger width
             *  - if copy link button is enabled
             */
            const modifierCopyButton = enablePublicLink ? 0 : 8;

            // decrease modifier if imageWidth > 100
            const modifierLargerWidth = this.state.imageWidth > MIN_IMAGE_SIZE_FOR_INTERNAL_BUTTONS ? 40 : 0;

            // since there is a max-width constraint on images, a max-left clause follows.
            const leftStyle = this.state.imageWidth > MIN_IMAGE_SIZE ? {
                left: `min(${wideImageButtonsOffset + (modifierCopyButton - modifierLargerWidth)}px, calc(100% - ${31 - (modifierCopyButton - modifierLargerWidth)}px)`,
            } : {};

            const wideSmallImageStyle = this.state.imageWidth > MIN_IMAGE_SIZE ? {
                width: this.state.imageWidth + 2, // 2px to account for the border
            } : {};
            return (
                <div
                    className='small-image-utility-buttons-wrapper'
                >
                    <div
                        onClick={this.handleImageClick}
                        className={classNames(className)}
                        style={wideSmallImageStyle}
                    >
                        {image}
                    </div>
                    <span
                        className={classNames('image-preview-utility-buttons-container', 'image-preview-utility-buttons-container--small-image', {
                            'image-preview-utility-buttons-container--small-image-no-copy-button': !enablePublicLink,
                        })}
                        style={leftStyle}
                    >
                        {enablePublicLink && copyLink}
                        {download}
                    </span>
                </div>
            );
        }

        // handling external small images (OR) handling all large internal / large external images
        const utilityButtonsWrapper = this.props.hideUtilities || (this.state.isSmallImage && !this.isInternalImage) ? null :
            (
                <span
                    className={classNames('image-preview-utility-buttons-container', {

                        // cases for when image isn't a small image but width is < 100px
                        'image-preview-utility-buttons-container--small-image': this.state.imageWidth < MIN_IMAGE_SIZE_FOR_INTERNAL_BUTTONS,
                        'image-preview-utility-buttons-container--small-image-no-copy-button': (!enablePublicLink || !this.isInternalImage) && this.state.imageWidth < MIN_IMAGE_SIZE_FOR_INTERNAL_BUTTONS,
                    })}
                >
                    {(enablePublicLink || !this.isInternalImage) && copyLink}
                    {download}
                </span>
            );
        return (
            <figure className={classNames('image-loaded-container')}>
                {image}
                {utilityButtonsWrapper}
            </figure>
        );
    };

    renderImageOrFallback = () => {
        const {
            dimensions,
            fileInfo,
        } = this.props;

        let ariaLabelImage = localizeMessage('file_attachment.thumbnail', 'file thumbnail');
        if (fileInfo) {
            ariaLabelImage += ` ${fileInfo.name}`.toLowerCase();
        }

        let fallback;

        if (this.dimensionsAvailable(dimensions) && !this.state.loaded) {
            const ratio = dimensions.height > MAX_IMAGE_HEIGHT ? MAX_IMAGE_HEIGHT / dimensions.height : 1;
            const height = dimensions.height * ratio;
            const width = dimensions.width * ratio;

            const miniPreview = getFileMiniPreviewUrl(fileInfo);

            if (miniPreview) {
                fallback = (
                    <div
                        className={`image-loading__container ${this.props.className}`}
                        style={{maxWidth: dimensions.width}}
                    >
                        <img
                            aria-label={ariaLabelImage}
                            className={this.props.className}
                            src={miniPreview}
                            tabIndex='0'
                            height={height}
                            width={width}
                        />
                    </div>
                );
            } else {
                fallback = (
                    <div
                        className={`image-loading__container ${this.props.className}`}
                        style={{maxWidth: width}}
                    >
                        {this.renderImageLoaderIfNeeded()}
                        <svg
                            xmlns='http://www.w3.org/2000/svg'
                            viewBox={`0 0 ${width} ${height}`}
                            style={{maxHeight: height, maxWidth: width, verticalAlign: 'middle'}}
                        />
                    </div>
                );
            }
        }

        const shouldShowImg = !this.dimensionsAvailable(dimensions) || this.state.loaded;

        return (
            <React.Fragment>
                {fallback}
                <div
                    className='file-preview__button'
                    style={{display: shouldShowImg ? 'inline-block' : 'none'}}
                >
                    {this.renderImageWithContainerIfNeeded()}
                </div>
            </React.Fragment>
        );
    };

    isInternalImage = (this.props.fileInfo !== undefined) && (this.props.fileInfo !== null);

    startCopyTimer = () => {
        // set linkCopiedRecently to true, and reset to false after 1.5 seconds
        this.setState({linkCopiedRecently: true});
        if (this.timeout) {
            clearTimeout(this.timeout);
        }
        this.timeout = setTimeout(() => {
            this.setState({linkCopiedRecently: false, linkCopyInProgress: false});
        }, 1500);
    };

    copyLinkToAsset = () => {
        // if linkCopyInProgress is true return
        if (this.state.linkCopyInProgress !== true) {
            // set linkCopyInProgress to true to prevent multiple api calls
            this.setState({linkCopyInProgress: true});

            // check if image is external, if not copy this.props.src
            if (!this.isInternalImage) {
                copyToClipboard(this.props.src ?? '');
                this.startCopyTimer();
                return;
            }

            // copying public link to clipboard
            this.props.getFilePublicLink().then((data) => {
                const fileURL = data.data.link;
                copyToClipboard(fileURL ?? '');
                this.startCopyTimer();
            });
        }
    };

    render() {
        return (
            this.renderImageOrFallback()
        );
    }
}
