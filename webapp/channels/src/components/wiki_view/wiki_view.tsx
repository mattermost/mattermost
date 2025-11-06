// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {useRouteMatch, useHistory, useLocation} from 'react-router-dom';

import {getCurrentTeamId, getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {openPagesPanel} from 'actions/views/pages_hierarchy';
import {closeRightHandSide, openWikiRhs} from 'actions/views/rhs';
import {setWikiRhsMode} from 'actions/views/wiki_rhs';
import {getPageDraft, getPageDraftsForWiki} from 'selectors/page_drafts';
import {getPage, getPages} from 'selectors/pages';
import {getIsPanesPanelCollapsed} from 'selectors/pages_hierarchy';
import {getRhsState} from 'selectors/rhs';

import DuplicatePageModal from 'components/duplicate_page_modal';
import LoadingScreen from 'components/loading_screen';
import MovePageModal from 'components/move_page_modal';
import PagesHierarchyPanel from 'components/pages_hierarchy_panel';
import DeletePageModal from 'components/pages_hierarchy_panel/delete_page_modal';
import {usePageMenuHandlers} from 'components/pages_hierarchy_panel/hooks/use_page_menu_handlers';
import TextInputModal from 'components/text_input_modal';

import {isEditingExistingPage, getPublishedPageIdFromDraft} from 'utils/page_utils';
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

    // Fullscreen state
    const [isFullscreen, setIsFullscreen] = React.useState(false);

    // Toggle fullscreen
    const toggleFullscreen = () => {
        setIsFullscreen(!isFullscreen);
    };

    // Esc key handler
    React.useEffect(() => {
        const handleKeydown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && isFullscreen) {
                setIsFullscreen(false);
            }
        };

        window.addEventListener('keydown', handleKeydown);
        return () => window.removeEventListener('keydown', handleKeydown);
    }, [isFullscreen]);

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

    // Single source of truth for empty state (no drafts, no pages)
    const isEmptyState = !currentDraft && !pageId && allDrafts.length === 0 && allPages.length === 0;

    // Auto-select draft or page when at wiki root
    React.useEffect(() => {
        if (!pageId && !draftId) {
            const teamName = getTeamNameFromPath(location.pathname);

            // Priority 1: Select first draft if drafts exist
            if (allDrafts.length > 0) {
                const firstDraft = allDrafts[0];
                if (firstDraft) {
                    const draftUrl = getWikiUrl(teamName, channelId, wikiId, firstDraft.rootId, true);
                    history.replace(draftUrl);
                    return;
                }
            }

            // Priority 2: Select first published page if no drafts but pages exist
            if (allPages.length > 0) {
                const firstPage = allPages[0];
                if (firstPage) {
                    const pageUrl = getWikiUrl(teamName, channelId, wikiId, firstPage.id, false);
                    history.replace(pageUrl);
                }
            }
        }
    }, [pageId, draftId, allDrafts, allPages, channelId, wikiId, location.pathname, history]);

    // --------------------------------------------------------------------------
    // Clear editingDraftId when the draft is deleted or published while we are
    // editing it. This prevents the editor from getting stuck with a non-existent
    // draft id in local state.
    // Phase 1 Refactor: Removed cleanup effect - no longer needed with route-based draft IDs

    const {handleEdit, handlePublish, handleTitleChange, handleContentChange, handleDraftStatusChange} = useWikiPageActions(
        channelId,
        pageId,
        draftId,
        wikiId,
        currentPage || null,
        currentDraft,
        location,
        history,
    );

    const handleToggleComments = () => {
        if (isWikiRhsOpen) {
            dispatch(closeRightHandSide());
        } else {
            // For published pages, use pageId directly
            // For drafts of existing pages, use the published page ID from draft
            const targetPageId = pageId || getPublishedPageIdFromDraft(currentDraft);

            if (targetPageId) {
                dispatch(openWikiRhs(targetPageId, wikiId || ''));
                dispatch(setWikiRhsMode('comments'));
            }
        }
    };

    const handlePageSelect = (selectedPageId: string) => {
        const isSelectedIdDraft = selectedPageId.startsWith('draft-') || allDrafts.some((draft) => draft.rootId === selectedPageId);
        const teamName = getTeamNameFromPath(location.pathname);
        const url = getWikiUrl(teamName, channelId, wikiId, selectedPageId, isSelectedIdDraft);

        history.push(url);

        // If RHS is open, update it to show the new page's comments
        if (isWikiRhsOpen && !isSelectedIdDraft) {
            dispatch(openWikiRhs(selectedPageId, wikiId || ''));
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
                                    onEdit={handleEdit}
                                    onPublish={handlePublish}
                                    onToggleComments={handleToggleComments}
                                    isFullscreen={isFullscreen}
                                    onToggleFullscreen={toggleFullscreen}
                                    onCreateChild={() => currentPageIdForHeader && menuHandlers.handleCreateChild(currentPageIdForHeader)}
                                    onRename={() => currentPageIdForHeader && menuHandlers.handleRename(currentPageIdForHeader)}
                                    onDuplicate={() => currentPageIdForHeader && menuHandlers.handleDuplicate(currentPageIdForHeader)}
                                    onMove={() => currentPageIdForHeader && menuHandlers.handleMove(currentPageIdForHeader)}
                                    onDelete={() => currentPageIdForHeader && menuHandlers.handleDelete(currentPageIdForHeader)}
                                    pageLink={pageLink}
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

                                const editorProps = {
                                    key: draftId,
                                    title: currentDraft.props?.title || '',
                                    content: currentDraft.message || '',
                                    onTitleChange: handleTitleChange,
                                    onContentChange: handleContentChange,
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

                    {menuHandlers.showDuplicateModal && menuHandlers.pageToDuplicate && (
                        <DuplicatePageModal
                            pageId={menuHandlers.pageToDuplicate.pageId}
                            pageTitle={menuHandlers.pageToDuplicate.pageTitle}
                            currentWikiId={wikiId || ''}
                            availableWikis={menuHandlers.availableWikis}
                            fetchPagesForWiki={menuHandlers.fetchPagesForWiki}
                            hasChildren={menuHandlers.pageToDuplicate.hasChildren}
                            onConfirm={menuHandlers.handleDuplicateConfirm}
                            onCancel={menuHandlers.handleDuplicateCancel}
                        />
                    )}

                    {menuHandlers.showRenameModal && menuHandlers.pageToRename && (
                        <TextInputModal
                            show={menuHandlers.showRenameModal}
                            title='Rename Page'
                            placeholder='Enter new page title...'
                            confirmButtonText='Rename'
                            maxLength={255}
                            initialValue={menuHandlers.pageToRename.currentTitle}
                            ariaLabel='Rename Page'
                            inputTestId='rename-page-modal-title-input'
                            onConfirm={menuHandlers.handleRenameConfirm}
                            onCancel={menuHandlers.handleRenameCancel}
                            onHide={() => menuHandlers.setShowRenameModal(false)}
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
                </>
            )}
        </div>
    );
};

export default WikiView;
