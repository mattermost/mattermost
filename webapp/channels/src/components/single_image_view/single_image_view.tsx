// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import type {KeyboardEvent, MouseEvent} from 'react';

import {MenuDownIcon, MenuRightIcon} from '@mattermost/compass-icons/components';
import type {FileInfo} from '@mattermost/types/files';

import type {ActionResult} from 'mattermost-redux/types/actions';
import {getFilePreviewUrl, getFileUrl} from 'mattermost-redux/utils/file_utils';

import FilePreviewModal from 'components/file_preview_modal';
import SizeAwareImage from 'components/size_aware_image';

import {FileTypes, ModalIdentifiers} from 'utils/constants';
import {
    getFileType,
} from 'utils/utils';

import type {PropsFromRedux} from './index';

const PREVIEW_IMAGE_MIN_DIMENSION = 50;
const SMALL_IMAGE_THRESHOLD = 216;
const DISPROPORTIONATE_HEIGHT_RATIO = 20;
const MAX_HEIGHT = 350;

export interface Props extends PropsFromRedux {
    postId: string;
    fileInfo: FileInfo;
    fileInfos?: FileInfo[];
    isRhsOpen: boolean;
    enablePublicLink: boolean;
    compactDisplay?: boolean;
    isEmbedVisible?: boolean;
    isInPermalink?: boolean;
    disableActions?: boolean;
    handleImageClick?: () => void;
    smallImageThreshold?: number;
    isGallery?: boolean;
    actions: {
        toggleEmbedVisibility: (postId: string) => void;
        getFilePublicLink: (fileId: string) => Promise<ActionResult<{link: string}>>;
        openModal: PropsFromRedux['actions']['openModal'];
    };
}

type State = {
    loaded: boolean;
    dimensions: {
        width: number;
        height: number;
    };
}

export default class SingleImageView extends React.PureComponent<Props, State> {
    private mounted = false;
    static defaultProps = {
        compactDisplay: false,
    };

    constructor(props: Props) {
        super(props);
        this.state = {
            loaded: false,
            dimensions: {
                width: props.fileInfo?.width || 0,
                height: props.fileInfo?.height || 0,
            },
        };
    }

    componentDidMount() {
        this.mounted = true;
    }

    static getDerivedStateFromProps(props: Props, state: State) {
        if ((props.fileInfo?.width !== state.dimensions.width) || props.fileInfo.height !== state.dimensions.height) {
            return {
                dimensions: {
                    width: props.fileInfo?.width,
                    height: props.fileInfo?.height,
                },
            };
        }
        return null;
    }

    componentWillUnmount() {
        this.mounted = false;
    }

    handleImageLoaded = () => {
        this.setState({loaded: true});
    };

    computeDimensions = () => {
        const {fileInfo} = this.props;
        const viewPortWidth = window.innerWidth;
        const imageHeight = fileInfo?.height ?? 0;
        const imageWidth = fileInfo?.width ?? 0;
        let dimensions = {
            width: imageWidth,
            height: imageHeight,
        };

        if (imageWidth > 0 && imageHeight > 0) {
            // First check if we need to scale based on height for tall images
            if (imageHeight > MAX_HEIGHT) {
                const heightRatio = MAX_HEIGHT / imageHeight;
                dimensions.height = MAX_HEIGHT;
                dimensions.width = Math.round(imageWidth * heightRatio);
            }

            // Then check if we still need to scale based on width
            const maxWidth = Math.min(1024, viewPortWidth - 50);
            if (dimensions.width > maxWidth) {
                const widthRatio = maxWidth / dimensions.width;
                dimensions.width = maxWidth;
                dimensions.height = Math.round(dimensions.height * widthRatio);
            }
        }

        return dimensions;
    };

    handleImageClick = (e: (KeyboardEvent<HTMLImageElement> | MouseEvent<HTMLDivElement | HTMLImageElement>)) => {
        e.preventDefault();

        // If a parent handleImageClick is provided, use it instead of opening the modal ourselves
        if (this.props.handleImageClick) {
            this.props.handleImageClick();
            return;
        }

        // Default behavior: open modal with this component's logic
        this.props.actions.openModal({
            modalId: ModalIdentifiers.FILE_PREVIEW_MODAL,
            dialogType: FilePreviewModal,
            dialogProps: {
                fileInfos: this.props.fileInfos || [this.props.fileInfo],
                startIndex: this.props.fileInfos ? this.props.fileInfos.findIndex((f) => f.id === this.props.fileInfo.id) : 0,
                onExited: () => {},
                handleImageClick: () => {},
                postId: this.props.postId,
            },
        });
    };

    toggleEmbedVisibility = (e: React.MouseEvent) => {
        // stopping propagation to avoid accidentally closing edit history
        // section when clicking on image collapse/expand button.
        e.stopPropagation();
        this.props.actions.toggleEmbedVisibility(this.props.postId);
    };

    getFilePublicLink = () => {
        return this.props.actions.getFilePublicLink(this.props.fileInfo.id);
    };

    render() {
        const {fileInfo, compactDisplay, isInPermalink, isGallery = false} = this.props;
        const {
            loaded,
        } = this.state;

        if (fileInfo === undefined) {
            return <></>;
        }

        const {has_preview_image: hasPreviewImage, id} = fileInfo;
        const fileURL = getFileUrl(id);
        const previewURL = hasPreviewImage ? getFilePreviewUrl(id) : fileURL;

        const previewHeight = fileInfo.height;
        const previewWidth = fileInfo.width;

        const hasDisproportionateHeight = previewHeight / previewWidth > DISPROPORTIONATE_HEIGHT_RATIO;
        let minPreviewClass = '';
        if (
            (previewWidth < PREVIEW_IMAGE_MIN_DIMENSION ||
            previewHeight < PREVIEW_IMAGE_MIN_DIMENSION) && !hasDisproportionateHeight
        ) {
            minPreviewClass = 'min-preview ';

            if (previewHeight > previewWidth) {
                minPreviewClass += 'min-preview--portrait ';
            }
        }

        // Add compact display class to image class if in compact mode
        if (compactDisplay) {
            minPreviewClass += ' compact-display';
        }

        // Add disproportionate class for very tall images
        if (hasDisproportionateHeight) {
            minPreviewClass += ' disproportionate';
        }

        const toggle = (
            <button
                key='toggle'
                className='style--none single-image-view__toggle'
                data-expanded={this.props.isEmbedVisible}
                aria-label='Toggle Embed Visibility'
                onClick={this.toggleEmbedVisibility}
            >
                {this.props.isEmbedVisible ? (
                    <MenuDownIcon
                        size={16}
                        color='currentColor'
                    />
                ) : (
                    <MenuRightIcon
                        size={16}
                        color='currentColor'
                    />
                )}
            </button>
        );

        const fileHeader = (
            <div
                className={classNames('image-header', {
                    'image-header--expanded': this.props.isEmbedVisible,
                })}
            >
                {toggle}
                {!this.props.isEmbedVisible && (
                    <div
                        data-testid='image-name'
                        className={classNames('image-name', {
                            'compact-display': compactDisplay,
                        })}
                    >
                        <div
                            id='image-name-text'
                            onClick={this.handleImageClick}
                        >
                            {fileInfo.name}
                        </div>
                    </div>
                )}
            </div>
        );

        let fadeInClass = '';
        let permalinkClass = '';

        const fileType = getFileType(fileInfo.extension);
        let styleIfSvgWithDimensions = {};
        let imageContainerStyle = {};
        let svgClass = '';
        if (fileType === FileTypes.SVG) {
            svgClass = 'svg';
            if (this.state.dimensions.height) {
                styleIfSvgWithDimensions = {
                    width: '100%',
                };
            } else {
                imageContainerStyle = {
                    height: this.state.dimensions.height > this.state.dimensions.width ? MAX_HEIGHT : undefined,
                    maxWidth: '100%',
                };
            }
        }

        // Always enforce min width/height for the image container
        imageContainerStyle = {
            ...imageContainerStyle,
            minWidth: PREVIEW_IMAGE_MIN_DIMENSION,
            minHeight: PREVIEW_IMAGE_MIN_DIMENSION,
        };

        if (loaded) {
            fadeInClass = 'image-fade-in';
        }

        if (isInPermalink) {
            permalinkClass = 'image-permalink';
        }

        const dimensions = this.computeDimensions();

        return (
            <div
                className={classNames('file-view--single', permalinkClass)}
            >
                <div
                    className='file__image'
                >
                    {fileHeader}
                    <div
                        className={classNames('image-container', permalinkClass)}
                        style={imageContainerStyle}
                        data-expanded={this.props.isEmbedVisible}
                    >
                        {this.props.isEmbedVisible && (
                            <div
                                className={classNames('image-loaded', fadeInClass, svgClass)}
                                style={styleIfSvgWithDimensions}
                            >
                                <div className={classNames(permalinkClass)}>
                                    <SizeAwareImage
                                        onClick={this.handleImageClick}
                                        className={`${minPreviewClass} single-image-view__image`}
                                        src={previewURL}
                                        dimensions={dimensions}
                                        fileInfo={fileInfo}
                                        fileURL={fileURL}
                                        handleSmallImageContainer={true}
                                        smallImageThreshold={SMALL_IMAGE_THRESHOLD}
                                        minContainerSize={PREVIEW_IMAGE_MIN_DIMENSION}
                                        showLoader={true}
                                        enablePublicLink={this.props.enablePublicLink}
                                        getFilePublicLink={this.getFilePublicLink}
                                        onImageLoaded={this.handleImageLoaded}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }
}
