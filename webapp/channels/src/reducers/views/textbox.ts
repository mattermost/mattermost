// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createSlice} from '@reduxjs/toolkit';
import type {PayloadAction} from '@reduxjs/toolkit';

import {UserTypes} from 'mattermost-redux/action_types';

import type {ViewsState} from 'types/store/views';

type TextboxState = ViewsState['textbox'];

const initialState: TextboxState = {
    shouldShowPreviewOnCreateComment: false,
    shouldShowPreviewOnCreatePost: false,
    shouldShowPreviewOnEditChannelHeaderModal: false,
    shouldShowPreviewOnChannelSettingsHeaderModal: false,
    shouldShowPreviewOnChannelSettingsPurposeModal: false,
};

const textboxSlice = createSlice({
    name: 'views/textbox',
    initialState,
    reducers: {
        setShowPreviewOnCreateComment(state, action: PayloadAction<boolean>) {
            state.shouldShowPreviewOnCreateComment = action.payload;
        },
        setShowPreviewOnCreatePost(state, action: PayloadAction<boolean>) {
            state.shouldShowPreviewOnCreatePost = action.payload;
        },
        setShowPreviewOnEditChannelHeaderModal(state, action: PayloadAction<boolean>) {
            state.shouldShowPreviewOnEditChannelHeaderModal = action.payload;
        },
        setShowPreviewOnChannelSettingsHeaderModal(state, action: PayloadAction<boolean>) {
            state.shouldShowPreviewOnChannelSettingsHeaderModal = action.payload;
        },
        setShowPreviewOnChannelSettingsPurposeModal(state, action: PayloadAction<boolean>) {
            state.shouldShowPreviewOnChannelSettingsPurposeModal = action.payload;
        },
    },
    extraReducers: (builder) => {
        builder.addCase(UserTypes.LOGOUT_SUCCESS, () => initialState);
    },
});

export const {
    setShowPreviewOnCreateComment,
    setShowPreviewOnCreatePost,
    setShowPreviewOnEditChannelHeaderModal,
    setShowPreviewOnChannelSettingsHeaderModal,
    setShowPreviewOnChannelSettingsPurposeModal,
} = textboxSlice.actions;

export default textboxSlice.reducer;
