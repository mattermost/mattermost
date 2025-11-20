// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {loadPageDraftsForWiki, removePageDraft} from 'actions/page_drafts';
import {getPageDraftsForWiki} from 'selectors/page_drafts';
import {loadPages, createPage, updatePage, deletePage, movePage, movePageToWiki, duplicatePage} from 'actions/pages';
import {toggleNodeExpanded, setSelectedPage, expandAncestors, closePagesPanel} from 'actions/views/pages_hierarchy';
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

    return {
        pages: getPages(state, wikiId),
        drafts: getPageDraftsForWiki(state, wikiId),
        loading: getPagesLoading(state, wikiId),
        expandedNodes: getExpandedNodes(state, wikiId),
        selectedPageId: getSelectedPageId(state),
        isPanelCollapsed: getIsPanesPanelCollapsed(state),
        lastInvalidated: getPagesLastInvalidated(state, wikiId),
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
