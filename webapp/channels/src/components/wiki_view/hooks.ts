// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Location} from 'history';
import {useEffect, useState, useCallback, useRef} from 'react';
import {useDispatch} from 'react-redux';

import type {Post} from '@mattermost/types/posts';

import {loadPageDraftsForWiki, savePageDraft} from 'actions/page_drafts';
import {loadChannelDefaultPage, loadWikiPages, publishPageDraft, loadPage} from 'actions/pages';

import * as Utils from 'utils/utils';

import type {PostDraft} from 'types/store/draft';

type UseWikiPageDataResult = {
    isLoading: boolean;
    editingDraftId: string | null;
    setEditingDraftId: (id: string | null) => void;
};

/**
 * Loads page or draft data for the wiki view and handles navigation
 */
export function useWikiPageData(
    pageId: string | undefined,
    channelId: string,
    wikiId: string | null,
    teamId: string,
    location: Location,
    history: any,
    path: string,
    isSelectingDraftRef: React.MutableRefObject<boolean>,
): UseWikiPageDataResult {
    const dispatch = useDispatch();
    const [isLoading, setLoading] = useState(true);
    const [editingDraftId, setEditingDraftId] = useState<string | null>(null);

    useEffect(() => {
        const loadPageOrDraft = async () => {
            console.log('[useWikiPageData] Effect triggered:', {
                pageId,
                channelId,
                wikiId,
                currentEditingDraftId: editingDraftId,
            });

            if (pageId) {
                // Clear any draft editing when viewing a published page
                console.log('[useWikiPageData] Clearing editingDraftId because pageId exists:', {
                    pageId,
                    previousEditingDraftId: editingDraftId,
                });
                setEditingDraftId(null);

                if (wikiId) {
                    console.log('[useWikiPageData] Loading full page:', {pageId, wikiId});
                    const result = await dispatch(loadPage(pageId, wikiId));
                    console.log('[useWikiPageData] Page loaded:', {
                        hasData: Boolean(result.data),
                        hasMessage: Boolean(result.data?.message),
                        messageLength: result.data?.message?.length || 0,
                    });
                }
                setLoading(false);
                return;
            }

            // No pageId in URL - at wiki root (e.g., /team/wiki/channelId/wikiId)
            // Safety check: channelId should always exist in wiki routes
            if (!channelId) {
                setLoading(false);
                return;
            }

            // Load pages list for the hierarchy panel
            let pages: any[] = [];
            if (wikiId) {
                try {
                    const pagesResult = await dispatch(loadWikiPages(wikiId));
                    pages = pagesResult.data || [];
                } catch (error) {
                    // Error loading pages - continue anyway
                }
            } else {
                // No wikiId - load default page if available (for channel wiki without explicit wikiId)
                try {
                    await dispatch(loadChannelDefaultPage(channelId));
                } catch (error) {
                    // Error loading default page - continue anyway
                }
            }

            // Load drafts for the wiki
            // When at wiki root, check if we should auto-select a draft
            if (wikiId) {
                try {
                    const result = await dispatch(loadPageDraftsForWiki(wikiId));
                    const drafts = result.data || [];

                    console.log('[useWikiPageData] Loaded drafts and pages:', {
                        draftCount: drafts.length,
                        pageCount: pages.length,
                        isSelectingDraft: isSelectingDraftRef.current,
                    });

                    // Only clear editingDraftId if we're not selecting a draft
                    if (isSelectingDraftRef.current) {
                        console.log('[useWikiPageData] Keeping editingDraftId (selecting draft)');
                    } else if (drafts.length === 1 && pages.length === 0) {
                        // If there's exactly one draft and no published pages, auto-select it (typical for new wikis)
                        console.log('[useWikiPageData] Auto-selecting single draft (new wiki):', drafts[0].rootId);
                        setEditingDraftId(drafts[0].rootId);
                    } else {
                        console.log('[useWikiPageData] Clearing editingDraftId');
                        setEditingDraftId(null);
                    }
                } catch (error) {
                    if (!isSelectingDraftRef.current) {
                        setEditingDraftId(null);
                    }
                } finally {
                    setLoading(false);
                }
            } else {
                setLoading(false);
            }
        };

        loadPageOrDraft();
    }, [pageId, channelId, wikiId, dispatch]);

    return {
        isLoading,
        editingDraftId,
        setEditingDraftId,
    };
}

type UseWikiPageActionsResult = {
    handleEdit: () => Promise<void>;
    handlePublish: () => Promise<void>;
    handleTitleChange: (title: string) => void;
    handleContentChange: (content: string) => void;
};

/**
 * Provides actions for editing and publishing wiki pages
 */
export function useWikiPageActions(
    channelId: string,
    pageId: string | undefined,
    wikiId: string | null,
    currentPage: Post | null,
    currentDraft: PostDraft | null,
    location: Location,
    history: any,
    setEditingDraftId: (id: string | null) => void,
): UseWikiPageActionsResult {
    const dispatch = useDispatch();
    const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const latestContentRef = useRef<string>('');
    const latestTitleRef = useRef<string>('');
    const previousDraftRef = useRef<PostDraft | null>(null);

    // Initialize refs when draft changes
    useEffect(() => {
        // Save any pending changes to the PREVIOUS draft before switching
        // BUT: Don't flush if transitioning to null (draft was deleted/published)
        if (autosaveTimeoutRef.current && previousDraftRef.current && wikiId && currentDraft) {
            console.log('[useWikiPageActions] Flushing pending auto-save before draft change');
            clearTimeout(autosaveTimeoutRef.current);
            autosaveTimeoutRef.current = null;

            // Immediately save the pending changes to the previous draft
            const prevDraft = previousDraftRef.current;
            const prevContent = latestContentRef.current;
            const prevTitle = latestTitleRef.current;
            const pageIdFromDraft = prevDraft.props?.page_id as string | undefined;
            const pageParentIdFromDraft = prevDraft.props?.page_parent_id;

            console.log('[useWikiPageActions] Saving to previous draft:', {
                draftId: prevDraft.rootId,
                title: prevTitle,
                contentLength: prevContent.length,
            });

            dispatch(savePageDraft(
                channelId,
                wikiId,
                prevDraft.rootId,
                prevContent,
                prevTitle,
                pageIdFromDraft,
                pageParentIdFromDraft ? {page_parent_id: pageParentIdFromDraft} : undefined,
            ));
        } else if (autosaveTimeoutRef.current && !currentDraft) {
            // Transitioning to null (draft deleted/published) - just cancel the timeout
            console.log('[useWikiPageActions] Canceling pending auto-save - draft was deleted/published');
            clearTimeout(autosaveTimeoutRef.current);
            autosaveTimeoutRef.current = null;
        }

        if (currentDraft) {
            console.log('[useWikiPageActions] Initializing refs for draft:', {
                draftId: currentDraft.rootId,
                title: currentDraft.props?.title,
                message: currentDraft.message?.substring(0, 50),
                pageParentId: currentDraft.props?.page_parent_id,
            });
            latestContentRef.current = currentDraft.message || '';
            latestTitleRef.current = currentDraft.props?.title || '';
            previousDraftRef.current = currentDraft;
        } else {
            // Clear refs when no draft
            latestContentRef.current = '';
            latestTitleRef.current = '';
            previousDraftRef.current = null;
        }
    }, [currentDraft?.rootId, channelId, wikiId, dispatch]); // Include channelId, wikiId and dispatch for flush save

    const handleEdit = useCallback(async () => {
        if (!pageId || !wikiId || !currentPage) {
            return;
        }

        console.log('[handleEdit] Starting edit:', {
            pageId,
            wikiId,
            hasMessage: Boolean(currentPage.message),
            messageLength: currentPage.message?.length || 0,
            messagePreview: currentPage.message?.substring(0, 100),
            pageTitle: currentPage.props?.title,
            pageParentId: currentPage.page_parent_id,
        });

        try {
            const pageTitle = (currentPage.props?.title as string | undefined) || 'Untitled page';
            const pageParentId = currentPage.page_parent_id;

            await dispatch(savePageDraft(channelId, wikiId, pageId, currentPage.message, pageTitle, pageId, pageParentId ? {page_parent_id: pageParentId} : undefined));

            setEditingDraftId(pageId);
        } catch (error) {
            alert('Failed to start editing. Please try again.');
        }
    }, [channelId, pageId, wikiId, currentPage, dispatch, setEditingDraftId]);

    const handleTitleChange = useCallback((newTitle: string) => {
        // Update ref immediately
        latestTitleRef.current = newTitle;

        if (!wikiId || !currentDraft) {
            console.log('[handleTitleChange] Skipping - no wikiId or currentDraft');
            return;
        }

        if (autosaveTimeoutRef.current) {
            clearTimeout(autosaveTimeoutRef.current);
        }

        // Capture draft details in closure to prevent stale data
        const draftId = currentDraft.rootId;
        const content = latestContentRef.current || currentDraft.message || '';
        const pageIdFromDraft = currentDraft.props?.page_id as string | undefined;
        const pageParentIdFromDraft = currentDraft.props?.page_parent_id;
        const capturedTitle = newTitle;

        console.log('[handleTitleChange] Scheduling auto-save:', {
            capturedTitle,
            draftId,
            pageIdFromDraft,
            pageParentIdFromDraft,
            contentLength: content.length,
        });

        autosaveTimeoutRef.current = setTimeout(() => {
            // Verify we're still editing the same draft before saving
            if (!currentDraft || currentDraft.rootId !== draftId) {
                console.log('[handleTitleChange] Canceling auto-save - draft changed', {
                    expectedDraftId: draftId,
                    currentDraftId: currentDraft?.rootId,
                });
                return;
            }

            console.log('[handleTitleChange] Executing auto-save:', {
                title: capturedTitle,
                draftId,
            });
            dispatch(savePageDraft(channelId, wikiId, draftId, content, capturedTitle, pageIdFromDraft, pageParentIdFromDraft ? {page_parent_id: pageParentIdFromDraft} : undefined));
        }, 500);
    }, [channelId, wikiId, currentDraft, dispatch]);

    const handleContentChange = useCallback((newContent: string) => {
        // Update ref immediately
        latestContentRef.current = newContent;

        if (!wikiId || !currentDraft) {
            console.log('[handleContentChange] Skipping - no wikiId or currentDraft');
            return;
        }

        if (autosaveTimeoutRef.current) {
            clearTimeout(autosaveTimeoutRef.current);
        }

        // Capture draft details in closure to prevent stale data
        const draftId = currentDraft.rootId;
        const title = latestTitleRef.current || currentDraft.props?.title || '';
        const pageIdFromDraft = currentDraft.props?.page_id as string | undefined;
        const pageParentIdFromDraft = currentDraft.props?.page_parent_id;
        const capturedContent = newContent;

        console.log('[handleContentChange] Scheduling auto-save:', {
            draftId,
            contentLength: capturedContent.length,
            title,
        });

        autosaveTimeoutRef.current = setTimeout(() => {
            // Verify we're still editing the same draft before saving
            if (!currentDraft || currentDraft.rootId !== draftId) {
                console.log('[handleContentChange] Canceling auto-save - draft changed', {
                    expectedDraftId: draftId,
                    currentDraftId: currentDraft?.rootId,
                });
                return;
            }

            console.log('[handleContentChange] Executing auto-save:', {
                draftId,
                contentLength: capturedContent.length,
            });
            dispatch(savePageDraft(channelId, wikiId, draftId, capturedContent, title, pageIdFromDraft, pageParentIdFromDraft ? {page_parent_id: pageParentIdFromDraft} : undefined));
        }, 500);
    }, [channelId, wikiId, currentDraft, dispatch]);

    const handlePublish = useCallback(async () => {
        if (!wikiId || !currentDraft) {
            return;
        }

        if (!currentDraft.rootId) {
            alert('Cannot publish: draft not found. Please refresh the page and try again.');
            return;
        }

        // Use the latest content and title from refs (may not be saved yet due to debounce)
        const content = latestContentRef.current || currentDraft.message || '';
        const title = latestTitleRef.current || currentDraft.props?.title || '';

        if (!content || content.trim() === '') {
            alert('Cannot publish an empty page. Please add some content first.');
            return;
        }

        const draftRootId = currentDraft.rootId;
        const pageIdFromDraft = currentDraft.props?.page_id as string | undefined;
        const pageParentIdFromDraft = currentDraft.props?.page_parent_id;

        console.log('[handlePublish] Publishing draft:', {
            draftRootId,
            pageIdFromDraft,
            pageParentIdFromDraft,
            willPassToAPI: pageParentIdFromDraft || '',
            contentLength: content.length,
            titleLength: title.length,
            draftProps: currentDraft.props,
        });

        try {
            // Cancel any pending autosave and save immediately with latest content
            if (autosaveTimeoutRef.current) {
                clearTimeout(autosaveTimeoutRef.current);
            }
            await dispatch(savePageDraft(channelId, wikiId, draftRootId, content, title, pageIdFromDraft, pageParentIdFromDraft ? {page_parent_id: pageParentIdFromDraft} : undefined));

            const result = await dispatch(publishPageDraft(
                wikiId,
                draftRootId,
                pageParentIdFromDraft || '',
                title,
            ));

            if (result.data) {
                setEditingDraftId(null);

                const currentPath = location.pathname;
                const basePath = pageId ? currentPath.substring(0, currentPath.lastIndexOf('/')) : currentPath;
                const redirectUrl = `${basePath}/${result.data.id}`;
                history.replace(redirectUrl);
            }
        } catch (error) {
            // Error handled
        }
    }, [channelId, wikiId, currentDraft, pageId, location.pathname, history, dispatch, setEditingDraftId]);

    return {
        handleEdit,
        handlePublish,
        handleTitleChange,
        handleContentChange,
    };
}
