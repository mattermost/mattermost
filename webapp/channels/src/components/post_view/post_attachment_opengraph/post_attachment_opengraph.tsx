// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo, useRef} from 'react';
import {useIntl} from 'react-intl';

import {CloseIcon, MenuDownIcon, MenuRightIcon} from '@mattermost/compass-icons/components';

import AutoHeightSwitcher from 'components/common/auto_height_switcher';
import ExternalImage from 'components/external_image';
import ExternalLink from 'components/external_link';
import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';

import Constants, {PostTypes} from 'utils/constants';
import {isSystemMessage} from 'utils/post_utils';
import {makeUrlSafe} from 'utils/url';

import {getNearestPoint} from './get_nearest_point';

import type {
    OpenGraphMetadata,
    OpenGraphMetadataImage,
    Post,
    PostImage,
} from '@mattermost/types/posts';

import './post_attachment_opengraph.scss';

const DIMENSIONS_NEAREST_POINT_IMAGE = {
    height: 80,
    width: 80,
};

const LARGE_IMAGE_RATIO = 4 / 3;
const LARGE_IMAGE_WIDTH = 150;

export type Props = {
    postId: string;
    link: string;
    currentUserId?: string;
    post: Post;
    openGraphData?: OpenGraphMetadata;
    enableLinkPreviews?: boolean;
    previewEnabled?: boolean;
    isEmbedVisible?: boolean;
    toggleEmbedVisibility: () => void;
    actions: {
        editPost: (post: { id: string; props: Record<string, any> }) => void;
    };
    isInPermalink?: boolean;
    imageCollapsed?: boolean;
};

type ImageMetadata = Partial<OpenGraphMetadataImage> & PostImage;

export function getBestImage(openGraphData?: OpenGraphMetadata, imagesMetadata?: Record<string, PostImage>) {
    if (!openGraphData?.images?.length) {
        return null;
    }

    // Get the dimensions from the post metadata if they weren't provided by the website as part of the OpenGraph data
    const images = openGraphData.images.map((image: OpenGraphMetadataImage) => {
        const imageUrl = image.secure_url || image.url;

        return {
            ...image,
            height: image.height || imagesMetadata?.[imageUrl]?.height || -1,
            width: image.width || imagesMetadata?.[imageUrl]?.width || -1,
            format: image.type?.split('/')[1] || image.type || '',
            frameCount: 0,
        };
    });

    return getNearestPoint<ImageMetadata>(DIMENSIONS_NEAREST_POINT_IMAGE, images);
}

export const getIsLargeImage = (data: ImageMetadata|null) => {
    if (!data) {
        return false;
    }

    const {height, width} = data;

    return width >= LARGE_IMAGE_WIDTH && (width / height) >= LARGE_IMAGE_RATIO;
};

const PostAttachmentOpenGraph = ({openGraphData, post, actions, link, isInPermalink, previewEnabled, ...rest}: Props) => {
    const {formatMessage} = useIntl();
    const {current: bestImageData} = useRef<ImageMetadata>(getBestImage(openGraphData, post.metadata.images));
    const isPreviewRemoved = post?.props?.[PostTypes.REMOVE_LINK_PREVIEW] === 'true';

    // block of early return statements
    if (!rest.enableLinkPreviews || !previewEnabled || isPreviewRemoved) {
        return null;
    }

    if (!post || isSystemMessage(post)) {
        return null;
    }

    if (!openGraphData) {
        return null;
    }

    const handleRemovePreview = async (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();

        // prevent the button-click to trigger visiting the link
        e.stopPropagation();
        const props = Object.assign({}, post.props);
        props[PostTypes.REMOVE_LINK_PREVIEW] = 'true';

        const patchedPost = {
            id: post.id,
            props,
        };

        return actions.editPost(patchedPost);
    };

    const removeButtonTooltip = (
        <Tooltip id={`removeLinkPreview-${post.id}`}>
            {formatMessage({id: 'link_preview.remove_link_preview', defaultMessage: 'Remove link preview'})}
        </Tooltip>
    );

    const safeLink = makeUrlSafe(openGraphData?.url || link);

    return (
        <ExternalLink
            className='PostAttachmentOpenGraph'
            role='link'
            href={safeLink}
            title={openGraphData?.title || openGraphData?.url || link}
            location='post_attachment_opengraph'
        >
            {rest.currentUserId === post.user_id && !isInPermalink && (
                <OverlayTrigger
                    placement='top'
                    delayShow={Constants.OVERLAY_TIME_DELAY}
                    overlay={removeButtonTooltip}
                >
                    <button
                        type='button'
                        className='remove-button style--none'
                        aria-label='Remove'
                        onClick={handleRemovePreview}
                        data-testid='removeLinkPreviewButton'
                    >
                        <CloseIcon
                            size={14}
                            color={'currentColor'}
                        />
                    </button>
                </OverlayTrigger>
            )}
            <PostAttachmentOpenGraphBody
                isInPermalink={isInPermalink}
                sitename={openGraphData?.site_name}
                title={openGraphData?.title || openGraphData?.url || link}
                description={openGraphData?.description}
            />
            <PostAttachmentOpenGraphImage
                imageMetadata={bestImageData}
                title={openGraphData?.title}
                isInPermalink={isInPermalink}
                isEmbedVisible={rest.isEmbedVisible}
                toggleEmbedVisibility={rest.toggleEmbedVisibility}
            />
        </ExternalLink>
    );
};

type BodyProps = {
    title: string;
    isInPermalink?: boolean;
    sitename?: string;
    description?: string;
}

export const PostAttachmentOpenGraphBody = memo(({title, isInPermalink, sitename = '', description = ''}: BodyProps) => {
    return title ? (
        <div className={classNames('PostAttachmentOpenGraph__body', {isInPermalink})}>
            {(!isInPermalink && sitename) && <span className='sitename'>{sitename}</span>}
            <span className='title'>{title}</span>
            {description && <span className='description'>{description}</span>}
        </div>
    ) : null;
});

type ImageProps = {
    title?: string;
    imageMetadata?: ImageMetadata|null;
    isInPermalink: Props['isInPermalink'];
    isEmbedVisible: Props['isEmbedVisible'];
    toggleEmbedVisibility: Props['toggleEmbedVisibility'];
}

export const PostAttachmentOpenGraphImage = memo(({imageMetadata, isInPermalink, toggleEmbedVisibility, isEmbedVisible = true, title = ''}: ImageProps) => {
    const {formatMessage} = useIntl();

    if (!imageMetadata || isInPermalink) {
        return null;
    }

    const large = getIsLargeImage(imageMetadata);
    const src = imageMetadata.secure_url || imageMetadata.url || '';

    const toggleImagePreview = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();

        // prevent the button-click to trigger visiting the link
        e.stopPropagation();
        toggleEmbedVisibility();
    };

    const collapsedLabel = formatMessage({id: 'link_preview.image_preview', defaultMessage: 'Show image preview'});

    const imageCollapseButton = (
        <button
            className='preview-toggle style--none'
            onClick={toggleImagePreview}
        >
            {isEmbedVisible ? (
                <MenuDownIcon
                    size={18}
                    color='currentColor'
                />
            ) : (
                <>
                    <MenuRightIcon
                        size={18}
                        color='currentColor'
                    />
                    {collapsedLabel}
                </>
            )}
        </button>
    );

    const image = (
        <ExternalImage
            src={src}
            imageMetadata={imageMetadata}
        >
            {(source) => (
                <>
                    {large && imageCollapseButton}
                    <figure>
                        <img
                            src={source}
                            alt={title}
                        />
                    </figure>
                </>
            )}
        </ExternalImage>
    );

    return (
        <div className={classNames('PostAttachmentOpenGraph__image', {large, collapsed: !isEmbedVisible})}>
            {large ? (
                <AutoHeightSwitcher
                    showSlot={isEmbedVisible ? 1 : 2}
                    slot1={image}
                    slot2={imageCollapseButton}
                />
            ) : image}
        </div>
    );
});

export default PostAttachmentOpenGraph;
