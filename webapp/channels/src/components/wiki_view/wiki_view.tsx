// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {lazy} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {useRouteMatch, useHistory, useLocation} from 'react-router-dom';

import {getCurrentTeamId, getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {openPagesPanel} from 'actions/views/pages_hierarchy';
import {closeRightHandSide, openWikiRhs} from 'actions/views/rhs';
import {setWikiRhsMode} from 'actions/views/wiki_rhs';
import {getPageDraft, getPageDraftsForWiki} from 'selectors/page_drafts';
import {getPage, getWikiPages} from 'selectors/pages';
import {getIsPanesPanelCollapsed} from 'selectors/pages_hierarchy';
import {getRhsState} from 'selectors/rhs';

import {makeAsyncComponent} from 'components/async_load';
import LoadingScreen from 'components/loading_screen';
import PagesHierarchyPanel from 'components/pages_hierarchy_panel';
import {getWikiUrl, getTeamNameFromPath} from 'utils/url';

import type {GlobalState} from 'types/store';

import {useWikiPageData, useWikiPageActions} from './hooks';
import PageViewer from './page_viewer';
import WikiPageEditor from './wiki_page_editor';
import WikiPageHeader from './wiki_page_header';

import './wiki_view.scss';

const ChannelHeader = makeAsyncComponent('ChannelHeader', lazy(() => import('components/channel_header')));
const ChannelBookmarks = makeAsyncComponent('ChannelBookmarks', lazy(() => import('components/channel_bookmarks')));

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
    const allDrafts = useSelector((state: GlobalState) => (wikiId ? getPageDraftsForWiki(state, wikiId) : []));
    const allPages = useSelector((state: GlobalState) => (wikiId ? getWikiPages(state, wikiId) : []));

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

    const {handleEdit, handlePublish, handleTitleChange, handleContentChange} = useWikiPageActions(
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
        } else if (pageId) {
            dispatch(openWikiRhs(pageId, wikiId || ''));
            dispatch(setWikiRhsMode('comments'));
        }
    };

    const handlePageSelect = (selectedPageId: string) => {
        const startTime = performance.now();

        const isSelectedIdDraft = selectedPageId.startsWith('draft-') || allDrafts.some((draft) => draft.rootId === selectedPageId);
        const teamName = getTeamNameFromPath(location.pathname);
        const url = getWikiUrl(teamName, channelId, wikiId, selectedPageId, isSelectedIdDraft);

        history.push(url);

        // If RHS is open, update it to show the new page's comments
        if (isWikiRhsOpen && !isSelectedIdDraft) {
            dispatch(openWikiRhs(selectedPageId, wikiId || ''));
        }
    };

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
            className='app__content'
            data-testid='wiki-view-app-content'
        >
            <ChannelHeader/>
            <ChannelBookmarks channelId={channelId}/>
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
                                currentPageId={pageId}
                                onPageSelect={handlePageSelect}
                            />
                        )}

                        <div
                            className={classNames('PagePane', {'PagePane--sidebarCollapsed': isPanesPanelCollapsed})}
                            data-testid='wiki-page-pane'
                        >
                            {!isEmptyState && (
                                <WikiPageHeader
                                    wikiId={wikiId || ''}
                                    pageId={currentDraft ? '' : (pageId || '')}
                                    channelId={actualChannelId}
                                    isDraft={isDraft}
                                    parentPageId={currentDraft?.props?.page_parent_id}
                                    draftTitle={currentDraft?.props?.title}
                                    onEdit={handleEdit}
                                    onPublish={handlePublish}
                                    onToggleComments={handleToggleComments}
                                />
                            )}
                            <div
                                className='PagePane__content'
                                data-testid='wiki-page-content'
                            >
                                {draftId && !currentDraft && (
                                    <div className='no-results__holder'>
                                        <LoadingScreen/>
                                    </div>
                                )}
                                {draftId && currentDraft && (() => {
                                    const editorProps = {
                                        key: draftId,
                                        title: currentDraft.props?.title || '',
                                        content: currentDraft.message || '',
                                        onTitleChange: handleTitleChange,
                                        onContentChange: handleContentChange,
                                        currentUserId,
                                        channelId: actualChannelId,
                                        teamId,
                                        pageId: draftId,
                                        wikiId,
                                        showAuthor: false,
                                    };
                                    return <WikiPageEditor {...editorProps} />;
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
                    </>
                )}
            </div>
        </div>
    );
};

export default WikiView;
