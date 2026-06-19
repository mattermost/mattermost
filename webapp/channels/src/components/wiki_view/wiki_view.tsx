// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {useRouteMatch, useHistory, useLocation} from 'react-router-dom';

import {getChannel as fetchChannel} from 'mattermost-redux/actions/channels';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {notifyPageEditorStopped} from 'actions/pages';
import {openPagesPanel, setLastViewedPage} from 'actions/views/pages_hierarchy';
import {closeRightHandSide, openWikiRhs} from 'actions/views/rhs';
import {setWikiRhsMode} from 'actions/views/wiki_rhs';
import {fetchWikiBundle} from 'actions/wiki_actions';
import {getPageDraft, getPageDraftsForWiki, getNewDraftsForWiki} from 'selectors/page_drafts';
import {getPage, makeGetPages, getResolvedChannelId} from 'selectors/pages';
import {getIsPanesPanelCollapsed, getLastViewedPage} from 'selectors/pages_hierarchy';
import {getRhsState} from 'selectors/rhs';

import LoadingScreen from 'components/loading_screen';
import PagesHierarchyPanel from 'components/pages_hierarchy_panel';
import {usePageMenuHandlers} from 'components/pages_hierarchy_panel/hooks/usePageMenuHandlers';

import {usePublishedDraftCleanup} from 'hooks/usePublishedDraftCleanup';
import {isEditingExistingPage, getPublishedPageIdFromDraft, copyPageAsMarkdown, canEditPageInWiki} from 'utils/page_utils';
import {getWikiUrl, getTeamNameFromPath} from 'utils/url';

import type {GlobalState} from 'types/store';

import {useWikiPageData, useWikiPageActions, useFullscreen, useAutoPageSelection, useVersionHistory} from './hooks';
import {handleAnchorHashNavigation} from './page_anchor';
import PageViewer from './page_viewer';
import {withWikiErrorBoundary} from './wiki_error_boundary';
import WikiPageEditor from './wiki_page_editor';
import type {AIToolsHandlers} from './wiki_page_editor/tiptap_editor';
import WikiPageHeader from './wiki_page_header';

import './wiki_view.scss';

const WikiView = () => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const history = useHistory();
    const location = useLocation();
    const {params, path} = useRouteMatch<{pageId?: string; draftId?: string; wikiId: string}>();
    const {pageId, draftId, wikiId} = params;
    const channelId = useSelector((state: GlobalState) => getResolvedChannelId(state, wikiId || ''));

    const teamId = useSelector(getCurrentTeamId);
    const currentUserId = useSelector(getCurrentUserId);
    const rhsState = useSelector((state: GlobalState) => getRhsState(state));
    const isWikiRhsOpen = rhsState === 'wiki';
    const isPanesPanelCollapsed = useSelector((state: GlobalState) => getIsPanesPanelCollapsed(state));
    const lastViewedPageId = useSelector((state: GlobalState) => (wikiId ? getLastViewedPage(state, wikiId) : null));

    // Fullscreen state and handlers (extracted to hook)
    const {isFullscreen, toggleFullscreen} = useFullscreen();

    // AI tools handlers from editor - lifted up to pass to header
    const [aiToolsHandlers, setAIToolsHandlers] = React.useState<AIToolsHandlers | null>(null);

    // Current editor content ref — updated on every change so the outline button can read it
    const currentEditorContentRef = React.useRef<string>('');
    const getEditorContent = React.useCallback(() => currentEditorContentRef.current, []);

    // Cleanup stale published draft timestamps periodically
    usePublishedDraftCleanup();

    // Track if we're navigating to select a draft
    const isSelectingDraftRef = React.useRef(false);

    const [wikiBundleLoadError, setWikiBundleLoadError] = React.useState(false);
    const [wikiBundleLoading, setWikiBundleLoading] = React.useState(Boolean(wikiId));

    // Load wiki data (pages, drafts) on wiki change
    // Uses cache-first pattern: only fetches pages if not already loaded
    React.useEffect(() => {
        if (!wikiId) {
            setWikiBundleLoading(false);
            return undefined;
        }
        let cancelled = false;
        setWikiBundleLoadError(false);
        setWikiBundleLoading(true);
        dispatch(fetchWikiBundle(wikiId)).then((result) => {
            if (cancelled) {
                return;
            }
            setWikiBundleLoading(false);
            if ('error' in result && result.error) {
                // eslint-disable-next-line no-console
                console.log('[wiki_view] fetchWikiBundle error', {wikiId, error: result.error});
                setWikiBundleLoadError(true);
            } else {
                // eslint-disable-next-line no-console
                console.log('[wiki_view] fetchWikiBundle ok', {wikiId});
            }
        }).catch((err) => {
            if (!cancelled) {
                setWikiBundleLoading(false);
                // eslint-disable-next-line no-console
                console.log('[wiki_view] fetchWikiBundle exception', {wikiId, err: String(err)});
                setWikiBundleLoadError(true);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [wikiId, dispatch]);

    const {isLoading: isRouteLoading} = useWikiPageData(
        pageId,
        draftId,
        channelId,
        wikiId,
        teamId,
        location,
        history,
        path,
        isSelectingDraftRef,
    );
    const isLoading = isRouteLoading || wikiBundleLoading;

    const currentDraft = useSelector((state: GlobalState) => {
        if (!wikiId || !draftId) {
            return null;
        }
        const d = getPageDraft(state, wikiId, draftId);
        return d;
    });

    const currentPage = useSelector((state: GlobalState) => {
        const page = pageId ? getPage(state, pageId) : null;
        return page;
    });

    // Get published page when editing a draft of an existing page
    const publishedPageForDraft = useSelector((state: GlobalState) => {
        if (!currentDraft) {
            return null;
        }
        const isExisting = isEditingExistingPage(currentDraft);
        if (!isExisting) {
            return null;
        }
        const pubPageId = getPublishedPageIdFromDraft(currentDraft);
        return pubPageId ? getPage(state, pubPageId) : null;
    });

    // Preserve parent ID and title across renders to avoid breadcrumb flickering
    // Consolidated ref-tracking: update refs when page/draft data changes
    const pageParentIdRef = React.useRef<string | undefined>(undefined);
    const draftParentIdRef = React.useRef<string | undefined>(undefined);
    const draftTitleRef = React.useRef<string | undefined>(undefined);
    React.useEffect(() => {
        if (currentPage?.parent_id) {
            pageParentIdRef.current = currentPage.parent_id;
        }
        if (currentDraft?.props?.page_parent_id) {
            draftParentIdRef.current = currentDraft.props.page_parent_id;
        }
        if (currentDraft?.props?.title) {
            draftTitleRef.current = currentDraft.props.title;
        }
    }, [currentPage?.parent_id, currentDraft?.props?.page_parent_id, currentDraft?.props?.title]);

    const getPages = React.useMemo(() => makeGetPages(), []);
    const allDrafts = useSelector((state: GlobalState) => (wikiId ? getPageDraftsForWiki(state, wikiId) : []));
    const newDrafts = useSelector((state: GlobalState) => (wikiId ? getNewDraftsForWiki(state, wikiId) : []));
    const allPages = useSelector((state: GlobalState) => (wikiId ? getPages(state, wikiId) : []));

    // Refs to track latest values to avoid stale closures in async callbacks
    const newDraftsRef = React.useRef(newDrafts);
    React.useEffect(() => {
        newDraftsRef.current = newDrafts;
    }, [newDrafts]);

    const pageIdRef = React.useRef(pageId);
    React.useEffect(() => {
        pageIdRef.current = pageId;
    }, [pageId]);

    // Version history modal via modal manager
    const {handleVersionHistory} = useVersionHistory({wikiId: wikiId || '', allPages});

    // isDraft derived from route - draftId in URL (via /drafts/ path) means we're editing
    const isDraft = Boolean(draftId);
    const onGetPageContent = draftId ? getEditorContent : undefined;

    // Channel for sidebar selection. channelId comes from getResolvedChannelId,
    // which walks ChannelMemberLinks for a member-channel match. Lazy-fetch if not in Redux
    // (covers the deep-link case where the channel hasn't been visited this session).
    const currentChannel = useSelector((state: GlobalState) => getChannel(state, channelId));

    React.useEffect(() => {
        if (channelId && !currentChannel) {
            dispatch(fetchChannel(channelId));
        }
    }, [channelId, currentChannel, dispatch]);

    // canEdit checks against the wiki's permission graph (backing channel + linked
    // source channels), not against the resolved "viewing channel" — the latter
    // depends on resolution timing and breaks after a page reload that wiped
    // linksByChannel. canEditPageInWiki mirrors the server's check.
    const canEdit = useSelector((state: GlobalState) => {
        if (!pageId || isDraft) {
            return true;
        }
        return canEditPageInWiki(state, currentPage);
    });

    // Single source of truth for empty state (no drafts, no pages)
    const isEmptyState = !currentDraft && !pageId && allDrafts.length === 0 && allPages.length === 0;

    // Store last viewed page when pageId or draftId changes
    React.useEffect(() => {
        if (wikiId && (pageId || draftId)) {
            const viewedPageId = pageId || draftId;
            if (viewedPageId) {
                dispatch(setLastViewedPage(wikiId, viewedPageId));
            }
        }
    }, [pageId, draftId, wikiId, dispatch]);

    // Track current editing state in a ref so we can access it on unmount
    // without triggering cleanup on every dependency change
    const editorStoppedRef = React.useRef<{wikiId: string; pageId: string} | null>(null);

    // Notify server when user stops editing a page (page change or unmount)
    // This effect handles ONLY page navigation changes - not content updates
    React.useEffect(() => {
        // Compute inside effect to ensure all dependencies are captured
        const publishedPageId = currentDraft?.props?.page_id || publishedPageForDraft?.id;

        // Determine current editing state
        const currentEditingPage = (isDraft && wikiId && draftId && publishedPageId) ?
            {wikiId, pageId: publishedPageId} :
            null;

        // If the page being edited changed, notify about the OLD page
        const previousPage = editorStoppedRef.current;
        if (previousPage && (!currentEditingPage || previousPage.pageId !== currentEditingPage.pageId)) {
            dispatch(notifyPageEditorStopped(previousPage.wikiId, previousPage.pageId));
        }

        // Update ref to track current editing state
        editorStoppedRef.current = currentEditingPage;
    }, [isDraft, wikiId, draftId, currentDraft?.props?.page_id, publishedPageForDraft?.id, dispatch]);

    // Notify server on component unmount
    React.useEffect(() => {
        return () => {
            if (editorStoppedRef.current) {
                const {wikiId: wiki, pageId: page} = editorStoppedRef.current;
                dispatch(notifyPageEditorStopped(wiki, page));
            }
        };

        // Intentionally only run on unmount; dispatch is stable
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Auto-select page when at wiki root (extracted to hook)
    useAutoPageSelection({
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
    });

    // Consolidated URL parameter handling: openRhs query param + anchor hash navigation
    // Both handle post-load URL state processing
    React.useEffect(() => {
        // Handle openRhs query parameter
        const searchParams = new URLSearchParams(location.search);
        if (searchParams.get('openRhs') === 'true' && pageId && !isWikiRhsOpen) {
            dispatch(openWikiRhs(pageId, wikiId || '', undefined));
            dispatch(setWikiRhsMode('comments'));
            searchParams.delete('openRhs');
            const newSearch = searchParams.toString();
            const newUrl = `${location.pathname}${newSearch ? `?${newSearch}` : ''}`;
            history.replace(newUrl);
        }

        // Handle anchor hash navigation when content is ready
        const contentId = pageId || draftId;
        if (!isLoading && contentId && location.hash) {
            const delay = draftId ? 300 : 100;
            const timeoutId = setTimeout(() => {
                handleAnchorHashNavigation();
            }, delay);
            return () => clearTimeout(timeoutId);
        }
        return undefined;
    }, [location.search, location.pathname, location.hash, pageId, draftId, wikiId, isWikiRhsOpen, isLoading, dispatch, history]);

    const {handleEdit, handlePublish, handleTitleChange, handleTitleBlur, handleContentChange, handleDraftStatusChange, cancelAutosave, publishError, clearPublishError} = useWikiPageActions(
        channelId,
        pageId,
        draftId,
        wikiId,
        currentPage || null,
        currentDraft,
        location,
        history,
    );

    // Stable callback so TipTapEditor's custom arePropsEqual doesn't see a new
    // reference on every render and reinitialize the editor.
    const handleEditorContentChange = React.useCallback((content: string) => {
        currentEditorContentRef.current = content;
        handleContentChange(content);
    }, [handleContentChange]);

    // Clear the publish error when the user navigates to a different page/draft —
    // the error is scoped to the publish attempt, not to the wiki as a whole.
    React.useEffect(() => {
        clearPublishError();
    }, [pageId, draftId, clearPublishError]);

    const handleGoToParentPage = React.useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        if (!publishError) {
            return;
        }
        const rawId = publishError.parentPageId.replace(/^draft-/, '');
        const teamName = getTeamNameFromPath(location.pathname);
        history.push(getWikiUrl(teamName, wikiId || '', rawId, true));
        clearPublishError();
    }, [publishError, location.pathname, history, wikiId, clearPublishError]);

    // Auto-resume draft like Confluence (no modal prompt)
    const onEdit = React.useCallback(async () => {
        // Capture pageId before await to avoid stale closure
        const currentPageId = pageIdRef.current;

        const result = await handleEdit() as {error?: {id: string; data: any}} | {data: boolean} | undefined;

        // If draft exists, automatically navigate to it (Confluence-style auto-resume)
        if (result && 'error' in result && result.error?.id === 'api.page.edit.unsaved_draft_exists') {
            if (currentPageId && wikiId) {
                const teamName = getTeamNameFromPath(location.pathname);
                const draftPath = getWikiUrl(teamName, wikiId, currentPageId, true);
                history.push(draftPath);
            }
        }
    }, [handleEdit, wikiId, history, location]);

    const handleToggleComments = React.useCallback(() => {
        if (isWikiRhsOpen) {
            dispatch(closeRightHandSide());
        } else {
            // For published pages, use pageId directly
            // For drafts of existing pages, use the published page ID from draft
            const targetPageId = pageId || getPublishedPageIdFromDraft(currentDraft);

            if (targetPageId) {
                dispatch(openWikiRhs(targetPageId, wikiId || '', undefined));
                dispatch(setWikiRhsMode('comments'));
            }
        }
    }, [isWikiRhsOpen, dispatch, pageId, currentDraft, wikiId]);

    const handlePageSelect = React.useCallback((selectedPageId: string, isDraftHint?: boolean) => {
        if (!wikiId) {
            return;
        }

        if (!selectedPageId && wikiId) {
            dispatch(setLastViewedPage(wikiId, ''));
        }

        const teamName = getTeamNameFromPath(location.pathname);

        // Check if selected ID is a pure draft (new page, not yet published)
        // isDraftHint takes precedence when provided (avoids stale closure issue)
        // Otherwise check newDraftsRef (current value via ref to avoid stale closure)
        // Published pages should always open in view mode, even if they have unsaved drafts
        const isDraftPage = isDraftHint ?? newDraftsRef.current.some((draft) => draft.rootId === selectedPageId);

        const url = getWikiUrl(teamName, wikiId, selectedPageId, isDraftPage);

        history.push(url);

        // For RHS: new drafts don't have comments, published pages do
        if (isWikiRhsOpen && selectedPageId && !isDraftPage) {
            dispatch(openWikiRhs(selectedPageId, wikiId || '', undefined));
        }
    }, [wikiId, dispatch, location.pathname, history, isWikiRhsOpen]);

    // Use shared menu handlers hook - it will combine pages and drafts internally
    const menuHandlers = usePageMenuHandlers({
        wikiId: wikiId || '',
        channelId,
        pages: allPages,
        drafts: allDrafts,
        onPageSelect: handlePageSelect,
    });

    const handleOpenPagesPanel = React.useCallback(() => {
        if (isFullscreen) {
            toggleFullscreen();
        }
        dispatch(openPagesPanel());
    }, [dispatch, isFullscreen, toggleFullscreen]);

    React.useEffect(() => {
        // eslint-disable-next-line no-console
        console.log('[wiki_view] page-gone-check', {pageId, hasPage: Boolean(currentPage), isLoading, path: location.pathname});
        if (pageId && !currentPage && !isLoading) {
            const currentPath = location.pathname;
            const basePath = currentPath.substring(0, currentPath.lastIndexOf('/'));
            const target = pageParentIdRef.current ? `${basePath}/${pageParentIdRef.current}` : basePath;
            // eslint-disable-next-line no-console
            console.log('[wiki_view] page-gone: navigating away', {pageId, target});
            history.replace(target);
        }
    }, [pageId, currentPage, isLoading, location.pathname, history]);

    // Memoized header props to avoid inline IIFE recreation on every render
    const headerProps = React.useMemo(() => {
        if (isEmptyState) {
            return null;
        }

        const currentPageIdForHeader = currentDraft ? draftId : (pageId || '');
        const pageLink = currentPageIdForHeader && wikiId ? getWikiUrl(getTeamNameFromPath(location.pathname), wikiId, currentPageIdForHeader, false) : undefined;

        // For drafts, wait until currentDraft is loaded to avoid breadcrumb issues
        if (isDraft && draftId && !currentDraft) {
            return null;
        }

        // Use refs to preserve draft parent ID and title across renders
        const effectiveParentId = isDraft ? (currentDraft?.props?.page_parent_id || draftParentIdRef.current) : undefined;
        const effectiveTitle = isDraft ? (currentDraft?.props?.title || draftTitleRef.current) : undefined;
        const isExistingPage = currentDraft?.props?.has_published_version === undefined ?
            undefined :
            isEditingExistingPage(currentDraft);

        return {
            wikiId: wikiId || '',
            pageId: currentPageIdForHeader || '',
            channelId,
            isDraft,
            isExistingPage,
            parentPageId: effectiveParentId,
            draftTitle: effectiveTitle,
            pageLink,
        };
    }, [isEmptyState, currentDraft, draftId, pageId, wikiId, channelId, location.pathname, isDraft]);

    // Memoized header action callbacks to avoid recreating functions on every render
    const handleCreateChild = React.useCallback(() => {
        if (headerProps?.pageId) {
            menuHandlers.handleCreateChild(headerProps.pageId);
        }
    }, [headerProps?.pageId, menuHandlers]);

    const handleDuplicate = React.useCallback(() => {
        if (headerProps?.pageId) {
            menuHandlers.handleDuplicate(headerProps.pageId);
        }
    }, [headerProps?.pageId, menuHandlers]);

    const handleMove = React.useCallback(() => {
        if (headerProps?.pageId) {
            menuHandlers.handleMove(headerProps.pageId);
        }
    }, [headerProps?.pageId, menuHandlers]);

    const handleHeaderDelete = React.useCallback(() => {
        if (headerProps?.pageId) {
            menuHandlers.handleDelete(headerProps.pageId);
        }
    }, [headerProps?.pageId, menuHandlers]);

    const handleHeaderVersionHistory = React.useCallback(() => {
        if (headerProps?.pageId) {
            handleVersionHistory(headerProps.pageId);
        }
    }, [headerProps?.pageId, handleVersionHistory]);

    const handleCopyMarkdown = React.useCallback(async () => {
        const content = isDraft ? currentDraft?.message : currentPage?.body;
        const title = isDraft ? currentDraft?.props?.title : currentPage?.title;
        await copyPageAsMarkdown(content, typeof title === 'string' ? title : undefined);
    }, [isDraft, currentDraft?.message, currentDraft?.props?.title, currentPage?.body, currentPage?.title]);

    // Handler for when a translated/proofread draft is created - navigate to the new draft
    const handleTranslatedPageCreated = React.useCallback((newPageId: string) => {
        if (!wikiId) {
            return;
        }
        const teamName = getTeamNameFromPath(location.pathname);
        const url = getWikiUrl(teamName, wikiId, newPageId, true);
        history.push(url);
    }, [wikiId, location.pathname, history]);

    // Memoized editor props to avoid inline IIFE recreation on every render
    const editorProps = React.useMemo(() => {
        if (!draftId || !currentDraft || currentDraft.rootId !== draftId) {
            return null;
        }

        // Use undefined when draft props aren't loaded yet to prevent flash of "Draft" badge
        // Only return true/false when we're certain about the draft state
        const hasPublishedVersion = currentDraft?.props?.has_published_version;
        const isExistingPage = hasPublishedVersion === undefined ?
            undefined :
            isEditingExistingPage(currentDraft);
        const publishedPageId = getPublishedPageIdFromDraft(currentDraft);

        // Determine author: use original author if editing existing page, otherwise current user
        const authorId = isExistingPage && publishedPageForDraft ? publishedPageForDraft.user_id : currentUserId;

        return {
            key: draftId,
            title: currentDraft.props?.title || '',
            content: currentDraft.message || '',
            authorId,
            currentUserId,
            channelId,
            teamId,
            pageId: isExistingPage ? publishedPageId : draftId,
            wikiId,
            pageParentId: currentDraft.props?.page_parent_id as string | undefined,
            showAuthor: true,
            isExistingPage,
            draftStatus: currentDraft.props?.page_status as string | undefined,
            onTranslatedPageCreated: handleTranslatedPageCreated,
        };
    }, [draftId, currentDraft, publishedPageForDraft, currentUserId, channelId, teamId, wikiId, handleTranslatedPageCreated]);

    // Auto-updating RHS on page navigation is intentionally not done — the RHS ThreadViewer
    // mount blocks PageViewer rendering for ~60s; users toggle RHS manually instead.

    if (wikiBundleLoadError) {
        return (
            <div
                className='WikiView no-results__holder'
                data-testid='wiki-view-error'
            >
                <i className='icon icon-alert-outline'/>
                <p>
                    <FormattedMessage
                        id='wiki.load_error'
                        defaultMessage='Failed to load wiki. Please try refreshing the page.'
                    />
                </p>
            </div>
        );
    }

    return (
        <div
            className={classNames('WikiView', {
                'page-selected': Boolean(pageId),
            })}
            data-testid='wiki-view'
        >
            {isLoading ? (
                <div
                    className='no-results__holder'
                    data-testid='wiki-view-loading'
                >
                    <LoadingScreen/>
                </div>
            ) : (
                <>
                    {(isPanesPanelCollapsed || isFullscreen) && wikiId && (
                        <button
                            className='WikiView__hamburgerButton btn btn-icon btn-sm'
                            onClick={handleOpenPagesPanel}
                            aria-label={formatMessage({id: 'wiki_view.open_pages_panel', defaultMessage: 'Open pages panel'})}
                            data-testid='wiki-view-hamburger-button'
                        >
                            <i className='icon icon-menu-variant'/>
                        </button>
                    )}

                    {wikiId && !isFullscreen && (
                        <PagesHierarchyPanel
                            wikiId={wikiId}
                            channelId={channelId}
                            currentPageId={pageId || draftId}
                            onPageSelect={handlePageSelect}
                            onVersionHistory={handleVersionHistory}
                            onCancelAutosave={cancelAutosave}
                            onGetPageContent={onGetPageContent}
                        />
                    )}

                    <div
                        className={classNames('PagePane', {'PagePane--sidebarCollapsed': isPanesPanelCollapsed})}
                        data-testid='wiki-page-pane'
                    >
                        <div className='WikiView__pocWarning'>
                            <i className='icon icon-alert-outline'/>
                            <FormattedMessage
                                id='wiki.poc_warning'
                                defaultMessage='Wiki feature POC - expect updates and improvements, possible data loss.'
                            />
                        </div>
                        {headerProps && (
                            <WikiPageHeader
                                {...headerProps}
                                onEdit={onEdit}
                                onPublish={handlePublish}
                                onToggleComments={handleToggleComments}
                                isFullscreen={isFullscreen}
                                onToggleFullscreen={toggleFullscreen}
                                onCreateChild={handleCreateChild}
                                onDuplicate={handleDuplicate}
                                onMove={handleMove}
                                onDelete={handleHeaderDelete}
                                onVersionHistory={handleHeaderVersionHistory}
                                onNavigateToPage={handlePageSelect}
                                canEdit={canEdit}
                                onProofread={aiToolsHandlers?.proofread}
                                onTranslatePage={aiToolsHandlers?.openTranslateModal}
                                isAIProcessing={aiToolsHandlers?.isProcessing}
                                onCopyMarkdown={handleCopyMarkdown}
                                onGetPageContent={onGetPageContent}
                            />
                        )}
                        {publishError && (
                            <div
                                role='alert'
                                className='PagePane__publishError'
                                data-testid='wiki-page-publish-error'
                            >
                                <span>
                                    <FormattedMessage
                                        id='wiki.publish_error.parent_is_draft'
                                        defaultMessage='Cannot publish: the parent page "{title}" must be published first.'
                                        values={{
                                            title: publishError.parentPageTitle ?? formatMessage({id: 'wiki.untitled_page', defaultMessage: 'Untitled'}),
                                        }}
                                    />
                                    {' '}
                                    <button
                                        type='button'
                                        className='btn btn-link PagePane__publishError-link'
                                        onClick={handleGoToParentPage}
                                    >
                                        <FormattedMessage
                                            id='wiki.publish_error.go_to_parent'
                                            defaultMessage='Go to parent page'
                                        />
                                    </button>
                                </span>
                                <button
                                    type='button'
                                    className='close'
                                    onClick={clearPublishError}
                                    aria-label={formatMessage({id: 'generic.close', defaultMessage: 'Close'})}
                                >
                                    {'×'}
                                </button>
                            </div>
                        )}
                        <div
                            className='PagePane__content'
                            data-testid='wiki-page-content'
                        >
                            {draftId && (!currentDraft || currentDraft.rootId !== draftId) && (
                                <div className='no-results__holder'>
                                    <LoadingScreen/>
                                </div>
                            )}
                            {editorProps && (
                                <WikiPageEditor
                                    {...editorProps}
                                    onTitleChange={handleTitleChange}
                                    onTitleBlur={handleTitleBlur}
                                    onContentChange={handleEditorContentChange}
                                    onDraftStatusChange={handleDraftStatusChange}
                                    onAIToolsReady={setAIToolsHandlers}
                                />
                            )}
                            {pageId && (
                                <PageViewer
                                    key={pageId}
                                    pageId={pageId}
                                    wikiId={wikiId}
                                />
                            )}
                            {isEmptyState && (
                                <div className='PagePane__emptyState'>
                                    <i className='icon-file-document-outline'/>
                                    <h3>
                                        <FormattedMessage
                                            id='wiki.empty.no_pages'
                                            defaultMessage='No Pages Yet'
                                        />
                                    </h3>
                                    <p>
                                        <FormattedMessage
                                            id='wiki.empty.create_first'
                                            defaultMessage='Create your first page to get started'
                                        />
                                    </p>
                                </div>
                            )}
                            {!draftId && !pageId && !isEmptyState && (
                                <div className='PagePane__emptyState'>
                                    <i className='icon-file-document-outline'/>
                                    <h3>
                                        <FormattedMessage
                                            id='wiki.empty.select_or_create'
                                            defaultMessage='Select a page or create a new one'
                                        />
                                    </h3>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default withWikiErrorBoundary(WikiView);
