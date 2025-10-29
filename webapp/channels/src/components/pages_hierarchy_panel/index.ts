// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {loadPageDraftsForWiki, removePageDraft} from 'actions/page_drafts';
import {loadWikiPages, createPage, renamePage, deletePage, movePage, movePageToWiki} from 'actions/pages';
import {toggleNodeExpanded, setSelectedPage, expandAncestors, closePagesPanel} from 'actions/views/pages_hierarchy';
import {getPageDraftsForWiki} from 'selectors/page_drafts';
import {getWikiPages, getWikiPagesLoading} from 'selectors/pages';
import {getExpandedNodes, getSelectedPageId, getIsPanesPanelCollapsed} from 'selectors/pages_hierarchy';

import type {GlobalState} from 'types/store';

import PagesHierarchyPanel from './pages_hierarchy_panel';

type OwnProps = {
    wikiId: string;
    channelId: string;
    currentPageId?: string;
    onPageSelect: (pageId: string) => void;
};

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    const {wikiId} = ownProps;

    return {
        pages: getWikiPages(state, wikiId),
        drafts: getPageDraftsForWiki(state, wikiId),
        loading: getWikiPagesLoading(state, wikiId),
        expandedNodes: getExpandedNodes(state, wikiId),
        selectedPageId: getSelectedPageId(state),
        isPanelCollapsed: getIsPanesPanelCollapsed(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators(
            {
                loadWikiPages,
                loadPageDraftsForWiki,
                removePageDraft,
                toggleNodeExpanded,
                setSelectedPage,
                expandAncestors,
                createPage,
                renamePage,
                deletePage,
                movePage,
                movePageToWiki,
                closePagesPanel,
            },
            dispatch,
        ),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(PagesHierarchyPanel as any);
