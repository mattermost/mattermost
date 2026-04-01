// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import type {PostDraft} from 'types/store/draft';

import AIActionsMenu from './ai_actions_menu';
import {RewriteAction} from './rewrite_action';
import type {RewriteMenuProps} from './rewrite_menu';

jest.mock('./rewrite_menu', () => ({
    ...jest.requireActual('./rewrite_menu'),
    RewriteSubmenu: ({draftMessage}: any) => (
        draftMessage?.trim() ? <div data-testid='rewrite-submenu'>{'Rewrite Items'}</div> : null
    ),
    RewriteSubMenuHeader: () => (
        <div data-testid='rewrite-submenu-header'>{'Rewrite Header'}</div>
    ),
    RewriteSubMenuFooter: ({isProcessing, originalMessage, lastAction}: any) => (
        !isProcessing && originalMessage && lastAction ? <div data-testid='rewrite-submenu-footer'>{'Rewrite Footer'}</div> : null
    ),
}));

jest.mock('components/menu', () => ({
    ...jest.requireActual('components/menu'),
    Container: ({children, menuButton}: any) => (
        <div data-testid='ai-menu-container'>
            <div data-testid='ai-menu-button'>{menuButton.children}</div>
            <div data-testid='ai-menu-items'>{children}</div>
        </div>
    ),
    Item: ({labels, onClick, leadingElement, trailingElements}: any) => (
        <button
            data-testid='ai-menu-item'
            onClick={onClick}
        >
            {leadingElement}
            {labels}
            {trailingElements}
        </button>
    ),
    Separator: () => <hr data-testid='ai-menu-separator'/>,
}));

const mockDraft: PostDraft = {
    message: 'Test message',
    fileInfos: [],
    uploadsInProgress: [],
    createAt: 0,
    updateAt: 0,
    channelId: 'channel1',
    rootId: '',
    metadata: {},
};

const baseProps = {
    draft: mockDraft,
    getSelectedText: jest.fn(() => ({start: 0, end: 0})),
    updateText: jest.fn(),
    channelId: 'channel1',
};

const mockRewriteMenuProps: RewriteMenuProps = {
    isProcessing: false,
    isMenuOpen: false,
    setIsMenuOpen: jest.fn(),
    draftMessage: 'Test message',
    prompt: '',
    setPrompt: jest.fn(),
    selectedAgentId: 'agent1',
    setSelectedAgentId: jest.fn(),
    agents: [],
    originalMessage: '',
    lastAction: RewriteAction.CUSTOM,
    onMenuAction: jest.fn(() => () => {}),
    onCustomPromptKeyDown: jest.fn(),
    onCancelProcessing: jest.fn(),
    onUndoMessage: jest.fn(),
    onRegenerateMessage: jest.fn(),
    customPromptRef: React.createRef<HTMLInputElement>(),
};

describe('AIActionsMenu', () => {
    test('should not render when there are no plugin items and rewrite is disabled', () => {
        const {container} = renderWithContext(
            <AIActionsMenu
                {...baseProps}
                aiRewriteEnabled={false}
            />,
            {
                entities: {
                    general: {config: {}},
                    preferences: {myPreferences: {}},
                    users: {currentUserId: 'user1'},
                },
                plugins: {
                    components: {
                        AIActionMenuItem: [],
                    },
                },
            } as any,
        );
        expect(container.innerHTML).toBe('');
    });

    test('should render menu with rewrite item when rewrite is enabled', () => {
        const {container} = renderWithContext(
            <AIActionsMenu
                {...baseProps}
                aiRewriteEnabled={true}
                rewriteMenuProps={mockRewriteMenuProps}
            />,
            {
                entities: {
                    general: {config: {}},
                    preferences: {myPreferences: {}},
                    users: {currentUserId: 'user1'},
                },
                plugins: {
                    components: {
                        AIActionMenuItem: [],
                    },
                },
            } as any,
        );

        expect(container.innerHTML).not.toBe('');
        expect(screen.getByText('Rewrite')).toBeInTheDocument();
    });

    test('should render plugin items from Redux store', () => {
        const MockPluginComponent = () => <div data-testid='plugin-component'>{'Plugin Content'}</div>;

        renderWithContext(
            <AIActionsMenu
                {...baseProps}
                aiRewriteEnabled={false}
            />,
            {
                entities: {
                    general: {config: {}},
                    preferences: {myPreferences: {}},
                    users: {currentUserId: 'user1'},
                },
                plugins: {
                    components: {
                        AIActionMenuItem: [
                            {
                                id: 'plugin1',
                                pluginId: 'test-plugin',
                                component: MockPluginComponent,
                                icon: <span>{'icon'}</span>,
                                text: 'Test Action',
                                sortOrder: 1,
                            },
                        ],
                    },
                },
            } as any,
        );
        expect(screen.getByText('Test Action')).toBeInTheDocument();
    });

    test('should render plugin items sorted by sortOrder', () => {
        const MockComponent1 = () => <div>{'First'}</div>;
        const MockComponent2 = () => <div>{'Second'}</div>;

        renderWithContext(
            <AIActionsMenu
                {...baseProps}
                aiRewriteEnabled={false}
            />,
            {
                entities: {
                    general: {config: {}},
                    preferences: {myPreferences: {}},
                    users: {currentUserId: 'user1'},
                },
                plugins: {
                    components: {
                        AIActionMenuItem: [
                            {
                                id: 'plugin2',
                                pluginId: 'test-plugin',
                                component: MockComponent2,
                                icon: <span>{'icon2'}</span>,
                                text: 'Second Action',
                                sortOrder: 20,
                            },
                            {
                                id: 'plugin1',
                                pluginId: 'test-plugin',
                                component: MockComponent1,
                                icon: <span>{'icon1'}</span>,
                                text: 'First Action',
                                sortOrder: 10,
                            },
                        ],
                    },
                },
            } as any,
        );
        const items = screen.getAllByTestId('ai-menu-item');
        expect(items[0]).toHaveTextContent('First Action');
        expect(items[1]).toHaveTextContent('Second Action');
    });

    test('should render separator between plugin items and rewrite when both are present', () => {
        const MockComponent = () => <div>{'Plugin'}</div>;

        renderWithContext(
            <AIActionsMenu
                {...baseProps}
                aiRewriteEnabled={true}
                rewriteMenuProps={mockRewriteMenuProps}
            />,
            {
                entities: {
                    general: {config: {}},
                    preferences: {myPreferences: {}},
                    users: {currentUserId: 'user1'},
                },
                plugins: {
                    components: {
                        AIActionMenuItem: [
                            {
                                id: 'plugin1',
                                pluginId: 'test-plugin',
                                component: MockComponent,
                                icon: <span>{'icon'}</span>,
                                text: 'Plugin Action',
                                sortOrder: 1,
                            },
                        ],
                    },
                },
            } as any,
        );
        expect(screen.getByTestId('ai-menu-separator')).toBeInTheDocument();
    });

    test('should not render separator when only rewrite items are present', () => {
        renderWithContext(
            <AIActionsMenu
                {...baseProps}
                aiRewriteEnabled={true}
                rewriteMenuProps={mockRewriteMenuProps}
            />,
            {
                entities: {
                    general: {config: {}},
                    preferences: {myPreferences: {}},
                    users: {currentUserId: 'user1'},
                },
                plugins: {
                    components: {
                        AIActionMenuItem: [],
                    },
                },
            } as any,
        );
        expect(screen.queryByTestId('ai-menu-separator')).not.toBeInTheDocument();
    });

    test('should render menu with both plugin items and rewrite when both present', () => {
        const MockComponent = () => <div>{'Plugin Content'}</div>;

        renderWithContext(
            <AIActionsMenu
                {...baseProps}
                aiRewriteEnabled={true}
                rewriteMenuProps={mockRewriteMenuProps}
            />,
            {
                entities: {
                    general: {config: {}},
                    preferences: {myPreferences: {}},
                    users: {currentUserId: 'user1'},
                },
                plugins: {
                    components: {
                        AIActionMenuItem: [
                            {
                                id: 'plugin1',
                                pluginId: 'test-plugin',
                                component: MockComponent,
                                icon: <span>{'icon'}</span>,
                                text: 'Custom Action',
                                sortOrder: 1,
                            },
                        ],
                    },
                },
            } as any,
        );

        expect(screen.getByText('Custom Action')).toBeInTheDocument();
        expect(screen.getByText('Rewrite')).toBeInTheDocument();
    });
});
