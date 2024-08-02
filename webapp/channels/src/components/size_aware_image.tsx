// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @mattermost/use-external-link */

import classNames from 'classnames';
import React from 'react';
import type {KeyboardEvent, MouseEvent, SyntheticEvent} from 'react';
import {FormattedMessage} from 'react-intl';

import {DownloadOutlineIcon, LinkVariantIcon, CheckIcon} from '@mattermost/compass-icons/components';
import type {FileInfo} from '@mattermost/types/files';
import type {PostImage} from '@mattermost/types/posts';

import type {ActionResult} from 'mattermost-redux/types/actions';
import {getFileMiniPreviewUrl} from 'mattermost-redux/utils/file_utils';

import LoadingImagePreview from 'components/loading_image_preview';
import WithTooltip from 'components/with_tooltip';

import {localizeMessage, copyToClipboard} from 'utils/utils';

const MIN_IMAGE_SIZE = 48;
const MIN_IMAGE_SIZE_FOR_INTERNAL_BUTTONS = 100;
const MAX_IMAGE_HEIGHT = 350;

export type Props = {

    /*
    * The source URL of the image
    */
    src: string;

    /*
    * dimensions object to create empty space required to prevent scroll pop
    */
    dimensions?: Partial<PostImage>;
    fileInfo?: FileInfo;

    /**
    * fileURL of the original image
    */
    fileURL?: string;

    alt?: string;
    height?: string;
    width?: string;
    title?: string;

    /*
    * Boolean value to pass for showing a loader when image is being loaded
    */
    showLoader?: boolean;

    /*
    * A callback that is called as soon as the image component has a height value
    */
    onImageLoaded?: ({height, width}: {height: number; width: number}) => void;

    /*
    * A callback that is called when image load fails
    */
    onImageLoadFail?: () => void;

    /*
    * Fetch the onClick function
    */
    onClick?: (e: (KeyboardEvent<HTMLImageElement> | MouseEvent<HTMLImageElement | HTMLDivElement>), link?: string) => void;

    /*
    * css classes that can added to the img as well as parent div on svg for placeholder
    */
    className?: string;

    /*
    * Enables the logic of surrounding small images with a bigger container div for better click/tap targeting
    */
    handleSmallImageContainer?: boolean;

    /**
    * Enables copy URL functionality through a button on image hover.
    */
    enablePublicLink?: boolean;

    /**
    * Action to fetch public link of an image from server.
    */
    getFilePublicLink?: () => Promise<ActionResult<{link: string}>>;

    /*
    * Prevents display of utility buttons when image in a location that makes them inappropriate
    */
    hideUtilities?: boolean;
}

type State = {
    loaded: boolean;
    isSmallImage: boolean;
    linkCopiedRecently: boolean;
    linkCopyInProgress: boolean;
    error: boolean;
    imageWidth: number;
}

// SizeAwareImage is a component used for rendering images where the dimensions of the image are important for
// ensuring that the page is laid out correctly.
export default class SizeAwareImage extends React.PureComponent<Props, State> {
    public heightTimeout = 0;
    public mounted = false;
    public timeout: NodeJS.Timeout|null = null;

    constructor(props: Props) {
        super(props);
        const {dimensions} = props;

        this.state = {
            loaded: false,
            isSmallImage: this.dimensionsAvailable(dimensions) ? this.isSmallImage(
                dimensions?.width ?? 0, dimensions?.height ?? 0) : false,
            linkCopiedRecently: false,
            linkCopyInProgress: false,
            error: false,
            imageWidth: 0,
        };

        this.heightTimeout = 0;
    }

    componentDidMount() {
        this.mounted = true;
    }

    componentWillUnmount() {
        this.mounted = false;
    }

    dimensionsAvailable = (dimensions?: Partial<PostImage>) => {
        return dimensions && dimensions.width && dimensions.height;
    };

    isSmallImage = (width: number, height: number) => {
        return width < MIN_IMAGE_SIZE || height < MIN_IMAGE_SIZE;
    };

    handleLoad = (event: SyntheticEvent<HTMLImageElement, Event>) => {
        if (this.mounted) {
            const image = event.target as HTMLImageElement;
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

    handleImageClick = (e: MouseEvent<HTMLImageElement>) => {
        this.props.onClick?.(e, this.props.src);
    };

    onEnterKeyDown = (e: KeyboardEvent<HTMLImageElement>) => {
        if (e.key === 'Enter') {
            this.props.onClick?.(e, this.props.src);
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
                tabIndex={0}
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

        const copyLinkTooltipText = this.state.linkCopiedRecently ? (
            <FormattedMessage
                id={'single_image_view.copied_link_tooltip'}
                defaultMessage={'Copied'}
            />
        ) : (
            <FormattedMessage
                id={'single_image_view.copy_link_tooltip'}
                defaultMessage={'Copy link'}
            />
        );
        const copyLink = (
            <WithTooltip
                id='single_image_view.copy_link_tooltip.text'
                title={copyLinkTooltipText}
                placement='top'
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
            </WithTooltip>
        );

        const downloadTooltipText = (
            <FormattedMessage
                id='single_image_view.download_tooltip'
                defaultMessage='Download'
            />
        );
        const download = (
            <WithTooltip
                id='single_image_view.download_tooltip.text'
                placement='top'
                title={downloadTooltipText}
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
            </WithTooltip>
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
            const ratio = (dimensions?.height ?? 0) > MAX_IMAGE_HEIGHT ? MAX_IMAGE_HEIGHT / (dimensions?.height ?? 1) : 1;
            const height = (dimensions?.height ?? 0) * ratio;
            const width = (dimensions?.width ?? 0) * ratio;

            const miniPreview = getFileMiniPreviewUrl(fileInfo);

            if (miniPreview) {
                fallback = (
                    <div
                        className={`image-loading__container ${this.props.className}`}
                        style={{maxWidth: dimensions?.width}}
                    >
                        <img
                            aria-label={ariaLabelImage}
                            className={this.props.className}
                            src={miniPreview}
                            tabIndex={0}
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

    copyLinkToAsset = async () => {
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
            if (this.props.getFilePublicLink) {
                const data: any = await this.props.getFilePublicLink();
                const fileURL = data.data?.link;
                copyToClipboard(fileURL ?? '');
                this.startCopyTimer();
            }
        }
    };

    render() {
        return (
            this.renderImageOrFallback()
        );
    }
}
