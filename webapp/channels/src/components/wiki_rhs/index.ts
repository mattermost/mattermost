// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import type {Dispatch} from 'redux';
import {bindActionCreators} from 'redux';

import {getPageById} from 'mattermost-redux/selectors/entities/pages';

import {closeRightHandSide, openWikiRhs, toggleRhsExpanded} from 'actions/views/rhs';
import {setWikiRhsActiveTab, setFocusedInlineCommentId, setPendingInlineAnchor} from 'actions/views/wiki_rhs';
import {getIsRhsExpanded} from 'selectors/rhs';
import {getSelectedPageId, getWikiRhsWikiId, getWikiRhsActiveTab, getFocusedInlineCommentId, getPendingInlineAnchor, getIsSubmittingComment} from 'selectors/wiki_rhs';

import type {GlobalState} from 'types/store';

import WikiRHS from './wiki_rhs';

function makeMapStateToProps() {
    return (state: GlobalState) => {
        const pageId = getSelectedPageId(state);
        const page = pageId ? getPageById(state, pageId) : null;
        const pageTitle = (typeof page?.title === 'string' ? page.title : 'Page');

        // True once the page entity is hydrated (has wiki_id). The wiki RHS uses
        // page-comment endpoints, not channel-post endpoints.
        const pageHydrated = Boolean(page?.wiki_id);

        return {
            pageId,
            wikiId: getWikiRhsWikiId(state),
            pageTitle,
            pageHydrated,
            activeTab: getWikiRhsActiveTab(state),
            focusedInlineCommentId: getFocusedInlineCommentId(state),
            pendingInlineAnchor: getPendingInlineAnchor(state),
            isExpanded: getIsRhsExpanded(state),
            isSubmittingComment: getIsSubmittingComment(state),
        };
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            closeRightHandSide,
            setWikiRhsActiveTab,
            setFocusedInlineCommentId,
            setPendingInlineAnchor,
            openWikiRhs,
            toggleRhsExpanded,
        }, dispatch),
    };
}

export default connect(makeMapStateToProps, mapDispatchToProps)(WikiRHS);
