// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {lazy} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {useRouteMatch, useHistory, useLocation} from 'react-router-dom';

import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {openPagesPanel} from 'actions/views/pages_hierarchy';
import {closeRightHandSide, openWikiRhs} from 'actions/views/rhs';
import {setWikiRhsMode} from 'actions/views/wiki_rhs';
import {getPageDraft, getPageDraftsForWiki} from 'selectors/page_drafts';
import {getFullPage} from 'selectors/pages';
import {getIsPanesPanelCollapsed} from 'selectors/pages_hierarchy';
import {getRhsState} from 'selectors/rhs';

import {makeAsyncComponent} from 'components/async_load';
import LoadingScreen from 'components/loading_screen';
import PagesHierarchyPanel from 'components/pages_hierarchy_panel';

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
    const {params, path} = useRouteMatch<{pageId?: string; channelId: string; wikiId: string}>();
    const {pageId, channelId, wikiId} = params;

    const teamId = useSelector(getCurrentTeamId);
    const currentUserId = useSelector(getCurrentUserId);
    const rhsState = useSelector((state: GlobalState) => getRhsState(state));
    const isWikiRhsOpen = rhsState === 'wiki';
    const isPanesPanelCollapsed = useSelector((state: GlobalState) => getIsPanesPanelCollapsed(state));

    // Track if we're navigating to select a draft (to preserve editingDraftId during navigation)
    const isSelectingDraftRef = React.useRef(false);

    const {isLoading, editingDraftId, setEditingDraftId} = useWikiPageData(
        pageId,
        channelId,
        wikiId,
        teamId,
        location,
        history,
        path,
        isSelectingDraftRef,
    );

    const currentDraft = useSelector((state: GlobalState) => {
        if (!wikiId || !editingDraftId) {
            return null;
        }
        const draft = getPageDraft(state, wikiId, editingDraftId);
        return draft;
    });

    const currentPage = useSelector((state: GlobalState) => {
        const page = pageId ? getFullPage(state, pageId) : null;
        return page;
    });

    const pageParentIdRef = React.useRef<string | undefined>(undefined);
    React.useEffect(() => {
        if (currentPage?.page_parent_id) {
            pageParentIdRef.current = currentPage.page_parent_id;
        }
    }, [currentPage?.page_parent_id]);
    const allDrafts = useSelector((state: GlobalState) => (wikiId ? getPageDraftsForWiki(state, wikiId) : []));

    // Get the actual channel ID from the page or draft (URL params may have wikiId in channelId position)
    const actualChannelId = currentPage?.channel_id || currentDraft?.channelId || allDrafts[0]?.channelId || channelId;

    // Centralized draft state: true if editing a draft OR showing empty editor for new page
    // If we have editingDraftId matching pageId, we're editing a published page (draft mode)
    const isDraft = (pageId && editingDraftId === pageId) || (!pageId && (Boolean(currentDraft) || !currentPage));

    // Single source of truth for empty state (no drafts, no pages)
    const isEmptyState = !currentDraft && !pageId && allDrafts.length === 0;

    const {handleEdit, handlePublish, handleTitleChange, handleContentChange} = useWikiPageActions(
        channelId,
        pageId,
        wikiId,
        currentPage || null,
        currentDraft,
        location,
        history,
        setEditingDraftId,
    );

    const handleToggleComments = () => {
        // Don't open RHS for drafts (they can't have comments)
        if (currentDraft) {
            return;
        }

        if (isWikiRhsOpen) {
            dispatch(closeRightHandSide());
        } else if (pageId) {
            dispatch(openWikiRhs(pageId, wikiId || ''));
            dispatch(setWikiRhsMode('comments'));
        }
    };

    const handlePageSelect = (selectedPageId: string) => {
        const isDraft = allDrafts.some((draft) => draft.rootId === selectedPageId);

        if (isDraft) {
            // Set flag to prevent the hook from clearing editingDraftId during navigation
            isSelectingDraftRef.current = true;

            // Set the draft ID first (synchronously)
            setEditingDraftId(selectedPageId);

            // Then navigate to wiki root if needed (clear pageId from URL)
            if (pageId) {
                // Currently on a page URL, navigate back to wiki root
                const currentPath = location.pathname;
                const basePath = currentPath.substring(0, currentPath.lastIndexOf('/'));
                history.push(basePath);
            }

            // Clear flag after a short delay (after effect runs)
            setTimeout(() => {
                isSelectingDraftRef.current = false;
            }, 100);
        } else {
            isSelectingDraftRef.current = false;
            setEditingDraftId(null);
            const currentPath = location.pathname;
            const basePath = pageId ? currentPath.substring(0, currentPath.lastIndexOf('/')) : currentPath;
            const redirectUrl = `${basePath}/${selectedPageId}`;
            history.push(redirectUrl);
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

    // Update WikiRHS when navigating to a different page, or close it when viewing a draft
    React.useEffect(() => {
        if (isWikiRhsOpen) {
            if (pageId) {
                // Update RHS to show comments for the new page
                dispatch(openWikiRhs(pageId, wikiId || ''));
            } else if (currentDraft) {
                // Close RHS when viewing a draft (drafts can't have comments)
                dispatch(closeRightHandSide());
            }
        }
    }, [pageId, currentDraft, isWikiRhsOpen, wikiId, dispatch]);

    return (
        <div className='app__content'>
            <ChannelHeader/>
            <ChannelBookmarks channelId={channelId}/>
            <div
                className={classNames('WikiView', {
                    'page-selected': Boolean(pageId),
                })}
            >
                {isLoading ? (
                    <div className='no-results__holder'>
                        <LoadingScreen/>
                    </div>
                ) : (
                    <>
                        {isPanesPanelCollapsed && wikiId && (
                            <button
                                className='WikiView__hamburgerButton btn btn-icon btn-sm'
                                onClick={handleOpenPagesPanel}
                                aria-label='Open pages panel'
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

                        <div className={classNames('PagePane', {'PagePane--sidebarCollapsed': isPanesPanelCollapsed})}>
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
                            <div className='PagePane__content'>
                                {(() => {
                                    // Check if we're editing a published page (editingDraftId matches pageId)
                                    if (pageId && editingDraftId === pageId && currentDraft) {
                                        return (
                                            <WikiPageEditor
                                                title={currentDraft.props?.title || ''}
                                                content={currentDraft.message || ''}
                                                onTitleChange={handleTitleChange}
                                                onContentChange={handleContentChange}
                                                currentUserId={currentUserId}
                                                channelId={actualChannelId}
                                                teamId={teamId}
                                                showAuthor={false}
                                            />
                                        );
                                    }

                                    // If we have a pageId in the URL, we're viewing a published page (not editing)
                                    if (pageId) {
                                        return (
                                            <PageViewer
                                                pageId={pageId}
                                                wikiId={wikiId}
                                            />
                                        );
                                    }
                                    if (currentDraft) {
                                        return (
                                            <WikiPageEditor
                                                title={currentDraft.props?.title || ''}
                                                content={currentDraft.message || ''}
                                                onTitleChange={handleTitleChange}
                                                onContentChange={handleContentChange}
                                                currentUserId={currentUserId}
                                                channelId={actualChannelId}
                                                teamId={teamId}
                                                showAuthor={false}
                                            />
                                        );
                                    }

                                    if (isEmptyState) {
                                        return (
                                            <div className='PagePane__emptyState'>
                                                <i className='icon-file-document-outline'/>
                                                <h3>{'No Pages Yet'}</h3>
                                                <p>{'Create your first page to get started'}</p>
                                            </div>
                                        );
                                    }

                                    return (
                                        <WikiPageEditor
                                            title={''}
                                            content={''}
                                            onTitleChange={handleTitleChange}
                                            onContentChange={handleContentChange}
                                            currentUserId={currentUserId}
                                            channelId={actualChannelId}
                                            teamId={teamId}
                                            showAuthor={false}
                                        />
                                    );
                                })()}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default WikiView;
