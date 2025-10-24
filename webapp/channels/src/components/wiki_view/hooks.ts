// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Location} from 'history';
import {useEffect, useState, useCallback, useRef} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {Post} from '@mattermost/types/posts';

import {getChannel, getChannelMember, selectChannel} from 'mattermost-redux/actions/channels';
import {getChannel as getChannelSelector} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {savePageDraft} from 'actions/page_drafts';
import {loadChannelDefaultPage, loadWikiPages, publishPageDraft, loadPage} from 'actions/pages';

import type {GlobalState} from 'types/store';
import type {PostDraft} from 'types/store/draft';

type UseWikiPageDataResult = {
    isLoading: boolean;
};

/**
 * Loads page or draft data for the wiki view and handles navigation
 * Phase 1 Refactor: Removed editingDraftId state - now using draftId from route params only
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useWikiPageData(
    pageId: string | undefined,
    draftId: string | undefined,
    channelId: string,
    wikiId: string | null,
    _teamId: string,
    location: Location,
    history: any,
    _path: string,
    _isSelectingDraftRef: React.MutableRefObject<boolean>,
): UseWikiPageDataResult {
    const dispatch = useDispatch();
    const [isLoading, setLoading] = useState(true);
    const currentUserId = useSelector((state: GlobalState) => getCurrentUserId(state));
    const channel = useSelector((state: GlobalState) => getChannelSelector(state, channelId));
    const member = useSelector((state: GlobalState) => state.entities.channels.myMembers[channelId]);

    // Persistent channel selection: ensures channel stays selected even after route changes
    useEffect(() => {
        if (channel && member && channelId) {
            dispatch(selectChannel(channelId));
        }
    }, [channelId, channel, member, dispatch]);

    useEffect(() => {
        const loadPageOrDraft = async () => {
            if (!channelId) {
                setLoading(false);
                return;
            }

            try {
                if (!channel) {
                    await dispatch(getChannel(channelId));
                }

                if (!member) {
                    await dispatch(getChannelMember(channelId, currentUserId));
                }

                dispatch(selectChannel(channelId));
            } catch (error) {
                // Error loading channel
            }

            if (pageId) {
                if (wikiId) {
                    await dispatch(loadPage(pageId, wikiId));
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
            if (wikiId) {
                try {
                    await dispatch(loadWikiPages(wikiId));
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

            // Note: Drafts are loaded by PagesHierarchyPanel, no need to reload here
            // This avoids race condition where we re-add a just-deleted draft
            setLoading(false);
        };

        loadPageOrDraft();
    }, [pageId, draftId, channelId, wikiId, currentUserId, dispatch, channel, member]);

    return {
        isLoading,
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
 * Phase 1 Refactor: Removed setEditingDraftId parameter - now using route navigation only
 */
export function useWikiPageActions(
    channelId: string,
    pageId: string | undefined,
    draftId: string | undefined,
    wikiId: string | null,
    currentPage: Post | null,
    currentDraft: PostDraft | null,
    location: Location,
    history: any,
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
            clearTimeout(autosaveTimeoutRef.current);
            autosaveTimeoutRef.current = null;

            // Immediately save the pending changes to the previous draft
            const prevDraft = previousDraftRef.current;
            const prevContent = latestContentRef.current;
            const prevTitle = latestTitleRef.current;
            const pageIdFromDraft = prevDraft.props?.page_id as string | undefined;
            const pageParentIdFromDraft = prevDraft.props?.page_parent_id;

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
            clearTimeout(autosaveTimeoutRef.current);
            autosaveTimeoutRef.current = null;
        }

        if (currentDraft) {
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

        try {
            const pageTitle = (currentPage.props?.title as string | undefined) || 'Untitled page';
            const pageParentId = currentPage.page_parent_id;

            await dispatch(savePageDraft(channelId, wikiId, pageId, currentPage.message, pageTitle, pageId, pageParentId ? {page_parent_id: pageParentId} : undefined));

            // Phase 1 Refactor: Navigate to draft route instead of setting local state
            const currentPath = location.pathname;
            const basePath = currentPath.substring(0, currentPath.lastIndexOf('/'));
            history.replace(`${basePath}/drafts/${pageId}`);
        } catch (error) {
            // TODO: Show error notification instead of alert
            // alert('Failed to start editing. Please try again.');
        }
    }, [channelId, pageId, wikiId, currentPage, dispatch, location.pathname, history]);

    const handleTitleChange = useCallback((newTitle: string) => {
        // Update ref immediately
        latestTitleRef.current = newTitle;

        if (!wikiId || !currentDraft) {
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

        autosaveTimeoutRef.current = setTimeout(() => {
            // Verify we're still editing the same draft before saving
            if (!currentDraft || currentDraft.rootId !== draftId) {
                return;
            }

            dispatch(savePageDraft(channelId, wikiId, draftId, content, capturedTitle, pageIdFromDraft, pageParentIdFromDraft ? {page_parent_id: pageParentIdFromDraft} : undefined));
        }, 500);
    }, [channelId, wikiId, currentDraft, dispatch]);

    const handleContentChange = useCallback((newContent: string) => {
        // Update ref immediately
        latestContentRef.current = newContent;

        if (!wikiId || !currentDraft) {
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

        autosaveTimeoutRef.current = setTimeout(() => {
            // Verify we're still editing the same draft before saving
            if (!currentDraft || currentDraft.rootId !== draftId) {
                return;
            }

            dispatch(savePageDraft(channelId, wikiId, draftId, capturedContent, title, pageIdFromDraft, pageParentIdFromDraft ? {page_parent_id: pageParentIdFromDraft} : undefined));
        }, 500);
    }, [channelId, wikiId, currentDraft, dispatch]);

    const handlePublish = useCallback(async () => {
        if (!wikiId || !currentDraft) {
            return;
        }

        if (!currentDraft.rootId) {
            return;
        }

        // Use the latest content and title from refs (may not be saved yet due to debounce)
        const content = latestContentRef.current || currentDraft.message || '';
        const title = latestTitleRef.current || currentDraft.props?.title || '';

        if (!content || content.trim() === '') {
            return;
        }

        const draftRootId = currentDraft.rootId;
        const pageIdFromDraft = currentDraft.props?.page_id as string | undefined;
        const pageParentIdFromDraft = currentDraft.props?.page_parent_id;

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
                // Phase 1 Refactor: Clean navigation to published page
                // Build URL from scratch instead of manipulating current path
                const teamName = location.pathname.split('/')[1]; // Extract team from /:team/wiki/...
                const redirectUrl = `/${teamName}/wiki/${channelId}/${wikiId}/${result.data.id}`;

                history.replace(redirectUrl);
            }
        } catch (error) {
            // Error during publish
        }
    }, [channelId, wikiId, currentDraft, draftId, location.pathname, history, dispatch]);

    return {
        handleEdit,
        handlePublish,
        handleTitleChange,
        handleContentChange,
    };
}
