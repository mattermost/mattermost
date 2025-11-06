// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useEffect, useMemo, useState} from 'react';

import type {Post} from '@mattermost/types/posts';

import DuplicatePageModal from 'components/duplicate_page_modal';
import MovePageModal from 'components/move_page_modal';
import TextInputModal from 'components/text_input_modal';

import {PageDisplayTypes} from 'utils/constants';

import type {PostDraft} from 'types/store/draft';

import DeletePageModal from './delete_page_modal';
import {usePageMenuHandlers} from './hooks/use_page_menu_handlers';
import PageSearchBar from './page_search_bar';
import PageTreeView from './page_tree_view';
import PagesHeader from './pages_header';
import type {DraftPage} from './utils/tree_builder';
import {buildTree, getAncestorIds} from './utils/tree_builder';
import {filterTreeBySearch} from './utils/tree_flattener';

import './pages_hierarchy_panel.scss';

type Props = {
    wikiId: string;
    channelId: string;
    currentPageId?: string;
    onPageSelect: (pageId: string) => void;

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
    pages,
    drafts,
    loading,
    expandedNodes,
    selectedPageId,
    isPanelCollapsed,
    lastInvalidated,
    actions,
}: Props) => {
    const [searchQuery, setSearchQuery] = useState('');

    // Load pages and drafts on mount, when wikiId changes, or when pages are invalidated
    // lastInvalidated timestamp changes when wiki is renamed/modified, triggering a reload
    useEffect(() => {
        actions.loadPages(wikiId);
        actions.loadPageDraftsForWiki(wikiId);
    }, [wikiId, lastInvalidated]);

    // Use menu handlers hook - it will combine pages and drafts internally
    const menuHandlers = usePageMenuHandlers({
        wikiId,
        channelId,
        pages,
        drafts,
        onPageSelect,
    });

    // Convert drafts to Post-like objects to include in tree
    const draftPosts: DraftPage[] = useMemo(() => {
        return drafts.map((draft): DraftPage => {
            // If draft is editing an existing page, use that page's create_at for stable ordering
            const originalPage = draft.props?.page_id ? pages.find((p) => p.id === draft.props.page_id) : null;
            const createAt = originalPage?.create_at || draft.createAt;

            return {
                id: draft.rootId,
                create_at: createAt,
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
    }, [drafts, pages]);

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
    // But exclude published pages that have a draft (to avoid duplicates)
    const draftIds = useMemo(() => {
        const ids = new Set(drafts.map((d) => d.props?.page_id).filter(Boolean));
        return ids;
    }, [drafts]);
    const pagesWithoutDrafts = useMemo(() => {
        const filtered = pages.filter((page) => !draftIds.has(page.id));
        return filtered;
    }, [pages, draftIds]);
    const allPages = useMemo(() => {
        const combined = [...pagesWithoutDrafts, ...draftPosts];
        return combined;
    }, [pagesWithoutDrafts, draftPosts]);

    // Build tree from flat pages (including drafts)
    const tree = useMemo(() => {
        const builtTree = buildTree(allPages);
        return builtTree;
    }, [allPages]);

    // Filter tree by search query
    const filteredTree = useMemo(() => {
        if (!searchQuery.trim()) {
            return tree;
        }
        return filterTreeBySearch(tree, searchQuery);
    }, [tree, searchQuery]);

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
                        expandedNodes={expandedNodes}
                        selectedPageId={selectedPageId}
                        currentPageId={currentPageId}
                        onNodeSelect={handlePageSelect}
                        onToggleExpand={handleToggleExpanded}
                        onCreateChild={menuHandlers.handleCreateChild}
                        onRename={menuHandlers.handleRename}
                        onDuplicate={menuHandlers.handleDuplicate}
                        onMove={menuHandlers.handleMove}
                        onDelete={menuHandlers.handleDelete}
                        renamingPageId={menuHandlers.renamingPageId}
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

            {/* Duplicate page modal */}
            {menuHandlers.showDuplicateModal && menuHandlers.pageToDuplicate && (
                <DuplicatePageModal
                    pageId={menuHandlers.pageToDuplicate.pageId}
                    pageTitle={menuHandlers.pageToDuplicate.pageTitle}
                    currentWikiId={wikiId}
                    availableWikis={menuHandlers.availableWikis}
                    fetchPagesForWiki={menuHandlers.fetchPagesForWiki}
                    hasChildren={menuHandlers.pageToDuplicate.hasChildren}
                    onConfirm={menuHandlers.handleDuplicateConfirm}
                    onCancel={menuHandlers.handleDuplicateCancel}
                />
            )}

            {/* Rename page modal */}
            {menuHandlers.showRenameModal && menuHandlers.pageToRename && (
                <TextInputModal
                    show={menuHandlers.showRenameModal}
                    title='Rename Page'
                    placeholder='Enter new page title...'
                    confirmButtonText='Rename'
                    maxLength={255}
                    initialValue={menuHandlers.pageToRename.currentTitle}
                    ariaLabel='Rename Page'
                    inputTestId='rename-page-modal-title-input'
                    onConfirm={menuHandlers.handleRenameConfirm}
                    onCancel={menuHandlers.handleRenameCancel}
                    onHide={() => menuHandlers.setShowRenameModal(false)}
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
        </div>
    );
};

export default PagesHierarchyPanel;
