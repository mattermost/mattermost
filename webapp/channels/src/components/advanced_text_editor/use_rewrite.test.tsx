// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Agent} from '@mattermost/types/agents';
import type {DeepPartial} from '@mattermost/types/utilities';

import {getAgents as getAgentsAction} from 'mattermost-redux/actions/agents';
import {Client4} from 'mattermost-redux/client';

import type TextboxClass from 'components/textbox/textbox';

import {renderHookWithContext, waitFor} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';
import type {PostDraft} from 'types/store/draft';

import {RewriteAction} from './rewrite_action';
import useRewrite from './use_rewrite';

jest.mock('mattermost-redux/actions/agents', () => ({
    getAgents: jest.fn(() => ({type: 'GET_AGENTS'})),
}));

jest.mock('mattermost-redux/client', () => ({
    Client4: {
        getAIRewrittenMessage: jest.fn(),
    },
}));

describe('useRewrite', () => {
    const mockAgents: Agent[] = [
        {
            id: 'agent1',
            displayName: 'Agent 1',
            username: 'agent1',
            service_id: 'service1',
            service_type: 'openai',
        },
        {
            id: 'agent2',
            displayName: 'Agent 2',
            username: 'agent2',
            service_id: 'service2',
            service_type: 'anthropic',
        },
    ];

    const mockDraft: PostDraft = {
        message: 'Test message',
        fileInfos: [],
        uploadsInProgress: [],
        createAt: 0,
        updateAt: 0,
        channelId: 'channel_id',
        rootId: '',
    };

    const mockHandleDraftChange = jest.fn();
    const mockFocusTextbox = jest.fn();
    const mockSetServerError = jest.fn();
    const mockTextboxRef = React.createRef<TextboxClass>();
    const mockGetInputBox = jest.fn(() => {
        const input = document.createElement('textarea');
        const wrapper = document.createElement('div');
        document.body.appendChild(wrapper);
        wrapper.appendChild(input);
        return input;
    });

    const mockTextbox: Partial<TextboxClass> = {
        getInputBox: mockGetInputBox,
    };

    beforeEach(() => {
        jest.clearAllMocks();
        document.body.innerHTML = '';
        try {
            Object.defineProperty(mockTextboxRef, 'current', {
                value: mockTextbox as TextboxClass,
                writable: true,
                configurable: true,
            });
        } catch {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (mockTextboxRef as any).current = mockTextbox as TextboxClass;
        }
        (getAgentsAction as jest.Mock).mockReturnValue({type: 'GET_AGENTS'});
        (Client4.getAIRewrittenMessage as jest.Mock).mockResolvedValue('Rewritten message');
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    function getBaseState(): DeepPartial<GlobalState> {
        return {
            entities: {
                agents: {
                    agents: mockAgents,
                },
            },
        };
    }

    function renderHookWithProps(draft: PostDraft = mockDraft, overrides?: Partial<typeof mockDraft>) {
        return renderHookWithContext(
            () => useRewrite(
                {...draft, ...overrides},
                mockHandleDraftChange,
                mockTextboxRef,
                mockFocusTextbox,
                mockSetServerError,
            ),
            getBaseState(),
        );
    }

    describe('initialization', () => {
        it('should dispatch getAgents action on mount', () => {
            renderHookWithProps();
            expect(getAgentsAction).toHaveBeenCalledTimes(1);
        });

        it('should set default selected agent when agents are available', () => {
            const {result} = renderHookWithProps();
            const props = result.current.rewriteMenuProps;
            expect(props.selectedAgentId).toBe('agent1');
        });
    });

    describe('handleRewrite', () => {
        it('should successfully rewrite message', async () => {
            const {result} = renderHookWithProps();
            const props = result.current.rewriteMenuProps;
            const actionHandler = props.onMenuAction(RewriteAction.SHORTEN);
            actionHandler();

            await waitFor(() => {
                expect(Client4.getAIRewrittenMessage).toHaveBeenCalledWith(
                    'agent1',
                    'Test message',
                    RewriteAction.SHORTEN,
                    undefined,
                    '',
                );
            });

            await waitFor(() => {
                expect(mockHandleDraftChange).toHaveBeenCalledWith(
                    expect.objectContaining({
                        message: 'Rewritten message',
                    }),
                    {instant: true},
                );
            });

            expect(mockSetServerError).toHaveBeenCalledWith(null);
        });

        it('should handle rewrite with custom prompt', async () => {
            const {result, rerender} = renderHookWithProps();
            const rewritePromise = Client4.getAIRewrittenMessage as jest.Mock;
            rewritePromise.mockResolvedValue('Custom rewritten message');

            let props = result.current.rewriteMenuProps;
            props.setPrompt('Custom prompt');

            rerender();

            props = result.current.rewriteMenuProps;
            const mockEvent = {
                key: 'Enter',
                nativeEvent: {isComposing: false},
                stopPropagation: jest.fn(),
            } as unknown as React.KeyboardEvent<HTMLInputElement>;

            props.onCustomPromptKeyDown(mockEvent);

            await waitFor(() => {
                expect(rewritePromise).toHaveBeenCalledWith(
                    'agent1',
                    'Test message',
                    RewriteAction.CUSTOM,
                    'Custom prompt',
                    '',
                );
            });
        });

        it('should not rewrite if already processing', async () => {
            const {result, rerender} = renderHookWithProps();
            const rewritePromise = Client4.getAIRewrittenMessage as jest.Mock;
            rewritePromise.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve('Response'), 100)));

            let props = result.current.rewriteMenuProps;
            const actionHandler1 = props.onMenuAction(RewriteAction.SHORTEN);
            actionHandler1();

            await waitFor(() => {
                expect(result.current.isProcessing).toBe(true);
            });

            rerender();
            props = result.current.rewriteMenuProps;
            const actionHandler2 = props.onMenuAction(RewriteAction.ELABORATE);
            actionHandler2();

            expect(rewritePromise).toHaveBeenCalledTimes(1);
        });

        it('should handle rewrite error', async () => {
            const error = new Error('Rewrite failed');
            (Client4.getAIRewrittenMessage as jest.Mock).mockRejectedValue(error);

            const {result} = renderHookWithProps();
            const props = result.current.rewriteMenuProps;
            const actionHandler = props.onMenuAction(RewriteAction.SHORTEN);
            actionHandler();

            await waitFor(() => {
                expect(mockSetServerError).toHaveBeenCalledWith(error);
            });

            await waitFor(() => {
                expect(result.current.isProcessing).toBe(false);
            });
        });

        it('should ignore stale promise responses', async () => {
            const {result, rerender} = renderHookWithProps();

            let resolveFirst: (value: string) => void;
            const rewritePromise1 = new Promise<string>((resolve) => {
                resolveFirst = resolve;
            });

            const mockClient = Client4.getAIRewrittenMessage as jest.Mock;
            mockClient.mockImplementationOnce(() => rewritePromise1);
            mockClient.mockImplementationOnce(() => Promise.resolve('Second response'));

            let props = result.current.rewriteMenuProps;
            const actionHandler1 = props.onMenuAction(RewriteAction.SHORTEN);
            actionHandler1();

            await waitFor(() => {
                expect(result.current.isProcessing).toBe(true);
            });

            await waitFor(() => {
                expect(mockClient).toHaveBeenCalledTimes(1);
            });

            rerender();
            props = result.current.rewriteMenuProps;
            props.onCancelProcessing();

            await waitFor(() => {
                expect(result.current.isProcessing).toBe(false);
            });

            rerender();
            props = result.current.rewriteMenuProps;
            const actionHandler2 = props.onMenuAction(RewriteAction.ELABORATE);
            actionHandler2();

            await waitFor(() => {
                expect(mockHandleDraftChange).toHaveBeenCalledWith(
                    expect.objectContaining({
                        message: 'Second response',
                    }),
                    {instant: true},
                );
            });

            const callCountAfterSecond = mockHandleDraftChange.mock.calls.length;

            resolveFirst!('First response');
            await new Promise((resolve) => setTimeout(resolve, 200));

            expect(mockHandleDraftChange.mock.calls.length).toBe(callCountAfterSecond);
        });
    });

    describe('undoMessage', () => {
        it('should restore original message and focus textbox', async () => {
            const {result} = renderHookWithProps();
            let props = result.current.rewriteMenuProps;
            const actionHandler = props.onMenuAction(RewriteAction.SHORTEN);
            actionHandler();

            await waitFor(() => {
                expect(result.current.isProcessing).toBe(false);
            });

            props = result.current.rewriteMenuProps;
            props.onUndoMessage();

            expect(mockHandleDraftChange).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Test message',
                }),
                {instant: true},
            );
            expect(mockFocusTextbox).toHaveBeenCalled();
        });
    });

    describe('regenerateMessage', () => {
        it('should regenerate message with last action', async () => {
            const {result} = renderHookWithProps();
            let props = result.current.rewriteMenuProps;
            const actionHandler = props.onMenuAction(RewriteAction.SHORTEN);
            actionHandler();

            await waitFor(() => {
                expect(result.current.isProcessing).toBe(false);
            });

            props = result.current.rewriteMenuProps;
            const mockClient = Client4.getAIRewrittenMessage as jest.Mock;
            mockClient.mockResolvedValueOnce('Regenerated message');
            props.onRegenerateMessage();

            await waitFor(() => {
                expect(Client4.getAIRewrittenMessage).toHaveBeenCalledWith(
                    'agent1',
                    'Test message',
                    RewriteAction.SHORTEN,
                    undefined,
                    '',
                );
            });
        });

        it('should regenerate with custom prompt if last action was custom', async () => {
            const {result, rerender} = renderHookWithProps();
            let props = result.current.rewriteMenuProps;
            props.setPrompt('Custom prompt');

            rerender();
            props = result.current.rewriteMenuProps;
            const mockEvent = {
                key: 'Enter',
                nativeEvent: {isComposing: false},
                stopPropagation: jest.fn(),
            } as unknown as React.KeyboardEvent<HTMLInputElement>;

            props.onCustomPromptKeyDown(mockEvent);

            await waitFor(() => {
                expect(result.current.isProcessing).toBe(false);
            });

            rerender();
            props = result.current.rewriteMenuProps;
            const mockClient = Client4.getAIRewrittenMessage as jest.Mock;
            mockClient.mockResolvedValueOnce('Regenerated custom message');
            props.onRegenerateMessage();

            await waitFor(() => {
                expect(Client4.getAIRewrittenMessage).toHaveBeenCalledWith(
                    'agent1',
                    'Test message',
                    RewriteAction.CUSTOM,
                    'Custom prompt',
                    '',
                );
            });
        });
    });

    describe('cancelProcessing', () => {
        it('should cancel processing and reset state', async () => {
            let resolveSlowPromise: (value: string) => void;
            const slowPromise = new Promise<string>((resolve) => {
                resolveSlowPromise = resolve;
            });
            (Client4.getAIRewrittenMessage as jest.Mock).mockReturnValue(slowPromise);

            const {result, rerender} = renderHookWithProps();

            let props = result.current.rewriteMenuProps;
            const actionHandler = props.onMenuAction(RewriteAction.SHORTEN);
            actionHandler();

            await waitFor(() => {
                expect(result.current.isProcessing).toBe(true);
            });

            rerender();
            props = result.current.rewriteMenuProps;
            props.onCancelProcessing();

            rerender();

            await waitFor(() => {
                expect(result.current.isProcessing).toBe(false);
            });

            // Resolve the stale promise — the hook should ignore it
            resolveSlowPromise!('Slow response');
            await slowPromise;

            expect(mockHandleDraftChange).not.toHaveBeenCalled();
        });
    });

    describe('handleCustomPromptKeyDown', () => {
        it('should stop propagation for space key', () => {
            const {result} = renderHookWithProps();
            const props = result.current.rewriteMenuProps;
            const mockEvent = {
                key: ' ',
                stopPropagation: jest.fn(),
            } as unknown as React.KeyboardEvent<HTMLInputElement>;

            props.onCustomPromptKeyDown(mockEvent);

            expect(mockEvent.stopPropagation).toHaveBeenCalled();
            expect(Client4.getAIRewrittenMessage).not.toHaveBeenCalled();
        });

        it('should trigger rewrite on Enter key', async () => {
            const {result, rerender} = renderHookWithProps();
            let props = result.current.rewriteMenuProps;
            props.setPrompt('Custom prompt');

            rerender();
            props = result.current.rewriteMenuProps;
            const mockEvent = {
                key: 'Enter',
                nativeEvent: {isComposing: false},
                stopPropagation: jest.fn(),
            } as unknown as React.KeyboardEvent<HTMLInputElement>;

            props.onCustomPromptKeyDown(mockEvent);

            await waitFor(() => {
                expect(mockEvent.stopPropagation).toHaveBeenCalled();
                expect(Client4.getAIRewrittenMessage).toHaveBeenCalledWith(
                    'agent1',
                    'Test message',
                    RewriteAction.CUSTOM,
                    'Custom prompt',
                    '',
                );
            });
        });

        it('should not trigger rewrite on Enter key during IME composition', () => {
            const {result, rerender} = renderHookWithProps();
            let props = result.current.rewriteMenuProps;
            props.setPrompt('Custom prompt');

            rerender();
            props = result.current.rewriteMenuProps;
            const mockEvent = {
                key: 'Enter',
                nativeEvent: {isComposing: true},
                stopPropagation: jest.fn(),
            } as unknown as React.KeyboardEvent<HTMLInputElement>;

            props.onCustomPromptKeyDown(mockEvent);

            expect(mockEvent.stopPropagation).not.toHaveBeenCalled();
            expect(Client4.getAIRewrittenMessage).not.toHaveBeenCalled();
        });
    });

    describe('handleMenuAction', () => {
        it('should return function that calls handleRewrite with action', async () => {
            const {result} = renderHookWithProps();
            const props = result.current.rewriteMenuProps;
            const actionHandler = props.onMenuAction(RewriteAction.IMPROVE_WRITING);
            actionHandler();

            await waitFor(() => {
                expect(Client4.getAIRewrittenMessage).toHaveBeenCalledWith(
                    'agent1',
                    'Test message',
                    RewriteAction.IMPROVE_WRITING,
                    undefined,
                    '',
                );
            });
        });
    });

    describe('effects', () => {
        it('should add overlay when processing', async () => {
            const {result} = renderHookWithProps();
            const slowPromise = new Promise<string>((resolve) => {
                setTimeout(() => resolve('Response'), 100);
            });
            (Client4.getAIRewrittenMessage as jest.Mock).mockReturnValue(slowPromise);

            const props = result.current.rewriteMenuProps;
            const actionHandler = props.onMenuAction(RewriteAction.SHORTEN);
            actionHandler();

            await waitFor(() => {
                expect(result.current.isProcessing).toBe(true);
            });

            await waitFor(() => {
                const overlay = document.querySelector('.rewrite-overlay');
                expect(overlay).not.toBeNull();
            }, {timeout: 2000});

            await slowPromise;
        });

        it('should remove overlay when processing stops', async () => {
            const {result} = renderHookWithProps();
            const props = result.current.rewriteMenuProps;
            const actionHandler = props.onMenuAction(RewriteAction.SHORTEN);
            actionHandler();

            await waitFor(() => {
                expect(result.current.isProcessing).toBe(false);
            });

            const overlay = document.querySelector('.rewrite-overlay');
            expect(overlay).not.toBeInTheDocument();
        });

        it('should reset state when draft message becomes empty', async () => {
            let currentDraft = mockDraft;
            const {result, rerender} = renderHookWithContext(
                () => useRewrite(
                    currentDraft,
                    mockHandleDraftChange,
                    mockTextboxRef,
                    mockFocusTextbox,
                    mockSetServerError,
                ),
                getBaseState(),
            );

            let props = result.current.rewriteMenuProps;
            const actionHandler = props.onMenuAction(RewriteAction.SHORTEN);
            actionHandler();

            await waitFor(() => {
                expect(result.current.isProcessing).toBe(false);
            });

            rerender();

            props = result.current.rewriteMenuProps;
            expect(props.originalMessage).toBe('Test message');

            // Change draft to empty message on the same hook instance
            currentDraft = {...mockDraft, message: ''};
            rerender();

            props = result.current.rewriteMenuProps;
            expect(props.originalMessage).toBe('');
        });
    });
});
