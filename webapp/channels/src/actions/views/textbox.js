// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ActionTypes} from 'utils/constants';

export function setShowPreviewOnCreateComment(showPreview) {
    return {
        type: ActionTypes.SET_SHOW_PREVIEW_ON_CREATE_COMMENT,
        showPreview,
    };
}

export function setShowPreviewOnCreatePost(showPreview) {
    return {
        type: ActionTypes.SET_SHOW_PREVIEW_ON_CREATE_POST,
        showPreview,
    };
}

export function setShowPreviewOnEditChannelHeaderModal(showPreview) {
    return {
        type: ActionTypes.SET_SHOW_PREVIEW_ON_EDIT_CHANNEL_HEADER_MODAL,
        showPreview,
    };
}

export function setShowPreviewOnChannelSettingsHeaderModal(showPreview) {
    return {
        type: ActionTypes.SET_SHOW_PREVIEW_ON_CHANNEL_SETTINGS_HEADER_MODAL,
        showPreview,
    };
}

export function setShowPreviewOnChannelSettingsPurposeModal(showPreview) {
    return {
        type: ActionTypes.SET_SHOW_PREVIEW_ON_CHANNEL_SETTINGS_PURPOSE_MODAL,
        showPreview,
    };
}
