// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Location} from 'history';
import {useEffect, useLayoutEffect, useState, useCallback, useRef} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {Post} from '@mattermost/types/posts';

import {getChannel, getChannelMember, selectChannel} from 'mattermost-redux/actions/channels';
import {getChannel as getChannelSelector} from 'mattermost-redux/selectors/entities/channels';
import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {savePageDraft} from 'actions/page_drafts';
import {loadChannelDefaultPage, loadWikiPages, publishPageDraft, loadPage} from 'actions/pages';
import {getWikiUrl, getTeamNameFromPath} from 'utils/url';

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
    const currentTeam = useSelector((state: GlobalState) => getCurrentTeam(state));
    const channel = useSelector((state: GlobalState) => getChannelSelector(state, channelId));
    const member = useSelector((state: GlobalState) => state.entities.channels.myMembers[channelId]);

    // Use refs to avoid re-running effect when channel/member objects change reference
    const channelRef = useRef(channel);
    const memberRef = useRef(member);
    const historyRef = useRef(history);
    const currentTeamRef = useRef(currentTeam);
    channelRef.current = channel;
    memberRef.current = member;
    historyRef.current = history;
    currentTeamRef.current = currentTeam;

    // Persistent channel selection: ensures channel stays selected even after route changes
    useEffect(() => {
        const currentChannel = channelRef.current;
        const currentMember = memberRef.current;
        if (currentChannel && currentMember && channelId) {
            dispatch(selectChannel(channelId));
        }
    }, [channelId, dispatch]); // Removed channel and member from dependencies - using refs instead

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
                    const result = await dispatch(getChannelMember(channelId, currentUserId));

                    // Check for permission error (non-member trying to access channel)
                    if (result.error) {
                        const defaultChannel = 'town-square';
                        const teamName = currentTeamRef.current?.name || '';
                        historyRef.current.push(`/error?type=channel_not_found&returnTo=/${teamName}/channels/${defaultChannel}`);
                        return;
                    }
                }

                dispatch(selectChannel(channelId));
            } catch (error) {
                // Handle unexpected errors with redirect
                const defaultChannel = 'town-square';
                const teamName = currentTeamRef.current?.name || '';
                historyRef.current.push(`/error?type=channel_not_found&returnTo=/${teamName}/channels/${defaultChannel}`);
                return;
            }

            if (pageId) {
                if (wikiId) {
                    const result = await dispatch(loadPage(pageId, wikiId));

                    // Check for permission error (403) when loading page
                    if (result.error && result.error.status_code === 403) {
                        const defaultChannel = 'town-square';
                        const teamName = currentTeamRef.current?.name || '';
                        historyRef.current.push(`/error?type=channel_not_found&returnTo=/${teamName}/channels/${defaultChannel}`);
                        return;
                    }
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
    const draftGenerationRef = useRef(0);
    const currentDraftIdRef = useRef<string | null>(null);

    // Initialize refs when draft changes. We deliberately use `useLayoutEffect`
    // instead of `useEffect` so that any pending changes to the **previous**
    // draft are flushed *before* React mounts the child editor for the newly
    // selected draft. Using a layout-effect guarantees that this code runs
    // earlier in the effect phase (parent → child order) and therefore the
    // `latestContentRef` / `latestTitleRef` values still correspond to the
    // previous draft. This prevents the scenario where the new editor updates
    // `latestContentRef` during its own `useEffect`/`onUpdate` callbacks and
    // consequently causes us to save the previous draft with the new draft's
    // content (overwriting it).
    //
    // See https://react.dev/learn/synchronizing-with-effects#fetching-data for
    // effect ordering details.
    useLayoutEffect(() => {
        // Increment generation counter ONLY when switching to a different draft (different rootId)
        const newDraftId = currentDraft?.rootId || null;
        if (newDraftId !== currentDraftIdRef.current) {
            draftGenerationRef.current += 1;
            currentDraftIdRef.current = newDraftId;
        }

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

        // Capture draft details and generation in closure to prevent stale data
        const draftId = currentDraft.rootId;
        const content = latestContentRef.current || currentDraft.message || '';
        const pageIdFromDraft = currentDraft.props?.page_id as string | undefined;
        const pageParentIdFromDraft = currentDraft.props?.page_parent_id;
        const capturedTitle = newTitle;
        const capturedGeneration = draftGenerationRef.current;

        autosaveTimeoutRef.current = setTimeout(() => {
            // Verify we're still editing the same draft AND generation before saving
            if (!currentDraft || currentDraft.rootId !== draftId || draftGenerationRef.current !== capturedGeneration) {
                return;
            }

            dispatch(savePageDraft(channelId, wikiId, draftId, content, capturedTitle, pageIdFromDraft, pageParentIdFromDraft ? {page_parent_id: pageParentIdFromDraft} : undefined));
        }, 500);
    }, [channelId, wikiId, currentDraft, dispatch]);

    // Store the latest values in refs to avoid recreating handleContentChange
    const channelIdRef = useRef(channelId);
    const wikiIdRef = useRef(wikiId);
    const currentDraftRef = useRef(currentDraft);
    const dispatchRef = useRef(dispatch);

    // Update refs on every render
    channelIdRef.current = channelId;
    wikiIdRef.current = wikiId;
    currentDraftRef.current = currentDraft;
    dispatchRef.current = dispatch;

    const handleContentChange = useCallback((newContent: string) => {
        // Update ref immediately
        latestContentRef.current = newContent;

        if (!wikiIdRef.current || !currentDraftRef.current) {
            return;
        }

        if (autosaveTimeoutRef.current) {
            clearTimeout(autosaveTimeoutRef.current);
        }

        // Capture draft details and generation in closure to prevent stale data
        // IMPORTANT: Capture from currentDraft prop (via ref) at call time, before any draft switches
        const capturedDraft = currentDraftRef.current;
        const draftId = capturedDraft.rootId;
        const title = latestTitleRef.current || capturedDraft.props?.title || '';
        const pageIdFromDraft = capturedDraft.props?.page_id as string | undefined;
        const pageParentIdFromDraft = capturedDraft.props?.page_parent_id;
        const capturedContent = newContent;
        const capturedChannelId = channelIdRef.current;
        const capturedWikiId = wikiIdRef.current;
        const capturedGeneration = draftGenerationRef.current;

        autosaveTimeoutRef.current = setTimeout(() => {
            // Verify we're still editing the same draft AND generation before saving
            if (!currentDraftRef.current || currentDraftRef.current.rootId !== draftId || draftGenerationRef.current !== capturedGeneration) {
                return;
            }

            dispatchRef.current(savePageDraft(capturedChannelId, capturedWikiId, draftId ?? '', capturedContent, title, pageIdFromDraft, pageParentIdFromDraft ? {page_parent_id: pageParentIdFromDraft} : undefined));
        }, 500);
    }, []); // Empty deps - stable function reference

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
            // Cancel any pending autosave
            if (autosaveTimeoutRef.current) {
                clearTimeout(autosaveTimeoutRef.current);
            }

            // COMMENTED OUT: No longer need to save draft before publishing since we pass content directly
            // This also eliminates potential race condition where savePageDraft could resurrect a deleted draft
            // if the publish completes first (ON CONFLICT ... DO UPDATE SET DeleteAt = 0 in Upsert)
            // await dispatch(savePageDraft(channelId, wikiId, draftRootId, content, title, pageIdFromDraft, pageParentIdFromDraft ? {page_parent_id: pageParentIdFromDraft} : undefined));

            const result = await dispatch(publishPageDraft(
                wikiId,
                draftRootId,
                pageParentIdFromDraft || '',
                title,
                '',
                content,
            ));

            if (result.error) {
                return;
            }

            if (result.data) {
                const teamName = getTeamNameFromPath(location.pathname);
                const redirectUrl = getWikiUrl(teamName, channelId, wikiId, result.data.id);
                history.replace(redirectUrl);
            }
        } catch (error) {
            // Unexpected error - already logged by publishPageDraft action
        }
    }, [channelId, wikiId, currentDraft, draftId, location.pathname, history, dispatch]);

    return {
        handleEdit,
        handlePublish,
        handleTitleChange,
        handleContentChange,
    };
}
