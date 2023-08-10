// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {makeGetPostsForThread} from 'mattermost-redux/selectors/entities/posts';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import {updateThreadToastStatus} from 'actions/views/threads';

import NewRepliesBanner from './new_replies_banner';

import type {Post} from '@mattermost/types/posts';
import type {GenericAction} from 'mattermost-redux/types/actions';
import type {Dispatch} from 'redux';
import type {GlobalState} from 'types/store';

type Props = {
    threadId: Post['id'];
    lastViewedBottom: number;
    canShow: boolean;
}

function makeGetHasNewRepliesSince(): (state: GlobalState, threadId: string, lastViewed: number) => boolean {
    const getPostsForThread = makeGetPostsForThread();

    return createSelector(
        'makeGetHasNewRepliesSince',
        getPostsForThread,
        getCurrentUser,
        (_state: GlobalState, _threadId: string, lastViewed: number) => lastViewed,
        (posts, currentUser, lastViewed) => posts.
            some((post) => post.create_at > lastViewed && post.user_id !== currentUser.id),
    );
}

function makeMapStateToProps() {
    const getHasNewRepliesSince = makeGetHasNewRepliesSince();

    return (state: GlobalState, ownProps: Props) => {
        const {threadId, lastViewedBottom, canShow} = ownProps;

        const hasNewReplies = canShow ? getHasNewRepliesSince(state, threadId, lastViewedBottom) : false;

        return {
            hasNewReplies,
        };
    };
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators({
            updateThreadToastStatus,
        }, dispatch),
    };
}

export default connect(makeMapStateToProps, mapDispatchToProps)(NewRepliesBanner);
