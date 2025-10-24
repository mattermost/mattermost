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

    // DEBUG: Check thread posts and user data
    if (pageId) {
        const postsInThread = state.entities.posts.postsInThread[pageId] || [];
        const allPosts = state.entities.posts.posts;
        const allUsers = state.entities.users.profiles;

        console.log('[WikiRHS DEBUG] Thread posts for page:', pageId);
        console.log('[WikiRHS DEBUG] Post IDs in thread:', postsInThread);

        postsInThread.forEach((postId: string) => {
            const post = allPosts[postId];
            if (post) {
                const user = allUsers[post.user_id];
                console.log(`[WikiRHS DEBUG] Post ${postId}:`, {
                    type: post.type,
                    user_id: post.user_id,
                    has_user_profile: Boolean(user),
                    user_username: user?.username || 'MISSING',
                    parent_comment_id: post.props?.parent_comment_id || 'none (root comment)',
                    message_preview: post.message.substring(0, 30),
                });
            } else {
                console.log(`[WikiRHS DEBUG] Post ${postId}: NOT FOUND IN REDUX`);
            }
        });
    }

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
