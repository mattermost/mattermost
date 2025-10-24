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
        console.log('[DEBUG] PagesHierarchyPanel mounted/wikiId changed:', wikiId);
        actions.loadWikiPages(wikiId);
        actions.loadPageDraftsForWiki(wikiId);
    }, [wikiId]);

    // Debug: Log when pages or drafts props change
    useEffect(() => {
        console.log('[DEBUG] PagesHierarchyPanel - pages prop changed:', {
            count: pages.length,
            ids: pages.map((p) => ({id: p.id, title: p.props?.title})),
        });
    }, [pages]);

    useEffect(() => {
        console.log('[DEBUG] PagesHierarchyPanel - drafts prop changed:', {
            count: drafts.length,
            drafts: drafts.map((d) => ({
                rootId: d.rootId,
                title: d.props?.title,
                channelId: d.channelId,
                wikiId: d.wikiId,
                page_parent_id: d.props?.page_parent_id,
                page_id: d.props?.page_id,
                createAt: d.createAt,
                updateAt: d.updateAt,
            })),
        });
    }, [drafts]);

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
        const converted = drafts.map((draft): DraftPage => ({
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
        console.log('[DEBUG] PagesHierarchyPanel - draftPosts converted:', converted.map((d) => ({
            id: d.id,
            title: d.props?.title,
            type: d.type,
            page_parent_id: d.page_parent_id,
        })));
        return converted;
    }, [drafts]);

    // Combine pages and drafts for tree building
    // But exclude published pages that have a draft (to avoid duplicates)
    const draftIds = useMemo(() => {
        const ids = new Set(drafts.map((d) => d.rootId));
        console.log('[DEBUG] PagesHierarchyPanel - draftIds (rootIds from drafts):', Array.from(ids));
        return ids;
    }, [drafts]);
    const pagesWithoutDrafts = useMemo(() => {
        const filtered = pages.filter((page) => {
            const hasDraft = draftIds.has(page.id);
            if (hasDraft) {
                console.log('[DEBUG] PagesHierarchyPanel - FILTERING OUT published page (has draft):', {
                    pageId: page.id,
                    title: page.props?.title,
                    type: page.type,
                });
            }
            return !hasDraft;
        });
        console.log('[DEBUG] PagesHierarchyPanel - pages:', pages.length, 'pagesWithoutDrafts:', filtered.length);
        console.log('[DEBUG] PagesHierarchyPanel - published pages details:', pages.map((p) => ({
            id: p.id,
            title: p.props?.title,
            type: p.type,
            page_parent_id: p.page_parent_id,
        })));
        return filtered;
    }, [pages, draftIds]);
    const allPages = useMemo(() => {
        const combined = [...pagesWithoutDrafts, ...draftPosts];
        console.log('[DEBUG] PagesHierarchyPanel - allPages (FINAL):', combined.length, 'breakdown:', {
            pagesWithoutDrafts: pagesWithoutDrafts.length,
            draftPosts: draftPosts.length,
        });
        console.log('[DEBUG] PagesHierarchyPanel - allPages details:', combined.map((p) => ({
            id: p.id,
            title: p.props?.title,
            type: p.type,
            isDraft: p.type === PageDisplayTypes.PAGE_DRAFT,
            page_parent_id: p.page_parent_id,
        })));
        return combined;
    }, [pagesWithoutDrafts, draftPosts]);

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

        // TODO: Replace prompt with modal dialog
        // eslint-disable-next-line no-alert
        const title = window.prompt('Enter page title:', 'Untitled Page');
        if (!title || title.trim() === '') {
            return;
        }

        setCreatingPage(true);
        try {
            const result = await actions.createPage(wikiId, title);
            console.log('[handleNewPage] createPage result:', result);
            if (result.error) {
                console.error('[handleNewPage] Error creating page:', result.error);
            } else if (result.data) {
                const draftId = result.data;
                console.log('[handleNewPage] Draft created with draftId:', draftId);
                handlePageSelect(draftId);
            }
        } catch (error) {
            console.error('[handleNewPage] Exception:', error);
        } finally {
            setCreatingPage(false);
        }
    };

    const handleCreateChild = async (pageId: string) => {
        if (creatingPage) {
            return;
        }

        // TODO: Replace prompt with modal dialog
        // eslint-disable-next-line no-alert
        const title = window.prompt('Enter page title:', 'Untitled Page');
        if (!title || title.trim() === '') {
            return;
        }

        setCreatingPage(true);
        try {
            const result = await actions.createPage(wikiId, title, pageId);
            if (result.error) {
                // TODO: Show error notification instead of alert
            } else if (result.data) {
                const draftId = result.data;
                actions.toggleNodeExpanded(wikiId, pageId);
                handlePageSelect(draftId);
            }
        } catch (error) {
            // TODO: Show error notification instead of alert
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

        // TODO: Replace prompt with modal dialog
        // eslint-disable-next-line no-alert
        const newTitle = window.prompt('Enter new title:', currentTitle);
        if (!newTitle || newTitle.trim() === '' || newTitle === currentTitle) {
            return;
        }

        setRenamingPageId(pageId);
        try {
            const result = await actions.renamePage(pageId, newTitle, wikiId);
            if (result.error) {
                // TODO: Show error notification instead of alert
            }
        } catch (error) {
            // TODO: Show error notification instead of alert
        } finally {
            setRenamingPageId(null);
        }
    };

    const handleDuplicate = () => {
        // TODO: Implement duplicate functionality
        // alert('Duplicate functionality coming soon!');
    };

    const handleMove = () => {
        // TODO: Implement move functionality with modal to select new parent
        // alert('Move functionality coming soon! This will open a modal to select a new parent page.');
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
            return;
        }

        const isDraft = page.type === PageDisplayTypes.PAGE_DRAFT;
        const title = page.props?.title || page.message || (isDraft ? 'this draft' : 'this page');

        if (isDraft) {
            // TODO: Replace confirm with modal dialog
            // eslint-disable-next-line no-alert
            if (!window.confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) {
                return;
            }

            setDeletingPageId(pageId);
            try {
                const result = await actions.removePageDraft(wikiId, pageId);

                if (result.error) {
                    // TODO: Show error notification instead of alert
                }
            } catch (error) {
                // TODO: Show error notification instead of alert
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
            // TODO: Replace confirm with modal dialog
            // eslint-disable-next-line no-alert
            if (!window.confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) {
                return;
            }

            setDeletingPageId(pageId);
            try {
                const result = await actions.deletePage(pageId, wikiId);

                if (result.error) {
                    // TODO: Show error notification instead of alert
                }
            } catch (error) {
                // TODO: Show error notification instead of alert
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
            if (deleteChildren) {
                const descendantIds = getAllDescendantIds(page.id, allPages);

                for (const descendantId of descendantIds.reverse()) {
                    // eslint-disable-next-line no-await-in-loop
                    await actions.deletePage(descendantId, wikiId);
                }
            }

            const result = await actions.deletePage(page.id, wikiId);

            if (result.error) {
                // TODO: Show error notification instead of alert
            } else {
                const deletedPageIds = deleteChildren ? [page.id, ...getAllDescendantIds(page.id, allPages)] : [page.id];
                const isViewingDeletedPage = currentPageId && deletedPageIds.includes(currentPageId);

                if (isViewingDeletedPage) {
                    const parentId = page.page_parent_id || '';
                    onPageSelect(parentId);
                }
            }
        } catch (error) {
            // TODO: Show error notification instead of alert
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
