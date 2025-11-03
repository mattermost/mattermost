// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as ReactRedux from 'react-redux';

import type {WebSocketMessage} from '@mattermost/client';
import type {AIAgent} from '@mattermost/types/ai';

import {renderHookWithContext} from 'tests/react_testing_utils';
import {SocketEvents} from 'utils/constants';
import * as useWebSocketHooks from 'utils/use_websocket/hooks';

import useGetAgentsBridgeEnabled from './useGetAgentsBridgeEnabled';

jest.mock('react-redux', () => ({
    __esModule: true,
    ...jest.requireActual('react-redux'),
}));

jest.mock('utils/use_websocket/hooks', () => ({
    __esModule: true,
    useWebSocket: jest.fn(),
    useWebSocketClient: jest.fn(() => ({
        addMessageListener: jest.fn(),
        removeMessageListener: jest.fn(),
    })),
}));

describe('useGetAgentsBridgeEnabled', () => {
    const mockAgent1: AIAgent = {
        id: 'agent1',
        displayName: 'Agent 1',
        username: 'agent1_user',
        service_id: 'service1',
        service_type: 'openai',
    };

    const mockAgent2: AIAgent = {
        id: 'agent2',
        displayName: 'Agent 2',
        username: 'agent2_user',
        service_id: 'service2',
        service_type: 'anthropic',
    };

    describe('with fake dispatch', () => {
        const dispatchMock = jest.fn();
        let useWebSocketMock: jest.Mock;
        let webSocketHandler: ((msg: WebSocketMessage) => void) | null = null;

        beforeAll(() => {
            jest.spyOn(ReactRedux, 'useDispatch').mockImplementation(() => dispatchMock);
            useWebSocketMock = jest.fn((options: {handler: (msg: WebSocketMessage) => void}) => {
                webSocketHandler = options.handler;
            });
            (useWebSocketHooks.useWebSocket as jest.Mock) = useWebSocketMock;
        });

        beforeEach(() => {
            dispatchMock.mockClear();
            useWebSocketMock.mockClear();
            webSocketHandler = null;
        });

        afterAll(() => {
            jest.restoreAllMocks();
        });

        test('should return true if agents are available', () => {
            const {result} = renderHookWithContext(
                () => useGetAgentsBridgeEnabled(),
                {
                    entities: {
                        ai: {
                            agents: [mockAgent1, mockAgent2],
                        },
                    },
                },
            );

            expect(result.current).toBe(true);
            expect(dispatchMock).toHaveBeenCalledTimes(1); // Initial fetch
        });

        test('should return false if agents list is empty', () => {
            const {result} = renderHookWithContext(
                () => useGetAgentsBridgeEnabled(),
                {
                    entities: {
                        ai: {
                            agents: [],
                        },
                    },
                },
            );

            expect(result.current).toBe(false);
            expect(dispatchMock).toHaveBeenCalledTimes(1); // Initial fetch
        });

        test('should return false if agents is undefined', () => {
            const {result} = renderHookWithContext(
                () => useGetAgentsBridgeEnabled(),
                {
                    entities: {
                        ai: {
                            agents: undefined,
                        },
                    },
                },
            );

            expect(result.current).toBe(false);
            expect(dispatchMock).toHaveBeenCalledTimes(1); // Initial fetch
        });

        test('should dispatch getAIAgents on mount', () => {
            renderHookWithContext(
                () => useGetAgentsBridgeEnabled(),
                {
                    entities: {
                        ai: {
                            agents: [],
                        },
                    },
                },
            );

            expect(dispatchMock).toHaveBeenCalledTimes(1);
        });

        test('should only fetch agents once on multiple renders', () => {
            const {rerender} = renderHookWithContext(
                () => useGetAgentsBridgeEnabled(),
                {
                    entities: {
                        ai: {
                            agents: [],
                        },
                    },
                },
            );

            expect(dispatchMock).toHaveBeenCalledTimes(1);

            for (let i = 0; i < 5; i++) {
                rerender();
            }

            expect(dispatchMock).toHaveBeenCalledTimes(1);
        });

        test('should register websocket handler', () => {
            renderHookWithContext(
                () => useGetAgentsBridgeEnabled(),
                {
                    entities: {
                        ai: {
                            agents: [],
                        },
                    },
                },
            );

            expect(useWebSocketMock).toHaveBeenCalled();
            expect(useWebSocketMock).toHaveBeenCalledWith({
                handler: expect.any(Function),
            });
        });

        test('should refetch agents when mattermost-ai plugin is enabled', () => {
            renderHookWithContext(
                () => useGetAgentsBridgeEnabled(),
                {
                    entities: {
                        ai: {
                            agents: [],
                        },
                    },
                },
            );

            expect(dispatchMock).toHaveBeenCalledTimes(1);

            // Simulate plugin enabled websocket event
            const pluginEnabledMessage: WebSocketMessage = {
                event: SocketEvents.PLUGIN_ENABLED,
                data: {
                    manifest: {
                        id: 'mattermost-ai',
                    },
                },
                broadcast: {
                    omit_users: {},
                    user_id: '',
                    channel_id: '',
                    team_id: '',
                },
                seq: 1,
            };

            if (webSocketHandler) {
                webSocketHandler(pluginEnabledMessage);
            }

            expect(dispatchMock).toHaveBeenCalledTimes(2);
        });

        test('should refetch agents when mattermost-ai plugin is disabled', () => {
            renderHookWithContext(
                () => useGetAgentsBridgeEnabled(),
                {
                    entities: {
                        ai: {
                            agents: [mockAgent1],
                        },
                    },
                },
            );

            expect(dispatchMock).toHaveBeenCalledTimes(1);

            // Simulate plugin disabled websocket event
            const pluginDisabledMessage: WebSocketMessage = {
                event: SocketEvents.PLUGIN_DISABLED,
                data: {
                    manifest: {
                        id: 'mattermost-ai',
                    },
                },
                broadcast: {
                    omit_users: {},
                    user_id: '',
                    channel_id: '',
                    team_id: '',
                },
                seq: 2,
            };

            if (webSocketHandler) {
                webSocketHandler(pluginDisabledMessage);
            }

            expect(dispatchMock).toHaveBeenCalledTimes(2);
        });

        test('should NOT refetch agents when a different plugin is enabled', () => {
            renderHookWithContext(
                () => useGetAgentsBridgeEnabled(),
                {
                    entities: {
                        ai: {
                            agents: [mockAgent1],
                        },
                    },
                },
            );

            expect(dispatchMock).toHaveBeenCalledTimes(1);

            // Simulate plugin enabled websocket event for a different plugin
            const pluginEnabledMessage: WebSocketMessage = {
                event: SocketEvents.PLUGIN_ENABLED,
                data: {
                    manifest: {
                        id: 'some-other-plugin',
                    },
                },
                broadcast: {
                    omit_users: {},
                    user_id: '',
                    channel_id: '',
                    team_id: '',
                },
                seq: 3,
            };

            if (webSocketHandler) {
                webSocketHandler(pluginEnabledMessage);
            }

            // Should still only be 1 call (initial fetch)
            expect(dispatchMock).toHaveBeenCalledTimes(1);
        });

        test('should NOT refetch agents when a different plugin is disabled', () => {
            renderHookWithContext(
                () => useGetAgentsBridgeEnabled(),
                {
                    entities: {
                        ai: {
                            agents: [mockAgent1],
                        },
                    },
                },
            );

            expect(dispatchMock).toHaveBeenCalledTimes(1);

            // Simulate plugin disabled websocket event for a different plugin
            const pluginDisabledMessage: WebSocketMessage = {
                event: SocketEvents.PLUGIN_DISABLED,
                data: {
                    manifest: {
                        id: 'another-plugin',
                    },
                },
                broadcast: {
                    omit_users: {},
                    user_id: '',
                    channel_id: '',
                    team_id: '',
                },
                seq: 4,
            };

            if (webSocketHandler) {
                webSocketHandler(pluginDisabledMessage);
            }

            // Should still only be 1 call (initial fetch)
            expect(dispatchMock).toHaveBeenCalledTimes(1);
        });

        test('should NOT refetch agents on unrelated websocket events', () => {
            renderHookWithContext(
                () => useGetAgentsBridgeEnabled(),
                {
                    entities: {
                        ai: {
                            agents: [mockAgent1],
                        },
                    },
                },
            );

            expect(dispatchMock).toHaveBeenCalledTimes(1);

            // Simulate different websocket event
            const otherMessage: WebSocketMessage = {
                event: SocketEvents.USER_UPDATED,
                data: {},
                broadcast: {
                    omit_users: {},
                    user_id: '',
                    channel_id: '',
                    team_id: '',
                },
                seq: 5,
            };

            if (webSocketHandler) {
                webSocketHandler(otherMessage);
            }

            // Should still only be 1 call (initial fetch)
            expect(dispatchMock).toHaveBeenCalledTimes(1);
        });

        test('should handle websocket message with missing manifest data', () => {
            renderHookWithContext(
                () => useGetAgentsBridgeEnabled(),
                {
                    entities: {
                        ai: {
                            agents: [mockAgent1],
                        },
                    },
                },
            );

            expect(dispatchMock).toHaveBeenCalledTimes(1);

            // Simulate plugin enabled websocket event without manifest
            const pluginEnabledMessage: WebSocketMessage = {
                event: SocketEvents.PLUGIN_ENABLED,
                data: {},
                broadcast: {
                    omit_users: {},
                    user_id: '',
                    channel_id: '',
                    team_id: '',
                },
                seq: 6,
            };

            if (webSocketHandler) {
                webSocketHandler(pluginEnabledMessage);
            }

            // Should still only be 1 call (initial fetch), no error thrown
            expect(dispatchMock).toHaveBeenCalledTimes(1);
        });

        test('should refetch agents when config changes', () => {
            renderHookWithContext(
                () => useGetAgentsBridgeEnabled(),
                {
                    entities: {
                        ai: {
                            agents: [mockAgent1],
                        },
                    },
                },
            );

            expect(dispatchMock).toHaveBeenCalledTimes(1);

            // Simulate config changed websocket event
            const configChangedMessage: WebSocketMessage = {
                event: SocketEvents.CONFIG_CHANGED,
                data: {},
                broadcast: {
                    omit_users: {},
                    user_id: '',
                    channel_id: '',
                    team_id: '',
                },
                seq: 7,
            };

            if (webSocketHandler) {
                webSocketHandler(configChangedMessage);
            }

            expect(dispatchMock).toHaveBeenCalledTimes(2);
        });

        test('should refetch agents multiple times on multiple config changes', () => {
            renderHookWithContext(
                () => useGetAgentsBridgeEnabled(),
                {
                    entities: {
                        ai: {
                            agents: [],
                        },
                    },
                },
            );

            expect(dispatchMock).toHaveBeenCalledTimes(1);

            // Simulate multiple config changed events
            for (let i = 0; i < 3; i++) {
                const configChangedMessage: WebSocketMessage = {
                    event: SocketEvents.CONFIG_CHANGED,
                    data: {},
                    broadcast: {
                        omit_users: {},
                        user_id: '',
                        channel_id: '',
                        team_id: '',
                    },
                    seq: 8 + i,
                };

                if (webSocketHandler) {
                    webSocketHandler(configChangedMessage);
                }
            }

            expect(dispatchMock).toHaveBeenCalledTimes(4); // 1 initial + 3 config changes
        });
    });
});

