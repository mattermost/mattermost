// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Client from 'utils/web_client.jsx';

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
