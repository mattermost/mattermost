// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act} from '@testing-library/react';
import * as ReactRedux from 'react-redux';

import type {WebSocketMessage} from '@mattermost/client';
import {WebSocketEvents} from '@mattermost/client';

import {getPluginStatuses} from 'mattermost-redux/actions/admin';

import {renderHookWithContext} from 'tests/react_testing_utils';
import * as webSocketHooks from 'utils/use_websocket/hooks';

import usePluginStatusesSync from './usePluginStatusesSync';

jest.mock('mattermost-redux/actions/admin', () => ({
    ...jest.requireActual('mattermost-redux/actions/admin'),
    getPluginStatuses: jest.fn(() => ({type: 'MOCK_GET_PLUGIN_STATUSES'})),
}));

jest.mock('utils/use_websocket/hooks', () => ({
    useWebSocket: jest.fn(),
    useWebSocketClient: jest.fn(),
}));

const DEBOUNCE_DELAY_MS = 500;

describe('usePluginStatusesSync', () => {
    const dispatchMock = jest.fn();
    const addReconnectListener = jest.fn();
    const removeReconnectListener = jest.fn();

    // The handler the hook registers with useWebSocket, captured so tests can feed it messages.
    let messageHandler: (msg: WebSocketMessage) => void;

    beforeEach(() => {
        jest.useFakeTimers();
        jest.spyOn(ReactRedux, 'useDispatch').mockReturnValue(dispatchMock);

        (webSocketHooks.useWebSocket as jest.Mock).mockImplementation(({handler}) => {
            messageHandler = handler;
        });
        (webSocketHooks.useWebSocketClient as jest.Mock).mockReturnValue({
            addReconnectListener,
            removeReconnectListener,
        });
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
        jest.restoreAllMocks();
        (getPluginStatuses as jest.Mock).mockClear();
        dispatchMock.mockClear();
        addReconnectListener.mockClear();
        removeReconnectListener.mockClear();
    });

    const pluginStatusesChanged = {event: WebSocketEvents.PluginStatusesChanged} as WebSocketMessage;

    test('dispatches getPluginStatuses after the debounce delay on a plugin_statuses_changed event', () => {
        renderHookWithContext(usePluginStatusesSync);

        act(() => {
            messageHandler(pluginStatusesChanged);
        });

        // Nothing dispatched until the debounce window elapses.
        expect(getPluginStatuses).not.toHaveBeenCalled();

        act(() => {
            jest.advanceTimersByTime(DEBOUNCE_DELAY_MS);
        });

        expect(getPluginStatuses).toHaveBeenCalledTimes(1);
        expect(dispatchMock).toHaveBeenCalledWith({type: 'MOCK_GET_PLUGIN_STATUSES'});
    });

    test('collapses multiple rapid events into a single refetch', () => {
        renderHookWithContext(usePluginStatusesSync);

        act(() => {
            messageHandler(pluginStatusesChanged);
            jest.advanceTimersByTime(100);
            messageHandler(pluginStatusesChanged);
            jest.advanceTimersByTime(100);
            messageHandler(pluginStatusesChanged);
        });

        act(() => {
            jest.advanceTimersByTime(DEBOUNCE_DELAY_MS);
        });

        expect(getPluginStatuses).toHaveBeenCalledTimes(1);
    });

    test('refetches on websocket reconnect', () => {
        renderHookWithContext(() => usePluginStatusesSync());

        expect(addReconnectListener).toHaveBeenCalledTimes(1);
        const reconnectListener = addReconnectListener.mock.calls[0][0];

        act(() => {
            reconnectListener();
            jest.advanceTimersByTime(DEBOUNCE_DELAY_MS);
        });

        expect(getPluginStatuses).toHaveBeenCalledTimes(1);
    });

    test('ignores other websocket events', () => {
        renderHookWithContext(usePluginStatusesSync);

        act(() => {
            messageHandler({event: WebSocketEvents.Posted} as WebSocketMessage);
            jest.advanceTimersByTime(DEBOUNCE_DELAY_MS);
        });

        expect(getPluginStatuses).not.toHaveBeenCalled();
    });

    test('cleans up on unmount: removes the reconnect listener and cancels a pending refetch', () => {
        const {unmount} = renderHookWithContext(usePluginStatusesSync);

        // Start a debounce window, then unmount before it elapses.
        act(() => {
            messageHandler(pluginStatusesChanged);
        });

        act(unmount);

        expect(removeReconnectListener).toHaveBeenCalledTimes(1);
        expect(removeReconnectListener).toHaveBeenCalledWith(addReconnectListener.mock.calls[0][0]);

        // The pending timer was cleared, so no refetch fires after unmount.
        act(() => {
            jest.advanceTimersByTime(DEBOUNCE_DELAY_MS);
        });

        expect(getPluginStatuses).not.toHaveBeenCalled();
    });

    test('returns the plugin statuses from the store', () => {
        const pluginStatuses = {
            'com.example.plugin': {
                id: 'com.example.plugin',
                name: 'Example',
                description: '',
                version: '1.0.0',
                active: true,
                state: 1,
                instances: [],
            },
        };

        const {result} = renderHookWithContext(usePluginStatusesSync, {
            entities: {admin: {pluginStatuses}},
        });

        expect(result.current).toEqual(pluginStatuses);
    });
});
