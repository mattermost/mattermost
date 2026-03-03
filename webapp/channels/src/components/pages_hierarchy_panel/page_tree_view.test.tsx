// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Post} from '@mattermost/types/posts';

import {PostTypes} from 'mattermost-redux/constants/posts';

import {buildTree} from 'selectors/pages_hierarchy';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import PageTreeView from './page_tree_view';

describe('components/pages_hierarchy_panel/PageTreeView', () => {
    const mockTeamId = 'team-id-1';
    const mockUserId = 'user-id-1';
    const mockChannelId = 'channel-id-1';
    const mockWikiId = 'wiki-id-1';
    const rootPage1Id = 'root-page-1';
    const rootPage2Id = 'root-page-2';
    const childPageId = 'child-page-1';

    const createMockPage = (id: string, title: string, parentId?: string): Post => ({
        id,
        type: PostTypes.PAGE,
        channel_id: mockChannelId,
        user_id: mockUserId,
        page_parent_id: parentId || '',
        props: {
            title,
            wiki_id: mockWikiId,
        },
        create_at: Date.now(),
        update_at: Date.now(),
        delete_at: 0,
        edit_at: 0,
        is_pinned: false,
        root_id: '',
        original_id: '',
        message: '',
        hashtags: '',
        file_ids: [],
        pending_post_id: '',
        reply_count: 0,
        metadata: {
            embeds: [],
            emojis: [],
            files: [],
            images: {},
        },
    });

    const mockPages: Post[] = [
        createMockPage(rootPage1Id, 'Root Page 1'),
        createMockPage(rootPage2Id, 'Root Page 2'),
        createMockPage(childPageId, 'Child Page', rootPage1Id),
    ];

    const getBaseProps = () => {
        const tree = buildTree(mockPages);

        return {
            tree,
            expandedNodes: {},
            currentPageId: undefined,
            onNodeSelect: jest.fn(),
            onToggleExpand: jest.fn(),
        };
    };

    const getInitialState = () => ({
        entities: {
            teams: {
                currentTeamId: mockTeamId,
                teams: {
                    [mockTeamId]: {
                        id: mockTeamId,
                        name: 'test-team',
                    },
                },
            },
            users: {
                currentUserId: mockUserId,
            },
        },
        views: {
            pagesHierarchy: {
                outlineExpandedNodes: {},
                outlineCache: {},
            },
        },
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Rendering', () => {
        test('should render tree with nodes', () => {
            const baseProps = getBaseProps();
            renderWithContext(<PageTreeView {...baseProps}/>, getInitialState());

            expect(screen.getByText('Root Page 1')).toBeInTheDocument();
            expect(screen.getByText('Root Page 2')).toBeInTheDocument();
        });

        test('should render empty state when no nodes', () => {
            const baseProps = getBaseProps();
            const props = {...baseProps, tree: []};
            renderWithContext(<PageTreeView {...props}/>, getInitialState());

            expect(screen.getByText('No pages found')).toBeInTheDocument();
        });

        test('should show root nodes when nothing is expanded', () => {
            const baseProps = getBaseProps();
            renderWithContext(<PageTreeView {...baseProps}/>, getInitialState());

            expect(screen.getByText('Root Page 1')).toBeInTheDocument();
            expect(screen.getByText('Root Page 2')).toBeInTheDocument();
        });

        test('should render selected page', () => {
            const baseProps = getBaseProps();
            const props = {
                ...baseProps,
                currentPageId: rootPage1Id,
            };
            const {container} = renderWithContext(<PageTreeView {...props}/>, getInitialState());

            expect(container.querySelector('.PageTreeNode--selected')).toBeInTheDocument();
        });
    });

    describe('Node Selection', () => {
        test('should call onNodeSelect when node is clicked', async () => {
            const user = (await import('@testing-library/user-event')).default.setup();
            const baseProps = getBaseProps();
            renderWithContext(<PageTreeView {...baseProps}/>, getInitialState());

            const titleButtons = screen.getAllByTestId('page-tree-node-title');
            await user.click(titleButtons[0]);

            expect(baseProps.onNodeSelect).toHaveBeenCalledTimes(1);
            const calledPageId = baseProps.onNodeSelect.mock.calls[0][0];
            expect([rootPage1Id, rootPage2Id, childPageId]).toContain(calledPageId);
        });
    });

    describe('Node Expansion', () => {
        test('should show child nodes when parent is expanded', () => {
            const baseProps = getBaseProps();
            const props = {
                ...baseProps,
                expandedNodes: {[rootPage1Id]: true},
            };
            renderWithContext(<PageTreeView {...props}/>, getInitialState());

            expect(screen.getByText('Child Page')).toBeInTheDocument();
        });
    });

    describe('Performance', () => {
        test('should render tree when props change', () => {
            const baseProps = getBaseProps();
            const {rerender} = renderWithContext(<PageTreeView {...baseProps}/>, getInitialState());

            expect(screen.getByText('Root Page 1')).toBeInTheDocument();

            const propsWithExpanded = {
                ...baseProps,
                expandedNodes: {[rootPage1Id]: true},
            };
            rerender(<PageTreeView {...propsWithExpanded}/>);

            expect(screen.getByText('Root Page 1')).toBeInTheDocument();
        });
    });

    describe('Edge Cases', () => {
        test('should handle empty tree gracefully', () => {
            const baseProps = getBaseProps();
            const props = {...baseProps, tree: []};
            renderWithContext(<PageTreeView {...props}/>, getInitialState());

            expect(screen.getByText('No pages found')).toBeInTheDocument();
        });
    });
});
