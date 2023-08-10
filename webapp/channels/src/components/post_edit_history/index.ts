// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {getChannel, getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getPost} from 'mattermost-redux/selectors/entities/posts';

import {getSelectedPostId} from 'selectors/rhs';

import PostEditHistory from './post_edit_history';

import type {ConnectedProps} from 'react-redux';
import type {GlobalState} from 'types/store';

function mapStateToProps(state: GlobalState) {
    const selectedPostId = getSelectedPostId(state) || '';
    const originalPost = getPost(state, selectedPostId);
    const channelDisplayName = getCurrentChannel(state) ? getCurrentChannel(state).display_name : getChannel(state, originalPost.channel_id).display_name;

    return {
        channelDisplayName,
        originalPost,
    };
}

const connector = connect(mapStateToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(PostEditHistory);
