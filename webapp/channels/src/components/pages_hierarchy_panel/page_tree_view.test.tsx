// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ZERO MOCKS - Uses real child components and real API data

import React from 'react';

import {Client4} from 'mattermost-redux/client';

import {setupWikiTestContext, createTestPage, type WikiTestContext} from 'tests/api_test_helpers';
import {renderWithContext, screen} from 'tests/react_testing_utils';

import PageTreeView from './page_tree_view';
import {buildTree} from './utils/tree_builder';

describe('components/pages_hierarchy_panel/PageTreeView', () => {
    let testContext: WikiTestContext;

    beforeAll(async () => {
        testContext = await setupWikiTestContext();

        // Create test pages with hierarchy
        const rootPage1Id = await createTestPage(testContext.wikiId, 'Root Page 1');
        const rootPage2Id = await createTestPage(testContext.wikiId, 'Root Page 2');
        const childPageId = await createTestPage(testContext.wikiId, 'Child Page', rootPage1Id);

        testContext.pageIds.push(rootPage1Id, rootPage2Id, childPageId);
    }, 30000);

    afterAll(async () => {
        await testContext.cleanup();
    }, 30000);

    const getBaseProps = async () => {
        const pages = await Client4.getPages(testContext.wikiId);
        const tree = buildTree(pages);

        return {
            tree,
            expandedNodes: {},
            selectedPageId: null,
            onNodeSelect: jest.fn(),
            onToggleExpand: jest.fn(),
        };
    };

    const getInitialState = () => ({
        entities: {
            teams: {
                currentTeamId: testContext?.team?.id || 'team-1',
                teams: {
                    [testContext?.team?.id || 'team-1']: testContext?.team || {
                        id: 'team-1',
                        name: 'test-team',
                    },
                },
            },
            users: {
                currentUserId: testContext?.user?.id || 'user-1',
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
        test('should render tree with nodes', async () => {
            const baseProps = await getBaseProps();
            renderWithContext(<PageTreeView {...baseProps}/>, getInitialState());

            expect(screen.getByText('Root Page 1')).toBeInTheDocument();
            expect(screen.getByText('Root Page 2')).toBeInTheDocument();
        });

        test('should render empty state when no nodes', async () => {
            const baseProps = await getBaseProps();
            const props = {...baseProps, tree: []};
            renderWithContext(<PageTreeView {...props}/>, getInitialState());

            expect(screen.getByText('No pages found')).toBeInTheDocument();
        });

        test('should show root nodes when nothing is expanded', async () => {
            const baseProps = await getBaseProps();
            renderWithContext(<PageTreeView {...baseProps}/>, getInitialState());

            expect(screen.getByText('Root Page 1')).toBeInTheDocument();
            expect(screen.getByText('Root Page 2')).toBeInTheDocument();
        });

        test('should render selected page', async () => {
            const baseProps = await getBaseProps();
            const props = {
                ...baseProps,
                selectedPageId: testContext.pageIds[0],
            };
            const {container} = renderWithContext(<PageTreeView {...props}/>, getInitialState());

            expect(container.querySelector('.PageTreeNode--selected')).toBeInTheDocument();
        });
    });

    describe('Node Selection', () => {
        test('should call onNodeSelect when node is clicked', async () => {
            const user = (await import('@testing-library/user-event')).default.setup();
            const baseProps = await getBaseProps();
            renderWithContext(<PageTreeView {...baseProps}/>, getInitialState());

            const titleButtons = screen.getAllByTestId('page-tree-node-title');
            await user.click(titleButtons[0]);

            expect(baseProps.onNodeSelect).toHaveBeenCalledTimes(1);
            const calledPageId = baseProps.onNodeSelect.mock.calls[0][0];
            expect(testContext.pageIds).toContain(calledPageId);
        });
    });

    describe('Node Expansion', () => {
        test('should show child nodes when parent is expanded', async () => {
            const baseProps = await getBaseProps();
            const props = {
                ...baseProps,
                expandedNodes: {[testContext.pageIds[0]]: true},
            };
            renderWithContext(<PageTreeView {...props}/>, getInitialState());

            expect(screen.getByText('Child Page')).toBeInTheDocument();
        });
    });

    describe('Performance', () => {
        test('should update visible nodes when expandedNodes changes', async () => {
            const baseProps = await getBaseProps();
            const {rerender} = renderWithContext(<PageTreeView {...baseProps}/>, getInitialState());

            expect(screen.queryByText('Child Page')).not.toBeInTheDocument();

            const propsWithExpanded = {
                ...baseProps,
                expandedNodes: {[testContext.pageIds[0]]: true},
            };
            rerender(<PageTreeView {...propsWithExpanded}/>);

            expect(screen.getByText('Child Page')).toBeInTheDocument();
        });
    });

    describe('Edge Cases', () => {
        test('should handle empty tree gracefully', async () => {
            const baseProps = await getBaseProps();
            const props = {...baseProps, tree: []};
            renderWithContext(<PageTreeView {...props}/>, getInitialState());

            expect(screen.getByText('No pages found')).toBeInTheDocument();
        });
    });
});
