// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useState, useCallback, useMemo, useRef} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import type {Post} from '@mattermost/types/posts';
import type {Wiki} from '@mattermost/types/wikis';

import type {ActionResult} from 'mattermost-redux/types/actions';

import {removePageDraft, savePageDraft} from 'actions/page_drafts';
import {createPage, deletePage, duplicatePage, fetchChannelWikis, fetchPages, movePageToWiki, updatePage} from 'actions/pages';
import {openModal} from 'actions/views/modals';
import {expandAncestors} from 'actions/views/pages_hierarchy';

import DeletePageModal from 'components/delete_page_modal';
import MovePageModal from 'components/move_page_modal';
import TextInputModal from 'components/text_input_modal';

import {ModalIdentifiers, PageDisplayTypes} from 'utils/constants';
import {copyPageAsMarkdown} from 'utils/page_utils';
import {getPageTitle} from 'utils/post_utils';

import type {PostDraft} from 'types/store/draft';

import type {DraftPage} from '../utils/tree_builder';
import {convertDraftToPagePost} from '../utils/tree_builder';

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
    const {formatMessage} = useIntl();

    // Convert drafts to Post-like objects and combine with pages
    // If a draft exists for a page, it should replace the published page in the list
    const allPages = useMemo(() => {
        const draftPosts: DraftPage[] = drafts.map((draft) => convertDraftToPagePost(draft));

        // Create a map of draft IDs for quick lookup
        const draftIds = new Set(draftPosts.map((d) => d.id));

        // Filter out published pages that have drafts, then add the drafts
        const pagesWithoutDrafts = pages.filter((p) => !draftIds.has(p.id));
        return [...pagesWithoutDrafts, ...draftPosts];
    }, [pages, drafts]);

    // Build index records for O(1) lookups instead of O(n) .find() calls
    const pageMap = useMemo(() => {
        const map: Record<string, Post | DraftPage> = {};
        allPages.forEach((p) => {
            map[p.id] = p;
        });
        return map;
    }, [allPages]);

    const pagesMap = useMemo(() => {
        const map: Record<string, Post> = {};
        pages.forEach((p) => {
            map[p.id] = p;
        });
        return map;
    }, [pages]);

    const draftsMap = useMemo(() => {
        const map: Record<string, PostDraft> = {};
        drafts.forEach((d) => {
            map[d.rootId] = d;
        });
        return map;
    }, [drafts]);

    // Build parent→children index for efficient getDescendantIds (O(d) instead of O(n) per call)
    const childrenByParent = useMemo(() => {
        const map: Record<string, Array<Post | DraftPage>> = {};
        allPages.forEach((page) => {
            const parentId = page.page_parent_id || '__root__';
            if (!map[parentId]) {
                map[parentId] = [];
            }
            map[parentId].push(page);
        });
        return map;
    }, [allPages]);

    // Optimized getDescendantIds using childrenByParent index
    const getDescendantIdsOptimized = useCallback((pageId: string): string[] => {
        const result: string[] = [];
        const traverse = (parentId: string) => {
            const children = childrenByParent[parentId] || [];
            children.forEach((child) => {
                result.push(child.id);
                traverse(child.id);
            });
        };
        traverse(pageId);
        return result;
    }, [childrenByParent]);

    // Refs to track latest values and avoid callback recreation on every page/draft change
    // IMPORTANT: Update refs synchronously during render (not in useEffect) to ensure
    // callbacks always have access to the latest values. Using useEffect would cause
    // race conditions where the callback sees stale data if executed before the effect runs.
    const pageMapRef = useRef(pageMap);
    pageMapRef.current = pageMap;

    const pagesMapRef = useRef(pagesMap);
    pagesMapRef.current = pagesMap;

    const draftsMapRef = useRef(draftsMap);
    draftsMapRef.current = draftsMap;

    const getDescendantIdsRef = useRef(getDescendantIdsOptimized);
    getDescendantIdsRef.current = getDescendantIdsOptimized;

    const [createPageParent, setCreatePageParent] = useState<{id: string; title: string} | null>(null);
    const [pageToMove, setPageToMove] = useState<{pageId: string; pageTitle: string; hasChildren: boolean} | null>(null);
    const [pageToDelete, setPageToDelete] = useState<{page: Post; childCount: number} | null>(null);
    const [availableWikis, setAvailableWikis] = useState<Wiki[]>([]);
    const [deletingPageId, setDeletingPageId] = useState<string | null>(null);
    const [creatingPage, setCreatingPage] = useState(false);
    const [showBookmarkModal, setShowBookmarkModal] = useState(false);
    const [pageToBookmark, setPageToBookmark] = useState<{pageId: string; pageTitle: string} | null>(null);
    const [pageToRename, setPageToRename] = useState<{pageId: string; currentTitle: string} | null>(null);
    const [renamingPage, setRenamingPage] = useState(false);

    const handleCreateRootPage = useCallback(() => {
        if (creatingPage) {
            return;
        }

        setCreatePageParent(null);

        dispatch(openModal({
            modalId: ModalIdentifiers.PAGE_CREATE,
            dialogType: TextInputModal,
            dialogProps: {
                title: formatMessage({id: 'pages_panel.create_modal.title', defaultMessage: 'Create New Page'}),
                fieldLabel: formatMessage({id: 'pages_panel.modal.field_label', defaultMessage: 'Page title'}),
                placeholder: formatMessage({id: 'pages_panel.modal.placeholder', defaultMessage: 'Enter page title...'}),
                helpText: formatMessage({id: 'pages_panel.create_modal.help_text', defaultMessage: 'A new draft will be created for you to edit.'}),
                confirmButtonText: formatMessage({id: 'pages_panel.create_modal.confirm', defaultMessage: 'Create'}),
                maxLength: 255,
                ariaLabel: formatMessage({id: 'pages_panel.create_modal.aria_label', defaultMessage: 'Create Page'}),
                inputTestId: 'create-page-modal-title-input',
                modalId: ModalIdentifiers.PAGE_CREATE,
                onConfirm: async (title: string) => {
                    setCreatingPage(true);
                    try {
                        const result = await dispatch(createPage(wikiId, title, undefined)) as ActionResult<string>;
                        if (result.error) {
                            throw result.error;
                        }
                        if (result.data) {
                            const draftId = result.data;
                            onPageSelect?.(draftId, true);
                        }
                    } finally {
                        setCreatingPage(false);
                    }
                },
                onCancel: () => {},
            },
        }));
    }, [creatingPage, dispatch, formatMessage, wikiId, onPageSelect]);

    const handleCreateChild = useCallback((pageId: string) => {
        if (creatingPage) {
            return;
        }
        const parentPage = pageMapRef.current[pageId];
        const parentTitle = getPageTitle(parentPage);

        setCreatePageParent({
            id: pageId,
            title: parentTitle,
        });

        dispatch(openModal({
            modalId: ModalIdentifiers.PAGE_CREATE,
            dialogType: TextInputModal,
            dialogProps: {
                title: formatMessage(
                    {id: 'pages_panel.create_child_modal.title', defaultMessage: 'Create Child Page under "{parentTitle}"'},
                    {parentTitle},
                ),
                fieldLabel: formatMessage({id: 'pages_panel.modal.field_label', defaultMessage: 'Page title'}),
                placeholder: formatMessage({id: 'pages_panel.modal.placeholder', defaultMessage: 'Enter page title...'}),
                helpText: formatMessage(
                    {id: 'pages_panel.create_child_modal.help_text', defaultMessage: 'This page will be created as a child of "{parentTitle}".'},
                    {parentTitle},
                ),
                confirmButtonText: formatMessage({id: 'pages_panel.create_modal.confirm', defaultMessage: 'Create'}),
                maxLength: 255,
                ariaLabel: formatMessage({id: 'pages_panel.create_modal.aria_label', defaultMessage: 'Create Page'}),
                inputTestId: 'create-page-modal-title-input',
                modalId: ModalIdentifiers.PAGE_CREATE,
                onConfirm: async (title: string) => {
                    setCreatingPage(true);
                    try {
                        const result = await dispatch(createPage(wikiId, title, pageId)) as ActionResult<string>;
                        if (result.error) {
                            throw result.error;
                        }
                        if (result.data) {
                            const draftId = result.data;
                            dispatch(expandAncestors(wikiId, [pageId]));
                            onPageSelect?.(draftId, true);
                        }
                    } finally {
                        setCreatingPage(false);
                        setCreatePageParent(null);
                    }
                },
                onCancel: () => {
                    setCreatePageParent(null);
                },
            },
        }));
    }, [creatingPage, dispatch, formatMessage, wikiId, onPageSelect]);

    const handleRename = useCallback((pageId: string) => {
        if (renamingPage) {
            return;
        }
        const page = pageMapRef.current[pageId];
        if (!page || !wikiId) {
            return;
        }

        const currentTitle = getPageTitle(page, '');
        setPageToRename({pageId, currentTitle});

        dispatch(openModal({
            modalId: ModalIdentifiers.PAGE_RENAME,
            dialogType: TextInputModal,
            dialogProps: {
                title: formatMessage({id: 'pages_panel.rename_modal.title', defaultMessage: 'Rename Page'}),
                fieldLabel: formatMessage({id: 'pages_panel.modal.field_label', defaultMessage: 'Page title'}),
                placeholder: formatMessage({id: 'pages_panel.modal.placeholder', defaultMessage: 'Enter page title...'}),
                helpText: formatMessage({id: 'pages_panel.rename_modal.help_text', defaultMessage: 'The page will be renamed immediately.'}),
                confirmButtonText: formatMessage({id: 'pages_panel.rename_modal.confirm', defaultMessage: 'Rename'}),
                maxLength: 255,
                initialValue: currentTitle,
                ariaLabel: formatMessage({id: 'pages_panel.rename_modal.aria_label', defaultMessage: 'Rename Page'}),
                inputTestId: 'rename-page-modal-title-input',
                modalId: ModalIdentifiers.PAGE_RENAME,
                onConfirm: async (newTitle: string) => {
                    setRenamingPage(true);
                    try {
                        // Check if there's a draft for this page (regardless of page.type)
                        // This handles the case where user is editing an existing page - the hierarchy
                        // shows the published page, but we need to update the draft
                        const draft = draftsMapRef.current[pageId];
                        const isDraft = page.type === PageDisplayTypes.PAGE_DRAFT || Boolean(draft);

                        if (isDraft && draft) {
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
                                pageId,
                                contentToSave,
                                newTitle,
                                draft.updateAt,
                                propsToPreserve,
                            )) as ActionResult<boolean>;

                            if (result.error) {
                                throw result.error;
                            }
                        } else {
                            const result = await dispatch(updatePage(pageId, newTitle, wikiId)) as ActionResult<Post>;
                            if (result.error) {
                                throw result.error;
                            }
                        }
                    } finally {
                        setRenamingPage(false);
                        setPageToRename(null);
                    }
                },
                onCancel: () => {
                    setPageToRename(null);
                },
            },
        }));
    }, [wikiId, renamingPage, dispatch, formatMessage, channelId, onCancelAutosave]);

    const handleDuplicate = useCallback(async (pageId: string) => {
        const page = pageMapRef.current[pageId];
        if (!page) {
            return;
        }

        try {
            await dispatch(duplicatePage(pageId, wikiId));
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Failed to duplicate page:', error);
        }
    }, [wikiId, dispatch]);

    const fetchPagesForWiki = useCallback(async (targetWikiId: string): Promise<Post[]> => {
        try {
            const wikisResult = await dispatch(fetchChannelWikis(channelId));
            const wikis = (wikisResult as ActionResult<Wiki[]>).data;
            const targetWiki = wikis?.find((w) => w.id === targetWikiId);
            if (targetWiki) {
                const pagesResult = await dispatch(fetchPages(targetWikiId));
                return (pagesResult as ActionResult<Post[]>).data || [];
            }
            return [];
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Failed to fetch pages for wiki:', error);
            return [];
        }
    }, [channelId, dispatch]);

    const handleMove = useCallback(async (pageId: string) => {
        const page = pageMapRef.current[pageId];
        if (!page) {
            return;
        }
        const pageTitle = getPageTitle(page);
        const childCount = getDescendantIdsRef.current(pageId).length;
        const hasChildren = childCount > 0;

        try {
            const result = await dispatch(fetchChannelWikis(channelId));
            const wikis = (result as ActionResult<Wiki[]>).data || [];

            // Store for reference
            setAvailableWikis(wikis);
            setPageToMove({pageId, pageTitle, hasChildren});

            // Open modal via modal manager
            dispatch(openModal({
                modalId: ModalIdentifiers.PAGE_MOVE,
                dialogType: MovePageModal,
                dialogProps: {
                    pageId,
                    pageTitle,
                    currentWikiId: wikiId,
                    availableWikis: wikis,
                    fetchPagesForWiki,
                    hasChildren,
                    onConfirm: async (targetWikiId: string, parentPageIdArg?: string) => {
                        try {
                            await dispatch(movePageToWiki(pageId, wikiId, targetWikiId, parentPageIdArg));
                        } finally {
                            setPageToMove(null);
                        }
                    },
                    onCancel: () => {
                        setPageToMove(null);
                    },
                },
            }));
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Failed to open move page modal:', error);
        }
    }, [channelId, dispatch, wikiId, fetchPagesForWiki]);

    const handleDelete = useCallback((pageId: string) => {
        if (deletingPageId) {
            return;
        }
        const page = pageMapRef.current[pageId];
        if (!page) {
            return;
        }
        const isDraft = page.type === PageDisplayTypes.PAGE_DRAFT;
        const childCount = isDraft ? 0 : getDescendantIdsRef.current(pageId).length;
        const pageTitle = getPageTitle(page);

        // Store page info for deletion tracking
        setPageToDelete({page, childCount});

        // Open modal via modal manager
        dispatch(openModal({
            modalId: ModalIdentifiers.PAGE_DELETE,
            dialogType: DeletePageModal,
            dialogProps: {
                pageTitle,
                childCount,
                onConfirm: async (deleteChildren: boolean) => {
                    setDeletingPageId(page.id);
                    try {
                        if (isDraft) {
                            const result = await dispatch(removePageDraft(wikiId, page.id)) as ActionResult<boolean>;
                            if (result.error) {
                                throw result.error;
                            }
                            onPageSelect?.('');
                        } else {
                            if (deleteChildren) {
                                const descendantIds = getDescendantIdsRef.current(page.id);
                                for (const descendantId of descendantIds.reverse()) {
                                    // eslint-disable-next-line no-await-in-loop
                                    const result = await dispatch(deletePage(descendantId, wikiId)) as ActionResult<boolean>;
                                    if (result.error) {
                                        throw result.error;
                                    }
                                }
                            }
                            const result = await dispatch(deletePage(page.id, wikiId)) as ActionResult<boolean>;
                            if (result.error) {
                                throw result.error;
                            }
                            const parentId = page.page_parent_id || '';
                            onPageSelect?.(parentId);
                        }
                    } finally {
                        setDeletingPageId(null);
                        setPageToDelete(null);
                    }
                },
            },
        }));
    }, [deletingPageId, dispatch, wikiId, onPageSelect]);

    const handleBookmarkInChannel = useCallback((pageId: string) => {
        const page = pageMapRef.current[pageId];
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
                const actualPage = pagesMapRef.current[actualPageId];
                if (actualPage) {
                    const pageTitle = getPageTitle(actualPage);
                    setPageToBookmark({pageId: actualPageId, pageTitle});
                    setShowBookmarkModal(true);
                    return;
                }
            }

            // Can't bookmark unpublished drafts - show error or just return
            return;
        }

        const pageTitle = getPageTitle(page);
        setPageToBookmark({pageId, pageTitle});
        setShowBookmarkModal(true);
    }, []);

    const handleBookmarkCancel = useCallback(() => {
        setShowBookmarkModal(false);
        setPageToBookmark(null);
    }, []);

    const handleCopyMarkdown = useCallback((pageId: string) => {
        const page = pageMapRef.current[pageId];
        if (!page) {
            return;
        }
        copyPageAsMarkdown(page.message, getPageTitle(page));
    }, []);

    return {

        // Handlers
        handleCreateRootPage,
        handleCreateChild,
        handleRename,
        handleDuplicate,
        handleMove,
        handleDelete,
        handleBookmarkInChannel,
        handleCopyMarkdown,

        // Modal state (only bookmark remains inline)
        showBookmarkModal,
        setShowBookmarkModal,

        // Modal data
        createPageParent,
        pageToMove,
        pageToDelete,
        availableWikis,
        pageToBookmark,
        pageToRename,

        // Modal handlers
        handleBookmarkCancel,

        // Helper
        fetchPagesForWiki,

        // Loading states
        deletingPageId,
        creatingPage,
        renamingPage,
    };
};
