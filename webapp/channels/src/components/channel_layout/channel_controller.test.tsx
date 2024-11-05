// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act} from '@testing-library/react';
import React from 'react';
import {Provider} from 'react-redux';

import * as actions from 'actions/status_actions';

import {renderWithContext} from 'tests/react_testing_utils';
import mockStore from 'tests/test_store';
import Constants from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import ChannelController, {getClassnamesForBody} from './channel_controller';

let mockState: GlobalState;

jest.mock('components/reset_status_modal', () => () => <div/>);
jest.mock('components/sidebar', () => () => <div/>);
jest.mock('components/channel_layout/center_channel', () => () => <div/>);
jest.mock('components/loading_screen', () => () => <div/>);
jest.mock('components/unreads_status_handler', () => () => <div/>);
jest.mock('components/product_notices_modal', () => () => <div/>);
jest.mock('plugins/pluggable', () => () => <div/>);

jest.mock('actions/status_actions', () => ({
    addVisibleUsersInCurrentChannelAndSelfToStatusPoll: jest.fn().mockImplementation(() => () => {}),
}));

jest.mock('mattermost-redux/selectors/entities/general', () => ({
    ...jest.requireActual('mattermost-redux/selectors/entities/general') as typeof import('mattermost-redux/selectors/entities/general'),
}));

describe('ChannelController', () => {
    beforeEach(() => {
        mockState = {
            entities: {
                general: {
                    config: {
                        EnableUserStatuses: 'false',
                    },
                },
                preferences: {
                    myPreferences: TestHelper.getPreferencesMock(),
                },
            },
        } as unknown as GlobalState;
        jest.useFakeTimers();
    });

    it('dispatches addVisibleUsersInCurrentChannelAndSelfToStatusPoll when enableUserStatuses is true', () => {
        mockState.entities.general.config.EnableUserStatuses = 'true';
        const store = mockStore(mockState);

        renderWithContext(
            <Provider store={store}>
                <ChannelController shouldRenderCenterChannel={true}/>
            </Provider>,
        );

        act(() => {
            jest.advanceTimersByTime(Constants.STATUS_INTERVAL);
        });

        expect(actions.addVisibleUsersInCurrentChannelAndSelfToStatusPoll).toHaveBeenCalled();
    });

    it('does not dispatch addVisibleUsersInCurrentChannelAndSelfToStatusPoll when enableUserStatuses is false', () => {
        const store = mockStore(mockState);
        mockState.entities.general.config.EnableUserStatuses = 'false';

        renderWithContext(
            <Provider store={store}>
                <ChannelController shouldRenderCenterChannel={true}/>
            </Provider>,
        );

        act(() => {
            jest.advanceTimersByTime(Constants.STATUS_INTERVAL);
        });

        expect(actions.addVisibleUsersInCurrentChannelAndSelfToStatusPoll).not.toHaveBeenCalled();
    });
});

describe('components/channel_layout/ChannelController', () => {
    test('Should have app__body and channel-view classes by default', () => {
        expect(getClassnamesForBody('')).toEqual(['app__body', 'channel-view']);
    });

    test('Should have os--windows class on body for windows 32 or windows 64', () => {
        expect(getClassnamesForBody('Win32')).toEqual(['app__body', 'channel-view', 'os--windows']);
        expect(getClassnamesForBody('Win64')).toEqual(['app__body', 'channel-view', 'os--windows']);
    });

    test('Should have os--mac class on body for MacIntel or MacPPC', () => {
        expect(getClassnamesForBody('MacIntel')).toEqual(['app__body', 'channel-view', 'os--mac']);
        expect(getClassnamesForBody('MacPPC')).toEqual(['app__body', 'channel-view', 'os--mac']);
    });
});
