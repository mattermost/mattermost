// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import {UserTypes} from 'mattermost-redux/action_types';

import {ActionTypes} from 'utils/constants';

import type {MMAction} from 'types/store';

function shouldShowPreviewOnCreateComment(state = false, action: MMAction) {
    switch (action.type) {
    case ActionTypes.SET_SHOW_PREVIEW_ON_CREATE_COMMENT:
        return action.showPreview;

    case UserTypes.LOGOUT_SUCCESS:
        return false;
    default:
        return state;
    }
}

function shouldShowPreviewOnCreatePost(state = false, action: MMAction) {
    switch (action.type) {
    case ActionTypes.SET_SHOW_PREVIEW_ON_CREATE_POST:
        return action.showPreview;

    case UserTypes.LOGOUT_SUCCESS:
        return false;
    default:
        return state;
    }
}

function shouldShowPreviewOnEditChannelHeaderModal(state = false, action: MMAction) {
    switch (action.type) {
    case ActionTypes.SET_SHOW_PREVIEW_ON_EDIT_CHANNEL_HEADER_MODAL:
        return action.showPreview;

    case UserTypes.LOGOUT_SUCCESS:
        return false;
    default:
        return state;
    }
}

function shouldShowPreviewOnChannelSettingsHeaderModal(state = false, action: MMAction) {
    switch (action.type) {
    case ActionTypes.SET_SHOW_PREVIEW_ON_CHANNEL_SETTINGS_HEADER_MODAL:
        return action.showPreview;

    case UserTypes.LOGOUT_SUCCESS:
        return false;
    default:
        return state;
    }
}

function shouldShowPreviewOnChannelSettingsPurposeModal(state = false, action: MMAction) {
    switch (action.type) {
    case ActionTypes.SET_SHOW_PREVIEW_ON_CHANNEL_SETTINGS_PURPOSE_MODAL:
        return action.showPreview;

    case UserTypes.LOGOUT_SUCCESS:
        return false;
    default:
        return state;
    }
}

export default combineReducers({
    shouldShowPreviewOnCreateComment,
    shouldShowPreviewOnCreatePost,
    shouldShowPreviewOnEditChannelHeaderModal,
    shouldShowPreviewOnChannelSettingsHeaderModal,
    shouldShowPreviewOnChannelSettingsPurposeModal,
});
