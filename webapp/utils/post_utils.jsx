// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Client from 'utils/web_client.jsx';
import PostStore from 'stores/post_store.jsx';
import Constants from 'utils/constants.jsx';

export function isSystemMessage(post) {
    return post.type && (post.type.lastIndexOf(Constants.SYSTEM_MESSAGE_PREFIX) === 0);
}

export function isComment(post) {
    if ('root_id' in post) {
        return post.root_id !== '' && post.root_id != null;
    }
    return false;
}

export function getProfilePicSrcForPost(post, timestamp) {
    let src = Client.getUsersRoute() + '/' + post.user_id + '/image?time=' + timestamp;
    if (post.props && post.props.from_webhook && global.window.mm_config.EnablePostIconOverride === 'true') {
        if (post.props.override_icon_url) {
            src = post.props.override_icon_url;
        } else {
            src = Constants.DEFAULT_WEBHOOK_LOGO;
        }
    } else if (isSystemMessage(post)) {
        src = Constants.SYSTEM_MESSAGE_PROFILE_IMAGE;
    }

    return src;
}

export function messageHistoryHandler(e) {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.keyCode === Constants.KeyCodes.UP || e.keyCode === Constants.KeyCodes.DOWN)) {
        if (this.state.messageText !== '' && this.currentLastMsgIndex === PostStore.getHistoryLength()) {
            return;
        }

        e.preventDefault();

        if (this.currentMsgHistoryLength !== PostStore.getHistoryLength()) {
            this.currentLastMsgIndex = PostStore.getHistoryLength();
            this.currentMsgHistoryLength = this.currentLastMsgIndex;
        }

        if (e.keyCode === Constants.KeyCodes.UP) {
            this.currentLastMsgIndex--;
        } else if (e.keyCode === Constants.KeyCodes.DOWN) {
            this.currentLastMsgIndex++;
        }

        if (this.currentLastMsgIndex < 0) {
            this.currentLastMsgIndex = 0;
        } else if (this.currentLastMsgIndex >= PostStore.getHistoryLength()) {
            this.currentLastMsgIndex = PostStore.getHistoryLength();
        }

        this.setState({messageText: PostStore.getMessageInHistory(this.currentLastMsgIndex)});
    }
}
