// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useEffect, useMemo, useState, useCallback} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import type {ServerError} from '@mattermost/types/errors';
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

import {usePageMenuHandlers} from './hooks/usePageMenuHandlers';
import PageSearchBar from './page_search_bar';
import PageTreeView from './page_tree_view';
import PagesHeader from './pages_header';
import {filterTreeBySearch} from './utils/tree_flattener';

import './pages_hierarchy_panel.scss';

type Props = {
    wikiId: string;
    channelId: string;
    currentPageId?: string;
    onPageSelect: (pageId: string, isDraft?: boolean) => void;
    onVersionHistory?: (pageId: string) => void;

    // From Redux
    pages: Post[];
    drafts: PostDraft[];
    loading: boolean;
    expandedNodes: {[pageId: string]: boolean};
    selectedPageId: string | null;
    isPanelCollapsed: boolean;
    actions: {
        loadPages: (wikiId: string) => Promise<{data?: Post[]; error?: ServerError}>;
        loadPageDraftsForWiki: (wikiId: string) => Promise<{data?: PostDraft[]; error?: ServerError}>;
        removePageDraft: (wikiId: string, draftId: string) => Promise<{data?: boolean; error?: ServerError}>;
        toggleNodeExpanded: (wikiId: string, nodeId: string) => void;
        setSelectedPage: (pageId: string | null) => void;
        expandAncestors: (wikiId: string, ancestorIds: string[]) => void;
        createPage: (wikiId: string, title: string, pageParentId?: string) => Promise<{data?: string; error?: ServerError}>;
        updatePage: (pageId: string, newTitle: string, wikiId: string) => Promise<{data?: Post; error?: ServerError}>;
        deletePage: (pageId: string, wikiId: string) => Promise<{data?: boolean; error?: ServerError}>;
        movePage: (pageId: string, newParentId: string, wikiId: string) => Promise<{data?: Post; error?: ServerError}>;
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
    pages,
    drafts,
    loading,
    expandedNodes,
    selectedPageId,
    isPanelCollapsed,
    actions,
}: Props) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const untitledText = formatMessage({id: 'wiki.untitled_page', defaultMessage: 'Untitled'});
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
        return drafts.filter((draft) => !draft.props?.has_published_version).
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
                        title: draft.props?.title || untitledText,
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

    // Set selected page and expand ancestors when currentPageId changes
    useEffect(() => {
        if (currentPageId && currentPageId !== selectedPageId) {
            actions.setSelectedPage(currentPageId);

            // Expand ancestors to show path to current page
            // Only expand when navigating to a new page, not on every render
            // This preserves user's manual collapse actions
            const ancestorIds = getAncestorIds(pages, currentPageId, pageMap);
            if (ancestorIds.length > 0) {
                actions.expandAncestors(wikiId, ancestorIds);
            }
        }
    }, [currentPageId, pages, wikiId, pageMap, selectedPageId, actions]);

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

    const handlePageSelect = (pageId: string) => {
        actions.setSelectedPage(pageId);

        // Check if this is a new draft (not an edit of published page)
        // New drafts have has_published_version = false/undefined
        const isNewDraft = drafts.some((draft) => draft.rootId === pageId && !draft.props?.has_published_version);
        onPageSelect(pageId, isNewDraft);
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
                        {searchQuery ?
                            formatMessage({id: 'pages_panel.no_results', defaultMessage: 'No pages found'}) :
                            formatMessage({id: 'pages_panel.empty', defaultMessage: 'No pages yet'})}
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
                    pageTitle={(menuHandlers.pageToDelete.page.props?.title as string | undefined) || menuHandlers.pageToDelete.page.message || untitledText}
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
                title={menuHandlers.createPageParent ?
                    formatMessage({id: 'pages_panel.create_child_modal.title', defaultMessage: 'Create Child Page under "{parentTitle}"'}, {parentTitle: menuHandlers.createPageParent.title}) :
                    formatMessage({id: 'pages_panel.create_modal.title', defaultMessage: 'Create New Page'})}
                fieldLabel={formatMessage({id: 'pages_panel.modal.field_label', defaultMessage: 'Page title'})}
                placeholder={formatMessage({id: 'pages_panel.modal.placeholder', defaultMessage: 'Enter page title...'})}
                helpText={menuHandlers.createPageParent ?
                    formatMessage({id: 'pages_panel.create_child_modal.help_text', defaultMessage: 'This page will be created as a child of "{parentTitle}".'}, {parentTitle: menuHandlers.createPageParent.title}) :
                    formatMessage({id: 'pages_panel.create_modal.help_text', defaultMessage: 'A new draft will be created for you to edit.'})}
                confirmButtonText={formatMessage({id: 'pages_panel.create_modal.confirm', defaultMessage: 'Create'})}
                maxLength={255}
                ariaLabel={formatMessage({id: 'pages_panel.create_modal.aria_label', defaultMessage: 'Create Page'})}
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
                    title={formatMessage({id: 'pages_panel.bookmark_modal.title', defaultMessage: 'Bookmark in channel'})}
                />
            )}

            {/* Rename page modal */}
            <TextInputModal
                show={menuHandlers.showRenameModal}
                title={formatMessage({id: 'pages_panel.rename_modal.title', defaultMessage: 'Rename Page'})}
                fieldLabel={formatMessage({id: 'pages_panel.modal.field_label', defaultMessage: 'Page title'})}
                placeholder={formatMessage({id: 'pages_panel.modal.placeholder', defaultMessage: 'Enter page title...'})}
                helpText={formatMessage({id: 'pages_panel.rename_modal.help_text', defaultMessage: 'The page will be renamed immediately.'})}
                confirmButtonText={formatMessage({id: 'pages_panel.rename_modal.confirm', defaultMessage: 'Rename'})}
                maxLength={255}
                initialValue={menuHandlers.pageToRename?.currentTitle || ''}
                ariaLabel={formatMessage({id: 'pages_panel.rename_modal.aria_label', defaultMessage: 'Rename Page'})}
                inputTestId='rename-page-modal-title-input'
                onConfirm={menuHandlers.handleConfirmRename}
                onCancel={menuHandlers.handleCancelRename}
                onHide={() => menuHandlers.setShowRenameModal(false)}
            />
        </div>
    );
};

export default PagesHierarchyPanel;
