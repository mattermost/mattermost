// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import PropTypes from 'prop-types';

import {postListScrollChange} from 'actions/global_actions.jsx';
import {updatePost} from 'actions/post_actions.jsx';

import * as CommonUtils from 'utils/commons.jsx';
import {PostTypes} from 'utils/constants.jsx';
import {useSafeUrl} from 'utils/url.jsx';
import * as Utils from 'utils/utils.jsx';

export default class PostAttachmentOpenGraph extends React.PureComponent {
    static propTypes = {

        /**
         * The link to display the open graph data for
         */
        link: PropTypes.string.isRequired,

        /**
         * The current user viewing the post
         */
        currentUser: PropTypes.object,

        /**
         * The post where this link is included
         */
        post: PropTypes.object,

        /**
         * The open graph data to render
         */
        openGraphData: PropTypes.object,

        /**
         * Set to collapse the preview
         */
        previewCollapsed: PropTypes.string,
        actions: PropTypes.shape({

            /**
             * The function to get open graph data for a link
             */
            getOpenGraphMetadata: PropTypes.func.isRequired
        }).isRequired
    }

    constructor(props) {
        super(props);
        this.largeImageMinWidth = 150;
        this.imageDimentions = { // Image dimentions in pixels.
            height: 80,
            width: 80
        };
        this.textMaxLenght = 300;
        this.textEllipsis = '...';
        this.largeImageMinRatio = 16 / 9;
        this.smallImageContainerLeftPadding = 15;

        this.imageRatio = null;

        this.smallImageContainer = null;
        this.smallImageElement = null;

        this.IMAGE_LOADED = {
            LOADING: 'loading',
            YES: 'yes',
            ERROR: 'error'
        };

        this.fetchData = this.fetchData.bind(this);
        this.toggleImageVisibility = this.toggleImageVisibility.bind(this);
        this.onImageLoad = this.onImageLoad.bind(this);
        this.onImageError = this.onImageError.bind(this);
        this.handleRemovePreview = this.handleRemovePreview.bind(this);
    }

    componentWillMount() {
        const removePreview = this.isRemovePreview(this.props.post, this.props.currentUser);

        this.setState({
            imageLoaded: this.IMAGE_LOADED.LOADING,
            imageVisible: this.props.previewCollapsed.startsWith('false'),
            hasLargeImage: false,
            removePreview
        });
        this.fetchData(this.props.link);
    }

    componentWillReceiveProps(nextProps) {
        if (!Utils.areObjectsEqual(nextProps.post, this.props.post)) {
            const removePreview = this.isRemovePreview(nextProps.post, nextProps.currentUser);
            this.setState({
                removePreview
            });
        }
        if (nextProps.link !== this.props.link) {
            this.fetchData(nextProps.link);
        }
        if (nextProps.previewCollapsed !== this.props.previewCollapsed) {
            this.setState({
                imageVisible: nextProps.previewCollapsed.startsWith('false')
            });
        }
    }

    componentDidUpdate() {
        setTimeout(postListScrollChange, 0);
    }

    fetchData(url) {
        if (!this.props.openGraphData) {
            this.props.actions.getOpenGraphMetadata(url);
        }
    }

    getBestImageUrl(data) {
        if (Utils.isEmptyObject(data.images)) {
            return null;
        }

        const bestImage = CommonUtils.getNearestPoint(this.imageDimentions, data.images, 'width', 'height');
        return bestImage.secure_url || bestImage.url;
    }

    toggleImageVisibility() {
        this.setState({imageVisible: !this.state.imageVisible});
    }

    onImageLoad(image) {
        this.imageRatio = image.target.naturalWidth / image.target.naturalHeight;
        if (
            image.target.naturalWidth >= this.largeImageMinWidth &&
            this.imageRatio >= this.largeImageMinRatio &&
            !this.state.hasLargeImage
        ) {
            this.setState({
                hasLargeImage: true
            });
        }
        this.setState({
            imageLoaded: this.IMAGE_LOADED.YES
        });
    }

    onImageError() {
        this.setState({imageLoaded: this.IMAGE_LOADED.ERROR});
    }

    loadImage(src) {
        const img = new Image();
        img.onload = this.onImageLoad;
        img.onerror = this.onImageError;
        img.src = src;
    }

    imageToggleAnchoreTag(imageUrl) {
        if (imageUrl && this.state.hasLargeImage) {
            return (
                <a
                    className={'post__embed-visibility'}
                    data-expanded={this.state.imageVisible}
                    aria-label='Toggle Embed Visibility'
                    onClick={this.toggleImageVisibility}
                />
            );
        }
        return null;
    }

    wrapInSmallImageContainer(imageElement) {
        return (
            <div
                className='attachment__image__container--openraph'
                ref={(div) => {
                    this.smallImageContainer = div;
                }}
            >
                {imageElement}
            </div>
        );
    }

    imageTag(imageUrl, renderingForLargeImage = false) {
        var element = null;
        if (
            imageUrl && renderingForLargeImage === this.state.hasLargeImage &&
            (!renderingForLargeImage || (renderingForLargeImage && this.state.imageVisible))
        ) {
            if (this.state.imageLoaded === this.IMAGE_LOADED.LOADING) {
                if (renderingForLargeImage) {
                    element = <img className={'attachment__image attachment__image--openraph loading large_image'}/>;
                } else {
                    element = this.wrapInSmallImageContainer(
                        <img className={'attachment__image attachment__image--openraph loading '}/>
                    );
                }
            } else if (this.state.imageLoaded === this.IMAGE_LOADED.YES) {
                if (renderingForLargeImage) {
                    element = (
                        <img
                            className={'attachment__image attachment__image--openraph large_image'}
                            src={imageUrl}
                        />
                    );
                } else {
                    element = this.wrapInSmallImageContainer(
                        <img
                            className={'attachment__image attachment__image--openraph'}
                            src={imageUrl}
                            ref={(img) => {
                                this.smallImageElement = img;
                            }}
                        />
                    );
                }
            } else if (this.state.imageLoaded === this.IMAGE_LOADED.ERROR) {
                return null;
            }
        }
        return element;
    }

    truncateText(text, maxLength = this.textMaxLenght, ellipsis = this.textEllipsis) {
        if (text.length > maxLength) {
            return text.substring(0, maxLength - ellipsis.length) + ellipsis;
        }
        return text;
    }

    handleRemovePreview() {
        const props = Object.assign({}, this.props.post.props);
        props[PostTypes.REMOVE_LINK_PREVIEW] = 'true';

        const patchedPost = ({
            id: this.props.post.id,
            props
        });

        updatePost(patchedPost, () => {
            this.setState({removePreview: true});
        });
    }

    isRemovePreview(post, currentUser) {
        if (post && post.props && currentUser.id === post.user_id) {
            return post.props[PostTypes.REMOVE_LINK_PREVIEW] && post.props[PostTypes.REMOVE_LINK_PREVIEW] === 'true';
        }

        return false;
    }

    render() {
        const data = this.props.openGraphData;
        if (!data || Utils.isEmptyObject(data.description) || this.state.removePreview) {
            return null;
        }

        let removePreviewButton;
        if (this.props.currentUser.id === this.props.post.user_id) {
            removePreviewButton = (
                <button
                    id='removePreviewButton'
                    type='button'
                    className='btn-close'
                    aria-label='Close'
                    onClick={this.handleRemovePreview}
                >
                    <span aria-hidden='true'>{'×'}</span>
                </button>
            );
        }

        const imageUrl = this.getBestImageUrl(data);
        if (imageUrl) {
            this.loadImage(imageUrl);
        }

        return (
            <div
                className='attachment attachment--opengraph'
                ref='attachment'
            >
                <div className='attachment__content'>
                    <div
                        className={'clearfix attachment__container attachment__container--opengraph'}
                    >
                        <div
                            className={'attachment__body__wrap attachment__body__wrap--opengraph'}
                        >
                            <span className='sitename'>{this.truncateText(data.site_name)}</span>
                            {removePreviewButton}
                            <h1
                                className={'attachment__title attachment__title--opengraph' + (data.title ? '' : ' is-url')}
                            >
                                <a
                                    className='attachment__title-link attachment__title-link--opengraph'
                                    href={useSafeUrl(data.url || this.props.link)}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    title={data.title || data.url || this.props.link}
                                >
                                    {this.truncateText(data.title || data.url || this.props.link)}
                                </a>
                            </h1>
                            <div >
                                <div
                                    className={'attachment__body attachment__body--opengraph'}
                                >
                                    <div>
                                        <div>
                                            {this.truncateText(data.description)} &nbsp;
                                            {this.imageToggleAnchoreTag(imageUrl)}
                                        </div>
                                        {this.imageTag(imageUrl, true)}
                                    </div>
                                </div>
                            </div>
                        </div>
                        {this.imageTag(imageUrl, false)}
                    </div>
                </div>
            </div>
        );
    }
}
