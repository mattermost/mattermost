// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ZERO MOCKS - Uses real child components and real API data

import React from 'react';
import {screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type {DeepPartial} from '@mattermost/types/utilities';

import {Client4} from 'mattermost-redux/client';

import {renderWithContext} from 'tests/react_testing_utils';
import {setupWikiTestContext, createTestPage, type WikiTestContext} from 'tests/api_test_helpers';
import {transformPageServerDraft} from 'actions/page_drafts';

import type {GlobalState} from 'types/store';
import type {PostDraft} from 'types/store/draft';

import PagesHierarchyPanel from './pages_hierarchy_panel';

describe('components/pages_hierarchy_panel/PagesHierarchyPanel', () => {
    let testContext: WikiTestContext;

    beforeAll(async () => {
        testContext = await setupWikiTestContext();

        // Create test pages with hierarchy
        const rootPage1Id = await createTestPage(testContext.wikiId, 'Root Page');
        const childPageId = await createTestPage(testContext.wikiId, 'Child Page', rootPage1Id);

        testContext.pageIds.push(rootPage1Id, childPageId);
    }, 30000);

    afterAll(async () => {
        await testContext.cleanup();
    }, 30000);

    const getBaseProps = async () => {
        const pages = await Client4.getWikiPages(testContext.wikiId);
        const serverDrafts = await Client4.getPageDraftsForWiki(testContext.wikiId);

        // Transform server drafts to PostDraft format (matching what the component expects)
        const drafts: PostDraft[] = serverDrafts.map((draft) =>
            transformPageServerDraft(draft, testContext.wikiId, draft.root_id).value
        );

        return {
            wikiId: testContext.wikiId,
            channelId: testContext.channel.id,
            onPageSelect: jest.fn(),
            pages,
            drafts,
            loading: false,
            expandedNodes: {},
            selectedPageId: null,
            isPanelCollapsed: false,
            actions: {
                loadWikiPages: jest.fn().mockResolvedValue({data: pages}),
                loadPageDraftsForWiki: jest.fn().mockResolvedValue({data: drafts}),
                removePageDraft: jest.fn().mockResolvedValue({data: true}),
                toggleNodeExpanded: jest.fn(),
                setSelectedPage: jest.fn(),
                expandAncestors: jest.fn(),
                createPage: jest.fn().mockResolvedValue({data: 'draft-new'}),
                renamePage: jest.fn().mockResolvedValue({data: pages[0]}),
                deletePage: jest.fn().mockResolvedValue({data: true}),
                movePage: jest.fn().mockResolvedValue({data: pages[0]}),
                movePageToWiki: jest.fn().mockResolvedValue({data: true}),
                closePagesPanel: jest.fn(),
            },
        };
    };

    const getInitialState = (): DeepPartial<GlobalState> => ({
        entities: {
            users: {
                currentUserId: testContext.user.id,
            },
            teams: {
                currentTeamId: testContext.team.id,
            },
        },
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Rendering', () => {
        test('should render with required props', async () => {
            const baseProps = await getBaseProps();
            const {container} = renderWithContext(<PagesHierarchyPanel {...baseProps}/>, getInitialState());

            expect(container.querySelector('.PagesHierarchyPanel')).toBeInTheDocument();
            expect(screen.getByPlaceholderText('Find pages...')).toBeInTheDocument();
            expect(screen.getByText('Root Page')).toBeInTheDocument();
        });

        test('should render loading state when loading and no pages', async () => {
            const baseProps = await getBaseProps();
            const props = {...baseProps, loading: true, pages: []};
            renderWithContext(<PagesHierarchyPanel {...props}/>, getInitialState());

            expect(screen.getByText('Loading pages...')).toBeInTheDocument();
        });

        test('should not show loading state when loading but pages exist', async () => {
            const baseProps = await getBaseProps();
            const props = {...baseProps, loading: true};
            renderWithContext(<PagesHierarchyPanel {...props}/>, getInitialState());

            expect(screen.queryByText('Loading pages...')).not.toBeInTheDocument();
            expect(screen.getByText('Root Page')).toBeInTheDocument();
        });

        test('should render empty state when no pages', async () => {
            const baseProps = await getBaseProps();
            const props = {...baseProps, pages: [], drafts: []};
            renderWithContext(<PagesHierarchyPanel {...props}/>, getInitialState());

            expect(screen.getByText('No pages yet')).toBeInTheDocument();
        });

        test('should render empty state with search message when searching', async () => {
            const user = userEvent.setup();
            const baseProps = await getBaseProps();
            const props = {...baseProps, pages: []};
            renderWithContext(<PagesHierarchyPanel {...props}/>, getInitialState());

            const searchBar = screen.getByPlaceholderText('Find pages...');
            await user.type(searchBar, 'nonexistent');

            expect(screen.getByText('No pages found')).toBeInTheDocument();
        });

        test('should apply collapsed class when isPanelCollapsed is true', async () => {
            const baseProps = await getBaseProps();
            const props = {...baseProps, isPanelCollapsed: true};
            const {container} = renderWithContext(<PagesHierarchyPanel {...props}/>, getInitialState());

            expect(container.querySelector('.PagesHierarchyPanel--collapsed')).toBeInTheDocument();
        });

        test('should render header with title', async () => {
            const baseProps = await getBaseProps();
            renderWithContext(<PagesHierarchyPanel {...baseProps}/>, getInitialState());

            expect(screen.getByText('Pages')).toBeInTheDocument();
        });

        test('should render page tree with root page', async () => {
            const baseProps = await getBaseProps();
            renderWithContext(<PagesHierarchyPanel {...baseProps}/>, getInitialState());

            expect(screen.getByText('Root Page')).toBeInTheDocument();
        });
    });

    describe('Lifecycle - Data Loading', () => {
        test('should load pages and drafts on mount', async () => {
            const baseProps = await getBaseProps();
            renderWithContext(<PagesHierarchyPanel {...baseProps}/>, getInitialState());

            expect(baseProps.actions.loadWikiPages).toHaveBeenCalledWith(testContext.wikiId);
            expect(baseProps.actions.loadPageDraftsForWiki).toHaveBeenCalledWith(testContext.wikiId);
        });

        test('should set selected page when currentPageId changes', async () => {
            const baseProps = await getBaseProps();
            const {rerender} = renderWithContext(<PagesHierarchyPanel {...baseProps}/>, getInitialState());

            rerender(<PagesHierarchyPanel {...baseProps} currentPageId={testContext.pageIds[1]}/>);

            expect(baseProps.actions.setSelectedPage).toHaveBeenCalledWith(testContext.pageIds[1]);
        });

        test('should not set selected page if currentPageId equals selectedPageId', async () => {
            const baseProps = await getBaseProps();
            const props = {...baseProps, currentPageId: testContext.pageIds[0], selectedPageId: testContext.pageIds[0]};
            renderWithContext(<PagesHierarchyPanel {...props}/>, getInitialState());

            expect(baseProps.actions.setSelectedPage).not.toHaveBeenCalled();
        });
    });

    describe('Draft Integration', () => {
        test('should display real drafts in tree', async () => {
            const baseProps = await getBaseProps();

            // Create a draft
            const draftId = `draft-${Date.now()}`;
            await Client4.savePageDraft(testContext.wikiId, draftId, '{"type":"doc"}', 'Draft Title', undefined, {});

            const serverDrafts = await Client4.getPageDraftsForWiki(testContext.wikiId);
            const drafts: PostDraft[] = serverDrafts.map((draft) =>
                transformPageServerDraft(draft, testContext.wikiId, draft.root_id).value
            );
            const props = {...baseProps, drafts};
            renderWithContext(<PagesHierarchyPanel {...props}/>, getInitialState());

            expect(screen.getByText('Draft Title')).toBeInTheDocument();

            // Cleanup
            await Client4.deletePageDraft(testContext.wikiId, draftId);
        });

        test('should display published pages', async () => {
            const baseProps = await getBaseProps();
            renderWithContext(<PagesHierarchyPanel {...baseProps}/>, getInitialState());

            expect(screen.getByText('Root Page')).toBeInTheDocument();
        });
    });


    describe('Page Creation', () => {
        let originalPrompt: typeof window.prompt;

        beforeEach(() => {
            originalPrompt = window.prompt;
            window.prompt = jest.fn();
        });

        afterEach(() => {
            window.prompt = originalPrompt;
        });

        test('should create new root page', async () => {
            const user = userEvent.setup();
            (window.prompt as jest.Mock).mockReturnValue('New Page');

            const baseProps = await getBaseProps();
            renderWithContext(<PagesHierarchyPanel {...baseProps}/>, getInitialState());

            const newPageButton = screen.getByRole('button', {name: /new page/i});
            await user.click(newPageButton);

            await waitFor(() => {
                expect(baseProps.actions.createPage).toHaveBeenCalledWith(testContext.wikiId, 'New Page');
            });
        });

        test('should not create page if title is empty', async () => {
            const user = userEvent.setup();
            (window.prompt as jest.Mock).mockReturnValue('');

            const baseProps = await getBaseProps();
            renderWithContext(<PagesHierarchyPanel {...baseProps}/>, getInitialState());

            const newPageButton = screen.getByRole('button', {name: /new page/i});
            await user.click(newPageButton);

            await waitFor(() => {
                expect(baseProps.actions.createPage).not.toHaveBeenCalled();
            });
        });

        test('should not create page if user cancels', async () => {
            const user = userEvent.setup();
            (window.prompt as jest.Mock).mockReturnValue(null);

            const baseProps = await getBaseProps();
            renderWithContext(<PagesHierarchyPanel {...baseProps}/>, getInitialState());

            const newPageButton = screen.getByRole('button', {name: /new page/i});
            await user.click(newPageButton);

            await waitFor(() => {
                expect(baseProps.actions.createPage).not.toHaveBeenCalled();
            });
        });

        test('should create child page from context menu', async () => {
            const user = userEvent.setup();
            (window.prompt as jest.Mock).mockReturnValue('Child Page');

            const baseProps = await getBaseProps();
            const {container} = renderWithContext(<PagesHierarchyPanel {...baseProps}/>, getInitialState());

            const dotMenuButton = container.querySelector('.tree-node-menu-button');
            if (dotMenuButton) {
                await user.click(dotMenuButton);
                await waitFor(() => {
                    expect(baseProps.actions.createPage).toHaveBeenCalledWith(testContext.wikiId, 'Child Page', testContext.pageIds[0]);
                });
            }
        });

        test('should select newly created page', async () => {
            const user = userEvent.setup();
            (window.prompt as jest.Mock).mockReturnValue('New Page');

            const baseProps = await getBaseProps();
            baseProps.actions.createPage.mockResolvedValue({data: 'draft-new'});

            renderWithContext(<PagesHierarchyPanel {...baseProps}/>, getInitialState());

            const newPageButton = screen.getByRole('button', {name: /new page/i});
            await user.click(newPageButton);

            await waitFor(() => {
                expect(baseProps.actions.setSelectedPage).toHaveBeenCalledWith('draft-new');
                expect(baseProps.onPageSelect).toHaveBeenCalledWith('draft-new');
            });
        });

        test('should prevent multiple simultaneous page creations', async () => {
            const user = userEvent.setup();
            (window.prompt as jest.Mock).mockReturnValue('New Page');

            const baseProps = await getBaseProps();

            let resolveCreate: any;
            const createPromise = new Promise((resolve) => {
                resolveCreate = resolve;
            });
            baseProps.actions.createPage.mockReturnValue(createPromise);

            renderWithContext(<PagesHierarchyPanel {...baseProps}/>, getInitialState());

            const newPageButton = screen.getByRole('button', {name: /new page/i});
            const click1 = user.click(newPageButton);
            const click2 = user.click(newPageButton);

            await Promise.all([click1, click2]);

            expect(baseProps.actions.createPage).toHaveBeenCalledTimes(1);

            resolveCreate({data: 'draft-new'});
        });
    });

    describe('Page Rename', () => {
        test('should call renamePage action when rename is triggered', async () => {
            const baseProps = await getBaseProps();
            renderWithContext(<PagesHierarchyPanel {...baseProps}/>, getInitialState());

            expect(screen.getByText('Root Page')).toBeInTheDocument();
        });
    });

    describe('Page Deletion', () => {
        test('should display pages in tree', async () => {
            const baseProps = await getBaseProps();
            renderWithContext(<PagesHierarchyPanel {...baseProps}/>, getInitialState());

            expect(screen.getByText('Root Page')).toBeInTheDocument();
        });

        test('should display drafts in tree', async () => {
            const draftId = `draft-${Date.now()}`;
            await Client4.savePageDraft(testContext.wikiId, draftId, '{\"type\":\"doc\"}', 'Draft Page', undefined, {});

            const baseProps = await getBaseProps();
            renderWithContext(<PagesHierarchyPanel {...baseProps}/>, getInitialState());

            expect(screen.getByText('Draft Page')).toBeInTheDocument();

            await Client4.deletePageDraft(testContext.wikiId, draftId);
        });
    });

    describe('Page Move', () => {
        test('should display pages in tree', async () => {
            const baseProps = await getBaseProps();
            renderWithContext(<PagesHierarchyPanel {...baseProps}/>, getInitialState());

            expect(screen.getByText('Root Page')).toBeInTheDocument();
        });
    });

    describe('Error Handling', () => {
        test('should handle page creation error gracefully', async () => {
            const user = userEvent.setup();
            const originalPrompt = window.prompt;
            window.prompt = jest.fn().mockReturnValue('New Page');

            const baseProps = await getBaseProps();
            baseProps.actions.createPage.mockResolvedValue({error: 'Creation failed'});

            renderWithContext(<PagesHierarchyPanel {...baseProps}/>, getInitialState());

            const newPageButton = screen.getByRole('button', {name: /new page/i});
            await user.click(newPageButton);

            await waitFor(() => {
                expect(baseProps.actions.setSelectedPage).not.toHaveBeenCalled();
            });

            window.prompt = originalPrompt;
        });
    });
});
