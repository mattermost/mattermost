// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act} from '@testing-library/react';
import type {Editor} from '@tiptap/react';
import React from 'react';

import type {Agent} from '@mattermost/types/agents';
import type {DeepPartial} from '@mattermost/types/utilities';

import {getAgents as getAgentsAction} from 'mattermost-redux/actions/agents';
import {Client4} from 'mattermost-redux/client';

import {RewriteAction} from 'components/advanced_text_editor/rewrite_action';
import RewriteMenu from 'components/advanced_text_editor/rewrite_menu';
import {openMenu} from 'components/menu';

import {render, renderHookWithContext, waitFor} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

import usePageRewrite from './use_page_rewrite';

jest.mock('mattermost-redux/actions/agents', () => ({
    getAgents: jest.fn(() => ({type: 'GET_AGENTS'})),
}));

jest.mock('mattermost-redux/client', () => ({
    Client4: {
        getAIRewrittenMessage: jest.fn(),
    },
}));

jest.mock('components/advanced_text_editor/rewrite_menu', () => {
    const React = require('react');
    return {
        __esModule: true,
        default: jest.fn(() => React.createElement('div', {'data-testid': 'rewrite-menu'}, 'RewriteMenu')),
    };
});

jest.mock('components/menu', () => ({
    openMenu: jest.fn(),
}));

const MockedRewriteMenu = RewriteMenu as jest.MockedFunction<typeof RewriteMenu>;
const MockedOpenMenu = openMenu as jest.MockedFunction<typeof openMenu>;

describe('usePageRewrite', () => {
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

    const mockSetServerError = jest.fn();

    let mockEditor: Partial<Editor>;

    beforeEach(() => {
        jest.clearAllMocks();
        MockedRewriteMenu.mockClear();
        MockedOpenMenu.mockClear();

        // Create mock TipTap editor
        mockEditor = {
            state: {
                selection: {
                    from: 0,
                    to: 12,
                },
                doc: {
                    textBetween: jest.fn(() => 'Test message'),
                },
            } as any,
            chain: jest.fn(() => ({
                focus: jest.fn().mockReturnThis(),
                setTextSelection: jest.fn().mockReturnThis(),
                insertContent: jest.fn().mockReturnThis(),
                run: jest.fn(),
            })),
        } as any;

        (getAgentsAction as jest.Mock).mockReturnValue({type: 'GET_AGENTS'});
        (Client4.getAIRewrittenMessage as jest.Mock).mockResolvedValue('Rewritten message');
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

    function renderHookWithProps(editor: Partial<Editor> | null = mockEditor) {
        return renderHookWithContext(
            () => usePageRewrite(
                editor as Editor | null,
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

        it('should return openRewriteMenu function', () => {
            const {result} = renderHookWithProps();
            expect(result.current.openRewriteMenu).toBeDefined();
            expect(typeof result.current.openRewriteMenu).toBe('function');
        });

        it('should set default selected agent when agents are available', () => {
            const {result} = renderHookWithProps();
            render(result.current.additionalControl);
            expect(MockedRewriteMenu).toHaveBeenCalled();
            const props = MockedRewriteMenu.mock.calls[0][0];
            expect(props.selectedAgentId).toBe('agent1');
        });

        it('should handle null editor gracefully', () => {
            const {result} = renderHookWithProps(null);
            expect(result.current.additionalControl).toBeDefined();
            expect(result.current.isProcessing).toBe(false);
        });
    });

    describe('openRewriteMenu', () => {
        it('should open the menu when called', () => {
            const {result} = renderHookWithProps();

            result.current.openRewriteMenu();

            expect(MockedOpenMenu).toHaveBeenCalledWith('rewrite-button');
        });
    });

    describe('handleRewrite', () => {
        it('should successfully rewrite selected text', async () => {
            const {result} = renderHookWithProps();
            render(result.current.additionalControl);
            const props = MockedRewriteMenu.mock.calls[0][0];
            const actionHandler = props.onMenuAction(RewriteAction.SHORTEN);

            act(() => {
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
                expect(mockEditor.chain).toHaveBeenCalled();
            });

            expect(mockSetServerError).toHaveBeenCalledWith(null);
        });

        it('should handle rewrite with custom prompt', async () => {
            const {result, rerender} = renderHookWithProps();
            (Client4.getAIRewrittenMessage as jest.Mock).mockResolvedValue('Custom rewritten message');

            render(result.current.additionalControl);
            let props = MockedRewriteMenu.mock.calls[MockedRewriteMenu.mock.calls.length - 1][0];

            act(() => {
                props.setPrompt('Custom prompt');
            });

            rerender();

            render(result.current.additionalControl);
            props = MockedRewriteMenu.mock.calls[MockedRewriteMenu.mock.calls.length - 1][0];
            const mockEvent = {
                key: 'Enter',
                stopPropagation: jest.fn(),
            } as unknown as React.KeyboardEvent<HTMLInputElement>;

            act(() => {
                props.onCustomPromptKeyDown(mockEvent);
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

        it('should not rewrite if already processing', async () => {
            const {result, rerender} = renderHookWithProps();
            const rewritePromise = Client4.getAIRewrittenMessage as jest.Mock;
            rewritePromise.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve('Response'), 100)));

            render(result.current.additionalControl);
            let props = MockedRewriteMenu.mock.calls[MockedRewriteMenu.mock.calls.length - 1][0];
            const actionHandler1 = props.onMenuAction(RewriteAction.SHORTEN);

            act(() => {
                actionHandler1();
            });

            await waitFor(() => {
                expect(result.current.isProcessing).toBe(true);
            });

            rerender();
            render(result.current.additionalControl);
            props = MockedRewriteMenu.mock.calls[MockedRewriteMenu.mock.calls.length - 1][0];
            const actionHandler2 = props.onMenuAction(RewriteAction.ELABORATE);

            act(() => {
                actionHandler2();
            });

            expect(rewritePromise).toHaveBeenCalledTimes(1);
        });

        it('should not rewrite if editor is null', async () => {
            const {result} = renderHookWithProps(null);
            render(result.current.additionalControl);
            const props = MockedRewriteMenu.mock.calls[0][0];
            const actionHandler = props.onMenuAction(RewriteAction.SHORTEN);

            act(() => {
                actionHandler();
            });

            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(Client4.getAIRewrittenMessage).not.toHaveBeenCalled();
        });

        it('should not rewrite if selected text is empty', async () => {
            mockEditor.state!.doc.textBetween = jest.fn(() => '   ');

            const {result} = renderHookWithProps();
            render(result.current.additionalControl);
            const props = MockedRewriteMenu.mock.calls[0][0];
            const actionHandler = props.onMenuAction(RewriteAction.SHORTEN);

            act(() => {
                actionHandler();
            });

            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(Client4.getAIRewrittenMessage).not.toHaveBeenCalled();
        });

        it('should handle rewrite error', async () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            const error = new Error('Rewrite failed');
            (Client4.getAIRewrittenMessage as jest.Mock).mockRejectedValue(error);

            const {result} = renderHookWithProps();
            render(result.current.additionalControl);
            const props = MockedRewriteMenu.mock.calls[0][0];
            const actionHandler = props.onMenuAction(RewriteAction.SHORTEN);

            act(() => {
                actionHandler();
            });

            await waitFor(() => {
                expect(mockSetServerError).toHaveBeenCalledWith(error);
            });

            await waitFor(() => {
                expect(result.current.isProcessing).toBe(false);
            });

            consoleErrorSpy.mockRestore();
        });

        it('should ignore stale promise responses', async () => {
            const chainMock = jest.fn(() => ({
                focus: jest.fn().mockReturnThis(),
                setTextSelection: jest.fn().mockReturnThis(),
                insertContent: jest.fn().mockReturnThis(),
                run: jest.fn(),
            })) as any;
            mockEditor.chain = chainMock;

            const {result, rerender} = renderHookWithProps();

            let resolveFirst: (value: string) => void;
            const rewritePromise1 = new Promise<string>((resolve) => {
                resolveFirst = resolve;
            });

            const mockClient = Client4.getAIRewrittenMessage as jest.Mock;
            mockClient.mockClear();
            mockClient.mockImplementationOnce(() => rewritePromise1);
            mockClient.mockImplementationOnce(() => Promise.resolve('Second response'));

            render(result.current.additionalControl);
            let props = MockedRewriteMenu.mock.calls[MockedRewriteMenu.mock.calls.length - 1][0];
            const actionHandler1 = props.onMenuAction(RewriteAction.SHORTEN);

            act(() => {
                actionHandler1();
            });

            await waitFor(() => {
                expect(result.current.isProcessing).toBe(true);
            });

            rerender();
            render(result.current.additionalControl);
            props = MockedRewriteMenu.mock.calls[MockedRewriteMenu.mock.calls.length - 1][0];

            act(() => {
                props.onCancelProcessing();
            });

            await waitFor(() => {
                expect(result.current.isProcessing).toBe(false);
            });

            rerender();
            render(result.current.additionalControl);
            props = MockedRewriteMenu.mock.calls[MockedRewriteMenu.mock.calls.length - 1][0];
            const actionHandler2 = props.onMenuAction(RewriteAction.ELABORATE);

            act(() => {
                actionHandler2();
            });

            await waitFor(() => {
                expect(mockClient).toHaveBeenCalledTimes(2);
            });

            const callCountAfterSecond = chainMock.mock.calls.length;

            resolveFirst!('First response');
            await new Promise((resolve) => setTimeout(resolve, 200));

            expect(chainMock.mock.calls.length).toBe(callCountAfterSecond);
        });
    });

    describe('undoMessage', () => {
        it('should have onUndoMessage handler defined', () => {
            const {result} = renderHookWithProps();
            render(result.current.additionalControl);
            const props = MockedRewriteMenu.mock.calls[0][0];

            expect(props.onUndoMessage).toBeDefined();
            expect(typeof props.onUndoMessage).toBe('function');
        });

        it('should not crash if editor is null', () => {
            const {result} = renderHookWithProps(null);
            render(result.current.additionalControl);
            const props = MockedRewriteMenu.mock.calls[0][0];

            expect(() => props.onUndoMessage()).not.toThrow();
        });
    });

    describe('regenerateMessage', () => {
        it('should regenerate text with last action', async () => {
            const {result} = renderHookWithProps();
            render(result.current.additionalControl);
            let props = MockedRewriteMenu.mock.calls[MockedRewriteMenu.mock.calls.length - 1][0];
            const actionHandler = props.onMenuAction(RewriteAction.SHORTEN);

            act(() => {
                actionHandler();
            });

            await waitFor(() => {
                expect(result.current.isProcessing).toBe(false);
            });

            render(result.current.additionalControl);
            props = MockedRewriteMenu.mock.calls[MockedRewriteMenu.mock.calls.length - 1][0];
            const mockClient = Client4.getAIRewrittenMessage as jest.Mock;
            mockClient.mockResolvedValueOnce('Regenerated message');

            act(() => {
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
            render(result.current.additionalControl);
            let props = MockedRewriteMenu.mock.calls[MockedRewriteMenu.mock.calls.length - 1][0];

            act(() => {
                props.setPrompt('Custom prompt');
            });

            rerender();
            render(result.current.additionalControl);
            props = MockedRewriteMenu.mock.calls[MockedRewriteMenu.mock.calls.length - 1][0];
            const mockEvent = {
                key: 'Enter',
                stopPropagation: jest.fn(),
            } as unknown as React.KeyboardEvent<HTMLInputElement>;

            act(() => {
                props.onCustomPromptKeyDown(mockEvent);
            });

            await waitFor(() => {
                expect(result.current.isProcessing).toBe(false);
            });

            rerender();
            render(result.current.additionalControl);
            props = MockedRewriteMenu.mock.calls[MockedRewriteMenu.mock.calls.length - 1][0];
            const mockClient = Client4.getAIRewrittenMessage as jest.Mock;
            mockClient.mockResolvedValueOnce('Regenerated custom message');

            act(() => {
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
            const {result, rerender} = renderHookWithProps();
            const slowPromise = new Promise<string>((resolve) => {
                setTimeout(() => resolve('Slow response'), 1000);
            });
            (Client4.getAIRewrittenMessage as jest.Mock).mockReturnValue(slowPromise);

            render(result.current.additionalControl);
            let props = MockedRewriteMenu.mock.calls[MockedRewriteMenu.mock.calls.length - 1][0];
            const actionHandler = props.onMenuAction(RewriteAction.SHORTEN);

            act(() => {
                actionHandler();
            });

            await waitFor(() => {
                expect(result.current.isProcessing).toBe(true);
            });

            rerender();
            render(result.current.additionalControl);
            props = MockedRewriteMenu.mock.calls[MockedRewriteMenu.mock.calls.length - 1][0];

            act(() => {
                props.onCancelProcessing();
            });

            rerender();

            await waitFor(() => {
                expect(result.current.isProcessing).toBe(false);
            });
        });
    });

    describe('handleCustomPromptKeyDown', () => {
        it('should stop propagation for space key', () => {
            const {result} = renderHookWithProps();
            render(result.current.additionalControl);
            const props = MockedRewriteMenu.mock.calls[0][0];
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
            render(result.current.additionalControl);
            let props = MockedRewriteMenu.mock.calls[MockedRewriteMenu.mock.calls.length - 1][0];

            act(() => {
                props.setPrompt('Custom prompt');
            });

            rerender();
            render(result.current.additionalControl);
            props = MockedRewriteMenu.mock.calls[MockedRewriteMenu.mock.calls.length - 1][0];
            const mockEvent = {
                key: 'Enter',
                stopPropagation: jest.fn(),
            } as unknown as React.KeyboardEvent<HTMLInputElement>;

            act(() => {
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
            render(result.current.additionalControl);
            const props = MockedRewriteMenu.mock.calls[0][0];
            const actionHandler = props.onMenuAction(RewriteAction.IMPROVE_WRITING);

            act(() => {
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

        it('should handle all rewrite actions', async () => {
            const actions = [
                RewriteAction.IMPROVE_WRITING,
                RewriteAction.FIX_SPELLING,
                RewriteAction.SHORTEN,
                RewriteAction.ELABORATE,
                RewriteAction.SIMPLIFY,
                RewriteAction.SUMMARIZE,
            ];

            const testPromises = actions.map(async (action) => {
                const {result} = renderHookWithProps();
                (Client4.getAIRewrittenMessage as jest.Mock).mockClear();

                render(result.current.additionalControl);
                const props = MockedRewriteMenu.mock.calls[0][0];
                const actionHandler = props.onMenuAction(action);

                act(() => {
                    actionHandler();
                });

                await waitFor(() => {
                    expect(Client4.getAIRewrittenMessage).toHaveBeenCalledWith(
                        'agent1',
                        'Test message',
                        action,
                        undefined,
                    );
                });
            });

            await Promise.all(testPromises);
        });
    });
});
