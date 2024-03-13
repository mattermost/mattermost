// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable max-lines */

import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import AdvancedTextEditor from 'components/advanced_text_editor/advanced_text_editor';

import {
    Locations,
} from 'utils/constants';

export type Props = {

    // Data used in multiple places of the component
    currentChannel: Channel;

    // Data used dispatching handleViewAction ex: edit post
    latestReplyablePostId?: string;

    actions: {

        // func called for opening the last replayable post in the RHS
        selectPostFromRightHandSideSearchByPostId: (postId: string) => void;
    };
}

class AdvancedCreatePost extends React.PureComponent<Props> {
    static defaultProps = {
        latestReplyablePostId: '',
    };

    replyToLastPost = (e: React.KeyboardEvent) => {
        e.preventDefault();
        const latestReplyablePostId = this.props.latestReplyablePostId;
        const replyBox = document.getElementById('reply_textbox');
        if (replyBox) {
            replyBox.focus();
        }
        if (latestReplyablePostId) {
            this.props.actions.selectPostFromRightHandSideSearchByPostId(latestReplyablePostId);
        }
    };

    render() {
        if (!this.props.currentChannel || !this.props.currentChannel.id) {
            return null;
        }

        return (
            <AdvancedTextEditor
                location={Locations.CENTER}
                postId={''}
                channelId={this.props.currentChannel.id}
                replyToLastPost={this.replyToLastPost}
            />
        );
    }
}

export default AdvancedCreatePost;
