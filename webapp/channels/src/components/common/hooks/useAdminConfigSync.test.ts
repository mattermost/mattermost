// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act} from '@testing-library/react';
import * as ReactRedux from 'react-redux';

import type {WebSocketMessage} from '@mattermost/client';
import {WebSocketEvents} from '@mattermost/client';

import {getConfig} from 'mattermost-redux/actions/admin';

import {renderHookWithContext} from 'tests/react_testing_utils';
import * as webSocketHooks from 'utils/use_websocket/hooks';

import useAdminConfigSync from './useAdminConfigSync';

jest.mock('mattermost-redux/actions/admin', () => ({
    ...jest.requireActual('mattermost-redux/actions/admin'),
    getConfig: jest.fn(() => ({type: 'MOCK_GET_ADMIN_CONFIG'})),
}));

jest.mock('utils/use_websocket/hooks', () => ({
    useWebSocket: jest.fn(),
    useWebSocketClient: jest.fn(),
}));

describe('useAdminConfigSync', () => {
    const dispatchMock = jest.fn();
    const addReconnectListener = jest.fn();
    const removeReconnectListener = jest.fn();

    let messageHandler: (msg: WebSocketMessage) => void;

    beforeEach(() => {
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
        jest.restoreAllMocks();
        (getConfig as jest.Mock).mockClear();
        dispatchMock.mockClear();
        addReconnectListener.mockClear();
        removeReconnectListener.mockClear();
    });

    test('dispatches getConfig on a config_changed event', () => {
        renderHookWithContext(useAdminConfigSync);

        act(() => {
            messageHandler({event: WebSocketEvents.ConfigChanged} as WebSocketMessage);
        });

        expect(getConfig).toHaveBeenCalledTimes(1);
        expect(dispatchMock).toHaveBeenCalledWith({type: 'MOCK_GET_ADMIN_CONFIG'});
    });

    test('ignores other websocket events', () => {
        renderHookWithContext(useAdminConfigSync);

        act(() => {
            messageHandler({event: WebSocketEvents.Posted} as WebSocketMessage);
        });

        expect(getConfig).not.toHaveBeenCalled();
    });

    test('refetches on websocket reconnect', () => {
        renderHookWithContext(useAdminConfigSync);

        expect(addReconnectListener).toHaveBeenCalledTimes(1);
        const reconnectListener = addReconnectListener.mock.calls[0][0];

        act(() => {
            reconnectListener();
        });

        expect(getConfig).toHaveBeenCalledTimes(1);
    });

    test('removes the reconnect listener on unmount', () => {
        const {unmount} = renderHookWithContext(useAdminConfigSync);

        act(unmount);

        expect(removeReconnectListener).toHaveBeenCalledTimes(1);
        expect(removeReconnectListener).toHaveBeenCalledWith(addReconnectListener.mock.calls[0][0]);
    });
});
