// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {logError} from 'mattermost-redux/actions/errors';
import {getProfilesByIds} from 'mattermost-redux/actions/users';
import {getCurrentChannel, getMyChannelMember, makeGetChannel} from 'mattermost-redux/selectors/entities/channels';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getTeammateNameDisplaySetting, isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUserId, getCurrentUser, getStatusForUserId, getUser} from 'mattermost-redux/selectors/entities/users';
import {isChannelMuted} from 'mattermost-redux/utils/channel_utils';
import {isSystemMessage, isUserAddedInChannel} from 'mattermost-redux/utils/post_utils';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import {isThreadOpen} from 'selectors/views/threads';
import {getChannelURL, getPermalinkURL} from 'selectors/urls';

import {getHistory} from 'utils/browser_history';
import Constants, {NotificationLevels, UserStatuses} from 'utils/constants';
import * as NotificationSounds from 'utils/notification_sounds';
import {showNotification} from 'utils/notifications';
import {isDesktopApp, isMobileApp, isWindowsApp} from 'utils/user_agent';
import * as Utils from 'utils/utils';
import {t} from 'utils/i18n';
import {stripMarkdown} from 'utils/markdown';
import {callsWillNotify} from 'selectors/calls';

const NOTIFY_TEXT_MAX_LENGTH = 50;

// windows notification length is based windows chrome which supports 128 characters and is the lowest length of windows browsers
const WINDOWS_NOTIFY_TEXT_MAX_LENGTH = 120;

const getSoundFromChannelMemberAndUser = (member, user) => {
    if (member?.notify_props?.desktop_sound) {
        return member.notify_props.desktop_sound === 'on';
    }

    return !user.notify_props || user.notify_props.desktop_sound === 'true';
};

const getNotificationSoundFromChannelMemberAndUser = (member, user) => {
    if (member?.notify_props?.desktop_notification_sound) {
        return member.notify_props.desktop_notification_sound;
    }

    return user.notify_props?.desktop_notification_sound ? user.notify_props.desktop_notification_sound : 'Bing';
};

export function sendDesktopNotification(post, msgProps) {
    return async (dispatch, getState) => {
        const state = getState();
        const currentUserId = getCurrentUserId(state);

        if ((currentUserId === post.user_id && post.props.from_webhook !== 'true')) {
            return;
        }

        if (isSystemMessage(post) && !isUserAddedInChannel(post, currentUserId)) {
            return;
        }

        let userFromPost = getUser(state, post.user_id);
        if (!userFromPost) {
            const missingProfileResponse = await dispatch(getProfilesByIds([post.user_id]));
            if (missingProfileResponse.data && missingProfileResponse.data.length) {
                userFromPost = missingProfileResponse.data[0];
            }
        }

        let mentions = [];
        if (msgProps.mentions) {
            mentions = JSON.parse(msgProps.mentions);
        }

        let followers = [];
        if (msgProps.followers) {
            followers = JSON.parse(msgProps.followers);
            mentions = [...new Set([...followers, ...mentions])];
        }

        const teamId = msgProps.team_id;

        let channel = makeGetChannel()(state, {id: post.channel_id});
        const user = getCurrentUser(state);
        const userStatus = getStatusForUserId(state, user.id);
        const member = getMyChannelMember(state, post.channel_id);
        const isCrtReply = isCollapsedThreadsEnabled(state) && post.root_id !== '';

        if (!member || isChannelMuted(member) || userStatus === UserStatuses.DND || userStatus === UserStatuses.OUT_OF_OFFICE) {
            return;
        }

        let notifyLevel = member?.notify_props?.desktop || NotificationLevels.DEFAULT;

        if (notifyLevel === NotificationLevels.DEFAULT) {
            notifyLevel = user?.notify_props?.desktop || NotificationLevels.ALL;
        }

        if (notifyLevel === NotificationLevels.NONE) {
            return;
        } else if (notifyLevel === NotificationLevels.MENTION && mentions.indexOf(user.id) === -1 && msgProps.channel_type !== Constants.DM_CHANNEL) {
            return;
        } else if (isCrtReply && notifyLevel === NotificationLevels.ALL && followers.indexOf(currentUserId) === -1) {
            // if user is not following the thread don't notify
            return;
        }

        const config = getConfig(state);
        let username = '';
        if (post.props.override_username && config.EnablePostUsernameOverride === 'true') {
            username = post.props.override_username;
        } else if (userFromPost) {
            username = displayUsername(userFromPost, getTeammateNameDisplaySetting(state), false);
        } else {
            username = Utils.localizeMessage('channel_loader.someone', 'Someone');
        }

        let title = Utils.localizeMessage('channel_loader.posted', 'Posted');
        if (!channel) {
            title = msgProps.channel_display_name;
            channel = {
                name: msgProps.channel_name,
                type: msgProps.channel_type,
            };
        } else if (channel.type === Constants.DM_CHANNEL) {
            title = Utils.localizeMessage('notification.dm', 'Direct Message');
        } else {
            title = channel.display_name;
        }

        if (title === '') {
            if (msgProps.channel_type === Constants.DM_CHANNEL) {
                title = Utils.localizeMessage('notification.dm', 'Direct Message');
            } else {
                title = msgProps.channel_display_name;
            }
        }

        if (isCrtReply) {
            title = Utils.localizeAndFormatMessage(t('notification.crt'), 'Reply in {title}', {title});
        }

        let notifyText = post.message;

        const msgPropsPost = JSON.parse(msgProps.post);
        const attachments = msgPropsPost && msgPropsPost.props && msgPropsPost.props.attachments ? msgPropsPost.props.attachments : [];
        let image = false;
        attachments.forEach((attachment) => {
            if (notifyText.length === 0) {
                notifyText = attachment.fallback ||
                    attachment.pretext ||
                    attachment.text;
            }
            image |= attachment.image_url.length > 0;
        });

        let strippedMarkdownNotifyText = stripMarkdown(notifyText);

        const notifyTextMaxLength = isWindowsApp() ? WINDOWS_NOTIFY_TEXT_MAX_LENGTH : NOTIFY_TEXT_MAX_LENGTH;
        if (strippedMarkdownNotifyText.length > notifyTextMaxLength) {
            strippedMarkdownNotifyText = strippedMarkdownNotifyText.substring(0, notifyTextMaxLength - 1) + '...';
        }

        let body = `@${username}`;
        if (strippedMarkdownNotifyText.length === 0) {
            if (msgProps.image) {
                body += Utils.localizeMessage('channel_loader.uploadedImage', ' uploaded an image');
            } else if (msgProps.otherFile) {
                body += Utils.localizeMessage('channel_loader.uploadedFile', ' uploaded a file');
            } else if (image) {
                body += Utils.localizeMessage('channel_loader.postedImage', ' posted an image');
            } else {
                body += Utils.localizeMessage('channel_loader.something', ' did something new');
            }
        } else {
            body += `: ${strippedMarkdownNotifyText}`;
        }

        //Play a sound if explicitly set in settings
        const sound = getSoundFromChannelMemberAndUser(member, user);

        // Notify if you're not looking in the right channel or when
        // the window itself is not active
        const activeChannel = getCurrentChannel(state);
        const channelId = channel ? channel.id : null;

        let notify = false;
        if (isCrtReply) {
            notify = !isThreadOpen(state, post.root_id);
        } else {
            notify = activeChannel && activeChannel.id !== channelId;
        }
        notify = notify || !state.views.browser.focused;

        // Do not notify if Calls will handle this notification
        if (callsWillNotify(state, post, channel)) {
            notify = false;
        }

        const soundName = getNotificationSoundFromChannelMemberAndUser(member, user);

        if (notify) {
            const updatedState = getState();
            let url = getChannelURL(updatedState, channel, teamId);

            if (isCrtReply) {
                url = getPermalinkURL(updatedState, teamId, post.id);
            }

            dispatch(notifyMe(title, body, channel, teamId, !sound, soundName, url));

            //Don't add extra sounds on native desktop clients
            if (sound && !isDesktopApp() && !isMobileApp()) {
                NotificationSounds.ding(soundName);
            }
        }
    };
}

export const notifyMe = (title, body, channel, teamId, silent, soundName, url) => (dispatch) => {
    // handle notifications in desktop app
    if (isDesktopApp()) {
        const msg = {
            title,
            body,
            channel,
            teamId,
            silent,
        };
        msg.data = {soundName};
        msg.url = url;

        // get the desktop app to trigger the notification
        window.postMessage(
            {
                type: 'dispatch-notification',
                message: msg,
            },
            window.location.origin,
        );
    } else {
        showNotification({
            title,
            body,
            requireInteraction: false,
            silent,
            onClick: () => {
                window.focus();
                getHistory().push(url);
            },
        }).catch((error) => {
            dispatch(logError(error));
        });
    }
};
