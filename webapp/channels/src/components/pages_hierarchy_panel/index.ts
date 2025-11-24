// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {loadPageDraftsForWiki, removePageDraft} from 'actions/page_drafts';
import {loadPages, createPage, updatePage, deletePage, movePage, movePageToWiki, duplicatePage} from 'actions/pages';
import {toggleNodeExpanded, setSelectedPage, expandAncestors, closePagesPanel} from 'actions/views/pages_hierarchy';
import {getPageDraftsForWiki} from 'selectors/page_drafts';
import {getPages, getPagesLoading, getPagesLastInvalidated} from 'selectors/pages';
import {getExpandedNodes, getSelectedPageId, getIsPanesPanelCollapsed} from 'selectors/pages_hierarchy';

import type {GlobalState} from 'types/store';

import PagesHierarchyPanel from './pages_hierarchy_panel';

type OwnProps = {
    wikiId: string;
    channelId: string;
    currentPageId?: string;
    onPageSelect: (pageId: string) => void;
    onVersionHistory?: (pageId: string) => void;
};

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    const {wikiId} = ownProps;

    const pages = getPages(state, wikiId);
    const drafts = getPageDraftsForWiki(state, wikiId);
    const loading = getPagesLoading(state, wikiId);
    const expandedNodes = getExpandedNodes(state, wikiId);
    const selectedPageId = getSelectedPageId(state);
    const isPanelCollapsed = getIsPanesPanelCollapsed(state);
    const lastInvalidated = getPagesLastInvalidated(state, wikiId);

    return {
        pages,
        drafts,
        loading,
        expandedNodes,
        selectedPageId,
        isPanelCollapsed,
        lastInvalidated,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators(
            {
                loadPages,
                loadPageDraftsForWiki,
                removePageDraft,
                toggleNodeExpanded,
                setSelectedPage,
                expandAncestors,
                createPage,
                updatePage,
                deletePage,
                movePage,
                movePageToWiki,
                duplicatePage,
                closePagesPanel,
            },
            dispatch,
        ),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(PagesHierarchyPanel as any);
