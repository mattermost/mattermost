// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useState, useCallback, useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {Post} from '@mattermost/types/posts';
import type {Wiki} from '@mattermost/types/wikis';

import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import type {ActionResult} from 'mattermost-redux/types/actions';

import {removePageDraft, savePageDraft} from 'actions/page_drafts';
import {createPage, deletePage, duplicatePage, loadChannelWikis, loadPages, movePageToWiki, updatePage} from 'actions/pages';
import {expandAncestors} from 'actions/views/pages_hierarchy';

import {PageDisplayTypes} from 'utils/constants';

import type {GlobalState} from 'types/store';
import type {PostDraft} from 'types/store/draft';

type UsePageMenuHandlersProps = {
    wikiId: string;
    channelId: string;
    pages: Post[];
    drafts: PostDraft[];
    onPageSelect?: (pageId: string, isDraft?: boolean) => void;
    onCancelAutosave?: () => void;
};

export const usePageMenuHandlers = ({wikiId, channelId, pages, drafts, onPageSelect, onCancelAutosave}: UsePageMenuHandlersProps) => {
    const dispatch = useDispatch();
    const currentUserId = useSelector((state: GlobalState) => getCurrentUserId(state));

    // Convert drafts to Post-like objects and combine with pages
    // If a draft exists for a page, it should replace the published page in the list
    const allPages = useMemo(() => {
        const draftPosts: Post[] = drafts.map((draft): Post => ({
            id: draft.rootId,
            create_at: draft.createAt || 0,
            update_at: draft.updateAt || 0,
            edit_at: 0,
            delete_at: 0,
            is_pinned: false,
            user_id: currentUserId,
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

        // Create a map of draft IDs for quick lookup
        const draftIds = new Set(draftPosts.map((d) => d.id));

        // Filter out published pages that have drafts, then add the drafts
        const pagesWithoutDrafts = pages.filter((p) => !draftIds.has(p.id));
        return [...pagesWithoutDrafts, ...draftPosts];
    }, [pages, drafts, currentUserId]);

    const [showCreatePageModal, setShowCreatePageModal] = useState(false);
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [createPageParent, setCreatePageParent] = useState<{id: string; title: string} | null>(null);
    const [pageToMove, setPageToMove] = useState<{pageId: string; pageTitle: string; hasChildren: boolean} | null>(null);
    const [pageToDelete, setPageToDelete] = useState<{page: Post; childCount: number} | null>(null);
    const [availableWikis, setAvailableWikis] = useState<Wiki[]>([]);
    const [deletingPageId, setDeletingPageId] = useState<string | null>(null);
    const [creatingPage, setCreatingPage] = useState(false);
    const [showBookmarkModal, setShowBookmarkModal] = useState(false);
    const [pageToBookmark, setPageToBookmark] = useState<{pageId: string; pageTitle: string} | null>(null);
    const [showRenameModal, setShowRenameModal] = useState(false);
    const [pageToRename, setPageToRename] = useState<{pageId: string; currentTitle: string} | null>(null);
    const [renamingPage, setRenamingPage] = useState(false);

    const getDescendantCount = useCallback((pageId: string): number => {
        const children = allPages.filter((p) => p.page_parent_id === pageId);
        let count = children.length;
        children.forEach((child) => {
            count += getDescendantCount(child.id);
        });
        return count;
    }, [allPages]);

    const getAllDescendantIds = useCallback((pageId: string): string[] => {
        const children = allPages.filter((p) => p.page_parent_id === pageId);
        const descendantIds: string[] = [];
        children.forEach((child) => {
            descendantIds.push(child.id);
            descendantIds.push(...getAllDescendantIds(child.id));
        });
        return descendantIds;
    }, [allPages]);

    const handleCreateChild = useCallback((pageId: string) => {
        if (creatingPage) {
            return;
        }
        const parentPage = allPages.find((p) => p.id === pageId);
        const parentTitle = parentPage?.props?.title as string | undefined;
        setCreatePageParent({
            id: pageId,
            title: parentTitle || 'Untitled',
        });
        setShowCreatePageModal(true);
    }, [allPages, creatingPage]);

    const handleConfirmCreatePage = useCallback(async (title: string) => {
        setCreatingPage(true);
        try {
            const parentPageId = createPageParent?.id;
            const result = await dispatch(createPage(wikiId, title, parentPageId)) as ActionResult<string>;
            if (result.error) {
                setCreatingPage(false);
                throw result.error;
            }

            if (result.data) {
                const draftId = result.data;
                if (parentPageId) {
                    dispatch(expandAncestors(wikiId, [parentPageId]));
                }

                // Pass true to indicate this is a new draft (not a published page)
                onPageSelect?.(draftId, true);
            }
        } finally {
            setCreatingPage(false);
            setCreatePageParent(null);
        }
    }, [dispatch, createPageParent, wikiId, onPageSelect]);

    const handleCancelCreatePage = useCallback(() => {
        setCreatePageParent(null);
    }, []);

    const handleRename = useCallback((pageId: string) => {
        if (renamingPage) {
            return;
        }
        const page = allPages.find((p) => p.id === pageId);
        if (!page || !wikiId) {
            return;
        }

        const currentTitle = (page.props?.title as string | undefined) || page.message || '';
        setPageToRename({pageId, currentTitle});
        setShowRenameModal(true);
    }, [allPages, wikiId, renamingPage]);

    const handleConfirmRename = useCallback(async (newTitle: string) => {
        if (!pageToRename || !wikiId) {
            return;
        }

        setRenamingPage(true);
        try {
            const page = allPages.find((p) => p.id === pageToRename.pageId);
            const isDraft = page?.type === PageDisplayTypes.PAGE_DRAFT;

            if (isDraft) {
                const draft = drafts.find((d) => d.rootId === pageToRename.pageId);

                if (draft) {
                    onCancelAutosave?.();

                    const {page_parent_id: pageParentId, has_published_version: hasPublishedVersion, ...otherProps} = draft.props || {};
                    const propsToPreserve = {
                        ...(pageParentId !== undefined && {page_parent_id: pageParentId}),
                        ...(hasPublishedVersion !== undefined && {has_published_version: hasPublishedVersion}),
                        ...otherProps,
                    };

                    const contentToSave = draft.message || '';

                    const result = await dispatch(savePageDraft(
                        channelId,
                        wikiId,
                        pageToRename.pageId,
                        contentToSave,
                        newTitle,
                        draft.updateAt,
                        propsToPreserve,
                    )) as ActionResult<boolean>;

                    if (result.error) {
                        throw result.error;
                    }
                }
            } else {
                const result = await dispatch(updatePage(pageToRename.pageId, newTitle, wikiId)) as ActionResult<Post>;
                if (result.error) {
                    throw result.error;
                }
            }
        } finally {
            setRenamingPage(false);
            setPageToRename(null);
        }
    }, [dispatch, pageToRename, wikiId, allPages, channelId, drafts, onCancelAutosave]);

    const handleCancelRename = useCallback(() => {
        setShowRenameModal(false);
        setPageToRename(null);
    }, []);

    const handleDuplicate = useCallback(async (pageId: string) => {
        const page = allPages.find((p) => p.id === pageId);
        if (!page) {
            return;
        }

        try {
            await dispatch(duplicatePage(pageId, wikiId));
        } catch (error) {
            // Error handled
        }
    }, [allPages, wikiId, dispatch]);

    const handleMove = useCallback(async (pageId: string) => {
        const page = allPages.find((p) => p.id === pageId);
        if (!page) {
            return;
        }
        const pageTitle = page.props?.title || page.message || 'Untitled';
        const childCount = getDescendantCount(pageId);
        const hasChildren = childCount > 0;

        try {
            const result = await dispatch(loadChannelWikis(channelId));
            setAvailableWikis((result as ActionResult<Wiki[]>).data || []);
            setPageToMove({pageId, pageTitle: String(pageTitle), hasChildren});
            setShowMoveModal(true);
        } catch (error) {
            // Error handled
        }
    }, [allPages, channelId, dispatch, getDescendantCount]);

    const handleMoveConfirm = useCallback(async (targetWikiId: string, parentPageId?: string) => {
        if (!pageToMove) {
            return;
        }
        try {
            await dispatch(movePageToWiki(pageToMove.pageId, wikiId, targetWikiId, parentPageId));
        } finally {
            setShowMoveModal(false);
            setPageToMove(null);
        }
    }, [dispatch, pageToMove, wikiId]);

    const handleMoveCancel = useCallback(() => {
        setShowMoveModal(false);
        setPageToMove(null);
    }, []);

    const handleDelete = useCallback((pageId: string) => {
        if (deletingPageId) {
            return;
        }
        const page = allPages.find((p) => p.id === pageId);
        if (!page) {
            return;
        }
        const isDraft = page.type === PageDisplayTypes.PAGE_DRAFT;
        if (isDraft) {
            setPageToDelete({page, childCount: 0});
            setShowDeleteModal(true);
            return;
        }
        const childCount = getDescendantCount(pageId);
        setPageToDelete({page, childCount});
        setShowDeleteModal(true);
    }, [allPages, deletingPageId, getDescendantCount]);

    const handleDeleteConfirm = useCallback(async (deleteChildren: boolean) => {
        if (!pageToDelete) {
            return;
        }
        const {page} = pageToDelete;
        const isDraft = page.type === PageDisplayTypes.PAGE_DRAFT;

        setShowDeleteModal(false);
        setDeletingPageId(page.id);

        try {
            if (isDraft) {
                const result = await dispatch(removePageDraft(wikiId, page.id)) as ActionResult<boolean>;
                if (result.error) {
                    return;
                }
                onPageSelect?.('');
            } else {
                if (deleteChildren) {
                    const descendantIds = getAllDescendantIds(page.id);
                    for (const descendantId of descendantIds.reverse()) {
                        // eslint-disable-next-line no-await-in-loop
                        const result = await dispatch(deletePage(descendantId, wikiId)) as ActionResult<boolean>;
                        if (result.error) {
                            return;
                        }
                    }
                }
                const result = await dispatch(deletePage(page.id, wikiId)) as ActionResult<boolean>;
                if (result.error) {
                    return;
                }

                const parentId = page.page_parent_id || '';
                onPageSelect?.(parentId);
            }
        } finally {
            setDeletingPageId(null);
            setPageToDelete(null);
        }
    }, [dispatch, pageToDelete, wikiId, getAllDescendantIds, onPageSelect]);

    const handleDeleteCancel = useCallback(() => {
        setShowDeleteModal(false);
        setPageToDelete(null);
    }, []);

    const handleBookmarkInChannel = useCallback((pageId: string) => {
        const page = allPages.find((p) => p.id === pageId);
        if (!page) {
            return;
        }

        // Check if this is a draft
        const isDraft = page.type === PageDisplayTypes.PAGE_DRAFT;
        if (isDraft) {
            // If it's a draft editing an existing page, use the actual page ID
            const actualPageId = page.props?.page_id as string | undefined;
            if (actualPageId) {
                // Find the actual published page
                const actualPage = pages.find((p) => p.id === actualPageId);
                if (actualPage) {
                    const pageTitle = actualPage.props?.title || actualPage.message || 'Untitled';
                    setPageToBookmark({pageId: actualPageId, pageTitle: String(pageTitle)});
                    setShowBookmarkModal(true);
                    return;
                }
            }

            // Can't bookmark unpublished drafts - show error or just return
            return;
        }

        const pageTitle = page.props?.title || page.message || 'Untitled';
        setPageToBookmark({pageId, pageTitle: String(pageTitle)});
        setShowBookmarkModal(true);
    }, [allPages, pages]);

    const handleBookmarkCancel = useCallback(() => {
        setShowBookmarkModal(false);
        setPageToBookmark(null);
    }, []);

    const fetchPagesForWiki = useCallback(async (targetWikiId: string): Promise<Post[]> => {
        try {
            const wikisResult = await dispatch(loadChannelWikis(channelId));
            const wikis = (wikisResult as ActionResult<Wiki[]>).data;
            const targetWiki = wikis?.find((w) => w.id === targetWikiId);
            if (targetWiki) {
                const pagesResult = await dispatch(loadPages(targetWikiId));
                return (pagesResult as ActionResult<Post[]>).data || [];
            }
            return [];
        } catch (error) {
            return [];
        }
    }, [channelId, dispatch]);

    return {

        // Handlers
        handleCreateChild,
        handleRename,
        handleDuplicate,
        handleMove,
        handleDelete,
        handleBookmarkInChannel,

        // Modal state
        showCreatePageModal,
        setShowCreatePageModal,
        showMoveModal,
        setShowMoveModal,
        showDeleteModal,
        setShowDeleteModal,
        showBookmarkModal,
        setShowBookmarkModal,
        showRenameModal,
        setShowRenameModal,

        // Modal data
        createPageParent,
        pageToMove,
        pageToDelete,
        availableWikis,
        pageToBookmark,
        pageToRename,

        // Modal handlers
        handleConfirmCreatePage,
        handleCancelCreatePage,
        handleMoveConfirm,
        handleMoveCancel,
        handleDeleteConfirm,
        handleDeleteCancel,
        handleBookmarkCancel,
        handleConfirmRename,
        handleCancelRename,

        // Helper
        fetchPagesForWiki,

        // Loading states
        deletingPageId,
        creatingPage,
        renamingPage,
    };
};
