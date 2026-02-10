// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import type {KeyboardEvent, MouseEvent} from 'react';

import type {FileInfo} from '@mattermost/types/files';

import {Client4} from 'mattermost-redux/client';
import {getFilePreviewUrl, getFileUrl, getFileThumbnailUrl} from 'mattermost-redux/utils/file_utils';

import FilePreviewModal from 'components/file_preview_modal';
import SizeAwareImage from 'components/size_aware_image';

import {FileTypes, HttpHeaders, ModalIdentifiers} from 'utils/constants';
import {
    getFileType,
} from 'utils/utils';

import type {PropsFromRedux} from './index';

const PREVIEW_IMAGE_MIN_DIMENSION = 50;
const DISPROPORTIONATE_HEIGHT_RATIO = 20;

export interface Props extends PropsFromRedux {
    postId: string;
    fileInfo: FileInfo;
    enablePublicLink: boolean;
    compactDisplay?: boolean;
    isEmbedVisible?: boolean;
    isInPermalink?: boolean;
    disableActions?: boolean;
}

type State = {
    loaded: boolean;
    dimensions: {
        width: number;
        height: number;
    };
    thumbnailCheckComplete: boolean;
    thumbnailRejected: boolean;
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
            thumbnailCheckComplete: false,
            thumbnailRejected: false,
        };
    }

    componentDidMount() {
        this.mounted = true;
        this.checkThumbnailAvailability();
    }

    checkThumbnailAvailability = () => {
        // Probe the thumbnail endpoint to see if it's rejected by a plugin
        // This allows plugins to control inline image display via thumbnail rejection when
        // there's only one file in the post and we try to display it inline as a preview and
        // not as a thumbnail.
        const {fileInfo} = this.props;
        if (!fileInfo || !fileInfo.has_preview_image) {
            // No preview image, so we'll use the file directly - don't check thumbnail
            this.setState({thumbnailCheckComplete: true, thumbnailRejected: false});
            return;
        }

        const thumbnailUrl = getFileThumbnailUrl(fileInfo.id);

        // Use Client4.getOptions() to get properly authenticated request options
        // This includes the Bearer token and all required headers
        const options = Client4.getOptions({method: 'HEAD'});

        fetch(thumbnailUrl, options).then((response) => {
            if (this.mounted) {
                // 403 Forbidden with X-Reject-Reason header = rejected by plugin
                const rejected = response.status === 403 && response.headers.get(HttpHeaders.REJECT_REASON) !== null;
                this.setState({
                    thumbnailCheckComplete: true,
                    thumbnailRejected: rejected,
                });
            }
        }).catch(() => {
            // On error, assume not rejected (fail open for compatibility)
            if (this.mounted) {
                this.setState({
                    thumbnailCheckComplete: true,
                    thumbnailRejected: false,
                });
            }
        });
    };

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

    imageLoaded = () => {
        if (this.mounted) {
            this.setState({loaded: true});
        }
    };

    handleImageClick = (e: (KeyboardEvent<HTMLImageElement> | MouseEvent<HTMLDivElement | HTMLImageElement>)) => {
        e.preventDefault();

        this.props.actions.openModal({
            modalId: ModalIdentifiers.FILE_PREVIEW_MODAL,
            dialogType: FilePreviewModal,
            dialogProps: {
                fileInfos: [this.props.fileInfo],
                postId: this.props.postId,
                startIndex: 0,
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
        const {fileInfo, compactDisplay, isInPermalink} = this.props;
        const {
            loaded,
            thumbnailCheckComplete,
            thumbnailRejected,
        } = this.state;

        if (fileInfo === undefined) {
            return <></>;
        }

        // If thumbnail check not complete yet, don't render the preview
        // This prevents flashing the image before we know if it should be hidden
        if (!thumbnailCheckComplete) {
            return (
                <div className={classNames('file-view--single')}>
                    <div className='file__image'>
                        <div className='image-header'>
                            <div className='image-name'>{fileInfo.name}</div>
                        </div>
                    </div>
                </div>
            );
        }

        // If thumbnail was rejected, treat this file as rejected
        // Show it collapsed with file icon instead of inline preview
        const effectivelyRejected = this.props.isFileRejected || thumbnailRejected;
        if (effectivelyRejected) {
            // Don't show inline preview - return minimal view
            // User can still click to attempt opening in modal (which will be controlled by preview rejection)
            return (
                <div className={classNames('file-view--single')}>
                    <div className='file__image'>
                        <div className='image-header'>
                            <div
                                className='image-name'
                                onClick={this.handleImageClick}
                            >
                                {fileInfo.name}
                            </div>
                        </div>
                    </div>
                </div>
            );
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

        const toggle = (
            <button
                key='toggle'
                className='style--none single-image-view__toggle'
                data-expanded={this.props.isEmbedVisible}
                aria-label='Toggle Embed Visibility'
                onClick={this.toggleEmbedVisibility}
            >
                <span
                    className={classNames('icon', {
                        'icon-menu-down': this.props.isEmbedVisible,
                        'icon-menu-right': !this.props.isEmbedVisible,
                    })}
                />
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
                    height: 350,
                    maxWidth: '100%',
                };
            }
        }

        if (loaded) {
            fadeInClass = 'image-fade-in';
        }

        if (isInPermalink) {
            permalinkClass = 'image-permalink';
        }

        return (
            <div
                className={classNames('file-view--single', permalinkClass)}
            >
                <div
                    className='file__image'
                >
                    {fileHeader}
                    {this.props.isEmbedVisible &&
                    <div
                        className={classNames('image-container', permalinkClass)}
                        style={imageContainerStyle}
                    >
                        <div
                            className={classNames('image-loaded', fadeInClass, svgClass)}
                            style={styleIfSvgWithDimensions}
                        >
                            <div className={classNames(permalinkClass)}>
                                <SizeAwareImage
                                    onClick={this.handleImageClick}
                                    className={classNames(minPreviewClass, permalinkClass)}
                                    src={previewURL}
                                    dimensions={this.state.dimensions}
                                    fileInfo={this.props.fileInfo}
                                    fileURL={fileURL}
                                    onImageLoaded={this.imageLoaded}
                                    showLoader={this.props.isEmbedVisible}
                                    handleSmallImageContainer={true}
                                    enablePublicLink={this.props.enablePublicLink}
                                    getFilePublicLink={this.getFilePublicLink}
                                    hideUtilities={this.props.disableActions}
                                    isFileRejected={effectivelyRejected}
                                />
                            </div>
                        </div>
                    </div>
                    }
                </div>
            </div>
        );
    }
}
