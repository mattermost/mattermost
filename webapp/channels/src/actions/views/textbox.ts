// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ActionTypes} from 'utils/constants';

export function setShowPreviewOnCreateComment(showPreview: boolean) {
    return {
        type: ActionTypes.SET_SHOW_PREVIEW_ON_CREATE_COMMENT,
        showPreview,
    };
}

export function setShowPreviewOnCreatePost(showPreview: boolean) {
    return {
        type: ActionTypes.SET_SHOW_PREVIEW_ON_CREATE_POST,
        showPreview,
    };
}

export function setShowPreviewOnEditChannelHeaderModal(showPreview: boolean) {
    return {
        type: ActionTypes.SET_SHOW_PREVIEW_ON_EDIT_CHANNEL_HEADER_MODAL,
        showPreview,
    };
}
