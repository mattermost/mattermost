// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useEffect, useMemo, useState} from 'react';

import type {Post} from '@mattermost/types/posts';

import {PageDisplayTypes} from 'utils/constants';

import type {PostDraft} from 'types/store/draft';

import DeletePageModal from './delete_page_modal';
import PageSearchBar from './page_search_bar';
import PageTreeView from './page_tree_view';
import PagesHeader from './pages_header';
import type {DraftPage, PageOrDraft} from './utils/tree_builder';
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
    actions: {
        loadWikiPages: (wikiId: string) => Promise<{data?: Post[]; error?: any}>;
        loadPageDraftsForWiki: (wikiId: string) => Promise<{data?: PostDraft[]; error?: any}>;
        removePageDraft: (wikiId: string, draftId: string) => Promise<{data?: boolean; error?: any}>;
        toggleNodeExpanded: (wikiId: string, nodeId: string) => void;
        setSelectedPage: (pageId: string | null) => void;
        expandAncestors: (wikiId: string, ancestorIds: string[]) => void;
        createPage: (wikiId: string, title: string, pageParentId?: string) => Promise<{data?: any; error?: any}>;
        renamePage: (pageId: string, newTitle: string, wikiId: string) => Promise<{data?: Post; error?: any}>;
        deletePage: (pageId: string, wikiId: string) => Promise<{data?: boolean; error?: any}>;
        movePage: (pageId: string, newParentId: string, wikiId: string) => Promise<{data?: Post; error?: any}>;
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
    actions,
}: Props) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [creatingPage, setCreatingPage] = useState(false);
    const [renamingPageId, setRenamingPageId] = useState<string | null>(null);
    const [deletingPageId, setDeletingPageId] = useState<string | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [pageToDelete, setPageToDelete] = useState<{page: Post; childCount: number} | null>(null);

    // Load pages and drafts on mount or when wikiId changes
    useEffect(() => {
        actions.loadWikiPages(wikiId);
        actions.loadPageDraftsForWiki(wikiId);
    }, [wikiId]);

    // Set selected page when currentPageId changes
    useEffect(() => {
        if (currentPageId && currentPageId !== selectedPageId) {
            actions.setSelectedPage(currentPageId);

            // Expand ancestors to show path to current page
            const ancestorIds = getAncestorIds(pages, currentPageId);
            if (ancestorIds.length > 0) {
                actions.expandAncestors(wikiId, ancestorIds);
            }
        }
    }, [currentPageId, pages, wikiId]);

    // Convert drafts to Post-like objects to include in tree
    const draftPosts: DraftPage[] = useMemo(() => {
        console.log('[PagesHierarchyPanel] Converting drafts to draftPosts:', {
            draftsCount: drafts.length,
            drafts: drafts.map((d) => ({
                rootId: d.rootId,
                title: d.props?.title,
                pageParentId: d.props?.page_parent_id,
            })),
        });

        return drafts.map((draft): DraftPage => ({
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
        }));
    }, [drafts]);

    // Combine pages and drafts for tree building
    // But exclude published pages that have a draft (to avoid duplicates)
    const draftIds = useMemo(() => new Set(drafts.map((d) => d.rootId)), [drafts]);
    const pagesWithoutDrafts = useMemo(() => pages.filter((page) => !draftIds.has(page.id)), [pages, draftIds]);
    const allPages = useMemo(() => [...pagesWithoutDrafts, ...draftPosts], [pagesWithoutDrafts, draftPosts]);

    // Build tree from flat pages (including drafts)
    const tree = useMemo(() => buildTree(allPages), [allPages]);

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

    const handleNewPage = async () => {
        if (creatingPage) {
            return;
        }

        const title = window.prompt('Enter page title:', 'Untitled Page');
        if (!title || title.trim() === '') {
            return;
        }

        setCreatingPage(true);
        try {
            const result = await actions.createPage(wikiId, title);
            if (result.error) {
                alert(`Failed to create page: ${result.error.message || 'Unknown error'}`);
            }
        } catch (error) {
            alert('Failed to create page. Please try again.');
            console.error('Create page error:', error);
        } finally {
            setCreatingPage(false);
        }
    };

    const handleCreateChild = async (pageId: string) => {
        if (creatingPage) {
            return;
        }

        const title = window.prompt('Enter page title:', 'Untitled Page');
        if (!title || title.trim() === '') {
            return;
        }

        setCreatingPage(true);
        try {
            const result = await actions.createPage(wikiId, title, pageId);
            if (result.error) {
                alert(`Failed to create child page: ${result.error.message || 'Unknown error'}`);
            }
        } catch (error) {
            alert('Failed to create child page. Please try again.');
            console.error('Create child page error:', error);
        } finally {
            setCreatingPage(false);
        }
    };

    const handleRename = async (pageId: string) => {
        if (renamingPageId) {
            return;
        }

        const page = pages.find((p) => p.id === pageId);
        if (!page) {
            return;
        }

        const currentTitle = (page.props?.title as string | undefined) || page.message || 'Untitled';
        const newTitle = window.prompt('Enter new title:', currentTitle);
        if (!newTitle || newTitle.trim() === '' || newTitle === currentTitle) {
            return;
        }

        setRenamingPageId(pageId);
        try {
            const result = await actions.renamePage(pageId, newTitle, wikiId);
            if (result.error) {
                alert(`Failed to rename page: ${result.error.message || 'Unknown error'}`);
            }
        } catch (error) {
            alert('Failed to rename page. Please try again.');
            console.error('Rename page error:', error);
        } finally {
            setRenamingPageId(null);
        }
    };

    const handleDuplicate = (pageId: string) => {
        alert('Duplicate functionality coming soon!');
        console.log('Duplicate page:', pageId);
    };

    const handleMove = (pageId: string) => {
        alert('Move functionality coming soon! This will open a modal to select a new parent page.');
        console.log('Move page:', pageId);
    };

    const getDescendantCount = (pageId: string, pages: PageOrDraft[]): number => {
        const children = pages.filter((p) => p.page_parent_id === pageId);
        let count = children.length;

        children.forEach((child) => {
            count += getDescendantCount(child.id, pages);
        });

        return count;
    };

    const getAllDescendantIds = (pageId: string, pages: PageOrDraft[]): string[] => {
        const children = pages.filter((p) => p.page_parent_id === pageId);
        const descendantIds: string[] = [];

        children.forEach((child) => {
            descendantIds.push(child.id);
            descendantIds.push(...getAllDescendantIds(child.id, pages));
        });

        return descendantIds;
    };

    const handleDelete = async (pageId: string) => {
        if (deletingPageId) {
            return;
        }

        const page = allPages.find((p) => p.id === pageId);
        if (!page) {
            console.error('[handleDelete] Page not found:', pageId);
            return;
        }

        const isDraft = page.type === PageDisplayTypes.PAGE_DRAFT;
        const title = page.props?.title || page.message || (isDraft ? 'this draft' : 'this page');

        console.log('[handleDelete] Deleting:', {
            pageId,
            isDraft,
            title,
            wikiId,
            pageType: page.type,
        });

        if (isDraft) {
            if (!window.confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) {
                return;
            }

            setDeletingPageId(pageId);
            try {
                console.log('[handleDelete] Calling removePageDraft:', {wikiId, pageId});
                const result = await actions.removePageDraft(wikiId, pageId);

                console.log('[handleDelete] Result:', result);

                if (result.error) {
                    alert(`Failed to delete draft: ${result.error.message || 'Unknown error'}`);
                } else {
                    console.log('[handleDelete] Successfully deleted draft');
                }
            } catch (error) {
                alert('Failed to delete draft. Please try again.');
                console.error('Delete draft error:', error);
            } finally {
                setDeletingPageId(null);
            }
            return;
        }

        const childCount = getDescendantCount(pageId, allPages);

        if (childCount > 0) {
            setPageToDelete({page, childCount});
            setShowDeleteModal(true);
        } else {
            if (!window.confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) {
                return;
            }

            setDeletingPageId(pageId);
            try {
                console.log('[handleDelete] Calling deletePage:', {pageId, wikiId});
                const result = await actions.deletePage(pageId, wikiId);

                console.log('[handleDelete] Result:', result);

                if (result.error) {
                    alert(`Failed to delete page: ${result.error.message || 'Unknown error'}`);
                } else {
                    console.log('[handleDelete] Successfully deleted page');
                }
            } catch (error) {
                alert('Failed to delete page. Please try again.');
                console.error('Delete page error:', error);
            } finally {
                setDeletingPageId(null);
            }
        }
    };

    const handleDeleteConfirm = async (deleteChildren: boolean) => {
        if (!pageToDelete) {
            return;
        }

        const {page} = pageToDelete;

        setShowDeleteModal(false);
        setDeletingPageId(page.id);

        try {
            console.log('[handleDeleteConfirm] Deleting page:', {
                pageId: page.id,
                wikiId,
                deleteChildren,
            });

            if (deleteChildren) {
                const descendantIds = getAllDescendantIds(page.id, allPages);
                console.log('[handleDeleteConfirm] Deleting descendants:', descendantIds);

                for (const descendantId of descendantIds.reverse()) {
                    // eslint-disable-next-line no-await-in-loop
                    const result = await actions.deletePage(descendantId, wikiId);
                    if (result.error) {
                        console.error('[handleDeleteConfirm] Failed to delete descendant:', descendantId, result.error);
                    }
                }
            }

            const result = await actions.deletePage(page.id, wikiId);

            console.log('[handleDeleteConfirm] Result:', result);

            if (result.error) {
                alert(`Failed to delete page: ${result.error.message || 'Unknown error'}`);
            } else {
                console.log('[handleDeleteConfirm] Successfully deleted page');
            }
        } catch (error) {
            alert('Failed to delete page. Please try again.');
            console.error('Delete page error:', error);
        } finally {
            setDeletingPageId(null);
            setPageToDelete(null);
        }
    };

    const handleDeleteCancel = () => {
        setShowDeleteModal(false);
        setPageToDelete(null);
    };

    if (loading && pages.length === 0) {
        return (
            <div
                className={classNames('PagesHierarchyPanel', {
                    'PagesHierarchyPanel--collapsed': isPanelCollapsed,
                })}
            >
                <div className='PagesHierarchyPanel__loading'>
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
        >
            {/* Header */}
            <PagesHeader
                title='Pages'
                onNewPage={handleNewPage}
                onCollapse={actions.closePagesPanel}
                isCreating={creatingPage}
            />

            {/* Search */}
            <PageSearchBar
                value={searchQuery}
                onChange={setSearchQuery}
            />

            {/* Tree (includes both pages and drafts) */}
            <div className='PagesHierarchyPanel__tree'>
                {filteredTree.length === 0 ? (
                    <div className='PagesHierarchyPanel__empty'>
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
                        onCreateChild={handleCreateChild}
                        onRename={handleRename}
                        onDuplicate={handleDuplicate}
                        onMove={handleMove}
                        onDelete={handleDelete}
                        renamingPageId={renamingPageId}
                        deletingPageId={deletingPageId}
                        wikiId={wikiId}
                        channelId={channelId}
                    />
                )}
            </div>

            {/* Delete confirmation modal */}
            {showDeleteModal && pageToDelete && (
                <DeletePageModal
                    pageTitle={(pageToDelete.page.props?.title as string | undefined) || pageToDelete.page.message || 'Untitled'}
                    childCount={pageToDelete.childCount}
                    onConfirm={handleDeleteConfirm}
                    onCancel={handleDeleteCancel}
                />
            )}
        </div>
    );
};

export default PagesHierarchyPanel;
