// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Agent} from '@mattermost/types/agents';
import type {DeepPartial} from '@mattermost/types/utilities';

import {getAgents as getAgentsAction} from 'mattermost-redux/actions/agents';
import {Client4} from 'mattermost-redux/client';

import type TextboxClass from 'components/textbox/textbox';

import {act, render, renderHookWithContext, waitFor} from 'tests/vitest_react_testing_utils';

import type {GlobalState} from 'types/store';
import type {PostDraft} from 'types/store/draft';

import {RewriteAction} from './rewrite_action';
import RewriteMenu from './rewrite_menu';
import useRewrite from './use_rewrite';

vi.mock('mattermost-redux/actions/agents', () => ({
    getAgents: vi.fn(() => ({type: 'GET_AGENTS'})),
}));

vi.mock('mattermost-redux/client', () => ({
    Client4: {
        getAIRewrittenMessage: vi.fn(),
    },
}));

vi.mock('./rewrite_menu', () => ({
    default: vi.fn(() => React.createElement('div', {'data-testid': 'rewrite-menu'}, 'RewriteMenu')),
}));

const MockedRewriteMenu = RewriteMenu as unknown as ReturnType<typeof vi.fn>;

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

    const mockHandleDraftChange = vi.fn();
    const mockFocusTextbox = vi.fn();
    const mockSetServerError = vi.fn();
    const mockTextboxRef = React.createRef<TextboxClass>();
    const mockGetInputBox = vi.fn(() => {
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
        vi.clearAllMocks();
        MockedRewriteMenu.mockClear();
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
        vi.mocked(getAgentsAction).mockImplementation(() => ({type: 'GET_AGENTS'}) as any);
        vi.mocked(Client4.getAIRewrittenMessage).mockResolvedValue('Rewritten message');
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

        it('should return isProcessing state', () => {
            const {result} = renderHookWithProps();
            expect(result.current.isProcessing).toBe(false);
        });

        it('should return additionalControl component', () => {
            const {result} = renderHookWithProps();
            expect(result.current.additionalControl).toBeDefined();
            expect(React.isValidElement(result.current.additionalControl)).toBe(true);
        });

        it('should set default selected agent when agents are available', async () => {
            const {result} = renderHookWithProps();
            await act(async () => {
                render(result.current.additionalControl);
            });
            expect(MockedRewriteMenu).toHaveBeenCalled();
            const props = MockedRewriteMenu.mock.calls[0][0];
            expect(props.selectedAgentId).toBe('agent1');
        });
    });

    describe('handleRewrite', () => {
        it('should successfully rewrite message', async () => {
            const {result} = renderHookWithProps();
            await act(async () => {
                render(result.current.additionalControl);
            });
            const props = MockedRewriteMenu.mock.calls[0][0];
            await act(async () => {
                const actionHandler = props.onMenuAction(RewriteAction.SHORTEN);
                actionHandler();
            });

            await waitFor(() => {
                expect(Client4.getAIRewrittenMessage).toHaveBeenCalledWith(
                    'agent1',
                    'Test message',
                    RewriteAction.SHORTEN,
                    undefined,
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
            const rewritePromise = vi.mocked(Client4.getAIRewrittenMessage);
            rewritePromise.mockResolvedValue('Custom rewritten message');

            await act(async () => {
                render(result.current.additionalControl);
            });
            let props = MockedRewriteMenu.mock.calls[MockedRewriteMenu.mock.calls.length - 1][0];
            await act(async () => {
                props.setPrompt('Custom prompt');
            });

            await act(async () => {
                rerender();
                render(result.current.additionalControl);
            });
            props = MockedRewriteMenu.mock.calls[MockedRewriteMenu.mock.calls.length - 1][0];
            const mockEvent = {
                key: 'Enter',
                stopPropagation: vi.fn(),
            } as unknown as React.KeyboardEvent<HTMLInputElement>;

            await act(async () => {
                props.onCustomPromptKeyDown(mockEvent);
            });

            await waitFor(() => {
                expect(rewritePromise).toHaveBeenCalledWith(
                    'agent1',
                    'Test message',
                    RewriteAction.CUSTOM,
                    'Custom prompt',
                );
            });
        });

        it('should not rewrite if already processing', async () => {
            const {result, rerender} = renderHookWithProps();
            const rewritePromise = vi.mocked(Client4.getAIRewrittenMessage);

            // Use a controllable promise instead of setTimeout to avoid timing issues
            let resolveProcessingPromise: (value: string) => void;
            rewritePromise.mockImplementation(() => new Promise((resolve) => {
                resolveProcessingPromise = resolve;
            }));

            await act(async () => {
                render(result.current.additionalControl);
            });
            let props = MockedRewriteMenu.mock.calls[MockedRewriteMenu.mock.calls.length - 1][0];
            await act(async () => {
                const actionHandler1 = props.onMenuAction(RewriteAction.SHORTEN);
                actionHandler1();
            });

            await waitFor(() => {
                expect(result.current.isProcessing).toBe(true);
            });

            await act(async () => {
                rerender();
                render(result.current.additionalControl);
            });
            props = MockedRewriteMenu.mock.calls[MockedRewriteMenu.mock.calls.length - 1][0];
            await act(async () => {
                const actionHandler2 = props.onMenuAction(RewriteAction.ELABORATE);
                actionHandler2();
            });

            expect(rewritePromise).toHaveBeenCalledTimes(1);

            // Resolve the promise to clean up
            await act(async () => {
                resolveProcessingPromise!('Response');
            });
            await waitFor(() => {
                expect(result.current.isProcessing).toBe(false);
            });
        });

        it('should handle rewrite error', async () => {
            const error = new Error('Rewrite failed');
            vi.mocked(Client4.getAIRewrittenMessage).mockRejectedValue(error);

            const {result} = renderHookWithProps();
            await act(async () => {
                render(result.current.additionalControl);
            });
            const props = MockedRewriteMenu.mock.calls[0][0];
            await act(async () => {
                const actionHandler = props.onMenuAction(RewriteAction.SHORTEN);
                actionHandler();
            });

            await waitFor(() => {
                expect(mockSetServerError).toHaveBeenCalledWith(error);
            });

            await waitFor(() => {
                expect(result.current.isProcessing).toBe(false);
            });
        });

        it('should ignore stale promise responses', async () => {
            mockHandleDraftChange.mockClear();

            const {result, rerender} = renderHookWithProps();

            let resolveFirst: (value: string) => void;
            const rewritePromise1 = new Promise<string>((resolve) => {
                resolveFirst = resolve;
            });

            const mockClient = vi.mocked(Client4.getAIRewrittenMessage);
            mockClient.mockClear();
            mockClient.mockImplementationOnce(() => rewritePromise1);
            mockClient.mockImplementationOnce(() => Promise.resolve('Second response'));

            await act(async () => {
                render(result.current.additionalControl);
            });
            let props = MockedRewriteMenu.mock.calls[MockedRewriteMenu.mock.calls.length - 1][0];
            await act(async () => {
                const actionHandler1 = props.onMenuAction(RewriteAction.SHORTEN);
                actionHandler1();
            });

            await waitFor(() => {
                expect(result.current.isProcessing).toBe(true);
            });

            await waitFor(() => {
                expect(mockClient).toHaveBeenCalledTimes(1);
            });

            await act(async () => {
                rerender();
                render(result.current.additionalControl);
            });
            props = MockedRewriteMenu.mock.calls[MockedRewriteMenu.mock.calls.length - 1][0];
            await act(async () => {
                props.onCancelProcessing();
            });

            await waitFor(() => {
                expect(result.current.isProcessing).toBe(false);
            });

            await act(async () => {
                rerender();
                render(result.current.additionalControl);
            });
            props = MockedRewriteMenu.mock.calls[MockedRewriteMenu.mock.calls.length - 1][0];
            await act(async () => {
                const actionHandler2 = props.onMenuAction(RewriteAction.ELABORATE);
                actionHandler2();
            });

            await waitFor(() => {
                expect(mockHandleDraftChange).toHaveBeenCalledWith(
                    expect.objectContaining({
                        message: 'Second response',
                    }),
                    {instant: true},
                );
            });

            const callCountAfterSecond = mockHandleDraftChange.mock.calls.length;

            await act(async () => {
                resolveFirst!('First response');
            });
            await new Promise((resolve) => setTimeout(resolve, 200));

            expect(mockHandleDraftChange.mock.calls.length).toBe(callCountAfterSecond);
        });
    });

    describe('undoMessage', () => {
        it('should restore original message and focus textbox', async () => {
            const {result} = renderHookWithProps();
            await act(async () => {
                render(result.current.additionalControl);
            });
            let props = MockedRewriteMenu.mock.calls[MockedRewriteMenu.mock.calls.length - 1][0];
            await act(async () => {
                const actionHandler = props.onMenuAction(RewriteAction.SHORTEN);
                actionHandler();
            });

            await waitFor(() => {
                expect(result.current.isProcessing).toBe(false);
            });

            await act(async () => {
                render(result.current.additionalControl);
            });
            props = MockedRewriteMenu.mock.calls[MockedRewriteMenu.mock.calls.length - 1][0];
            await act(async () => {
                props.onUndoMessage();
            });

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
            await act(async () => {
                render(result.current.additionalControl);
            });
            let props = MockedRewriteMenu.mock.calls[MockedRewriteMenu.mock.calls.length - 1][0];
            await act(async () => {
                const actionHandler = props.onMenuAction(RewriteAction.SHORTEN);
                actionHandler();
            });

            await waitFor(() => {
                expect(result.current.isProcessing).toBe(false);
            });

            await act(async () => {
                render(result.current.additionalControl);
            });
            props = MockedRewriteMenu.mock.calls[MockedRewriteMenu.mock.calls.length - 1][0];
            vi.mocked(Client4.getAIRewrittenMessage).mockResolvedValueOnce('Regenerated message');
            await act(async () => {
                props.onRegenerateMessage();
            });

            await waitFor(() => {
                expect(Client4.getAIRewrittenMessage).toHaveBeenCalledWith(
                    'agent1',
                    'Test message',
                    RewriteAction.SHORTEN,
                    undefined,
                );
            });
        });

        it('should regenerate with custom prompt if last action was custom', async () => {
            const {result, rerender} = renderHookWithProps();
            await act(async () => {
                render(result.current.additionalControl);
            });
            let props = MockedRewriteMenu.mock.calls[MockedRewriteMenu.mock.calls.length - 1][0];
            await act(async () => {
                props.setPrompt('Custom prompt');
            });

            await act(async () => {
                rerender();
                render(result.current.additionalControl);
            });
            props = MockedRewriteMenu.mock.calls[MockedRewriteMenu.mock.calls.length - 1][0];
            const mockEvent = {
                key: 'Enter',
                stopPropagation: vi.fn(),
            } as unknown as React.KeyboardEvent<HTMLInputElement>;

            await act(async () => {
                props.onCustomPromptKeyDown(mockEvent);
            });

            await waitFor(() => {
                expect(result.current.isProcessing).toBe(false);
            });

            await act(async () => {
                rerender();
                render(result.current.additionalControl);
            });
            props = MockedRewriteMenu.mock.calls[MockedRewriteMenu.mock.calls.length - 1][0];
            vi.mocked(Client4.getAIRewrittenMessage).mockResolvedValueOnce('Regenerated custom message');
            await act(async () => {
                props.onRegenerateMessage();
            });

            await waitFor(() => {
                expect(Client4.getAIRewrittenMessage).toHaveBeenCalledWith(
                    'agent1',
                    'Test message',
                    RewriteAction.CUSTOM,
                    'Custom prompt',
                );
            });
        });
    });

    describe('cancelProcessing', () => {
        it('should cancel processing and reset state', async () => {
            // Clear any previous mock implementations before setting up our test
            vi.mocked(Client4.getAIRewrittenMessage).mockReset();
            mockHandleDraftChange.mockClear();

            // Create a promise that can be resolved externally
            let resolvePromise: (value: string) => void;
            const slowPromise = new Promise<string>((resolve) => {
                resolvePromise = resolve;
            });
            vi.mocked(Client4.getAIRewrittenMessage).mockReturnValue(slowPromise);

            const {result, rerender} = renderHookWithProps();

            await act(async () => {
                render(result.current.additionalControl);
            });
            let props = MockedRewriteMenu.mock.calls[MockedRewriteMenu.mock.calls.length - 1][0];
            await act(async () => {
                const actionHandler = props.onMenuAction(RewriteAction.SHORTEN);
                actionHandler();
            });

            await waitFor(() => {
                expect(result.current.isProcessing).toBe(true);
            });

            await act(async () => {
                rerender();
                render(result.current.additionalControl);
            });
            props = MockedRewriteMenu.mock.calls[MockedRewriteMenu.mock.calls.length - 1][0];
            await act(async () => {
                props.onCancelProcessing();
            });

            await act(async () => {
                rerender();
            });

            await waitFor(() => {
                expect(result.current.isProcessing).toBe(false);
            });

            // Even if the promise resolves after cancelling, the callback should be ignored
            await act(async () => {
                resolvePromise!('Slow response');
            });

            // Give time for any pending callbacks to run
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(mockHandleDraftChange).not.toHaveBeenCalled();
        });
    });

    describe('handleCustomPromptKeyDown', () => {
        it('should stop propagation for space key', async () => {
            const {result} = renderHookWithProps();
            await act(async () => {
                render(result.current.additionalControl);
            });
            const props = MockedRewriteMenu.mock.calls[0][0];
            const mockEvent = {
                key: ' ',
                stopPropagation: vi.fn(),
            } as unknown as React.KeyboardEvent<HTMLInputElement>;

            await act(async () => {
                props.onCustomPromptKeyDown(mockEvent);
            });

            expect(mockEvent.stopPropagation).toHaveBeenCalled();
            expect(Client4.getAIRewrittenMessage).not.toHaveBeenCalled();
        });

        it('should trigger rewrite on Enter key', async () => {
            const {result, rerender} = renderHookWithProps();
            await act(async () => {
                render(result.current.additionalControl);
            });
            let props = MockedRewriteMenu.mock.calls[MockedRewriteMenu.mock.calls.length - 1][0];
            await act(async () => {
                props.setPrompt('Custom prompt');
            });

            await act(async () => {
                rerender();
                render(result.current.additionalControl);
            });
            props = MockedRewriteMenu.mock.calls[MockedRewriteMenu.mock.calls.length - 1][0];
            const mockEvent = {
                key: 'Enter',
                stopPropagation: vi.fn(),
            } as unknown as React.KeyboardEvent<HTMLInputElement>;

            await act(async () => {
                props.onCustomPromptKeyDown(mockEvent);
            });

            await waitFor(() => {
                expect(mockEvent.stopPropagation).toHaveBeenCalled();
                expect(Client4.getAIRewrittenMessage).toHaveBeenCalledWith(
                    'agent1',
                    'Test message',
                    RewriteAction.CUSTOM,
                    'Custom prompt',
                );
            });
        });
    });

    describe('handleMenuAction', () => {
        it('should return function that calls handleRewrite with action', async () => {
            const {result} = renderHookWithProps();
            await act(async () => {
                render(result.current.additionalControl);
            });
            const props = MockedRewriteMenu.mock.calls[0][0];
            await act(async () => {
                const actionHandler = props.onMenuAction(RewriteAction.IMPROVE_WRITING);
                actionHandler();
            });

            await waitFor(() => {
                expect(Client4.getAIRewrittenMessage).toHaveBeenCalledWith(
                    'agent1',
                    'Test message',
                    RewriteAction.IMPROVE_WRITING,
                    undefined,
                );
            });
        });
    });

    describe('effects', () => {
        it('should add overlay when processing', async () => {
            const {result} = renderHookWithProps();
            let resolveSlowPromise: (value: string) => void;
            const slowPromise = new Promise<string>((resolve) => {
                resolveSlowPromise = resolve;
            });
            vi.mocked(Client4.getAIRewrittenMessage).mockReturnValue(slowPromise);

            await act(async () => {
                render(result.current.additionalControl);
            });
            const props = MockedRewriteMenu.mock.calls[0][0];
            await act(async () => {
                const actionHandler = props.onMenuAction(RewriteAction.SHORTEN);
                actionHandler();
            });

            await waitFor(() => {
                expect(result.current.isProcessing).toBe(true);
            });

            await waitFor(() => {
                const overlay = document.querySelector('.rewrite-overlay');
                expect(overlay).not.toBeNull();
            }, {timeout: 2000});

            // Resolve the promise and wait for React to process state updates
            await act(async () => {
                resolveSlowPromise!('Response');
            });

            // Wait for processing to complete
            await waitFor(() => {
                expect(result.current.isProcessing).toBe(false);
            });
        });

        it('should remove overlay when processing stops', async () => {
            const {result} = renderHookWithProps();
            await act(async () => {
                render(result.current.additionalControl);
            });
            const props = MockedRewriteMenu.mock.calls[0][0];
            await act(async () => {
                const actionHandler = props.onMenuAction(RewriteAction.SHORTEN);
                actionHandler();
            });

            await waitFor(() => {
                expect(result.current.isProcessing).toBe(false);
            });

            const overlay = document.querySelector('.rewrite-overlay');
            expect(overlay).not.toBeInTheDocument();
        });

        it('should reset state when draft message becomes empty', async () => {
            const {result, rerender} = renderHookWithProps(mockDraft);
            await act(async () => {
                render(result.current.additionalControl);
            });
            let props = MockedRewriteMenu.mock.calls[MockedRewriteMenu.mock.calls.length - 1][0];
            await act(async () => {
                const actionHandler = props.onMenuAction(RewriteAction.SHORTEN);
                actionHandler();
            });

            await waitFor(() => {
                expect(result.current.isProcessing).toBe(false);
            });

            await act(async () => {
                rerender();
                render(result.current.additionalControl);
            });
            props = MockedRewriteMenu.mock.calls[MockedRewriteMenu.mock.calls.length - 1][0];
            expect(props.originalMessage).toBe('Test message');

            const {result: result2} = renderHookWithProps({...mockDraft, message: ''});
            await act(async () => {
                render(result2.current.additionalControl);
            });
            props = MockedRewriteMenu.mock.calls[MockedRewriteMenu.mock.calls.length - 1][0];
            expect(props.originalMessage).toBe('');
        });
    });
});
