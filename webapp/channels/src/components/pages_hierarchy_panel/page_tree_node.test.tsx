// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {PostTypes} from 'mattermost-redux/constants/posts';

import {renderWithContext} from 'tests/react_testing_utils';
import {PageDisplayTypes} from 'utils/constants';

import type {GlobalState} from 'types/store';

import PageTreeNode from './page_tree_node';
import type {FlatNode} from './utils/tree_flattener';

describe('components/pages_hierarchy_panel/PageTreeNode', () => {
    const mockNode: FlatNode = {
        id: 'page-1',
        title: 'Test Page',
        depth: 0,
        hasChildren: false,
        isExpanded: false,
        parentId: null,
        children: [],
        page: {
            id: 'page-1',
            create_at: 1000,
            update_at: 1000,
            delete_at: 0,
            edit_at: 0,
            is_pinned: false,
            user_id: 'user-1',
            channel_id: 'wiki-1',
            root_id: '',
            original_id: '',
            message: 'Test content',
            type: PostTypes.PAGE,
            page_parent_id: '',
            props: {title: 'Test Page'},
            hashtags: '',
            pending_post_id: '',
            reply_count: 0,
            metadata: {
                embeds: [],
                emojis: [],
                files: [],
                images: {},
            },
        },
    };

    const baseProps = {
        node: mockNode,
        isSelected: false,
        onSelect: jest.fn(),
        onToggleExpand: jest.fn(),
    };

    const initialState: DeepPartial<GlobalState> = {
        entities: {
            users: {
                currentUserId: 'user-1',
            },
            teams: {
                currentTeamId: 'team-1',
                teams: {
                    'team-1': {
                        id: 'team-1',
                        name: 'test-team',
                        display_name: 'Test Team',
                        delete_at: 0,
                        create_at: 0,
                        update_at: 0,
                        type: 'O',
                        company_name: '',
                        allowed_domains: '',
                        invite_id: '',
                        allow_open_invite: false,
                        scheme_id: '',
                        group_constrained: false,
                        policy_id: '',
                        description: '',
                        email: '',
                    },
                },
            },
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Rendering', () => {
        test('should render with required props', () => {
            renderWithContext(<PageTreeNode {...baseProps}/>, initialState);

            expect(screen.getByText('Test Page')).toBeInTheDocument();
        });

        test('should apply selected class when isSelected is true', () => {
            const props = {...baseProps, isSelected: true};
            const {container} = renderWithContext(<PageTreeNode {...props}/>, initialState);

            expect(container.querySelector('.PageTreeNode--selected')).toBeInTheDocument();
        });

        test('should apply loading class when isRenaming is true', () => {
            const props = {...baseProps, isRenaming: true};
            const {container} = renderWithContext(<PageTreeNode {...props}/>, initialState);

            expect(container.querySelector('.PageTreeNode--loading')).toBeInTheDocument();
        });

        test('should apply loading class when isDeleting is true', () => {
            const props = {...baseProps, isDeleting: true};
            const {container} = renderWithContext(<PageTreeNode {...props}/>, initialState);

            expect(container.querySelector('.PageTreeNode--loading')).toBeInTheDocument();
        });

        test('should show loading spinner when loading', () => {
            const props = {...baseProps, isRenaming: true};
            const {container} = renderWithContext(<PageTreeNode {...props}/>, initialState);

            expect(container.querySelector('.icon-loading')).toBeInTheDocument();
            expect(container.querySelector('.icon-spin')).toBeInTheDocument();
        });

        test('should apply correct indentation based on depth', () => {
            const node = {...mockNode, depth: 2};
            const props = {...baseProps, node};
            const {container} = renderWithContext(<PageTreeNode {...props}/>, initialState);

            const pageTreeNode = container.querySelector('.PageTreeNode');
            expect(pageTreeNode).toHaveStyle({paddingLeft: '48px'}); // (2 * 20) + 8
        });

        test('should render draft badge for draft pages', () => {
            const draftNode: FlatNode = {
                ...mockNode,
                page: {
                    ...mockNode.page,
                    type: PageDisplayTypes.PAGE_DRAFT,
                    page_parent_id: '',
                },
            };
            const props = {...baseProps, node: draftNode};
            renderWithContext(<PageTreeNode {...props}/>, initialState);

            expect(screen.getByText('Draft')).toBeInTheDocument();
        });

        test('should not render draft badge for published pages', () => {
            renderWithContext(<PageTreeNode {...baseProps}/>, initialState);

            expect(screen.queryByText('Draft')).not.toBeInTheDocument();
        });
    });

    describe('Page Icon Button', () => {
        test('should not show expand/collapse icon for leaf nodes', () => {
            const {container} = renderWithContext(<PageTreeNode {...baseProps}/>, initialState);

            expect(container.querySelector('.icon-chevron-right')).not.toBeInTheDocument();
            expect(container.querySelector('.icon-chevron-down')).not.toBeInTheDocument();
        });

        test('should be disabled when loading', () => {
            const props = {...baseProps, isRenaming: true};
            const {container} = renderWithContext(<PageTreeNode {...props}/>, initialState);

            const iconButton = container.querySelector('.PageTreeNode__iconButton');
            expect(iconButton).not.toBeInTheDocument();
        });
    });

    describe('Title Button', () => {
        test('should call onSelect when title button is clicked', async () => {
            const user = userEvent.setup();
            renderWithContext(<PageTreeNode {...baseProps}/>, initialState);

            await user.click(screen.getByRole('button', {name: /test page/i}));

            expect(baseProps.onSelect).toHaveBeenCalled();
        });

        test('should be disabled when loading', () => {
            const props = {...baseProps, isRenaming: true};
            renderWithContext(<PageTreeNode {...props}/>, initialState);

            const titleButton = screen.getByRole('button', {name: /test page/i});
            expect(titleButton).toBeDisabled();
        });

        test('should not call onSelect when disabled', async () => {
            const user = userEvent.setup();
            const props = {...baseProps, isDeleting: true};
            renderWithContext(<PageTreeNode {...props}/>, initialState);

            const titleButton = screen.getByRole('button', {name: /test page/i});
            await user.click(titleButton);

            expect(baseProps.onSelect).not.toHaveBeenCalled();
        });
    });

    describe('Accessibility', () => {
        test('should have correct aria-label for expand button', () => {
            const node = {...mockNode, hasChildren: true, isExpanded: false};
            const props = {...baseProps, node};
            renderWithContext(<PageTreeNode {...props}/>, initialState);

            expect(screen.getByLabelText('Expand')).toBeInTheDocument();
        });

        test('should have correct aria-label for collapse button', () => {
            const node = {...mockNode, hasChildren: true, isExpanded: true};
            const props = {...baseProps, node};
            renderWithContext(<PageTreeNode {...props}/>, initialState);

            expect(screen.getByLabelText('Collapse')).toBeInTheDocument();
        });

        test('should have correct aria-label for select button on leaf node', () => {
            renderWithContext(<PageTreeNode {...baseProps}/>, initialState);

            expect(screen.getByLabelText('Select page')).toBeInTheDocument();
        });

        test('should have aria-label for menu button', () => {
            renderWithContext(<PageTreeNode {...baseProps}/>, initialState);

            expect(screen.getByLabelText('Page menu')).toBeInTheDocument();
        });
    });

    describe('Draft Pages', () => {
        test('should identify draft page correctly in context menu', async () => {
            const user = userEvent.setup();
            const draftNode: FlatNode = {
                ...mockNode,
                page: {
                    ...mockNode.page,
                    type: PageDisplayTypes.PAGE_DRAFT,
                    page_parent_id: '',
                },
            };
            const props = {...baseProps, node: draftNode};
            renderWithContext(<PageTreeNode {...props}/>, initialState);

            await user.click(screen.getByLabelText('Page menu'));

            expect(screen.getByText('Delete draft')).toBeInTheDocument();
        });

        test('should show draft badge for draft pages', () => {
            const draftNode: FlatNode = {
                ...mockNode,
                page: {
                    ...mockNode.page,
                    type: PageDisplayTypes.PAGE_DRAFT,
                    page_parent_id: '',
                },
            };
            const props = {...baseProps, node: draftNode};
            renderWithContext(<PageTreeNode {...props}/>, initialState);

            expect(screen.getByText('Draft')).toBeInTheDocument();
        });
    });

    describe('Edge Cases', () => {
        test('should handle node at maximum depth', () => {
            const deepNode = {...mockNode, depth: 10};
            const props = {...baseProps, node: deepNode};
            const {container} = renderWithContext(<PageTreeNode {...props}/>, initialState);

            const pageTreeNode = container.querySelector('.PageTreeNode');
            expect(pageTreeNode).toHaveStyle({paddingLeft: '208px'}); // (10 * 20) + 8
        });

        test('should reduce opacity when loading', () => {
            const props = {...baseProps, isRenaming: true};
            const {container} = renderWithContext(<PageTreeNode {...props}/>, initialState);

            const pageTreeNode = container.querySelector('.PageTreeNode');
            expect(pageTreeNode).toHaveStyle({opacity: 0.6});
        });

        test('should have full opacity when not loading', () => {
            const {container} = renderWithContext(<PageTreeNode {...baseProps}/>, initialState);

            const pageTreeNode = container.querySelector('.PageTreeNode');
            expect(pageTreeNode).toHaveStyle({opacity: 1});
        });
    });
});
