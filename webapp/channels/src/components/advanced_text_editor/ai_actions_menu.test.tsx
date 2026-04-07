// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent} from '@testing-library/react';
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

jest.mock('components/menu', () => {
    const react = jest.requireActual('react');
    return {
        ...jest.requireActual('components/menu'),
        Container: ({children, menuButton, menu}: any) => {
            react.useEffect(() => {
                menu?.onToggle?.(true);
            }, []); // eslint-disable-line react-hooks/exhaustive-deps
            return (
                <div>
                    <div>{menuButton.children}</div>
                    <ul role='menu'>{children}</ul>
                </div>
            );
        },
        Item: ({labels, onClick, leadingElement, trailingElements, onMouseEnter, onKeyDown, ...rest}: any) => (
            <li
                role='menuitem'
                onClick={onClick}
                onMouseEnter={onMouseEnter}
                onKeyDown={onKeyDown}
                aria-haspopup={rest['aria-haspopup']}
                aria-expanded={rest['aria-expanded']}
            >
                {leadingElement}
                {labels}
                {trailingElements}
            </li>
        ),
        Separator: () => <li role='separator'/>,
    };
});

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

function getBaseProps() {
    return {
        draft: mockDraft,
        getSelectedText: jest.fn(() => ({start: 0, end: 0})),
        updateText: jest.fn(),
        channelId: 'channel1',
        isRHS: false,
    };
}

function getRewriteMenuProps(): RewriteMenuProps {
    return {
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
}

describe('AIActionsMenu', () => {
    test('should not render when there are no plugin items and rewrite is disabled', () => {
        const {container} = renderWithContext(
            <AIActionsMenu
                {...getBaseProps()}
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
        renderWithContext(
            <AIActionsMenu
                {...getBaseProps()}
                aiRewriteEnabled={true}
                rewriteMenuProps={getRewriteMenuProps()}
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

        expect(screen.getByText('Rewrite')).toBeInTheDocument();
    });

    test('should render plugin items from Redux store', () => {
        const MockPluginComponent = () => <div data-testid='plugin-component'>{'Plugin Content'}</div>;

        renderWithContext(
            <AIActionsMenu
                {...getBaseProps()}
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
                {...getBaseProps()}
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
        const items = screen.getAllByRole('menuitem');
        expect(items[0]).toHaveTextContent('First Action');
        expect(items[1]).toHaveTextContent('Second Action');
    });

    test('should render separator between plugin items and rewrite when both are present', () => {
        const MockComponent = () => <div>{'Plugin'}</div>;

        renderWithContext(
            <AIActionsMenu
                {...getBaseProps()}
                aiRewriteEnabled={true}
                rewriteMenuProps={getRewriteMenuProps()}
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
        expect(screen.getByRole('separator')).toBeInTheDocument();
        expect(screen.getByText('Plugin Action')).toBeInTheDocument();
        expect(screen.getByText('Rewrite')).toBeInTheDocument();
    });

    test('should not render separator when only rewrite items are present', () => {
        renderWithContext(
            <AIActionsMenu
                {...getBaseProps()}
                aiRewriteEnabled={true}
                rewriteMenuProps={getRewriteMenuProps()}
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
        expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    });

    test('should call action with correct props when action item is clicked', () => {
        const mockAction = jest.fn();
        const baseProps = getBaseProps();

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
                                id: 'action1',
                                pluginId: 'test-plugin',
                                action: mockAction,
                                icon: <span>{'icon'}</span>,
                                text: 'Quick Action',
                                sortOrder: 1,
                            },
                        ],
                    },
                },
            } as any,
        );

        fireEvent.click(screen.getByText('Quick Action'));

        expect(mockAction).toHaveBeenCalledTimes(1);
        expect(mockAction).toHaveBeenCalledWith({
            draft: baseProps.draft,
            getSelectedText: baseProps.getSelectedText,
            updateText: baseProps.updateText,
            channelId: baseProps.channelId,
            isRHS: baseProps.isRHS,
        });
    });

    test('should render chevron for component items but not for action items', () => {
        const MockComponent = () => <div>{'Plugin'}</div>;

        renderWithContext(
            <AIActionsMenu
                {...getBaseProps()}
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
                                id: 'submenu1',
                                pluginId: 'test-plugin',
                                component: MockComponent,
                                icon: <span>{'icon1'}</span>,
                                text: 'Submenu Item',
                                sortOrder: 1,
                            },
                            {
                                id: 'action1',
                                pluginId: 'test-plugin',
                                action: jest.fn(),
                                icon: <span>{'icon2'}</span>,
                                text: 'Action Item',
                                sortOrder: 2,
                            },
                        ],
                    },
                },
            } as any,
        );

        const submenuItem = screen.getByText('Submenu Item').closest('li')!;
        const actionItem = screen.getByText('Action Item').closest('li')!;

        expect(submenuItem).toHaveAttribute('aria-haspopup', 'menu');
        expect(actionItem).not.toHaveAttribute('aria-haspopup');
    });

    test('should render plugin component in submenu on hover with correct props including isRHS', () => {
        let receivedProps: any = null;
        const MockPluginComponent = (props: any) => {
            receivedProps = props;
            return <div data-testid='plugin-submenu'>{'Plugin Content'}</div>;
        };

        renderWithContext(
            <AIActionsMenu
                {...getBaseProps()}
                isRHS={true}
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
                                text: 'Hover Me',
                                sortOrder: 1,
                            },
                        ],
                    },
                },
            } as any,
        );

        fireEvent.mouseEnter(screen.getByText('Hover Me').closest('li')!);

        expect(screen.getByTestId('plugin-submenu')).toBeInTheDocument();
        expect(receivedProps).not.toBeNull();
        expect(receivedProps.isRHS).toBe(true);
        expect(receivedProps.channelId).toBe('channel1');
        expect(receivedProps.draft).toBeDefined();
        expect(receivedProps.getSelectedText).toBeDefined();
        expect(receivedProps.updateText).toBeDefined();
    });
});
