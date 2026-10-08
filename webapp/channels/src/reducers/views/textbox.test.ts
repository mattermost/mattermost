// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {UserTypes} from 'mattermost-redux/action_types';

import textboxReducer, {
    setShowPreviewOnChannelSettingsHeaderModal,
    setShowPreviewOnChannelSettingsPurposeModal,
    setShowPreviewOnCreateComment,
    setShowPreviewOnCreatePost,
    setShowPreviewOnEditChannelHeaderModal,
} from 'reducers/views/textbox';

describe('Reducers.views.textbox', () => {
    const initialState = {
        shouldShowPreviewOnCreateComment: false,
        shouldShowPreviewOnCreatePost: false,
        shouldShowPreviewOnEditChannelHeaderModal: false,
        shouldShowPreviewOnChannelSettingsHeaderModal: false,
        shouldShowPreviewOnChannelSettingsPurposeModal: false,
    };

    test('should return the initial state', () => {
        expect(textboxReducer(undefined, {type: 'unknown'})).toEqual(initialState);
    });

    test('should set show preview on create comment', () => {
        expect(textboxReducer(initialState, setShowPreviewOnCreateComment(true))).toEqual({
            ...initialState,
            shouldShowPreviewOnCreateComment: true,
        });
    });

    test('should set show preview on create post', () => {
        expect(textboxReducer(initialState, setShowPreviewOnCreatePost(true))).toEqual({
            ...initialState,
            shouldShowPreviewOnCreatePost: true,
        });
    });

    test('should set show preview on edit channel header modal', () => {
        expect(textboxReducer(initialState, setShowPreviewOnEditChannelHeaderModal(true))).toEqual({
            ...initialState,
            shouldShowPreviewOnEditChannelHeaderModal: true,
        });
    });

    test('should set show preview on channel settings header modal', () => {
        expect(textboxReducer(initialState, setShowPreviewOnChannelSettingsHeaderModal(true))).toEqual({
            ...initialState,
            shouldShowPreviewOnChannelSettingsHeaderModal: true,
        });
    });

    test('should set show preview on channel settings purpose modal', () => {
        expect(textboxReducer(initialState, setShowPreviewOnChannelSettingsPurposeModal(true))).toEqual({
            ...initialState,
            shouldShowPreviewOnChannelSettingsPurposeModal: true,
        });
    });

    test('should clear show preview', () => {
        const previousState = {...initialState, shouldShowPreviewOnCreatePost: true};

        expect(textboxReducer(previousState, setShowPreviewOnCreatePost(false))).toEqual(initialState);
    });

    test('should reset all values on logout', () => {
        const previousState = {
            shouldShowPreviewOnCreateComment: true,
            shouldShowPreviewOnCreatePost: true,
            shouldShowPreviewOnEditChannelHeaderModal: true,
            shouldShowPreviewOnChannelSettingsHeaderModal: true,
            shouldShowPreviewOnChannelSettingsPurposeModal: true,
        };

        expect(textboxReducer(previousState, {type: UserTypes.LOGOUT_SUCCESS})).toEqual(initialState);
    });
});
