// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useEffect, useMemo, useState, useCallback, useRef} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import type {ServerError} from '@mattermost/types/errors';
import type {Post} from '@mattermost/types/posts';

import {createBookmarkFromPage} from 'actions/channel_bookmarks';
import type {DraftPage, TreeNode} from 'selectors/pages_hierarchy';
import {buildTree, getAncestorIds} from 'selectors/pages_hierarchy';

import BookmarkChannelSelect from 'components/bookmark_channel_select';
import {withWikiErrorBoundary} from 'components/wiki_view/wiki_error_boundary';

import type {PostDraft} from 'types/store/draft';

import {usePageMenuHandlers} from './hooks/usePageMenuHandlers';
import PageSearchBar from './page_search_bar';
import PageTreeView from './page_tree_view';
import PagesHeader from './pages_header';
import {convertDraftToPagePost} from './utils/tree_builder';
import {filterTreeBySearch} from './utils/tree_flattener';

import './pages_hierarchy_panel.scss';

type Props = {
    wikiId: string;
    channelId: string;
    currentPageId?: string;
    onPageSelect: (pageId: string, isDraft?: boolean) => void;
    onVersionHistory?: (pageId: string) => void;
    onCancelAutosave?: () => void;

    // From Redux
    pages: Post[];
    drafts: PostDraft[];
    loading: boolean;
    expandedNodes: {[pageId: string]: boolean};
    isPanelCollapsed: boolean;
    actions: {
        fetchPages: (wikiId: string) => Promise<{data?: Post[]; error?: ServerError}>;
        fetchPageDraftsForWiki: (wikiId: string) => Promise<{data?: PostDraft[]; error?: ServerError}>;
        removePageDraft: (wikiId: string, draftId: string) => Promise<{data?: boolean; error?: ServerError}>;
        toggleNodeExpanded: (wikiId: string, nodeId: string) => void;
        expandAncestors: (wikiId: string, ancestorIds: string[]) => void;
        createPage: (wikiId: string, title: string, pageParentId?: string) => Promise<{data?: string; error?: ServerError}>;
        updatePage: (pageId: string, newTitle: string, wikiId: string) => Promise<{data?: Post; error?: ServerError}>;
        deletePage: (pageId: string, wikiId: string) => Promise<{data?: boolean; error?: ServerError}>;
        movePageToWiki: (pageId: string, sourceWikiId: string, targetWikiId: string, parentPageId?: string) => Promise<{data?: boolean; error?: ServerError}>;
        duplicatePage: (pageId: string, sourceWikiId: string, targetWikiId: string, parentPageId?: string, customTitle?: string) => Promise<{data?: Post; error?: ServerError}>;
        closePagesPanel: () => void;
    };
};

const PagesHierarchyPanel = ({
    wikiId,
    channelId,
    currentPageId,
    onPageSelect,
    onVersionHistory,
    onCancelAutosave,
    pages,
    drafts,
    loading,
    expandedNodes,
    isPanelCollapsed,
    actions,
}: Props) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const untitledText = formatMessage({id: 'wiki.untitled_page', defaultMessage: 'Untitled'});
    const [searchQuery, setSearchQuery] = useState('');

    // Track previous currentPageId to prevent unnecessary ancestor expansions
    const prevCurrentPageIdRef = useRef<string | undefined>(currentPageId);

    // Refs for data used in effects to avoid unnecessary re-runs
    // These allow the ancestor expansion effect to only trigger on currentPageId changes
    const pagesRef = useRef(pages);
    const actionsRef = useRef(actions);
    useEffect(() => {
        pagesRef.current = pages;
    }, [pages]);
    useEffect(() => {
        actionsRef.current = actions;
    }, [actions]);

    // Data loading moved to parent WikiView component to prevent duplicate API calls
    // Pages and drafts are loaded once at WikiView level and passed down via Redux

    // Use menu handlers hook - it will combine pages and drafts internally
    const menuHandlers = usePageMenuHandlers({
        wikiId,
        channelId,
        pages,
        drafts,
        onPageSelect,
        onCancelAutosave,
    });

    const handleChannelSelected = useCallback(async (selectedChannelId: string) => {
        if (menuHandlers.pageToBookmark) {
            await dispatch(createBookmarkFromPage(selectedChannelId, menuHandlers.pageToBookmark.pageId, menuHandlers.pageToBookmark.pageTitle));
        }
    }, [dispatch, menuHandlers]);

    // Convert NEW drafts to Post-like objects to include in tree
    // Only include drafts for pages that don't exist yet (first-time drafts)
    // Drafts for existing pages will show "Unpublished changes" on the published page instead
    const draftPosts: DraftPage[] = useMemo(() => {
        return drafts.
            filter((draft) => !draft.props?.has_published_version).
            map((draft) => convertDraftToPagePost(draft, untitledText));
    }, [drafts, untitledText]);

    // Combine pages and drafts for tree display
    // Filter out drafts whose IDs already exist as published pages to avoid duplicates
    const allPagesAndDrafts = useMemo(() => {
        const pageIds = new Set(pages.map((p) => p.id));
        const uniqueDraftPosts = draftPosts.filter((draft) => !pageIds.has(draft.id));
        return [...pages, ...uniqueDraftPosts];
    }, [pages, draftPosts]);

    // Memoize pageMap to avoid recreating it on every render
    // Must include both pages and drafts since tree contains both
    const pageMap = useMemo(() => {
        return new Map(allPagesAndDrafts.map((p) => [p.id, p]));
    }, [allPagesAndDrafts]);

    // Keep pageMap ref in sync for use in effect
    const pageMapRef = useRef(pageMap);
    useEffect(() => {
        pageMapRef.current = pageMap;
    }, [pageMap]);

    // Expand ancestors when currentPageId changes to show path to current page
    // Uses refs to avoid running effect when pages/pageMap/actions change
    useEffect(() => {
        if (currentPageId && currentPageId !== prevCurrentPageIdRef.current) {
            // Update the ref to track the current page
            prevCurrentPageIdRef.current = currentPageId;

            // Expand ancestors to show path to current page
            // Only expand when navigating to a new page, not on every render
            // This preserves user's manual collapse actions
            const ancestorIds = getAncestorIds(pagesRef.current, currentPageId, pageMapRef.current);
            if (ancestorIds.length > 0) {
                actionsRef.current.expandAncestors(wikiId, ancestorIds);
            }
        }
    }, [currentPageId, wikiId]);

    // Build tree from flat pages (including drafts)
    // Uses allPagesAndDrafts which combines published pages with draft-only pages
    const tree = useMemo(() => {
        return buildTree(allPagesAndDrafts);
    }, [allPagesAndDrafts]);

    // Filter tree by search query
    const filteredTree = useMemo(() => {
        if (!searchQuery.trim()) {
            return tree;
        }
        return filterTreeBySearch(tree, searchQuery);
    }, [tree, searchQuery]);

    // When searching, auto-expand all nodes in the filtered tree to make results visible
    const effectiveExpandedNodes = useMemo(() => {
        if (!searchQuery.trim()) {
            return expandedNodes;
        }

        // Collect all node IDs from filtered tree
        const allNodeIds: {[key: string]: boolean} = {};
        const collectIds = (nodes: TreeNode[]) => {
            nodes.forEach((node) => {
                allNodeIds[node.id] = true;
                if (node.children.length > 0) {
                    collectIds(node.children);
                }
            });
        };
        collectIds(filteredTree);

        return allNodeIds;
    }, [searchQuery, filteredTree, expandedNodes]);

    const handlePageSelect = useCallback((pageId: string) => {
        // Check if this is a new draft (not an edit of published page)
        // New drafts have has_published_version = false/undefined
        const isNewDraft = drafts.some((draft) => draft.rootId === pageId && !draft.props?.has_published_version);
        onPageSelect(pageId, isNewDraft);
    }, [drafts, onPageSelect]);

    const handleToggleExpanded = useCallback((nodeId: string) => {
        actions.toggleNodeExpanded(wikiId, nodeId);
    }, [actions, wikiId]);

    const handleNewPage = useCallback(() => {
        if (menuHandlers.creatingPage) {
            return;
        }
        menuHandlers.handleCreateRootPage();
    }, [menuHandlers]);

    if (loading && pages.length === 0) {
        return (
            <div
                className={classNames('PagesHierarchyPanel', {
                    'PagesHierarchyPanel--collapsed': isPanelCollapsed,
                })}
                data-testid='pages-hierarchy-panel'
            >
                <div
                    className='PagesHierarchyPanel__loading'
                    data-testid='pages-hierarchy-loading'
                >
                    {formatMessage({id: 'pages_panel.loading', defaultMessage: 'Loading pages...'})}
                </div>
            </div>
        );
    }

    return (
        <div
            className={classNames('PagesHierarchyPanel', {
                'PagesHierarchyPanel--collapsed': isPanelCollapsed,
            })}
            data-testid='pages-hierarchy-panel'
        >
            {/* Header */}
            <PagesHeader
                title={formatMessage({id: 'pages_panel.header.title', defaultMessage: 'Pages'})}
                onNewPage={handleNewPage}
                onCollapse={actions.closePagesPanel}
                isCreating={menuHandlers.creatingPage}
            />

            {/* Search */}
            <PageSearchBar
                value={searchQuery}
                onChange={setSearchQuery}
            />

            {/* Tree (includes both pages and drafts) */}
            <div
                className='PagesHierarchyPanel__tree'
                data-testid='pages-hierarchy-tree'
            >
                {filteredTree.length === 0 ? (
                    <div
                        className='PagesHierarchyPanel__empty'
                        data-testid='pages-hierarchy-empty'
                    >
                        {searchQuery ? formatMessage({id: 'pages_panel.no_results', defaultMessage: 'No pages found'}) : formatMessage({id: 'pages_panel.empty', defaultMessage: 'No pages yet'})}
                    </div>
                ) : (
                    <PageTreeView
                        tree={filteredTree}
                        expandedNodes={effectiveExpandedNodes}
                        currentPageId={currentPageId}
                        onNodeSelect={handlePageSelect}
                        onToggleExpand={handleToggleExpanded}
                        onCreateChild={menuHandlers.handleCreateChild}
                        onRename={menuHandlers.handleRename}
                        onDuplicate={menuHandlers.handleDuplicate}
                        onMove={menuHandlers.handleMove}
                        onBookmarkInChannel={menuHandlers.handleBookmarkInChannel}
                        onDelete={menuHandlers.handleDelete}
                        onVersionHistory={onVersionHistory}
                        onCopyMarkdown={menuHandlers.handleCopyMarkdown}
                        deletingPageId={menuHandlers.deletingPageId}
                        wikiId={wikiId}
                        channelId={channelId}
                    />
                )}
            </div>

            {/* Bookmark in channel modal */}
            {menuHandlers.showBookmarkModal && menuHandlers.pageToBookmark && (
                <BookmarkChannelSelect
                    onSelect={handleChannelSelected}
                    onClose={menuHandlers.handleBookmarkCancel}
                    title={formatMessage({id: 'pages_panel.bookmark_modal.title', defaultMessage: 'Bookmark in channel'})}
                />
            )}

        </div>
    );
};

export default withWikiErrorBoundary(PagesHierarchyPanel);
