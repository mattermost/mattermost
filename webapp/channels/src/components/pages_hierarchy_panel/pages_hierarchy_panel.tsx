// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useEffect, useMemo, useState, useCallback} from 'react';
import {useDispatch} from 'react-redux';

import type {Post} from '@mattermost/types/posts';

import {createBookmarkFromPage} from 'actions/channel_bookmarks';
import type {DraftPage, TreeNode} from 'selectors/pages_hierarchy';
import {buildTree, getAncestorIds} from 'selectors/pages_hierarchy';

import BookmarkChannelSelect from 'components/bookmark_channel_select';
import DeletePageModal from 'components/delete_page_modal';
import MovePageModal from 'components/move_page_modal';
import TextInputModal from 'components/text_input_modal';

import {PageDisplayTypes} from 'utils/constants';

import type {PostDraft} from 'types/store/draft';

import {usePageMenuHandlers} from './hooks/use_page_menu_handlers';
import PageSearchBar from './page_search_bar';
import PageTreeView from './page_tree_view';
import PagesHeader from './pages_header';
import {filterTreeBySearch} from './utils/tree_flattener';

import './pages_hierarchy_panel.scss';

type Props = {
    wikiId: string;
    channelId: string;
    currentPageId?: string;
    onPageSelect: (pageId: string) => void;
    onVersionHistory?: (pageId: string) => void;

    // From Redux
    pages: Post[];
    drafts: PostDraft[];
    loading: boolean;
    expandedNodes: {[pageId: string]: boolean};
    selectedPageId: string | null;
    isPanelCollapsed: boolean;
    lastInvalidated: number;
    actions: {
        loadPages: (wikiId: string) => Promise<{data?: Post[]; error?: any}>;
        loadPageDraftsForWiki: (wikiId: string) => Promise<{data?: PostDraft[]; error?: any}>;
        removePageDraft: (wikiId: string, draftId: string) => Promise<{data?: boolean; error?: any}>;
        toggleNodeExpanded: (wikiId: string, nodeId: string) => void;
        setSelectedPage: (pageId: string | null) => void;
        expandAncestors: (wikiId: string, ancestorIds: string[]) => void;
        createPage: (wikiId: string, title: string, pageParentId?: string) => Promise<{data?: any; error?: any}>;
        updatePage: (pageId: string, newTitle: string, wikiId: string) => Promise<{data?: Post; error?: any}>;
        deletePage: (pageId: string, wikiId: string) => Promise<{data?: boolean; error?: any}>;
        movePage: (pageId: string, newParentId: string, wikiId: string) => Promise<{data?: Post; error?: any}>;
        movePageToWiki: (pageId: string, sourceWikiId: string, targetWikiId: string, parentPageId?: string) => Promise<{data?: boolean; error?: any}>;
        duplicatePage: (pageId: string, sourceWikiId: string, targetWikiId: string, parentPageId?: string, customTitle?: string) => Promise<{data?: Post; error?: any}>;
        closePagesPanel: () => void;
    };
};

const PagesHierarchyPanel = ({
    wikiId,
    channelId,
    currentPageId,
    onPageSelect,
    onVersionHistory,
    pages,
    drafts,
    loading,
    expandedNodes,
    selectedPageId,
    isPanelCollapsed,
    actions,
}: Props) => {
    const dispatch = useDispatch();
    const [searchQuery, setSearchQuery] = useState('');

    // Data loading moved to parent WikiView component to prevent duplicate API calls
    // Pages and drafts are loaded once at WikiView level and passed down via Redux

    // Use menu handlers hook - it will combine pages and drafts internally
    const menuHandlers = usePageMenuHandlers({
        wikiId,
        channelId,
        pages,
        drafts,
        onPageSelect,
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
            filter((draft) => !draft.props?.page_id).
            map((draft): DraftPage => {
                return {
                    id: draft.rootId,
                    create_at: draft.createAt,
                    update_at: draft.updateAt,
                    delete_at: 0,
                    edit_at: 0,
                    is_pinned: false,
                    user_id: '',
                    channel_id: draft.channelId,
                    root_id: '',
                    original_id: '',
                    message: draft.message,
                    type: PageDisplayTypes.PAGE_DRAFT,
                    page_parent_id: draft.props?.page_parent_id || '',
                    props: {
                        ...draft.props,
                        title: draft.props?.title || 'Untitled',
                    },
                    hashtags: '',
                    filenames: [],
                    file_ids: [],
                    pending_post_id: '',
                    reply_count: 0,
                    last_reply_at: 0,
                    participants: null,
                    metadata: {
                        embeds: [],
                        emojis: [],
                        files: [],
                        images: {},
                    },
                };
            });
    }, [drafts]);

    // Combine pages and drafts for tree display
    const allPagesAndDrafts = useMemo(() => {
        return [...pages, ...draftPosts];
    }, [pages, draftPosts]);

    // Memoize pageMap to avoid recreating it on every render
    // Must include both pages and drafts since tree contains both
    const pageMap = useMemo(() => {
        return new Map(allPagesAndDrafts.map((p) => [p.id, p]));
    }, [allPagesAndDrafts]);

    // Set selected page and expand ancestors when currentPageId changes
    useEffect(() => {
        if (currentPageId) {
            // Update selected page if it changed
            if (currentPageId !== selectedPageId) {
                actions.setSelectedPage(currentPageId);
            }

            // Always expand ancestors to ensure navigation works after wiki operations
            // This runs even if page is already selected to handle cases like:
            // - Navigating back to wiki after rename
            // - Reloading pages after wiki operations
            const ancestorIds = getAncestorIds(pages, currentPageId, pageMap);
            if (ancestorIds.length > 0) {
                actions.expandAncestors(wikiId, ancestorIds);
            }
        }
    }, [currentPageId, pages, wikiId, pageMap, selectedPageId, actions]);

    // Combine pages and drafts for tree building
    // Show published pages even if they have drafts (drafts are indicated with "Unpublished changes" badge)
    // Only show draft nodes for NEW pages (pages that don't exist yet)
    const allPages = useMemo(() => {
        return [...pages, ...draftPosts];
    }, [pages, draftPosts]);

    // Build tree from flat pages (including drafts)
    const tree = useMemo(() => {
        return buildTree(allPages);
    }, [allPages]);

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

    const handlePageSelect = (pageId: string) => {
        actions.setSelectedPage(pageId);
        onPageSelect(pageId);
    };

    const handleToggleExpanded = (nodeId: string) => {
        actions.toggleNodeExpanded(wikiId, nodeId);
    };

    const handleNewPage = () => {
        if (menuHandlers.creatingPage) {
            return;
        }
        menuHandlers.setShowCreatePageModal(true);
    };

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
                    {'Loading pages...'}
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
                title='Pages'
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
                        {searchQuery ? 'No pages found' : 'No pages yet'}
                    </div>
                ) : (
                    <PageTreeView
                        tree={filteredTree}
                        expandedNodes={effectiveExpandedNodes}
                        selectedPageId={selectedPageId}
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
                        deletingPageId={menuHandlers.deletingPageId}
                        wikiId={wikiId}
                        channelId={channelId}
                    />
                )}
            </div>

            {/* Delete confirmation modal */}
            {menuHandlers.showDeleteModal && menuHandlers.pageToDelete && (
                <DeletePageModal
                    pageTitle={(menuHandlers.pageToDelete.page.props?.title as string | undefined) || menuHandlers.pageToDelete.page.message || 'Untitled'}
                    childCount={menuHandlers.pageToDelete.childCount}
                    onConfirm={menuHandlers.handleDeleteConfirm}
                    onCancel={menuHandlers.handleDeleteCancel}
                />
            )}

            {/* Move page to wiki modal */}
            {menuHandlers.showMoveModal && menuHandlers.pageToMove && (
                <MovePageModal
                    pageId={menuHandlers.pageToMove.pageId}
                    pageTitle={menuHandlers.pageToMove.pageTitle}
                    currentWikiId={wikiId}
                    availableWikis={menuHandlers.availableWikis}
                    fetchPagesForWiki={menuHandlers.fetchPagesForWiki}
                    hasChildren={menuHandlers.pageToMove.hasChildren}
                    onConfirm={menuHandlers.handleMoveConfirm}
                    onCancel={menuHandlers.handleMoveCancel}
                />
            )}

            {/* Create page modal */}
            <TextInputModal
                show={menuHandlers.showCreatePageModal}
                title={menuHandlers.createPageParent ? `Create Child Page under "${menuHandlers.createPageParent.title}"` : 'Create New Page'}
                placeholder='Enter page title...'
                helpText={menuHandlers.createPageParent ? `This page will be created as a child of "${menuHandlers.createPageParent.title}".` : 'A new draft will be created for you to edit.'}
                confirmButtonText='Create'
                maxLength={255}
                ariaLabel='Create Page'
                inputTestId='create-page-modal-title-input'
                onConfirm={menuHandlers.handleConfirmCreatePage}
                onCancel={menuHandlers.handleCancelCreatePage}
                onHide={() => menuHandlers.setShowCreatePageModal(false)}
            />

            {/* Bookmark in channel modal */}
            {menuHandlers.showBookmarkModal && menuHandlers.pageToBookmark && (
                <BookmarkChannelSelect
                    onSelect={handleChannelSelected}
                    onClose={menuHandlers.handleBookmarkCancel}
                    title='Bookmark in channel'
                />
            )}
        </div>
    );
};

export default PagesHierarchyPanel;
