// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createSlice} from '@reduxjs/toolkit';
import type {PayloadAction} from '@reduxjs/toolkit';

import {UserTypes} from 'mattermost-redux/action_types';

import type {GlobalState} from 'types/store';

export type TextboxState = {
    shouldShowPreviewOnEditChannelHeaderModal: boolean;
    shouldShowPreviewOnChannelSettingsHeaderModal: boolean;
    shouldShowPreviewOnChannelSettingsPurposeModal: boolean;
};

const initialState: TextboxState = {
    shouldShowPreviewOnEditChannelHeaderModal: false,
    shouldShowPreviewOnChannelSettingsHeaderModal: false,
    shouldShowPreviewOnChannelSettingsPurposeModal: false,
};

const textboxSlice = createSlice({
    name: 'views/textbox',
    initialState,
    reducers: {
        editChannelHeaderPreviewChanged(state, action: PayloadAction<boolean>) {
            state.shouldShowPreviewOnEditChannelHeaderModal = action.payload;
        },
        channelSettingsHeaderPreviewToggled(state) {
            state.shouldShowPreviewOnChannelSettingsHeaderModal = !state.shouldShowPreviewOnChannelSettingsHeaderModal;
        },
        channelSettingsPurposePreviewToggled(state) {
            state.shouldShowPreviewOnChannelSettingsPurposeModal = !state.shouldShowPreviewOnChannelSettingsPurposeModal;
        },
        channelSettingsModalClosed(state) {
            state.shouldShowPreviewOnChannelSettingsHeaderModal = false;
            state.shouldShowPreviewOnChannelSettingsPurposeModal = false;
        },
    },
    extraReducers: (builder) => {
        builder.addCase(UserTypes.LOGOUT_SUCCESS, () => initialState);
    },
    selectors: {
        showPreviewOnEditChannelHeaderModal: (state) => state.shouldShowPreviewOnEditChannelHeaderModal,
        showPreviewOnChannelSettingsHeaderModal: (state) => state.shouldShowPreviewOnChannelSettingsHeaderModal,
        showPreviewOnChannelSettingsPurposeModal: (state) => state.shouldShowPreviewOnChannelSettingsPurposeModal,
    },
});

export const {
    editChannelHeaderPreviewChanged,
    channelSettingsHeaderPreviewToggled,
    channelSettingsPurposePreviewToggled,
    channelSettingsModalClosed,
} = textboxSlice.actions;

export const {
    showPreviewOnEditChannelHeaderModal,
    showPreviewOnChannelSettingsHeaderModal,
    showPreviewOnChannelSettingsPurposeModal,
} = textboxSlice.getSelectors((state: GlobalState) => state.views.textbox);

export default textboxSlice.reducer;
