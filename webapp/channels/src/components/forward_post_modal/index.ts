// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import type {ConnectedProps} from 'react-redux';

import {bindActionCreators} from 'redux';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';

import type {Channel} from '@mattermost/types/channels';
import type {Post} from '@mattermost/types/posts';

import type {ActionResult} from 'mattermost-redux/types/actions';

import {openDirectChannelToUserId} from 'actions/channel_actions';
import {joinChannelById, switchToChannel} from 'actions/views/channel';
import {forwardPost} from 'actions/views/posts';

import ForwardPostModal from './forward_post_modal';

export type PropsFromRedux = ConnectedProps<typeof connector>;

export type ActionProps = {

    // join the selected channel when necessary
    joinChannelById: (channelId: string) => Promise<ActionResult>;

    // switch to the selected channel
    switchToChannel: (channel: Channel) => Promise<ActionResult>;

    // switch to the selected channel
    openDirectChannelToUserId: (userId: string) => Promise<ActionResult>;

    // action called to forward the post with an optional comment
    forwardPost: (post: Post, channelId: Channel, message?: string) => Promise<ActionResult>;
}

export type OwnProps = {

    // The function called immediately after the modal is hidden
    onExited?: () => void;

    // the post that is going to be forwarded
    post: Post;
};

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<any>, ActionProps>({
            joinChannelById,
            switchToChannel,
            forwardPost,
            openDirectChannelToUserId,
        }, dispatch),
    };
}
const connector = connect(null, mapDispatchToProps);

export default connector(ForwardPostModal);
