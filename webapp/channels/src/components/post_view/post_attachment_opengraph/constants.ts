// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// These values are passed into post_attachment_opengraph.scss as CSS variables on the
// .PostAttachmentOpenGraph element so that the JS and CSS layout values can't drift apart.
export const OPEN_GRAPH_THUMBNAIL_SIZE = 80;
export const OPEN_GRAPH_MAX_IMAGE_WIDTH = 392;
export const OPEN_GRAPH_MAX_IMAGE_HEIGHT = 240;

export const OPEN_GRAPH_NEAREST_POINT_IMAGE = {
    height: OPEN_GRAPH_THUMBNAIL_SIZE,
    width: OPEN_GRAPH_THUMBNAIL_SIZE,
};

export const OPEN_GRAPH_LARGE_IMAGE_RATIO = 4 / 3;
export const OPEN_GRAPH_LARGE_IMAGE_MIN_WIDTH = 150;
