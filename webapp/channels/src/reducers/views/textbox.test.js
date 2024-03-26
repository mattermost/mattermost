// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import textboxReducer from 'reducers/views/textbox';

import {ActionTypes} from 'utils/constants';

describe('Reducers.RHS', () => {
    const initialState = {
        shouldShowPreviewOnCreateComment: false,
        shouldShowPreviewOnCreatePost: false,
        shouldShowPreviewOnEditChannelHeaderModal: false,
    };

    test('Initial state', () => {
        const nextState = textboxReducer(
            {},
            {},
        );

        expect(nextState).toEqual(initialState);
    });

    test('update show preview value on create comment', () => {
        const nextState = textboxReducer(
            {},
            {
                type: ActionTypes.SET_SHOW_PREVIEW_ON_CREATE_COMMENT,
                showPreview: true,
            },
        );

        expect(nextState).toEqual({
            ...initialState,
            shouldShowPreviewOnCreateComment: true,
        });
    });

    test('update show preview value on create post', () => {
        const nextState = textboxReducer(
            {},
            {
                type: ActionTypes.SET_SHOW_PREVIEW_ON_CREATE_POST,
                showPreview: true,
            },
        );

        expect(nextState).toEqual({
            ...initialState,
            shouldShowPreviewOnCreatePost: true,
        });
    });

    test('update show preview value on edit channel header modal', () => {
        const nextState = textboxReducer(
            {},
            {
                type: ActionTypes.SET_SHOW_PREVIEW_ON_EDIT_CHANNEL_HEADER_MODAL,
                showPreview: true,
            },
        );

        expect(nextState).toEqual({
            ...initialState,
            shouldShowPreviewOnEditChannelHeaderModal: true,
        });
    });
});
