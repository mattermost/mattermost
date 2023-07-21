// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Post} from '@mattermost/types/posts';
import {connect} from 'react-redux';

import {makeGetPostsForThread} from 'mattermost-redux/selectors/entities/posts';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getSelectedChannel, getSelectedPost} from 'selectors/rhs';

import {GlobalState} from 'types/store';

import RhsThread from './rhs_thread';

function makeMapStateToProps() {
    const getPostsForThread = makeGetPostsForThread();

    return function mapStateToProps(state: GlobalState) {
        const selected = getSelectedPost(state);
        const channel = getSelectedChannel(state);
        const currentTeam = getCurrentTeam(state);
        let posts: Post[] = [];
        if (selected) {
            posts = getPostsForThread(state, selected.id);
        }

        return {
            selected,
            channel,
            posts,
            currentTeam,
        };
    };
}
export default connect(makeMapStateToProps)(RhsThread);
