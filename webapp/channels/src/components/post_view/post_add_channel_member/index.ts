// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {GlobalState} from '@mattermost/types/store';

import {addChannelMember} from 'mattermost-redux/actions/channels';
import {removePost} from 'mattermost-redux/actions/posts';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import type {GenericAction} from 'mattermost-redux/types/actions';

import PostAddChannelMember from './post_add_channel_member';

type OwnProps = {
    postId: string;
}

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    const post = getPost(state, ownProps.postId) || {};
    let channelType = '';
    if (post && post.channel_id) {
        const channel = getChannel(state, post.channel_id);
        if (channel && channel.type) {
            channelType = channel.type;
        }
    }

    return {
        channelType,
        currentUser: getCurrentUser(state),
        post,
    };
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators({
            addChannelMember,
            removePost,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(PostAddChannelMember);
