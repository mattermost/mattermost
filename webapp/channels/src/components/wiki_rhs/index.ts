// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getPost} from 'mattermost-redux/selectors/entities/posts';

import {publishPage} from 'actions/pages';
import {closeRightHandSide} from 'actions/views/rhs';
import {getSelectedPageId, getWikiRhsWikiId} from 'selectors/wiki_rhs';

import type {GlobalState} from 'types/store';

import WikiRHS from './wiki_rhs';

function mapStateToProps(state: GlobalState) {
    const pageId = getSelectedPageId(state);
    const page = pageId ? getPost(state, pageId) : null;
    const pageTitle = (typeof page?.props?.title === 'string' ? page.props.title : 'Page');
    const channel = page?.channel_id ? getChannel(state, page.channel_id) : null;

    return {
        pageId,
        wikiId: getWikiRhsWikiId(state),
        pageTitle,
        channelLoaded: Boolean(channel),
    };
}

function mapDispatchToProps(dispatch: any) {
    return {
        actions: bindActionCreators({
            publishPage,
            closeRightHandSide,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(WikiRHS);
