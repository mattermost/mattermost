// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel, ChannelMembership} from '@mattermost/types/channels';
import type {ServerError} from '@mattermost/types/errors';
import {isMessageAttachmentArray} from '@mattermost/types/message_attachments';
import type {Post} from '@mattermost/types/posts';
import type {UserProfile} from '@mattermost/types/users';

import {logError} from 'mattermost-redux/actions/errors';
import {Client4} from 'mattermost-redux/client';
import {getCurrentChannel, getMyChannelMember, makeGetChannel} from 'mattermost-redux/selectors/entities/channels';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {
    getTeammateNameDisplaySetting,
    isCollapsedThreadsEnabled,
} from 'mattermost-redux/selectors/entities/preferences';
import {getAllUserMentionKeys} from 'mattermost-redux/selectors/entities/search';
import {getCurrentUserId, getCurrentUser, getStatusForUserId, getUser} from 'mattermost-redux/selectors/entities/users';
import {isChannelMuted} from 'mattermost-redux/utils/channel_utils';
import {ensureString, isSystemMessage, isUserAddedInChannel} from 'mattermost-redux/utils/post_utils';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import {getChannelURL, getPermalinkURL} from 'selectors/urls';
import {isThreadOpen} from 'selectors/views/threads';

import {getHistory} from 'utils/browser_history';
import Constants, {NotificationLevels, UserStatuses, IgnoreChannelMentions, DesktopSound} from 'utils/constants';
import DesktopApp from 'utils/desktop_api';
import {stripMarkdown, formatWithRenderer} from 'utils/markdown';
import MentionableRenderer from 'utils/markdown/mentionable_renderer';
import {DesktopNotificationSounds, ding} from 'utils/notification_sounds';
import {showNotification} from 'utils/notifications';
import {cjkrPattern, escapeRegex} from 'utils/text_formatting';
import {isDesktopApp, isMobileApp} from 'utils/user_agent';
import * as Utils from 'utils/utils';

import type {ActionFuncAsync, GlobalState} from 'types/store';

import {runDesktopNotificationHooks} from './hooks';
import type {NewPostMessageProps} from './new_post';

type NotificationResult = {
    status: string;
    reason?: string;
    data?: string;
}

type NotificationHooksArgs = {
    title: string;
    body: string;
    silent: boolean;
    soundName: string;
    url: string;
    notify: boolean;
}

/**
 * This function is used to determine if the desktop sound is enabled.
 * It checks if desktop sound is defined in the channel member and if not, it checks if it's defined in the user preferences.
 */
export function isDesktopSoundEnabled(channelMember: ChannelMembership | undefined, user: UserProfile | undefined) {
    const soundInChannelMemberNotifyProps = channelMember?.notify_props?.desktop_sound;
    const soundInUserNotifyProps = user?.notify_props?.desktop_sound;

    if (soundInChannelMemberNotifyProps === DesktopSound.ON) {
        return true;
    }

    if (soundInChannelMemberNotifyProps === DesktopSound.OFF) {
        return false;
    }

    if (soundInChannelMemberNotifyProps === DesktopSound.DEFAULT) {
        return soundInUserNotifyProps ? soundInUserNotifyProps === 'true' : true;
    }

    if (soundInUserNotifyProps) {
        return soundInUserNotifyProps === 'true';
    }

    return true;
}

/**
 * This function returns the desktop notification sound from the channel member and user.
 * It checks if desktop notification sound is defined in the channel member and if not, it checks if it's defined in the user preferences.
 * If neither is defined, it returns the default sound 'BING'.
 */
export function getDesktopNotificationSound(channelMember: ChannelMembership | undefined, user: UserProfile | undefined) {
    const notificationSoundInChannelMember = channelMember?.notify_props?.desktop_notification_sound;
    const notificationSoundInUser = user?.notify_props?.desktop_notification_sound;

    if (notificationSoundInChannelMember && notificationSoundInChannelMember !== DesktopNotificationSounds.DEFAULT) {
        return notificationSoundInChannelMember;
    }

    if (notificationSoundInUser && notificationSoundInUser !== DesktopNotificationSounds.DEFAULT) {
        return notificationSoundInUser;
    }

    return DesktopNotificationSounds.BING;
}

export function sendDesktopNotification(post: Post, msgProps: NewPostMessageProps): ActionFuncAsync<NotificationResult> {
    return async (dispatch, getState) => {
        const state = getState();

        const teamId = msgProps.team_id;

        const channel = makeGetChannel()(state, post.channel_id) || {
            id: post.channel_id,
            name: msgProps.channel_name,
            display_name: msgProps.channel_display_name,
            type: msgProps.channel_type,
        };
        const user = getCurrentUser(state);
        const member = getMyChannelMember(state, post.channel_id);
        const isCrtReply = isCollapsedThreadsEnabled(state) && post.root_id !== '';
        const forceNotification = Boolean(post.props?.force_notification);

        const skipNotificationReason = shouldSkipNotification(
            state,
            post,
            msgProps,
            user,
            channel,
            member,
            forceNotification,
            isCrtReply,
        );
        if (skipNotificationReason) {
            return {data: skipNotificationReason};
        }

        const title = getNotificationTitle(channel, msgProps, isCrtReply);
        const body = getNotificationBody(state, post, msgProps);

        //Play a sound if explicitly set in settings
        const desktopSoundEnabled = isDesktopSoundEnabled(member, user);
        const soundName = getDesktopNotificationSound(member, user);

        const updatedState = getState();
        const url = isCrtReply ? getPermalinkURL(updatedState, teamId, post.id) : getChannelURL(updatedState, channel, teamId);

        // Allow plugins to change the notification, or re-enable a notification
        const args: NotificationHooksArgs = {title, body, silent: !desktopSoundEnabled, soundName, url, notify: true};

        // TODO verify the type of the desktop hook.
        // The channel may not be complete at this moment
        // and may cause crashes down the line if not
        // properly typed.
        const hookResult = await dispatch(runDesktopNotificationHooks(post, msgProps, channel as any, teamId, args));
        if (hookResult.error) {
            dispatch(logError(hookResult.error as ServerError));
            return {data: {status: 'error', reason: 'desktop_notification_hook', data: String(hookResult.error)}};
        }

        const argsAfterHooks = hookResult.data!;

        if (!argsAfterHooks.notify && !forceNotification) {
            return {data: {status: 'not_sent', reason: 'desktop_notification_hook', data: String(hookResult)}};
        }

        const result = dispatch(notifyMe(argsAfterHooks.title, argsAfterHooks.body, channel.id, teamId, argsAfterHooks.silent, argsAfterHooks.soundName, argsAfterHooks.url));

        //Don't add extra sounds on native desktop clients
        if (desktopSoundEnabled && !isDesktopApp() && !isMobileApp()) {
            ding(soundName);
        }

        return result;
    };
}

const getNotificationTitle = (channel: Pick<Channel, 'type' | 'display_name'>, msgProps: NewPostMessageProps, isCrtReply: boolean) => {
    let title = Utils.localizeMessage({id: 'channel_loader.posted', defaultMessage: 'Posted'});
    if (channel.type === Constants.DM_CHANNEL) {
        title = Utils.localizeMessage({id: 'notification.dm', defaultMessage: 'Direct Message'});
    } else {
        title = channel.display_name;
    }

    if (title === '') {
        if (msgProps.channel_type === Constants.DM_CHANNEL) {
            title = Utils.localizeMessage({id: 'notification.dm', defaultMessage: 'Direct Message'});
        } else {
            title = msgProps.channel_display_name;
        }
    }

    if (isCrtReply) {
        title = Utils.localizeAndFormatMessage({id: 'notification.crt', defaultMessage: 'Reply in {title}'}, {title});
    }

    return title;
};

const getNotificationUsername = (state: GlobalState, post: Post, msgProps: NewPostMessageProps): string => {
    const config = getConfig(state);
    const userFromPost = getUser(state, post.user_id);

    const overrideUsername = ensureString(post.props.override_username);
    if (overrideUsername && config.EnablePostUsernameOverride === 'true') {
        return overrideUsername;
    }
    if (userFromPost) {
        return displayUsername(userFromPost, getTeammateNameDisplaySetting(state), false);
    }
    if (msgProps.sender_name) {
        return msgProps.sender_name;
    }
    return Utils.localizeMessage({id: 'channel_loader.someone', defaultMessage: 'Someone'});
};

const getNotificationBody = (state: GlobalState, post: Post, msgProps: NewPostMessageProps) => {
    const username = getNotificationUsername(state, post, msgProps);

    let notifyText = post.message;

    const msgPropsPost: Post = JSON.parse(msgProps.post);
    const attachments = isMessageAttachmentArray(msgPropsPost?.props?.attachments) ? msgPropsPost.props.attachments : [];
    let image = false;
    attachments.forEach((attachment) => {
        if (notifyText.length === 0) {
            notifyText = attachment.fallback ||
                attachment.pretext ||
                attachment.text || '';
        }
        image = Boolean(image || (attachment.image_url?.length));
    });

    const strippedMarkdownNotifyText = stripMarkdown(notifyText);

    let body = `@${username}`;
    if (strippedMarkdownNotifyText.length === 0) {
        if (msgProps.image) {
            body += Utils.localizeMessage({id: 'channel_loader.uploadedImage', defaultMessage: ' uploaded an image'});
        } else if (msgProps.otherFile) {
            body += Utils.localizeMessage({id: 'channel_loader.uploadedFile', defaultMessage: ' uploaded a file'});
        } else if (image) {
            body += Utils.localizeMessage({id: 'channel_loader.postedImage', defaultMessage: ' posted an image'});
        } else {
            body += Utils.localizeMessage({id: 'channel_loader.something', defaultMessage: ' did something new'});
        }
    } else {
        body += `: ${strippedMarkdownNotifyText}`;
    }

    return body;
};

function shouldSkipNotification(
    state: GlobalState,
    post: Post,
    msgProps: NewPostMessageProps,
    user: UserProfile,
    channel: Pick<Channel, 'type' | 'id'>,
    member: ChannelMembership | undefined,
    skipChecks: boolean,
    isCrtReply: boolean,
) {
    const currentUserId = getCurrentUserId(state);
    if ((currentUserId === post.user_id && post.props.from_webhook !== 'true')) {
        return {status: 'not_sent', reason: 'own_post'};
    }

    if (isSystemMessage(post) && !isUserAddedInChannel(post, currentUserId)) {
        return {status: 'not_sent', reason: 'system_message'};
    }

    if (!member) {
        return {status: 'error', reason: 'no_member'};
    }

    if (skipChecks) {
        return undefined;
    }

    if (isChannelMuted(member)) {
        return {status: 'not_sent', reason: 'channel_muted'};
    }

    const userStatus = getStatusForUserId(state, user.id);
    if ((userStatus === UserStatuses.DND || userStatus === UserStatuses.OUT_OF_OFFICE)) {
        return {status: 'not_sent', reason: 'user_status', data: userStatus};
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
            if (isMessageAttachmentArray(post.props.attachments)) {
                const attachments = post.props.attachments;
                function appendText(toAppend?: string) {
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

    // Notify if you're not looking in the right channel or when
    // the window itself is not active
    const activeChannel = getCurrentChannel(state);
    const channelId = channel ? channel.id : null;

    if (state.views.browser.focused) {
        if (isCrtReply) {
            if (isThreadOpen(state, post.root_id)) {
                return {status: 'not_sent', reason: 'thread_is_open', data: post.root_id};
            }
        } else if (activeChannel && activeChannel.id === channelId) {
            return {status: 'not_sent', reason: 'channel_is_open', data: activeChannel?.id};
        }
    }

    return undefined;
}

export function notifyMe(title: string, body: string, channelId: string, teamId: string, silent: boolean, soundName: string, url: string): ActionFuncAsync<NotificationResult> {
    return async (dispatch) => {
        // handle notifications in desktop app
        if (isDesktopApp()) {
            const result = await DesktopApp.dispatchNotification(title, body, channelId, teamId, silent, soundName, url);
            return {data: result};
        }

        try {
            const result = await dispatch(showNotification({
                title,
                body,
                requireInteraction: false,
                silent,
                onClick: () => {
                    window.focus();
                    getHistory().push(url);
                },
            }));
            return {data: result};
        } catch (error) {
            dispatch(logError(error));
            return {data: {status: 'error', reason: 'notification_api', data: String(error)}};
        }
    };
}

export const sendTestNotification = async () => {
    try {
        const result = await Client4.sendTestNotificaiton();
        return result;
    } catch (error) {
        return error;
    }
};
