// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Constants from 'utils/constants.jsx';
import * as Utils from 'utils/utils.jsx';

import TeamStore from 'stores/team_store.jsx';
import UserStore from 'stores/user_store.jsx';
import ChannelStore from 'stores/channel_store.jsx';

export function isSystemMessage(post) {
    return post.type && (post.type.lastIndexOf(Constants.SYSTEM_MESSAGE_PREFIX) === 0);
}

export function isFromWebhook(post) {
    return post.props && post.props.from_webhook === 'true';
}

export function isPostOwner(post) {
    return UserStore.getCurrentId() === post.user_id;
}

export function isComment(post) {
    if ('root_id' in post) {
        return post.root_id !== '' && post.root_id != null;
    }
    return false;
}

export function isEdited(post) {
    return post.edit_at > 0;
}

export function getProfilePicSrcForPost(post, user) {
    let src = '';
    if (user && user.id === post.user_id) {
        src = Utils.imageURLForUser(user);
    } else {
        src = Utils.imageURLForUser(post.user_id);
    }

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

export function canDeletePost(post) {
    var isOwner = isPostOwner(post);
    var isSystemAdmin = UserStore.isSystemAdminForCurrentUser();
    var isTeamAdmin = TeamStore.isTeamAdminForCurrentTeam() || isSystemAdmin;
    var isChannelAdmin = ChannelStore.isChannelAdminForCurrentChannel() || isTeamAdmin;
    var isAdmin = isChannelAdmin || isTeamAdmin || isSystemAdmin;

    if (global.window.mm_license.IsLicensed === 'true') {
        return (global.window.mm_config.RestrictPostDelete === Constants.PERMISSIONS_DELETE_POST_ALL && (isOwner || isChannelAdmin)) ||
            (global.window.mm_config.RestrictPostDelete === Constants.PERMISSIONS_DELETE_POST_TEAM_ADMIN && isTeamAdmin) ||
            (global.window.mm_config.RestrictPostDelete === Constants.PERMISSIONS_DELETE_POST_SYSTEM_ADMIN && isSystemAdmin);
    }

    return isOwner || isAdmin;
}

export function canEditPost(post, editDisableAction) {
    var isOwner = isPostOwner(post);

    var canEdit = isOwner && !isSystemMessage(post);

    if (canEdit && global.window.mm_license.IsLicensed === 'true') {
        if (global.window.mm_config.AllowEditPost === Constants.ALLOW_EDIT_POST_NEVER) {
            canEdit = false;
        } else if (global.window.mm_config.AllowEditPost === Constants.ALLOW_EDIT_POST_TIME_LIMIT) {
            var timeLeft = (post.create_at + (global.window.mm_config.PostEditTimeLimit * 1000)) - Utils.getTimestamp();
            if (timeLeft > 0) {
                editDisableAction.fireAfter(timeLeft + 1000);
            } else {
                canEdit = false;
            }
        }
    }
    return canEdit;
}

export function shouldShowDotMenu(post) {
    if (Utils.isMobile()) {
        return true;
    }

    if (!isSystemMessage(post)) {
        return true;
    }

    if (canDeletePost(post)) {
        return true;
    }

    if (canEditPost(post)) {
        return true;
    }

    return false;
}
