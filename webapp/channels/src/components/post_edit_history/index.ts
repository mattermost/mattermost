// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import type {ConnectedProps} from 'react-redux';

import {getChannel, getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getPost} from 'mattermost-redux/selectors/entities/posts';

import {getSelectedPostId} from 'selectors/rhs';

import type {GlobalState} from 'types/store';

import PostEditHistory from './post_edit_history';

function mapStateToProps(state: GlobalState) {
    const selectedPostId = getSelectedPostId(state) || '';
    const originalPost = getPost(state, selectedPostId);
    const channel = getCurrentChannel(state) ?? getChannel(state, originalPost.channel_id);
    const channelDisplayName = channel?.display_name || '';

    return {
        channelDisplayName,
        originalPost,
    };
}

const connector = connect(mapStateToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(PostEditHistory);
