// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {History, Location} from 'history';
import {useEffect, useLayoutEffect, useState, useCallback, useRef} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';
import type {Post} from '@mattermost/types/posts';

import {getChannel, getChannelMember, selectChannel} from 'mattermost-redux/actions/channels';
import {logError, LogErrorBarMode} from 'mattermost-redux/actions/errors';
import {getChannel as getChannelSelector} from 'mattermost-redux/selectors/entities/channels';
import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import type {ActionResult} from 'mattermost-redux/types/actions';

import {savePageDraft} from 'actions/page_drafts';
import {fetchChannelDefaultPage, publishPageDraft, fetchPage, fetchWiki} from 'actions/pages';
import {openModal, closeModal} from 'actions/views/modals';
import {openPageInEditMode} from 'actions/wiki_edit';

import ConflictWarningModal from 'components/conflict_warning_modal';
import PageVersionHistoryModal from 'components/page_version_history';

import {ModalIdentifiers, PagePropsKeys} from 'utils/constants';
import {getPageTitle} from 'utils/post_utils';
import {getWikiUrl, getTeamNameFromPath} from 'utils/url';

import type {GlobalState} from 'types/store';
import type {PostDraft} from 'types/store/draft';

// AUTOSAVE_DEBOUNCE_MS is the delay before autosaving draft changes.
// This prevents excessive API calls while the user is actively typing.
const AUTOSAVE_DEBOUNCE_MS = 500;

type UseWikiPageDataResult = {
    isLoading: boolean;
};

/**
 * Extracts and builds additionalProps from a draft's props, preserving important metadata
 * that must persist across autosaves (page_parent_id, page_status, original_page_edit_at).
 */
function extractDraftAdditionalProps(draft: PostDraft): Record<string, any> | undefined {
    const additionalProps: Record<string, any> = {};

    if (draft.props?.[PagePropsKeys.PAGE_ID]) {
        additionalProps[PagePropsKeys.PAGE_ID] = draft.props[PagePropsKeys.PAGE_ID];
    }
    if (draft.props?.[PagePropsKeys.PAGE_PARENT_ID]) {
        additionalProps[PagePropsKeys.PAGE_PARENT_ID] = draft.props[PagePropsKeys.PAGE_PARENT_ID];
    }
    if (draft.props?.[PagePropsKeys.PAGE_STATUS]) {
        additionalProps[PagePropsKeys.PAGE_STATUS] = draft.props[PagePropsKeys.PAGE_STATUS];
    }
    if (draft.props?.[PagePropsKeys.ORIGINAL_PAGE_EDIT_AT]) {
        additionalProps[PagePropsKeys.ORIGINAL_PAGE_EDIT_AT] = draft.props[PagePropsKeys.ORIGINAL_PAGE_EDIT_AT];
    }
    if (draft.props?.has_published_version !== undefined) {
        additionalProps.has_published_version = draft.props.has_published_version;
    }

    return Object.keys(additionalProps).length > 0 ? additionalProps : undefined;
}

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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _teamId: string,
    location: Location,
    history: History,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _path: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _isSelectingDraftRef: React.MutableRefObject<boolean>,
): UseWikiPageDataResult {
    const dispatch = useDispatch();
    const [isLoading, setLoading] = useState(true);
    const currentUserId = useSelector((state: GlobalState) => getCurrentUserId(state));
    const currentTeam = useSelector((state: GlobalState) => getCurrentTeam(state));
    const channel = useSelector((state: GlobalState) => getChannelSelector(state, channelId));
    const member = useSelector((state: GlobalState) => state.entities.channels.myMembers[channelId]);
    const existingPage = useSelector((state: GlobalState) => (pageId ? getPost(state, pageId) : undefined));

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
            // Reset loading state when pageId/draftId changes to prevent flash of empty content
            setLoading(true);

            if (!channelId) {
                setLoading(false);
                return;
            }

            // Track the loaded channel for redirects (may differ from channelRef if just loaded)
            let loadedChannel = channel;

            try {
                // Parallelize independent fetches for better performance
                const fetchPromises: Array<Promise<unknown>> = [];
                const needsChannel = !channel;
                const needsMember = !member;

                if (needsChannel) {
                    fetchPromises.push(dispatch(getChannel(channelId)));
                }
                if (needsMember) {
                    fetchPromises.push(dispatch(getChannelMember(channelId, currentUserId)));
                }

                if (fetchPromises.length > 0) {
                    const results = await Promise.all(fetchPromises);

                    // Process results in order
                    let resultIndex = 0;
                    if (needsChannel) {
                        const channelResult = results[resultIndex++] as {data?: Channel};
                        if (channelResult.data) {
                            loadedChannel = channelResult.data;
                        }
                    }
                    if (needsMember) {
                        const memberResult = results[resultIndex] as {error?: {status_code: number}};

                        // Check for permission error (non-member trying to access channel)
                        if (memberResult.error) {
                            const defaultChannel = 'town-square';
                            const teamName = currentTeamRef.current?.name || '';
                            setLoading(false);
                            historyRef.current.replace(`/error?type=channel_not_found&returnTo=/${teamName}/channels/${defaultChannel}`);
                            return;
                        }
                    }
                }

                dispatch(selectChannel(channelId));
            } catch (error) {
                // Handle unexpected errors with redirect
                const defaultChannel = 'town-square';
                const teamName = currentTeamRef.current?.name || '';
                setLoading(false);
                historyRef.current.replace(`/error?type=channel_not_found&returnTo=/${teamName}/channels/${defaultChannel}`);
                return;
            }

            if (pageId) {
                if (wikiId) {
                    const hasPageContent = existingPage?.message?.trim();

                    if (!hasPageContent) {
                        const result = await dispatch(fetchPage(pageId, wikiId));

                        if (result.error && (result.error.status_code === 403 || result.error.status_code === 404)) {
                            const teamName = currentTeamRef.current?.name || '';
                            const channelName = loadedChannel?.name || channelId;
                            historyRef.current.replace(`/${teamName}/channels/${channelName}`);
                            setLoading(false);
                            return;
                        }
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
                // First check if wiki exists by trying to fetch it from Redux (or API if not cached)
                // This will return 404 if wiki was deleted
                const wikiResult = await dispatch(fetchWiki(wikiId));
                if (wikiResult.error) {
                    // Wiki was deleted or user doesn't have permission - redirect to channel
                    const teamName = currentTeamRef.current?.name || '';
                    const channelName = loadedChannel?.name || channelId;
                    setLoading(false);
                    historyRef.current.replace(`/${teamName}/channels/${channelName}`);
                    return;
                }

                // Wiki exists - pages and drafts are loaded by parent WikiView component
            } else {
                // No wikiId - load default page if available (for channel wiki without explicit wikiId)
                try {
                    await dispatch(fetchChannelDefaultPage(channelId));
                } catch (error) {
                    // Error loading default page - continue anyway
                }
            }

            // Pages and drafts are loaded by parent WikiView component to prevent duplicate API calls
            setLoading(false);
        };

        loadPageOrDraft();
    }, [pageId, draftId, channelId, wikiId, currentUserId, dispatch]);

    return {
        isLoading,
    };
}

type UseWikiPageActionsResult = {
    handleEdit: () => Promise<ActionResult | undefined>;
    handlePublish: () => Promise<void>;
    handleTitleChange: (title: string) => void;
    handleContentChange: (content: string) => void;
    handleDraftStatusChange: (status: string) => void;
    cancelAutosave: () => void;
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
    history: History,
): UseWikiPageActionsResult {
    const dispatch = useDispatch();
    const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const latestContentRef = useRef<string>('');
    const latestTitleRef = useRef<string>('');
    const latestStatusRef = useRef<string | null>(null);
    const previousDraftRef = useRef<PostDraft | null>(null);
    const draftGenerationRef = useRef(0);
    const currentDraftIdRef = useRef<string | null>(null);

    // Conflict modal state
    const [, setConflictPageData] = useState<Post | null>(null);
    const conflictContentRef = useRef<string>('');

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
        const isDifferentDraft = newDraftId !== currentDraftIdRef.current;

        if (isDifferentDraft) {
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
            const additionalProps = extractDraftAdditionalProps(prevDraft);

            dispatch(savePageDraft(
                channelId,
                wikiId,
                prevDraft.rootId,
                prevContent,
                prevTitle,
                undefined,
                additionalProps,
            ));
        } else if (autosaveTimeoutRef.current && !currentDraft) {
            // Transitioning to null (draft deleted/published) - just cancel the timeout
            clearTimeout(autosaveTimeoutRef.current);
            autosaveTimeoutRef.current = null;
        }

        if (currentDraft) {
            latestContentRef.current = currentDraft.message || '';
            latestTitleRef.current = currentDraft.props?.[PagePropsKeys.TITLE] || '';

            // Only reset latestStatusRef if we're switching to a different draft
            // If it's the same draft (just re-rendered), keep the latestStatusRef value
            if (isDifferentDraft) {
                // Initialize from draft props instead of resetting to null
                latestStatusRef.current = (currentDraft.props?.[PagePropsKeys.PAGE_STATUS] as string | undefined) || null;
            }
            previousDraftRef.current = currentDraft;
        } else {
            // Clear refs when no draft
            latestContentRef.current = '';
            latestTitleRef.current = '';
            latestStatusRef.current = null;
            previousDraftRef.current = null;
        }
    }, [currentDraft?.rootId, currentDraft?.props?.[PagePropsKeys.TITLE], channelId, wikiId, dispatch]); // Include title to update refs when draft title changes

    const handleEdit = useCallback(async () => {
        if (!pageId || !wikiId || !currentPage) {
            return undefined;
        }

        const result = await dispatch(openPageInEditMode(channelId, wikiId, currentPage));

        // Check if unsaved draft was detected
        if (result.error && result.error.id === 'api.page.edit.unsaved_draft_exists') {
            return result;
        }

        // Navigate to draft on success
        if (result.data) {
            const teamName = getTeamNameFromPath(location.pathname);
            const draftPath = getWikiUrl(teamName, channelId, wikiId, result.data, true);
            history.replace(draftPath);
        }

        return undefined;
    }, [channelId, pageId, wikiId, currentPage, dispatch, history, location]);

    const channelIdRef = useRef(channelId);
    const wikiIdRef = useRef(wikiId);
    const currentDraftRef = useRef(currentDraft);
    const dispatchRef = useRef(dispatch);

    channelIdRef.current = channelId;
    wikiIdRef.current = wikiId;
    currentDraftRef.current = currentDraft;
    dispatchRef.current = dispatch;

    // Cleanup autosave timeout on unmount to prevent dispatch after unmount
    useEffect(() => {
        return () => {
            if (autosaveTimeoutRef.current) {
                clearTimeout(autosaveTimeoutRef.current);
                autosaveTimeoutRef.current = null;
            }
        };
    }, []);

    const scheduleAutosave = useCallback((options: {
        content?: string;
        title?: string;
    }) => {
        if (!wikiIdRef.current || !currentDraftRef.current) {
            return;
        }

        if (autosaveTimeoutRef.current) {
            clearTimeout(autosaveTimeoutRef.current);
        }

        const capturedDraft = currentDraftRef.current;
        const draftId = capturedDraft.rootId;
        const content = options.content ?? (latestContentRef.current || capturedDraft.message || '');
        const title = options.title ?? (latestTitleRef.current || capturedDraft.props?.[PagePropsKeys.TITLE] || '');
        const additionalProps = extractDraftAdditionalProps(capturedDraft);
        const capturedChannelId = channelIdRef.current;
        const capturedWikiId = wikiIdRef.current;
        const capturedGeneration = draftGenerationRef.current;

        autosaveTimeoutRef.current = setTimeout(() => {
            if (!currentDraftRef.current || currentDraftRef.current.rootId !== draftId || draftGenerationRef.current !== capturedGeneration) {
                return;
            }

            dispatchRef.current(savePageDraft(
                capturedChannelId,
                capturedWikiId,
                draftId,
                content,
                title,
                undefined,
                additionalProps,
            ));
        }, AUTOSAVE_DEBOUNCE_MS);
    }, []);

    const handleTitleChange = useCallback((newTitle: string) => {
        latestTitleRef.current = newTitle;
        scheduleAutosave({title: newTitle});
    }, [scheduleAutosave]);

    const handleContentChange = useCallback((newContent: string) => {
        latestContentRef.current = newContent;
        scheduleAutosave({content: newContent});
    }, [scheduleAutosave]);

    const handlePublish = useCallback(async () => {
        // Capture ref values at start to avoid stale closures after await
        const capturedWikiId = wikiIdRef.current;
        const capturedChannelId = channelIdRef.current;
        const capturedDraft = currentDraftRef.current;

        if (!capturedWikiId || !capturedDraft) {
            return;
        }

        if (!capturedDraft.rootId) {
            return;
        }

        // Cancel any pending autosave BEFORE starting publish to prevent race condition
        // where autosave could fire during the async publish and resurrect the deleted draft
        if (autosaveTimeoutRef.current) {
            clearTimeout(autosaveTimeoutRef.current);
            autosaveTimeoutRef.current = null;
        }

        // Use the latest content and title from refs (may not be saved yet due to debounce)
        const content = latestContentRef.current || capturedDraft.message || '';
        const title = latestTitleRef.current || capturedDraft.props?.[PagePropsKeys.TITLE] || '';
        const pageStatus = latestStatusRef.current === null ? (capturedDraft.props?.[PagePropsKeys.PAGE_STATUS] as string | undefined) : latestStatusRef.current;

        if (!content || content.trim() === '') {
            return;
        }

        const draftRootId = capturedDraft.rootId;
        const pageParentIdFromDraft = capturedDraft.props?.[PagePropsKeys.PAGE_PARENT_ID];

        if (pageParentIdFromDraft && pageParentIdFromDraft.startsWith('draft-')) {
            const error = {
                message: 'Parent page must be published before publishing this page',
                server_error_id: 'api.page.publish.parent_is_draft.app_error',
                status_code: 400,
            };
            dispatch(logError(error, {errorBarMode: LogErrorBarMode.Always}));
            return;
        }

        try {
            const result = await dispatch(publishPageDraft(
                capturedWikiId,
                draftRootId,
                pageParentIdFromDraft || '',
                title,
                '',
                content,
                pageStatus,
            ));

            if (result.error) {
                // Check if it's a conflict error
                if (result.error.id === 'api.page.publish_draft.conflict') {
                    // Cancel pending autosave and immediately save the user's content
                    // This ensures the draft has the latest changes when the user clicks Cancel
                    if (autosaveTimeoutRef.current) {
                        clearTimeout(autosaveTimeoutRef.current);
                        autosaveTimeoutRef.current = null;
                    }
                    const additionalProps = extractDraftAdditionalProps(capturedDraft);

                    // Await the save to ensure Redux is updated before showing the modal
                    await dispatch(savePageDraft(
                        capturedChannelId,
                        capturedWikiId,
                        draftRootId,
                        content,
                        title,
                        undefined,
                        additionalProps,
                    ));

                    conflictContentRef.current = content;
                    const conflictPage = result.error.data.currentPage as Post;
                    setConflictPageData(conflictPage);

                    // Open conflict modal via modal manager
                    dispatch(openModal({
                        modalId: ModalIdentifiers.PAGE_CONFLICT_WARNING,
                        dialogType: ConflictWarningModal,
                        dialogProps: {
                            currentPage: conflictPage,
                            onViewChanges: () => {
                                if (conflictPage?.id && capturedWikiId) {
                                    const teamName = getTeamNameFromPath(location.pathname);
                                    const pageUrl = getWikiUrl(teamName, capturedChannelId, capturedWikiId, conflictPage.id);
                                    history.push(pageUrl);
                                }
                            },
                            onContinueEditing: () => {
                                // Modal closed, user stays on their draft
                            },
                            onOverwrite: async () => {
                                if (!capturedWikiId || !capturedDraft) {
                                    return;
                                }

                                const overwriteContent = conflictContentRef.current || latestContentRef.current || capturedDraft.message || '';
                                const overwriteTitle = latestTitleRef.current || capturedDraft.props?.[PagePropsKeys.TITLE] || '';
                                const overwriteStatus = latestStatusRef.current === null ? (capturedDraft.props?.[PagePropsKeys.PAGE_STATUS] as string | undefined) : latestStatusRef.current;
                                const overwriteDraftRootId = capturedDraft.rootId;
                                const overwritePageParentIdFromDraft = capturedDraft.props?.[PagePropsKeys.PAGE_PARENT_ID];

                                try {
                                    const overwriteResult = await dispatch(publishPageDraft(
                                        capturedWikiId,
                                        overwriteDraftRootId,
                                        overwritePageParentIdFromDraft || '',
                                        overwriteTitle,
                                        '',
                                        overwriteContent,
                                        overwriteStatus,
                                        true, // force = true
                                    ));

                                    if (overwriteResult.data) {
                                        const teamName = getTeamNameFromPath(location.pathname);
                                        const redirectUrl = getWikiUrl(teamName, capturedChannelId, capturedWikiId, overwriteResult.data.id);
                                        history.replace(redirectUrl);
                                    }
                                } catch (e) {
                                    // Handle error silently
                                }
                            },
                        },
                    }));
                    return;
                }
                return;
            }

            if (result.data) {
                const teamName = getTeamNameFromPath(location.pathname);
                const redirectUrl = getWikiUrl(teamName, capturedChannelId, capturedWikiId, result.data.id);
                history.replace(redirectUrl);
            }
        } catch (error) {
            // Unexpected error - already logged by publishPageDraft action
        }
    }, [location.pathname, history, dispatch]);

    const handleDraftStatusChange = useCallback((newStatus: string) => {
        if (!wikiId || !draftId || !currentDraft) {
            return;
        }

        // Update the ref immediately so handlePublish can use the latest value
        latestStatusRef.current = newStatus;

        // Clear any pending autosave timeout since we're about to save immediately with correct props
        if (autosaveTimeoutRef.current) {
            clearTimeout(autosaveTimeoutRef.current);
            autosaveTimeoutRef.current = null;
        }

        const pageParentIdFromDraft = currentDraft.props?.[PagePropsKeys.PAGE_PARENT_ID];
        const originalPageEditAt = currentDraft.props?.[PagePropsKeys.ORIGINAL_PAGE_EDIT_AT];
        const title = latestTitleRef.current || currentDraft.props?.[PagePropsKeys.TITLE] || '';
        const content = latestContentRef.current || currentDraft.message || '';

        const propsToSave: Record<string, unknown> = {
            [PagePropsKeys.PAGE_STATUS]: newStatus,
        };
        if (pageParentIdFromDraft) {
            propsToSave[PagePropsKeys.PAGE_PARENT_ID] = pageParentIdFromDraft;
        }
        if (originalPageEditAt !== undefined) {
            propsToSave[PagePropsKeys.ORIGINAL_PAGE_EDIT_AT] = originalPageEditAt;
        }

        dispatch(savePageDraft(
            channelId,
            wikiId,
            draftId,
            content,
            title,
            undefined,
            propsToSave,
        ));
    }, [channelId, wikiId, draftId, currentDraft, dispatch]);

    const cancelAutosave = useCallback(() => {
        if (autosaveTimeoutRef.current) {
            clearTimeout(autosaveTimeoutRef.current);
            autosaveTimeoutRef.current = null;
        }
    }, []);

    return {
        handleEdit,
        handlePublish,
        handleTitleChange,
        handleContentChange,
        handleDraftStatusChange,
        cancelAutosave,
    };
}

type UseFullscreenResult = {
    isFullscreen: boolean;
    toggleFullscreen: () => void;
};

/**
 * Manages fullscreen state for the wiki view.
 * Handles toggling, escape key, and body class management.
 */
export function useFullscreen(): UseFullscreenResult {
    const [isFullscreen, setIsFullscreen] = useState(false);

    const toggleFullscreen = useCallback(() => {
        setIsFullscreen((prev) => !prev);
    }, []);

    // Escape key handler
    useEffect(() => {
        const handleKeydown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && isFullscreen) {
                toggleFullscreen();
            }
        };

        window.addEventListener('keydown', handleKeydown);
        return () => window.removeEventListener('keydown', handleKeydown);
    }, [isFullscreen, toggleFullscreen]);

    // Body class management
    useEffect(() => {
        if (isFullscreen) {
            document.body.classList.add('fullscreen-mode');
        } else {
            document.body.classList.remove('fullscreen-mode');
        }

        return () => {
            document.body.classList.remove('fullscreen-mode');
        };
    }, [isFullscreen]);

    return {
        isFullscreen,
        toggleFullscreen,
    };
}

type UseAutoPageSelectionParams = {
    pageId: string | undefined;
    draftId: string | undefined;
    wikiId: string | undefined;
    channelId: string;
    allDrafts: PostDraft[];
    newDrafts: PostDraft[];
    allPages: Post[];
    lastViewedPageId: string | null;
    location: Location;
    history: History;
};

/**
 * Handles automatic page/draft selection when at wiki root (no pageId or draftId in URL).
 * Priority: last viewed page > first new draft > first published page.
 */
export function useAutoPageSelection({
    pageId,
    draftId,
    wikiId,
    channelId,
    allDrafts,
    newDrafts,
    allPages,
    lastViewedPageId,
    location,
    history,
}: UseAutoPageSelectionParams): void {
    useEffect(() => {
        if (pageId || draftId) {
            return;
        }

        const teamName = getTeamNameFromPath(location.pathname);

        // Priority 1: Try to restore last viewed page if it exists
        if (lastViewedPageId) {
            const lastViewedNewDraft = newDrafts.find((d) => d.rootId === lastViewedPageId);
            const lastViewedPage = allPages.find((p) => p.id === lastViewedPageId);

            if (lastViewedNewDraft && wikiId) {
                const draftUrl = getWikiUrl(teamName, channelId, wikiId, lastViewedNewDraft.rootId, true);
                history.replace(draftUrl);
                return;
            } else if (lastViewedPage && wikiId) {
                const pageUrl = getWikiUrl(teamName, channelId, wikiId, lastViewedPage.id, false);
                history.replace(pageUrl);
                return;
            }
        }

        // Priority 2: Select first NEW draft if one exists (drafts without page_id)
        if (newDrafts.length > 0 && wikiId) {
            const firstDraft = newDrafts[0];
            if (firstDraft) {
                const draftUrl = getWikiUrl(teamName, channelId, wikiId, firstDraft.rootId, true);
                history.replace(draftUrl);
                return;
            }
        }

        // Priority 3: Select first published page if pages exist
        if (allPages.length > 0 && wikiId) {
            const firstPage = allPages[0];
            if (firstPage) {
                const pageUrl = getWikiUrl(teamName, channelId, wikiId, firstPage.id, false);
                history.replace(pageUrl);
            }
        }
    }, [pageId, draftId, allDrafts, newDrafts, allPages, channelId, wikiId, location.pathname, history, lastViewedPageId]);
}

type UseVersionHistoryParams = {
    wikiId: string;
    allPages: Post[];
};

type UseVersionHistoryResult = {
    handleVersionHistory: (pageId: string) => void;
};

/**
 * Manages version history modal via modal manager.
 */
export function useVersionHistory({wikiId, allPages}: UseVersionHistoryParams): UseVersionHistoryResult {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const untitledText = formatMessage({id: 'wiki.untitled_page', defaultMessage: 'Untitled'});

    const handleVersionHistory = useCallback((targetPageId: string) => {
        const page = allPages.find((p) => p.id === targetPageId);
        if (!page || !wikiId) {
            return;
        }

        const pageTitle = getPageTitle(page, untitledText);

        dispatch(openModal({
            modalId: ModalIdentifiers.PAGE_VERSION_HISTORY,
            dialogType: PageVersionHistoryModal,
            dialogProps: {
                page,
                pageTitle,
                wikiId,
                onVersionRestored: () => {
                    dispatch(closeModal(ModalIdentifiers.PAGE_VERSION_HISTORY));
                },
            },
        }));
    }, [allPages, wikiId, untitledText, dispatch]);

    return {
        handleVersionHistory,
    };
}
