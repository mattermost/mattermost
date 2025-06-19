// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @mattermost/use-external-link */

import classNames from 'classnames';
import React from 'react';
import type {KeyboardEvent, MouseEvent, SyntheticEvent} from 'react';
import {FormattedMessage, injectIntl} from 'react-intl';
import type {WrappedComponentProps} from 'react-intl';

import {DownloadOutlineIcon, LinkVariantIcon, CheckIcon} from '@mattermost/compass-icons/components';
import type {FileInfo} from '@mattermost/types/files';
import type {PostImage} from '@mattermost/types/posts';

import type {ActionResult} from 'mattermost-redux/types/actions';
import {getFileMiniPreviewUrl} from 'mattermost-redux/utils/file_utils';

import LoadingImagePreview from 'components/loading_image_preview';
import WithTooltip from 'components/with_tooltip';

import {FileTypes} from 'utils/constants';
import {copyToClipboard, getFileType} from 'utils/utils';

const MIN_IMAGE_SIZE = 50;
const MIN_IMAGE_SIZE_FOR_INTERNAL_BUTTONS = 100;
const MAX_IMAGE_HEIGHT = 350;
const MIN_CONTAINER_SIZE = 50;

export type Props = WrappedComponentProps & {

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
    onImageLoaded?: (dimensions: {height: number; width: number}) => void;

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
    getFilePublicLink?: () => Promise<ActionResult<{ link: string }>>;

    /*
    * Prevents display of utility buttons when image in a location that makes them inappropriate
    */
    hideUtilities?: boolean;

    /*
    * Custom threshold for determining if an image is considered "small" (defaults to 216px)
    */
    smallImageThreshold?: number;

    /*
    * Custom minimum size for the container (defaults to 48px)
    */
    minContainerSize?: number;
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
export class SizeAwareImage extends React.PureComponent<Props, State> {
    public heightTimeout = 0;
    public mounted = false;
    public timeout: NodeJS.Timeout | null = null;

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
        const threshold = this.props.smallImageThreshold ?? 216;
        return width < threshold || height < threshold;
    };

    getContainerSize = () => {
        return this.props.minContainerSize ?? MIN_CONTAINER_SIZE;
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
            dimensions,
            src,
            intl,
            handleSmallImageContainer,
            className,
            ...allOtherProps
        } = this.props;

        // Remove props that shouldn't be passed to the img element
        /* eslint-disable @typescript-eslint/no-unused-vars */
        const {
            hideUtilities,
            getFilePublicLink,
            smallImageThreshold,
            fileURL,
            enablePublicLink,
            onImageLoaded,
            onImageLoadFail,
            showLoader,
            onClick,
            ...restProps
        } = allOtherProps;
        /* eslint-enable @typescript-eslint/no-unused-vars */

        let ariaLabelImage = intl.formatMessage({id: 'file_attachment.thumbnail', defaultMessage: 'file thumbnail'});
        if (fileInfo) {
            ariaLabelImage += ` ${fileInfo.name}`.toLowerCase();
        }

        const fileType = getFileType(fileInfo?.extension ?? '');

        let conditionalSVGStyleAttribute;
        if (fileType === FileTypes.SVG) {
            conditionalSVGStyleAttribute = {
                width: dimensions?.width || MIN_IMAGE_SIZE,
                height: 'auto',
            };
        }

        const image = (
            <img
                {...restProps}
                aria-label={ariaLabelImage}
                tabIndex={0}
                onClick={this.handleImageClick}
                onKeyDown={this.onEnterKeyDown}
                className={className + (handleSmallImageContainer && this.state.isSmallImage ? ' small-image--inside-container' : '')}
                src={src}
                onError={this.handleError}
                onLoad={this.handleLoad}
                style={conditionalSVGStyleAttribute}
            />
        );

        if (handleSmallImageContainer && this.state.isSmallImage) {
            const minSize = this.getContainerSize();

            return (
                <div
                    className='small-image__container'
                    style={{minWidth: minSize, minHeight: minSize}}
                >
                    <figure className={classNames('image-loaded-container')}>
                        {image}
                    </figure>
                </div>
            );
        }

        // For regular/large images, just return the figure with the image
        return (
            <figure className={classNames('image-loaded-container')}>
                {image}
            </figure>
        );
    };

    renderImageOrFallback = () => {
        const {
            fileInfo,
            dimensions,
            intl,
            hideUtilities,
            ...allOtherProps
        } = this.props;

        // Remove props that shouldn't be passed to the img element
        /* eslint-disable @typescript-eslint/no-unused-vars */
        const {
            src,
            getFilePublicLink,
            smallImageThreshold,
            fileURL,
            enablePublicLink,
            onImageLoaded,
            onImageLoadFail,
            showLoader,
            handleSmallImageContainer,
            ...props
        } = allOtherProps;
        /* eslint-enable @typescript-eslint/no-unused-vars */

        let ariaLabelImage = intl.formatMessage({id: 'file_attachment.thumbnail', defaultMessage: 'file thumbnail'});
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
                        className={`image-loading__container ${props.className}`}
                        style={{
                            width: dimensions?.width,
                            height: dimensions?.height,
                            minWidth: MIN_IMAGE_SIZE,
                            minHeight: MIN_IMAGE_SIZE,
                        }}
                    >
                        <img
                            aria-label={ariaLabelImage}
                            className={props.className}
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
                        className={`image-loading__container ${props.className}`}
                        style={{
                            width,
                            height,
                            minWidth: MIN_IMAGE_SIZE,
                            minHeight: MIN_IMAGE_SIZE,
                        }}
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
        const imageContainer = this.renderImageWithContainerIfNeeded();

        // Always render utility buttons outside the figure but inside file-preview__button (unless hideUtilities is true)
        const utilityButtons = hideUtilities ? null : this.renderUtilityButtons();

        return (
            <>
                {fallback}
                <div
                    className='file-preview__button'
                    style={{display: shouldShowImg ? 'flex' : 'none'}}
                >
                    {imageContainer}
                    {shouldShowImg && utilityButtons}
                </div>
            </>
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

    renderUtilityButtons = () => {
        const {
            enablePublicLink,
            intl,
            src,
            fileURL,
            handleSmallImageContainer,
        } = this.props;

        // Don't render utility buttons for external small images
        if (this.state.isSmallImage && !this.isInternalImage) {
            return null;
        }

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
                title={copyLinkTooltipText}
            >
                <button
                    className={classNames('style--none', 'size-aware-image__copy_link', {
                        'size-aware-image__copy_link--recently_copied': this.state.linkCopiedRecently,
                    })}
                    aria-label={intl.formatMessage({id: 'single_image_view.copy_link_tooltip', defaultMessage: 'Copy link'})}
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
                title={downloadTooltipText}
            >
                <a
                    target='_blank'
                    rel='noopener noreferrer'
                    href={this.isInternalImage ? fileURL : src}
                    className='style--none size-aware-image__download'
                    download={true}
                    role={this.isInternalImage ? 'button' : undefined}
                    aria-label={intl.formatMessage({id: 'single_image_view.download_tooltip', defaultMessage: 'Download'})}
                >
                    <DownloadOutlineIcon
                        className={'style--none'}
                        size={20}
                    />
                </a>
            </WithTooltip>
        );

        // Determine which CSS classes to use based on image type and size
        const isSmallImage = handleSmallImageContainer && this.state.isSmallImage;
        const hasSmallWidth = this.state.imageWidth < MIN_IMAGE_SIZE_FOR_INTERNAL_BUTTONS;

        const containerClasses = classNames('image-preview-utility-buttons-container', {
            'image-preview-utility-buttons-container--small-image': isSmallImage || hasSmallWidth,
            'image-preview-utility-buttons-container--small-image-no-copy-button': (!enablePublicLink || !this.isInternalImage) && (isSmallImage || hasSmallWidth),
        });

        // Determine which buttons to show
        const showCopyLink = (enablePublicLink || !this.isInternalImage);

        return (
            <span className={containerClasses}>
                {showCopyLink && copyLink}
                {download}
            </span>
        );
    };

    render() {
        return (
            this.renderImageOrFallback()
        );
    }
}

export default injectIntl(SizeAwareImage);
