// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useEffect, useMemo, useState} from 'react';

import type {Post} from '@mattermost/types/posts';

import {Client4} from 'mattermost-redux/client';

import DuplicatePageModal from 'components/duplicate_page_modal';
import MovePageModal from 'components/move_page_modal';
import TextInputModal from 'components/text_input_modal';

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
    const [creatingPage, setCreatingPage] = useState(false);
    const [renamingPageId, setRenamingPageId] = useState<string | null>(null);
    const [deletingPageId, setDeletingPageId] = useState<string | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [pageToDelete, setPageToDelete] = useState<{page: Post; childCount: number} | null>(null);
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [pageToMove, setPageToMove] = useState<{pageId: string; pageTitle: string; hasChildren: boolean} | null>(null);
    const [showDuplicateModal, setShowDuplicateModal] = useState(false);
    const [pageToDuplicate, setPageToDuplicate] = useState<{pageId: string; pageTitle: string; hasChildren: boolean} | null>(null);
    const [availableWikis, setAvailableWikis] = useState<any[]>([]);
    const [showCreatePageModal, setShowCreatePageModal] = useState(false);
    const [createPageParent, setCreatePageParent] = useState<{id: string; title: string} | null>(null);
    const [showRenameModal, setShowRenameModal] = useState(false);
    const [pageToRename, setPageToRename] = useState<{pageId: string; currentTitle: string} | null>(null);

    // Load pages and drafts on mount, when wikiId changes, or when pages are invalidated
    // lastInvalidated timestamp changes when wiki is renamed/modified, triggering a reload
    useEffect(() => {
        actions.loadPages(wikiId);
        actions.loadPageDraftsForWiki(wikiId);
    }, [wikiId, lastInvalidated]);

    // Convert drafts to Post-like objects to include in tree
    const draftPosts: DraftPage[] = useMemo(() => {
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

    // Memoize pageMap to avoid recreating it on every render
    // Must include both pages and drafts since tree contains both
    const pageMap = useMemo(() => {
        return new Map([...pages, ...draftPosts].map((p) => [p.id, p]));
    }, [pages, draftPosts]);

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
        if (creatingPage) {
            return;
        }
        setCreatePageParent(null);
        setShowCreatePageModal(true);
    };

    const handleConfirmCreatePage = async (title: string) => {
        setCreatingPage(true);

        try {
            const parentPageId = createPageParent?.id;
            const result = await actions.createPage(wikiId, title, parentPageId);
            if (result.error) {
                // TODO: Show error notification instead of alert
            } else if (result.data) {
                const draftId = result.data;
                if (parentPageId) {
                    actions.expandAncestors(wikiId, [parentPageId]);
                }
                handlePageSelect(draftId);
            }
        } catch (error) {
            // TODO: Show error notification instead of alert
        } finally {
            setCreatingPage(false);
            setCreatePageParent(null);
        }
    };

    const handleCancelCreatePage = () => {
        setCreatePageParent(null);
    };

    const handleCreateChild = (pageId: string) => {
        if (creatingPage) {
            return;
        }

        const parentPage = pageMap.get(pageId);
        const parentTitle = parentPage?.props?.title as string | undefined;

        setCreatePageParent({
            id: pageId,
            title: parentTitle || 'Untitled',
        });
        setShowCreatePageModal(true);
    };

    const handleRename = (pageId: string) => {
        if (renamingPageId) {
            return;
        }

        const page = pages.find((p) => p.id === pageId);
        if (!page) {
            return;
        }

        const currentTitle = (page.props?.title as string | undefined) || page.message || 'Untitled';

        setPageToRename({pageId, currentTitle});
        setShowRenameModal(true);
    };

    const handleRenameConfirm = async (newTitle: string) => {
        if (!pageToRename) {
            return;
        }

        const trimmedTitle = newTitle.trim();
        if (!trimmedTitle || trimmedTitle === pageToRename.currentTitle) {
            setPageToRename(null);
            return;
        }

        setRenamingPageId(pageToRename.pageId);

        try {
            const result = await actions.updatePage(pageToRename.pageId, trimmedTitle, wikiId);
            if (result.error) {
                // TODO: Show error notification instead of alert
            }
        } catch (error) {
            // TODO: Show error notification instead of alert
        } finally {
            setRenamingPageId(null);
            setPageToRename(null);
        }
    };

    const handleRenameCancel = () => {
        setPageToRename(null);
    };

    const handleDuplicate = async (pageId: string) => {
        const page = allPages.find((p) => p.id === pageId);
        if (!page) {
            return;
        }

        const pageTitle = page.props?.title || page.message || 'Untitled';
        const childCount = getDescendantCount(pageId, childrenMap);
        const hasChildren = childCount > 0;

        try {
            const wikis = await Client4.getChannelWikis(channelId);
            setAvailableWikis(wikis || []);
            setPageToDuplicate({pageId, pageTitle: String(pageTitle), hasChildren});
            setShowDuplicateModal(true);
        } catch (error) {
            // TODO: Show error notification instead of alert
        }
    };

    const handleDuplicateConfirm = async (targetWikiId: string, parentPageId?: string, customTitle?: string) => {
        if (!pageToDuplicate) {
            return;
        }

        try {
            await actions.duplicatePage(pageToDuplicate.pageId, wikiId, targetWikiId, parentPageId, customTitle);
        } finally {
            setShowDuplicateModal(false);
            setPageToDuplicate(null);
        }
    };

    const handleDuplicateCancel = () => {
        setShowDuplicateModal(false);
        setPageToDuplicate(null);
    };

    const handleMove = async (pageId: string) => {
        const page = allPages.find((p) => p.id === pageId);
        if (!page) {
            return;
        }

        const pageTitle = page.props?.title || page.message || 'Untitled';
        const childCount = getDescendantCount(pageId, childrenMap);
        const hasChildren = childCount > 0;

        try {
            const wikis = await Client4.getChannelWikis(channelId);
            setAvailableWikis(wikis || []);
            setPageToMove({pageId, pageTitle: String(pageTitle), hasChildren});
            setShowMoveModal(true);
        } catch (error) {
            // TODO: Show error notification instead of alert
        }
    };

    const fetchPagesForWiki = useCallback(async (wikiId: string): Promise<typeof pages> => {
        try {
            const result = await actions.loadPages(wikiId);
            return result.data || [];
        } catch (error) {
            return [];
        }
    }, [actions]);

    const handleMoveConfirm = async (targetWikiId: string, parentPageId?: string) => {
        if (!pageToMove) {
            return;
        }

        try {
            const result = await actions.movePageToWiki(pageToMove.pageId, wikiId, targetWikiId, parentPageId);
            if (result.error) {
                // TODO: Show error notification instead of alert
            }
        } catch (error) {
            // TODO: Show error notification instead of alert
        } finally {
            setShowMoveModal(false);
            setPageToMove(null);
        }
    };

    const handleMoveCancel = () => {
        setShowMoveModal(false);
        setPageToMove(null);
    };

    // Memoize children map for efficient descendant lookups
    const childrenMap = useMemo(() => {
        const map = new Map<string, PageOrDraft[]>();
        allPages.forEach((page) => {
            const parentId = page.page_parent_id || '';
            if (!map.has(parentId)) {
                map.set(parentId, []);
            }
            map.get(parentId)!.push(page);
        });
        return map;
    }, [allPages]);

    const getDescendantCount = useCallback((pageId: string, childrenMap: Map<string, PageOrDraft[]>): number => {
        const children = childrenMap.get(pageId) || [];
        let count = children.length;

        children.forEach((child) => {
            count += getDescendantCount(child.id, childrenMap);
        });

        return count;
    }, []);

    const getAllDescendantIds = useCallback((pageId: string, childrenMap: Map<string, PageOrDraft[]>): string[] => {
        const children = childrenMap.get(pageId) || [];
        const descendantIds: string[] = [];

        children.forEach((child) => {
            descendantIds.push(child.id);
            descendantIds.push(...getAllDescendantIds(child.id, childrenMap));
        });

        return descendantIds;
    }, []);

    const handleDelete = async (pageId: string) => {
        if (deletingPageId) {
            return;
        }

        const page = allPages.find((p) => p.id === pageId);
        if (!page) {
            return;
        }

        const isDraft = page.type === PageDisplayTypes.PAGE_DRAFT as any;

        if (isDraft) {
            // Use modal dialog for drafts as well for consistency
            const draftPage = page as any as Post;
            setPageToDelete({page: draftPage, childCount: 0});
            setShowDeleteModal(true);
            return;
        }

        const childCount = getDescendantCount(pageId, childrenMap);

        // Always use modal dialog for consistency and testability
        setPageToDelete({page: page as Post, childCount});
        setShowDeleteModal(true);
    };

    const handleDeleteConfirm = async (deleteChildren: boolean) => {
        if (!pageToDelete) {
            return;
        }

        const {page} = pageToDelete;
        const isDraft = page.type === PageDisplayTypes.PAGE_DRAFT as any;

        setShowDeleteModal(false);
        setDeletingPageId(page.id);

        try {
            if (isDraft) {
                // Handle draft deletion
                const result = await actions.removePageDraft(wikiId, page.id);

                if (result.error) {
                    // TODO: Show error notification instead of alert
                }
            } else {
                // Handle regular page deletion
                if (deleteChildren) {
                    const descendantIds = getAllDescendantIds(page.id, childrenMap);

                    for (const descendantId of descendantIds.reverse()) {
                        // eslint-disable-next-line no-await-in-loop
                        await actions.deletePage(descendantId, wikiId);
                    }
                }

                const result = await actions.deletePage(page.id, wikiId);

                if (result.error) {
                    // TODO: Show error notification instead of alert
                } else {
                    const deletedPageIds = deleteChildren ? [page.id, ...getAllDescendantIds(page.id, childrenMap)] : [page.id];
                    const isViewingDeletedPage = currentPageId && deletedPageIds.includes(currentPageId);

                    if (isViewingDeletedPage) {
                        const parentId = page.page_parent_id || '';
                        onPageSelect(parentId);
                    }
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
                isCreating={creatingPage}
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

            {/* Move page to wiki modal */}
            {showMoveModal && pageToMove && (
                <MovePageModal
                    pageId={pageToMove.pageId}
                    pageTitle={pageToMove.pageTitle}
                    currentWikiId={wikiId}
                    availableWikis={availableWikis}
                    fetchPagesForWiki={fetchPagesForWiki}
                    hasChildren={pageToMove.hasChildren}
                    onConfirm={handleMoveConfirm}
                    onCancel={handleMoveCancel}
                />
            )}

            {/* Duplicate page modal */}
            {showDuplicateModal && pageToDuplicate && (
                <DuplicatePageModal
                    pageId={pageToDuplicate.pageId}
                    pageTitle={pageToDuplicate.pageTitle}
                    currentWikiId={wikiId}
                    availableWikis={availableWikis}
                    fetchPagesForWiki={fetchPagesForWiki}
                    hasChildren={pageToDuplicate.hasChildren}
                    onConfirm={handleDuplicateConfirm}
                    onCancel={handleDuplicateCancel}
                />
            )}

            {/* Rename page modal */}
            {showRenameModal && pageToRename && (
                <TextInputModal
                    show={showRenameModal}
                    title='Rename Page'
                    placeholder='Enter new page title...'
                    confirmButtonText='Rename'
                    maxLength={255}
                    initialValue={pageToRename.currentTitle}
                    ariaLabel='Rename Page'
                    inputTestId='rename-page-modal-title-input'
                    onConfirm={handleRenameConfirm}
                    onCancel={handleRenameCancel}
                    onHide={() => setShowRenameModal(false)}
                />
            )}

            {/* Create page modal */}
            <TextInputModal
                show={showCreatePageModal}
                title={createPageParent ? `Create Child Page under "${createPageParent.title}"` : 'Create New Page'}
                placeholder='Enter page title...'
                helpText={createPageParent ? `This page will be created as a child of "${createPageParent.title}".` : 'A new draft will be created for you to edit.'}
                confirmButtonText='Create'
                maxLength={255}
                ariaLabel='Create Page'
                inputTestId='create-page-modal-title-input'
                onConfirm={handleConfirmCreatePage}
                onCancel={handleCancelCreatePage}
                onHide={() => setShowCreatePageModal(false)}
            />
        </div>
    );
};

export default PagesHierarchyPanel;
