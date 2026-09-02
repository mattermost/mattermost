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

import {isMembershipPolicyEnforced} from 'utils/channel_utils';

import PostAddChannelMember from './post_add_channel_member';

type OwnProps = {
    postId: string;
    userIds: string[];
};

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    const post = getPost(state, ownProps.postId) || {};
    let channelType = '';
    let isPolicyEnforced = false;
    if (post && post.channel_id) {
        const channel = getChannel(state, post.channel_id);
        if (channel && channel.type) {
            channelType = channel.type;

            // Suppress the "Add to channel" affordance only for channels
            // whose policy controls membership. Permission-only policies
            // (e.g. file upload restrictions) leave membership unchanged
            // and so must keep the affordance available.
            isPolicyEnforced = isMembershipPolicyEnforced(channel);
        }
    }

    return {
        channelType,
        currentUser: getCurrentUser(state),
        post,
        isPolicyEnforced,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            addChannelMember,
            removePost,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(PostAddChannelMember);
