// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {useRouteMatch, useHistory, useLocation} from 'react-router-dom';

import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeamId, getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {loadPageDraftsForWiki, removePageDraft} from 'actions/page_drafts';
import {loadPages} from 'actions/pages';
import {openPagesPanel, closePagesPanel, setLastViewedPage} from 'actions/views/pages_hierarchy';
import {closeRightHandSide, openWikiRhs} from 'actions/views/rhs';
import {setWikiRhsMode} from 'actions/views/wiki_rhs';
import {getPageDraft, getPageDraftsForWiki} from 'selectors/page_drafts';
import {getPage, getPages, getPagesLastInvalidated, getDraftsLastInvalidated} from 'selectors/pages';
import {getIsPanesPanelCollapsed, getLastViewedPage} from 'selectors/pages_hierarchy';
import {getRhsState} from 'selectors/rhs';

import ConflictWarningModal from 'components/conflict_warning_modal';
import LoadingScreen from 'components/loading_screen';
import MovePageModal from 'components/move_page_modal';
import PageVersionHistoryModal from 'components/page_version_history';
import PagesHierarchyPanel from 'components/pages_hierarchy_panel';
import DeletePageModal from 'components/delete_page_modal';
import {usePageMenuHandlers} from 'components/pages_hierarchy_panel/hooks/use_page_menu_handlers';
import TextInputModal from 'components/text_input_modal';
import UnsavedDraftModal from 'components/unsaved_draft_modal';

import {isEditingExistingPage, getPublishedPageIdFromDraft} from 'utils/page_utils';
import {canEditPage} from 'utils/post_utils';
import {getWikiUrl, getTeamNameFromPath} from 'utils/url';

import type {GlobalState} from 'types/store';

import {useWikiPageData, useWikiPageActions} from './hooks';
import PageViewer from './page_viewer';
import WikiPageEditor from './wiki_page_editor';
import WikiPageHeader from './wiki_page_header';

import './wiki_view.scss';

const WikiView = () => {
    const dispatch = useDispatch();
    const history = useHistory();
    const location = useLocation();
    const {params, path} = useRouteMatch<{pageId?: string; draftId?: string; channelId: string; wikiId: string}>();
    const {pageId, draftId, channelId, wikiId} = params;

    const teamId = useSelector(getCurrentTeamId);
    const currentTeam = useSelector(getCurrentTeam);
    const currentUserId = useSelector(getCurrentUserId);
    const rhsState = useSelector((state: GlobalState) => getRhsState(state));
    const isWikiRhsOpen = rhsState === 'wiki';
    const isPanesPanelCollapsed = useSelector((state: GlobalState) => getIsPanesPanelCollapsed(state));
    const lastViewedPageId = useSelector((state: GlobalState) => (wikiId ? getLastViewedPage(state, wikiId) : null));

    // Fullscreen state
    const [isFullscreen, setIsFullscreen] = React.useState(false);

    // Store panel state before entering fullscreen
    const panelStateBeforeFullscreenRef = React.useRef<boolean | null>(null);

    // Version history modal state
    const [showVersionHistory, setShowVersionHistory] = React.useState(false);
    const [versionHistoryPageId, setVersionHistoryPageId] = React.useState<string | null>(null);

    // Unsaved draft modal state
    const [showUnsavedDraftModal, setShowUnsavedDraftModal] = React.useState(false);
    const [unsavedDraftData, setUnsavedDraftData] = React.useState<any>(null);

    // Toggle fullscreen
    const toggleFullscreen = React.useCallback(() => {
        const newFullscreenState = !isFullscreen;
        setIsFullscreen(newFullscreenState);

        if (newFullscreenState) {
            // Entering fullscreen: save current panel state and close panel
            panelStateBeforeFullscreenRef.current = isPanesPanelCollapsed;
            dispatch(closePagesPanel());
        } else {
            // Exiting fullscreen: restore previous panel state
            if (panelStateBeforeFullscreenRef.current === false) {
                dispatch(openPagesPanel());
            }

            panelStateBeforeFullscreenRef.current = null;
        }
    }, [isFullscreen, isPanesPanelCollapsed, dispatch]);

    // Handle version history
    const handleVersionHistory = (targetPageId: string) => {
        setVersionHistoryPageId(targetPageId);
        setShowVersionHistory(true);
    };

    const handleCloseVersionHistory = () => {
        setShowVersionHistory(false);
        setVersionHistoryPageId(null);
    };

    // Esc key handler
    React.useEffect(() => {
        const handleKeydown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && isFullscreen) {
                toggleFullscreen();
            }
        };

        window.addEventListener('keydown', handleKeydown);
        return () => window.removeEventListener('keydown', handleKeydown);
    }, [isFullscreen, toggleFullscreen]);

    // Body class management
    React.useEffect(() => {
        if (isFullscreen) {
            document.body.classList.add('fullscreen-mode');
        } else {
            document.body.classList.remove('fullscreen-mode');
        }

        return () => {
            document.body.classList.remove('fullscreen-mode');
        };
    }, [isFullscreen]);

    // Track if we're navigating to select a draft
    const isSelectingDraftRef = React.useRef(false);

    const lastPagesInvalidated = useSelector((state: GlobalState) => getPagesLastInvalidated(state, wikiId));
    const lastDraftsInvalidated = useSelector((state: GlobalState) => getDraftsLastInvalidated(state, wikiId));

    // Load pages when they are invalidated
    React.useEffect(() => {
        if (wikiId) {
            dispatch(loadPages(wikiId));
        }
    }, [wikiId, lastPagesInvalidated, dispatch]);

    // Load drafts when they are invalidated
    React.useEffect(() => {
        if (wikiId) {
            dispatch(loadPageDraftsForWiki(wikiId));
        }
    }, [wikiId, lastDraftsInvalidated, dispatch]);

    const {isLoading} = useWikiPageData(
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

    const currentDraft = useSelector((state: GlobalState) => {
        if (!wikiId || !draftId) {
            return null;
        }
        const draft = getPageDraft(state, wikiId, draftId);
        return draft;
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

    const pageParentIdRef = React.useRef<string | undefined>(undefined);
    React.useEffect(() => {
        if (currentPage?.page_parent_id) {
            pageParentIdRef.current = currentPage.page_parent_id;
        }
    }, [currentPage?.page_parent_id]);

    // Preserve draft's parent ID and title across renders to avoid breadcrumb flickering
    const draftParentIdRef = React.useRef<string | undefined>(undefined);
    const draftTitleRef = React.useRef<string | undefined>(undefined);
    React.useEffect(() => {
        if (currentDraft?.props?.page_parent_id) {
            draftParentIdRef.current = currentDraft.props.page_parent_id;
        }
        if (currentDraft?.props?.title) {
            draftTitleRef.current = currentDraft.props.title;
        }
    }, [currentDraft?.props?.page_parent_id, currentDraft?.props?.title]);

    const allDrafts = useSelector((state: GlobalState) => (wikiId ? getPageDraftsForWiki(state, wikiId) : []));
    const allPages = useSelector((state: GlobalState) => (wikiId ? getPages(state, wikiId) : []));

    // Get the actual channel ID from the page or draft (URL params may have wikiId in channelId position)
    const actualChannelId = currentPage?.channel_id || currentDraft?.channelId || allDrafts[0]?.channelId || channelId;

    // Phase 1 Refactor: isDraft now derived from route - draftId in URL means we're editing a draft
    const isDraft = Boolean(draftId) || (!pageId && !draftId && (Boolean(currentDraft) || !currentPage));

    // Get the current channel for permission checks
    const currentChannel = useSelector((state: GlobalState) => getChannel(state, actualChannelId));

    // Check if user can edit the current page (only applies to published pages, not drafts)
    const canEdit = useSelector((state: GlobalState) => {
        // For drafts, always allow editing (the header shows Publish button instead of Edit anyway)
        if (!pageId || isDraft) {
            return true;
        }

        // For published pages, check permissions if we have the data
        if (currentPage && currentChannel) {
            return canEditPage(state, currentPage, currentChannel);
        }

        // Default to false while loading to prevent showing Edit button prematurely
        return false;
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

    // Auto-select draft or page when at wiki root
    React.useEffect(() => {
        if (!pageId && !draftId) {
            const teamName = getTeamNameFromPath(location.pathname);

            // Priority 1: Try to restore last viewed page if it exists
            if (lastViewedPageId) {
                const lastViewedDraft = allDrafts.find((d) => d.rootId === lastViewedPageId);
                const lastViewedPage = allPages.find((p) => p.id === lastViewedPageId);

                if (lastViewedDraft) {
                    const draftUrl = getWikiUrl(teamName, channelId, wikiId, lastViewedDraft.rootId, true);
                    history.replace(draftUrl);
                    return;
                } else if (lastViewedPage) {
                    const pageUrl = getWikiUrl(teamName, channelId, wikiId, lastViewedPage.id, false);
                    history.replace(pageUrl);
                    return;
                }
            }

            // Priority 2: Select first draft if drafts exist
            if (allDrafts.length > 0) {
                const firstDraft = allDrafts[0];
                if (firstDraft) {
                    const draftUrl = getWikiUrl(teamName, channelId, wikiId, firstDraft.rootId, true);
                    history.replace(draftUrl);
                    return;
                }
            }

            // Priority 3: Select first published page if no drafts but pages exist
            if (allPages.length > 0) {
                const firstPage = allPages[0];
                if (firstPage) {
                    const pageUrl = getWikiUrl(teamName, channelId, wikiId, firstPage.id, false);
                    history.replace(pageUrl);
                }
            }
        }
    }, [pageId, draftId, allDrafts, allPages, channelId, wikiId, location.pathname, history, lastViewedPageId]);

    // Check for openRhs query parameter and open RHS if requested
    React.useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        if (searchParams.get('openRhs') === 'true' && pageId && !isWikiRhsOpen) {
            dispatch(openWikiRhs(pageId, wikiId || '', undefined));
            dispatch(setWikiRhsMode('comments'));

            // Remove the query parameter from URL
            searchParams.delete('openRhs');
            const newSearch = searchParams.toString();
            const newUrl = `${location.pathname}${newSearch ? `?${newSearch}` : ''}`;
            history.replace(newUrl);
        }
    }, [location.search, location.pathname, pageId, wikiId, isWikiRhsOpen, dispatch, history]);

    // --------------------------------------------------------------------------
    // Clear editingDraftId when the draft is deleted or published while we are
    // editing it. This prevents the editor from getting stuck with a non-existent
    // draft id in local state.
    // Phase 1 Refactor: Removed cleanup effect - no longer needed with route-based draft IDs

    const {handleEdit, handlePublish, handleTitleChange, handleContentChange, handleDraftStatusChange, conflictModal} = useWikiPageActions(
        channelId,
        pageId,
        draftId,
        wikiId,
        currentPage || null,
        currentDraft,
        location,
        history,
    );

    // Check handleEdit result for unsaved draft error
    const onEdit = React.useCallback(async () => {
        const result = await handleEdit() as {error?: {id: string; data: any}} | {data: boolean} | undefined;
        if (result && 'error' in result && result.error?.id === 'api.page.edit.unsaved_draft_exists') {
            setUnsavedDraftData(result.error.data);
            setShowUnsavedDraftModal(true);
        }
    }, [handleEdit]);

    // Unsaved draft modal: Resume existing draft
    const handleResumeDraft = React.useCallback(() => {
        setShowUnsavedDraftModal(false);
        if (pageId && wikiId) {
            const teamName = getTeamNameFromPath(location.pathname);
            const draftPath = getWikiUrl(teamName, channelId, wikiId, pageId, true);
            history.push(draftPath);
        }
    }, [pageId, wikiId, channelId, history, location]);

    // Unsaved draft modal: Discard existing draft and create new one from published content
    const handleDiscardDraft = React.useCallback(async () => {
        setShowUnsavedDraftModal(false);
        if (pageId && wikiId) {
            // Delete the existing draft
            await dispatch(removePageDraft(wikiId, pageId));

            // Create a fresh draft from published content by calling handleEdit
            // This will trigger openPageInEditMode which creates a new draft
            await handleEdit();
        }
    }, [pageId, wikiId, dispatch, handleEdit]);

    const handleCancelUnsavedDraft = React.useCallback(() => {
        setShowUnsavedDraftModal(false);
        setUnsavedDraftData(null);
    }, []);

    const handleToggleComments = () => {
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
    };

    const handlePageSelect = (selectedPageId: string) => {
        if (!wikiId || !channelId) {
            return;
        }

        // BUGFIX: When navigating to wiki root (empty pageId), clear lastViewedPageId
        // to prevent auto-select from navigating back to a deleted page
        if (!selectedPageId && wikiId) {
            dispatch(setLastViewedPage(wikiId, ''));
        }

        const isSelectedIdDraft = selectedPageId.startsWith('draft-') || allDrafts.some((draft) => draft.rootId === selectedPageId);
        const teamName = getTeamNameFromPath(location.pathname);
        const url = getWikiUrl(teamName, channelId, wikiId, selectedPageId, isSelectedIdDraft);

        history.push(url);

        // If RHS is open, update it to show the new page's comments
        if (isWikiRhsOpen) {
            if (isSelectedIdDraft) {
                // For drafts, try to get the published page ID to show comments
                const draft = allDrafts.find((d) => d.rootId === selectedPageId || selectedPageId.startsWith('draft-'));
                const publishedPageId = getPublishedPageIdFromDraft(draft);
                if (publishedPageId) {
                    dispatch(openWikiRhs(publishedPageId, wikiId || '', undefined));
                }
            } else if (selectedPageId) {
                // For published pages, use the page ID directly (only if not empty)
                dispatch(openWikiRhs(selectedPageId, wikiId || '', undefined));
            }
        }
    };

    // Use shared menu handlers hook - it will combine pages and drafts internally
    const menuHandlers = usePageMenuHandlers({
        wikiId: wikiId || '',
        channelId,
        pages: allPages,
        drafts: allDrafts,
        onPageSelect: handlePageSelect,
    });

    const handleOpenPagesPanel = () => {
        dispatch(openPagesPanel());
    };

    React.useEffect(() => {
        if (pageId && !currentPage && !isLoading) {
            const currentPath = location.pathname;
            const basePath = currentPath.substring(0, currentPath.lastIndexOf('/'));

            if (pageParentIdRef.current) {
                history.replace(`${basePath}/${pageParentIdRef.current}`);
            } else {
                history.replace(basePath);
            }
        }
    }, [pageId, currentPage, isLoading, location.pathname, history]);

    // DISABLED: Auto-updating RHS when navigating causes 60+ second render blocks
    // The RHS ThreadViewer mounting blocks PageViewer from rendering
    // Users can manually toggle RHS to update it to the new page
    // React.useEffect(() => {
    //     if (isWikiRhsOpen && pageId) {
    //         dispatch(openWikiRhs(pageId, wikiId || ''));
    //     }
    // }, [pageId, isWikiRhsOpen, wikiId, dispatch]);

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
                    {isPanesPanelCollapsed && wikiId && (
                        <button
                            className='WikiView__hamburgerButton btn btn-icon btn-sm'
                            onClick={handleOpenPagesPanel}
                            aria-label='Open pages panel'
                            data-testid='wiki-view-hamburger-button'
                        >
                            <i className='icon icon-menu-variant'/>
                        </button>
                    )}

                    {wikiId && (
                        <PagesHierarchyPanel
                            wikiId={wikiId}
                            channelId={channelId}
                            currentPageId={pageId || draftId}
                            onPageSelect={handlePageSelect}
                            onVersionHistory={handleVersionHistory}
                        />
                    )}

                    <div
                        className={classNames('PagePane', {'PagePane--sidebarCollapsed': isPanesPanelCollapsed})}
                        data-testid='wiki-page-pane'
                    >
                        {!isEmptyState && (() => {
                            const currentPageIdForHeader = currentDraft ? draftId : (pageId || '');
                            const pageLink = currentPageIdForHeader && wikiId && channelId ? `/${currentTeam?.name || 'team'}/wiki/${channelId}/${wikiId}/${currentPageIdForHeader}` : undefined;

                            // For drafts, wait until currentDraft is loaded to avoid breadcrumb issues
                            if (isDraft && draftId && !currentDraft) {
                                return null;
                            }

                            // Use refs to preserve draft parent ID and title across renders
                            const effectiveParentId = isDraft ? (currentDraft?.props?.page_parent_id || draftParentIdRef.current) : undefined;
                            const effectiveTitle = isDraft ? (currentDraft?.props?.title || draftTitleRef.current) : undefined;
                            const isExistingPage = currentDraft ? isEditingExistingPage(currentDraft) : false;

                            return (
                                <WikiPageHeader
                                    wikiId={wikiId || ''}
                                    pageId={currentPageIdForHeader || ''}
                                    channelId={actualChannelId}
                                    isDraft={isDraft}
                                    isExistingPage={isExistingPage}
                                    parentPageId={effectiveParentId}
                                    draftTitle={effectiveTitle}
                                    onEdit={onEdit}
                                    onPublish={handlePublish}
                                    onToggleComments={handleToggleComments}
                                    isFullscreen={isFullscreen}
                                    onToggleFullscreen={toggleFullscreen}
                                    onCreateChild={() => currentPageIdForHeader && menuHandlers.handleCreateChild(currentPageIdForHeader)}
                                    onRename={() => currentPageIdForHeader && menuHandlers.handleRename(currentPageIdForHeader)}
                                    onDuplicate={() => currentPageIdForHeader && menuHandlers.handleDuplicate(currentPageIdForHeader)}
                                    onMove={() => currentPageIdForHeader && menuHandlers.handleMove(currentPageIdForHeader)}
                                    onDelete={() => currentPageIdForHeader && menuHandlers.handleDelete(currentPageIdForHeader)}
                                    onVersionHistory={() => currentPageIdForHeader && handleVersionHistory(currentPageIdForHeader)}
                                    pageLink={pageLink}
                                    canEdit={canEdit}
                                />
                            );
                        })()}
                        <div
                            className='PagePane__content'
                            data-testid='wiki-page-content'
                        >
                            {draftId && (!currentDraft || currentDraft.rootId !== draftId) && (
                                <div className='no-results__holder'>
                                    <LoadingScreen/>
                                </div>
                            )}
                            {draftId && currentDraft && currentDraft.rootId === draftId && (() => {
                                const isExistingPage = isEditingExistingPage(currentDraft);
                                const publishedPageId = getPublishedPageIdFromDraft(currentDraft);

                                // Determine author: use original author if editing existing page, otherwise current user
                                const authorId = isExistingPage && publishedPageForDraft ? publishedPageForDraft.user_id : currentUserId;

                                const editorProps = {
                                    key: draftId,
                                    title: currentDraft.props?.title || '',
                                    content: currentDraft.message || '',
                                    onTitleChange: handleTitleChange,
                                    onContentChange: handleContentChange,
                                    authorId,
                                    currentUserId,
                                    channelId: actualChannelId,
                                    teamId,
                                    pageId: isExistingPage ? publishedPageId : draftId,
                                    wikiId,
                                    showAuthor: true,
                                    isExistingPage,
                                    draftStatus: currentDraft.props?.page_status as string | undefined,
                                    onDraftStatusChange: handleDraftStatusChange,
                                };
                                return <WikiPageEditor {...editorProps}/>;
                            })()}
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
                                    <h3>{'No Pages Yet'}</h3>
                                    <p>{'Create your first page to get started'}</p>
                                </div>
                            )}
                            {!draftId && !pageId && !isEmptyState && (
                                <div className='PagePane__emptyState'>
                                    <i className='icon-file-document-outline'/>
                                    <h3>{'Select a page or create a new one'}</h3>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Menu action modals */}
                    {menuHandlers.showDeleteModal && menuHandlers.pageToDelete && (
                        <DeletePageModal
                            pageTitle={(menuHandlers.pageToDelete.page.props?.title as string | undefined) || menuHandlers.pageToDelete.page.message || 'Untitled'}
                            childCount={menuHandlers.pageToDelete.childCount}
                            onConfirm={menuHandlers.handleDeleteConfirm}
                            onCancel={menuHandlers.handleDeleteCancel}
                        />
                    )}

                    {menuHandlers.showMoveModal && menuHandlers.pageToMove && (
                        <MovePageModal
                            pageId={menuHandlers.pageToMove.pageId}
                            pageTitle={menuHandlers.pageToMove.pageTitle}
                            currentWikiId={wikiId || ''}
                            availableWikis={menuHandlers.availableWikis}
                            fetchPagesForWiki={menuHandlers.fetchPagesForWiki}
                            hasChildren={menuHandlers.pageToMove.hasChildren}
                            onConfirm={menuHandlers.handleMoveConfirm}
                            onCancel={menuHandlers.handleMoveCancel}
                        />
                    )}

                    {menuHandlers.showCreatePageModal && (
                        <TextInputModal
                            show={menuHandlers.showCreatePageModal}
                            title={menuHandlers.createPageParent ? `Create Child Page under "${menuHandlers.createPageParent.title}"` : 'Create New Page'}
                            placeholder='Enter page title...'
                            helpText={menuHandlers.createPageParent ? `This page will be created as a child of "${menuHandlers.createPageParent.title}".` : 'A new draft will be created for you to edit.'}
                            confirmButtonText='Create'
                            maxLength={255}
                            ariaLabel='Create Page'
                            inputTestId='create-page-modal-title-input'
                            onConfirm={menuHandlers.handleConfirmCreatePage}
                            onCancel={menuHandlers.handleCancelCreatePage}
                            onHide={() => menuHandlers.setShowCreatePageModal(false)}
                        />
                    )}

                    {showVersionHistory && versionHistoryPageId && (() => {
                        const versionHistoryPage = allPages.find((p) => p.id === versionHistoryPageId);
                        if (!versionHistoryPage) {
                            return null;
                        }
                        const pageTitle = (versionHistoryPage.props?.title as string | undefined) || versionHistoryPage.message || 'Untitled';
                        return (
                            <PageVersionHistoryModal
                                page={versionHistoryPage}
                                pageTitle={pageTitle}
                                wikiId={wikiId}
                                onClose={handleCloseVersionHistory}
                            />
                        );
                    })()}

                    {/* Conflict warning modal */}
                    {conflictModal.show && conflictModal.currentPage && (
                        <ConflictWarningModal
                            show={conflictModal.show}
                            currentPage={conflictModal.currentPage}
                            draftContent={conflictModal.draftContent}
                            onViewChanges={conflictModal.onViewChanges}
                            onCopyContent={conflictModal.onCopyContent}
                            onOverwrite={conflictModal.onOverwrite}
                            onCancel={conflictModal.onCancel}
                        />
                    )}

                    {/* Unsaved draft warning modal */}
                    <UnsavedDraftModal
                        show={showUnsavedDraftModal}
                        draftCreateAt={unsavedDraftData?.draftCreateAt}
                        onResumeDraft={handleResumeDraft}
                        onDiscardDraft={handleDiscardDraft}
                        onCancel={handleCancelUnsavedDraft}
                    />
                </>
            )}
        </div>
    );
};

export default WikiView;
