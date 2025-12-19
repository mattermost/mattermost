// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import type {Post} from '@mattermost/types/posts';
import type {DeepPartial} from '@mattermost/types/utilities';

import {PostTypes} from 'mattermost-redux/constants/posts';

import {renderWithContext} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';
import type {PostDraft} from 'types/store/draft';

import PagesHierarchyPanel from './pages_hierarchy_panel';

describe('components/pages_hierarchy_panel/PagesHierarchyPanel', () => {
    const mockUserId = 'user-id-1';
    const mockTeamId = 'team-id-1';
    const mockChannelId = 'channel-id-1';
    const mockWikiId = 'wiki-id-1';
    const rootPage1Id = 'root-page-1';
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
        createMockPage(rootPage1Id, 'Root Page'),
        createMockPage(childPageId, 'Child Page', rootPage1Id),
    ];

    const mockDrafts: PostDraft[] = [];

    const getBaseProps = () => {
        return {
            wikiId: mockWikiId,
            channelId: mockChannelId,
            onPageSelect: jest.fn(),
            pages: mockPages,
            drafts: mockDrafts,
            loading: false,
            expandedNodes: {},
            isPanelCollapsed: false,
            actions: {
                fetchPages: jest.fn().mockResolvedValue({data: mockPages}),
                fetchPageDraftsForWiki: jest.fn().mockResolvedValue({data: mockDrafts}),
                removePageDraft: jest.fn().mockResolvedValue({data: true}),
                toggleNodeExpanded: jest.fn(),
                expandAncestors: jest.fn(),
                createPage: jest.fn().mockResolvedValue({data: 'draft-new'}),
                updatePage: jest.fn().mockResolvedValue({data: mockPages[0]}),
                deletePage: jest.fn().mockResolvedValue({data: true}),
                movePageToWiki: jest.fn().mockResolvedValue({data: true}),
                duplicatePage: jest.fn().mockResolvedValue({data: mockPages[0]}),
                closePagesPanel: jest.fn(),
            },
        };
    };

    const getInitialState = (): DeepPartial<GlobalState> => ({
        entities: {
            users: {
                currentUserId: mockUserId,
            },
            teams: {
                currentTeamId: mockTeamId,
            },
        },
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Rendering', () => {
        test('should render with required props', () => {
            const baseProps = getBaseProps();
            const {container} = renderWithContext(<PagesHierarchyPanel {...baseProps}/>, getInitialState());

            expect(container.querySelector('.PagesHierarchyPanel')).toBeInTheDocument();
            expect(screen.getByPlaceholderText('Find pages...')).toBeInTheDocument();
            expect(screen.getByText('Root Page')).toBeInTheDocument();
        });

        test('should render loading state when loading and no pages', () => {
            const baseProps = getBaseProps();
            const props = {...baseProps, loading: true, pages: []};
            renderWithContext(<PagesHierarchyPanel {...props}/>, getInitialState());

            expect(screen.getByText('Loading pages...')).toBeInTheDocument();
        });

        test('should not show loading state when loading but pages exist', () => {
            const baseProps = getBaseProps();
            const props = {...baseProps, loading: true};
            renderWithContext(<PagesHierarchyPanel {...props}/>, getInitialState());

            expect(screen.queryByText('Loading pages...')).not.toBeInTheDocument();
            expect(screen.getByText('Root Page')).toBeInTheDocument();
        });

        test('should render empty state when no pages', () => {
            const baseProps = getBaseProps();
            const props = {...baseProps, pages: [], drafts: []};
            renderWithContext(<PagesHierarchyPanel {...props}/>, getInitialState());

            expect(screen.getByText('No pages yet')).toBeInTheDocument();
        });

        test('should render empty state with search message when searching', async () => {
            const user = userEvent.setup();
            const baseProps = getBaseProps();
            const props = {...baseProps, pages: []};
            renderWithContext(<PagesHierarchyPanel {...props}/>, getInitialState());

            const searchBar = screen.getByPlaceholderText('Find pages...');
            await user.type(searchBar, 'nonexistent');

            expect(screen.getByText('No pages found')).toBeInTheDocument();
        });

        test('should apply collapsed class when isPanelCollapsed is true', () => {
            const baseProps = getBaseProps();
            const props = {...baseProps, isPanelCollapsed: true};
            const {container} = renderWithContext(<PagesHierarchyPanel {...props}/>, getInitialState());

            expect(container.querySelector('.PagesHierarchyPanel--collapsed')).toBeInTheDocument();
        });

        test('should render header with title', () => {
            const baseProps = getBaseProps();
            renderWithContext(<PagesHierarchyPanel {...baseProps}/>, getInitialState());

            expect(screen.getByText('Pages')).toBeInTheDocument();
        });

        test('should render page tree with root page', () => {
            const baseProps = getBaseProps();
            renderWithContext(<PagesHierarchyPanel {...baseProps}/>, getInitialState());

            expect(screen.getByText('Root Page')).toBeInTheDocument();
        });
    });

    describe('Lifecycle - Data Loading', () => {
        test('should expand ancestors when currentPageId changes to a nested page', () => {
            const baseProps = getBaseProps();
            const {rerender} = renderWithContext(<PagesHierarchyPanel {...baseProps}/>, getInitialState());

            rerender(<PagesHierarchyPanel
                {...baseProps}
                currentPageId={childPageId}
            />, /* eslint-disable-line react/jsx-closing-bracket-location */
            );

            // Should expand ancestors to show path to current page
            expect(baseProps.actions.expandAncestors).toHaveBeenCalledWith(mockWikiId, [rootPage1Id]);
        });

        test('should not expand ancestors when currentPageId does not change', () => {
            const baseProps = getBaseProps();
            const props = {...baseProps, currentPageId: rootPage1Id};
            renderWithContext(<PagesHierarchyPanel {...props}/>, getInitialState());

            // Root page has no ancestors to expand
            expect(baseProps.actions.expandAncestors).not.toHaveBeenCalled();
        });
    });

    describe('Draft Integration', () => {
        test('should display published pages', () => {
            const baseProps = getBaseProps();
            renderWithContext(<PagesHierarchyPanel {...baseProps}/>, getInitialState());

            expect(screen.getByText('Root Page')).toBeInTheDocument();
        });

        test('should handle drafts for new pages', () => {
            const draftId = 'draft-123';
            const drafts: PostDraft[] = [{
                message: '{"type":"doc","content":[]}',
                fileInfos: [],
                uploadsInProgress: [],
                channelId: mockChannelId,
                rootId: draftId,
                createAt: Date.now(),
                updateAt: Date.now(),
                props: {
                    title: 'Draft Title',
                    wiki_id: mockWikiId,
                },
            }];

            const baseProps = getBaseProps();
            const props = {...baseProps, drafts};
            renderWithContext(<PagesHierarchyPanel {...props}/>, getInitialState());

            expect(screen.getByText('Draft Title')).toBeInTheDocument();
        });
    });
});
