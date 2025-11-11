// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getPost} from 'mattermost-redux/selectors/entities/posts';

import {publishPage} from 'actions/pages';
import {closeRightHandSide, openWikiRhs} from 'actions/views/rhs';
import {setWikiRhsActiveTab} from 'actions/views/wiki_rhs';
import {getSelectedPageId, getWikiRhsWikiId, getWikiRhsActiveTab, getFocusedInlineCommentId} from 'selectors/wiki_rhs';

import type {GlobalState} from 'types/store';

import WikiRHS from './wiki_rhs';

function makeMapStateToProps() {
    return (state: GlobalState) => {
        const pageId = getSelectedPageId(state);
        const page = pageId ? getPost(state, pageId) : null;
        const pageTitle = (typeof page?.props?.title === 'string' ? page.props.title : 'Page');
        const channel = page?.channel_id ? getChannel(state, page.channel_id) : null;

        return {
            pageId,
            wikiId: getWikiRhsWikiId(state),
            pageTitle,
            channelLoaded: Boolean(channel),
            activeTab: getWikiRhsActiveTab(state),
            focusedInlineCommentId: getFocusedInlineCommentId(state),
        };
    };
}

function mapDispatchToProps(dispatch: any) {
    return {
        actions: bindActionCreators({
            publishPage,
            closeRightHandSide,
            setWikiRhsActiveTab,
            openWikiRhs,
        }, dispatch),
    };
}

export default connect(makeMapStateToProps, mapDispatchToProps)(WikiRHS);
