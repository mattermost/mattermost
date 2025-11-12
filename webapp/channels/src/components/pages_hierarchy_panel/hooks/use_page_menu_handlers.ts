// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useState, useCallback, useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {useHistory, useLocation} from 'react-router-dom';

import type {Post} from '@mattermost/types/posts';

import {Client4} from 'mattermost-redux/client';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {removePageDraft} from 'actions/page_drafts';
import {createPage, deletePage, duplicatePage, movePageToWiki} from 'actions/pages';
import {expandAncestors} from 'actions/views/pages_hierarchy';
import {openPageInEditMode} from 'actions/wiki_edit';

import {PageDisplayTypes} from 'utils/constants';

import type {GlobalState} from 'types/store';
import type {PostDraft} from 'types/store/draft';

type UsePageMenuHandlersProps = {
    wikiId: string;
    channelId: string;
    pages: Post[];
    drafts: PostDraft[];
    onPageSelect?: (pageId: string) => void;
};

export const usePageMenuHandlers = ({wikiId, channelId, pages, drafts, onPageSelect}: UsePageMenuHandlersProps) => {
    const dispatch = useDispatch();
    const history = useHistory();
    const location = useLocation();
    const currentUserId = useSelector((state: GlobalState) => getCurrentUserId(state));

    // Convert drafts to Post-like objects and combine with pages
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
            type: PageDisplayTypes.PAGE_DRAFT as any,
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
        return [...pages, ...draftPosts];
    }, [pages, drafts, currentUserId]);

    const [showCreatePageModal, setShowCreatePageModal] = useState(false);
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [createPageParent, setCreatePageParent] = useState<{id: string; title: string} | null>(null);
    const [pageToMove, setPageToMove] = useState<{pageId: string; pageTitle: string; hasChildren: boolean} | null>(null);
    const [pageToDelete, setPageToDelete] = useState<{page: Post; childCount: number} | null>(null);
    const [availableWikis, setAvailableWikis] = useState<any[]>([]);
    const [deletingPageId, setDeletingPageId] = useState<string | null>(null);
    const [creatingPage, setCreatingPage] = useState(false);

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
            const result = await dispatch(createPage(wikiId, title, parentPageId));
            if ((result as any).error) {
                setCreatingPage(false);
                throw (result as any).error;
            }

            if ((result as any).data) {
                const draftId = (result as any).data;
                if (parentPageId) {
                    dispatch(expandAncestors(wikiId, [parentPageId]));
                }
                onPageSelect?.(draftId);
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
        const page = allPages.find((p) => p.id === pageId);
        if (!page || !wikiId) {
            return;
        }

        dispatch(openPageInEditMode(channelId, wikiId, page, history, location));
    }, [allPages, wikiId, channelId, history, location, dispatch]);

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
            const wikis = await Client4.getChannelWikis(channelId);
            setAvailableWikis(wikis || []);
            setPageToMove({pageId, pageTitle: String(pageTitle), hasChildren});
            setShowMoveModal(true);
        } catch (error) {
            // Error handled
        }
    }, [allPages, channelId, getDescendantCount]);

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
        const isDraft = page.type === PageDisplayTypes.PAGE_DRAFT as any;
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
        const isDraft = page.type === PageDisplayTypes.PAGE_DRAFT as any;

        setShowDeleteModal(false);
        setDeletingPageId(page.id);

        try {
            if (isDraft) {
                await dispatch(removePageDraft(wikiId, page.id));
                onPageSelect?.('');
            } else {
                if (deleteChildren) {
                    const descendantIds = getAllDescendantIds(page.id);
                    for (const descendantId of descendantIds.reverse()) {
                        // eslint-disable-next-line no-await-in-loop
                        await dispatch(deletePage(descendantId, wikiId));
                    }
                }
                await dispatch(deletePage(page.id, wikiId));

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

    const fetchPagesForWiki = useCallback(async (targetWikiId: string): Promise<Post[]> => {
        try {
            const wikis = await Client4.getChannelWikis(channelId);
            const targetWiki = wikis?.find((w: any) => w.id === targetWikiId);
            if (targetWiki) {
                const pages = await Client4.getPages(targetWikiId);
                return pages || [];
            }
            return [];
        } catch (error) {
            return [];
        }
    }, [channelId]);

    return {

        // Handlers
        handleCreateChild,
        handleRename,
        handleDuplicate,
        handleMove,
        handleDelete,

        // Modal state
        showCreatePageModal,
        setShowCreatePageModal,
        showMoveModal,
        setShowMoveModal,
        showDeleteModal,
        setShowDeleteModal,

        // Modal data
        createPageParent,
        pageToMove,
        pageToDelete,
        availableWikis,

        // Modal handlers
        handleConfirmCreatePage,
        handleCancelCreatePage,
        handleMoveConfirm,
        handleMoveCancel,
        handleDeleteConfirm,
        handleDeleteCancel,

        // Helper
        fetchPagesForWiki,

        // Loading states
        deletingPageId,
        creatingPage,
    };
};
