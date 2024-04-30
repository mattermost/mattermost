// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {logError} from 'mattermost-redux/actions/errors';
import {getCurrentChannel, getMyChannelMember, makeGetChannel} from 'mattermost-redux/selectors/entities/channels';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {
    getTeammateNameDisplaySetting,
    isCollapsedThreadsEnabled,
} from 'mattermost-redux/selectors/entities/preferences';
import {getAllUserMentionKeys} from 'mattermost-redux/selectors/entities/search';
import {getCurrentUserId, getCurrentUser, getStatusForUserId, getUser} from 'mattermost-redux/selectors/entities/users';
import {isChannelMuted} from 'mattermost-redux/utils/channel_utils';
import {isSystemMessage, isUserAddedInChannel} from 'mattermost-redux/utils/post_utils';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import {getChannelURL, getPermalinkURL} from 'selectors/urls';
import {isThreadOpen} from 'selectors/views/threads';

import {getHistory} from 'utils/browser_history';
import Constants, {NotificationLevels, UserStatuses, IgnoreChannelMentions} from 'utils/constants';
import DesktopApp from 'utils/desktop_api';
import {t} from 'utils/i18n';
import {stripMarkdown, formatWithRenderer} from 'utils/markdown';
import MentionableRenderer from 'utils/markdown/mentionable_renderer';
import * as NotificationSounds from 'utils/notification_sounds';
import {showNotification} from 'utils/notifications';
import {cjkrPattern, escapeRegex} from 'utils/text_formatting';
import {isDesktopApp, isMobileApp} from 'utils/user_agent';
import * as Utils from 'utils/utils';

import {runDesktopNotificationHooks} from './hooks';

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

/**
 * @returns {import('mattermost-redux/types/actions').ThunkActionFunc<Promise<import('utils/notifications').NotificationResult>, GlobalState>}
 */
export function sendDesktopNotification(post, msgProps) {
    return async (dispatch, getState) => {
        const state = getState();
        const currentUserId = getCurrentUserId(state);

        if ((currentUserId === post.user_id && post.props.from_webhook !== 'true')) {
            return {status: 'not_sent', reason: 'own_post'};
        }

        if (isSystemMessage(post) && !isUserAddedInChannel(post, currentUserId)) {
            return {status: 'not_sent', reason: 'system_message'};
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

        if (!member) {
            return {status: 'error', reason: 'no_member'};
        }

        if (isChannelMuted(member)) {
            return {status: 'not_sent', reason: 'channel_muted'};
        }

        if (userStatus === UserStatuses.DND || userStatus === UserStatuses.OUT_OF_OFFICE) {
            return {status: 'not_sent', reason: 'user_status', data: userStatus};
        }

        const channelNotifyProp = member?.notify_props?.desktop || NotificationLevels.DEFAULT;
        let notifyLevel = channelNotifyProp;

        if (notifyLevel === NotificationLevels.DEFAULT) {
            notifyLevel = user?.notify_props?.desktop || NotificationLevels.ALL;
        }

        if (channel?.type === 'G' && channelNotifyProp === NotificationLevels.DEFAULT && user?.notify_props?.desktop === NotificationLevels.MENTION) {
            notifyLevel = NotificationLevels.ALL;
        }

        if (notifyLevel === NotificationLevels.NONE) {
            return {status: 'not_sent', reason: 'notify_level_none'};
        } else if (channel?.type === 'G' && notifyLevel === NotificationLevels.MENTION) {
            // Compose the whole text in the message, including interactive messages.
            let text = post.message;

            // We do this on a try catch block to avoid errors from malformed props
            try {
                if (post.props && post.props.attachments) {
                    const attachments = post.props.attachments;
                    function appendText(toAppend) {
                        if (toAppend) {
                            text += `\n${toAppend}`;
                        }
                    }
                    for (const attachment of attachments) {
                        appendText(attachment.pretext);
                        appendText(attachment.title);
                        appendText(attachment.text);
                        appendText(attachment.footer);
                        if (attachment.fields) {
                            for (const field of attachment.fields) {
                                appendText(field.title);
                                appendText(field.value);
                            }
                        }
                    }
                }
            } catch (e) {
                // eslint-disable-next-line no-console
                console.log('Could not process the whole attachment for mentions', e);
            }

            const allMentions = getAllUserMentionKeys(state);

            const ignoreChannelMentionProp = member?.notify_props?.ignore_channel_mentions || IgnoreChannelMentions.DEFAULT;
            let ignoreChannelMention = ignoreChannelMentionProp === IgnoreChannelMentions.ON;
            if (ignoreChannelMentionProp === IgnoreChannelMentions.DEFAULT) {
                ignoreChannelMention = user?.notify_props?.channel === 'false';
            }

            const mentionableText = formatWithRenderer(text, new MentionableRenderer());
            let isExplicitlyMentioned = false;
            for (const mention of allMentions) {
                if (!mention || !mention.key) {
                    continue;
                }

                if (ignoreChannelMention && ['@all', '@here', '@channel'].includes(mention.key)) {
                    continue;
                }

                let flags = 'g';
                if (!mention.caseSensitive) {
                    flags += 'i';
                }

                let pattern;
                if (cjkrPattern.test(mention.key)) {
                    // In the case of CJK mention key, even if there's no delimiters (such as spaces) at both ends of a word, it is recognized as a mention key
                    pattern = new RegExp(`()(${escapeRegex(mention.key)})()`, flags);
                } else {
                    pattern = new RegExp(
                        `(^|\\W)(${escapeRegex(mention.key)})(\\b|_+\\b)`,
                        flags,
                    );
                }

                if (pattern.test(mentionableText)) {
                    isExplicitlyMentioned = true;
                    break;
                }
            }

            if (!isExplicitlyMentioned) {
                return {status: 'not_sent', reason: 'not_explicitly_mentioned', data: mentionableText};
            }
        } else if (notifyLevel === NotificationLevels.MENTION && mentions.indexOf(user.id) === -1 && msgProps.channel_type !== Constants.DM_CHANNEL) {
            return {status: 'not_sent', reason: 'not_mentioned'};
        } else if (isCrtReply && notifyLevel === NotificationLevels.ALL && followers.indexOf(currentUserId) === -1) {
            // if user is not following the thread don't notify
            return {status: 'not_sent', reason: 'not_following_thread'};
        }

        const config = getConfig(state);
        const userFromPost = getUser(state, post.user_id);

        let username = '';
        if (post.props.override_username && config.EnablePostUsernameOverride === 'true') {
            username = post.props.override_username;
        } else if (userFromPost) {
            username = displayUsername(userFromPost, getTeammateNameDisplaySetting(state), false);
        } else if (msgProps.sender_name) {
            username = msgProps.sender_name;
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

        const strippedMarkdownNotifyText = stripMarkdown(notifyText);

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
        let notifyResult = {status: 'not_sent', reason: 'unknown'};
        if (state.views.browser.focused) {
            notifyResult = {status: 'not_sent', reason: 'window_is_focused'};
            if (isCrtReply) {
                notify = !isThreadOpen(state, post.root_id);
                if (!notify) {
                    notifyResult = {status: 'not_sent', reason: 'thread_is_open', data: post.root_id};
                }
            } else {
                notify = activeChannel && activeChannel.id !== channelId;
                if (!notify) {
                    notifyResult = {status: 'not_sent', reason: 'channel_is_open', data: activeChannel?.id};
                }
            }
        } else {
            notify = true;
        }

        let soundName = getNotificationSoundFromChannelMemberAndUser(member, user);

        const updatedState = getState();
        let url = getChannelURL(updatedState, channel, teamId);

        if (isCrtReply) {
            url = getPermalinkURL(updatedState, teamId, post.id);
        }

        // Allow plugins to change the notification, or re-enable a notification
        const args = {title, body, silent: !sound, soundName, url, notify};
        const hookResult = await dispatch(runDesktopNotificationHooks(post, msgProps, channel, teamId, args));
        if (hookResult.error) {
            dispatch(logError(hookResult.error));
            return {status: 'error', reason: 'desktop_notification_hook', data: String(hookResult.error)};
        }

        let silent = false;
        ({title, body, silent, soundName, url, notify} = hookResult.args);

        if (notify) {
            const result = dispatch(notifyMe(title, body, channel, teamId, silent, soundName, url));

            //Don't add extra sounds on native desktop clients
            if (sound && !isDesktopApp() && !isMobileApp()) {
                NotificationSounds.ding(soundName);
            }

            return result;
        }

        if (args.notify && !notify) {
            notifyResult = {status: 'not_sent', reason: 'desktop_notification_hook', data: String(hookResult)};
        }

        return notifyResult;
    };
}

/**
 * @returns {import('mattermost-redux/types/actions').ThunkActionFunc<Promise<import('utils/notifications').NotificationResult>, GlobalState>}
 */
export const notifyMe = (title, body, channel, teamId, silent, soundName, url) => async (dispatch) => {
    // handle notifications in desktop app
    if (isDesktopApp()) {
        return DesktopApp.dispatchNotification(title, body, channel.id, teamId, silent, soundName, url);
    }

    try {
        return await dispatch(showNotification({
            title,
            body,
            requireInteraction: false,
            silent,
            onClick: () => {
                window.focus();
                getHistory().push(url);
            },
        }));
    } catch (error) {
        dispatch(logError(error));
        return {status: 'error', reason: 'notification_api', data: String(error)};
    }
};
