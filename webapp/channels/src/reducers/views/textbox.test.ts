// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {UserTypes} from 'mattermost-redux/action_types';

import textboxReducer, {
    channelSettingsHeaderPreviewToggled,
    channelSettingsModalClosed,
    channelSettingsPurposePreviewToggled,
    editChannelHeaderPreviewChanged,
} from 'reducers/views/textbox';

describe('Reducers.views.textbox', () => {
    const initialState = {
        shouldShowPreviewOnEditChannelHeaderModal: false,
        shouldShowPreviewOnChannelSettingsHeaderModal: false,
        shouldShowPreviewOnChannelSettingsPurposeModal: false,
    };

    const allShownState = {
        shouldShowPreviewOnEditChannelHeaderModal: true,
        shouldShowPreviewOnChannelSettingsHeaderModal: true,
        shouldShowPreviewOnChannelSettingsPurposeModal: true,
    };

    test('should return the initial state', () => {
        expect(textboxReducer(undefined, {type: 'unknown'})).toEqual(initialState);
    });

    test('should set the edit channel header preview', () => {
        expect(textboxReducer(initialState, editChannelHeaderPreviewChanged(true))).toEqual({
            ...initialState,
            shouldShowPreviewOnEditChannelHeaderModal: true,
        });
    });

    test('should toggle the channel settings header preview', () => {
        const shownState = textboxReducer(initialState, channelSettingsHeaderPreviewToggled());
        expect(shownState).toEqual({...initialState, shouldShowPreviewOnChannelSettingsHeaderModal: true});

        expect(textboxReducer(shownState, channelSettingsHeaderPreviewToggled())).toEqual(initialState);
    });

    test('should toggle the channel settings purpose preview', () => {
        const shownState = textboxReducer(initialState, channelSettingsPurposePreviewToggled());
        expect(shownState).toEqual({...initialState, shouldShowPreviewOnChannelSettingsPurposeModal: true});

        expect(textboxReducer(shownState, channelSettingsPurposePreviewToggled())).toEqual(initialState);
    });

    test('should hide only the channel settings previews when the channel settings modal closes', () => {
        expect(textboxReducer(allShownState, channelSettingsModalClosed())).toEqual({
            ...initialState,
            shouldShowPreviewOnEditChannelHeaderModal: true,
        });
    });

    test('should reset all values on logout', () => {
        expect(textboxReducer(allShownState, {type: UserTypes.LOGOUT_SUCCESS})).toEqual(initialState);
    });
});
