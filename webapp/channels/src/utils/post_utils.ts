// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {IntlShape, useIntl} from 'react-intl';
import {useMemo} from 'react';
import {useSelector} from 'react-redux';

import {Client4} from 'mattermost-redux/client';

import {Permissions, Posts} from 'mattermost-redux/constants';

import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {makeGetReactionsForPost} from 'mattermost-redux/selectors/entities/posts';
import {get, getTeammateNameDisplaySetting, isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentTeamId, getTeam} from 'mattermost-redux/selectors/entities/teams';
import {makeGetDisplayName, getCurrentUserId, getUser, UserMentionKey, getUsersByUsername} from 'mattermost-redux/selectors/entities/users';
import {getAllGroupsForReferenceByName} from 'mattermost-redux/selectors/entities/groups';

import {memoizeResult} from 'mattermost-redux/utils/helpers';

import {Channel} from '@mattermost/types/channels';
import {ClientConfig, ClientLicense} from '@mattermost/types/config';
import {ServerError} from '@mattermost/types/errors';
import {Group} from '@mattermost/types/groups';
import {Post, PostPriority, PostPriorityMetadata} from '@mattermost/types/posts';
import {Reaction} from '@mattermost/types/reactions';
import {UserProfile} from '@mattermost/types/users';

import {getUserIdFromChannelName} from 'mattermost-redux/utils/channel_utils';
import * as PostListUtils from 'mattermost-redux/utils/post_list';
import {canEditPost as canEditPostRedux} from 'mattermost-redux/utils/post_utils';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import {getEmojiMap} from 'selectors/emojis';
import {getIsMobileView} from 'selectors/views/browser';

import {GlobalState} from 'types/store';

import Constants, {PostListRowListIds, Preferences} from 'utils/constants';
import * as Keyboard from 'utils/keyboard';
import {formatWithRenderer} from 'utils/markdown';
import MentionableRenderer from 'utils/markdown/mentionable_renderer';
import {allAtMentions} from 'utils/text_formatting';
import {isMobile} from 'utils/user_agent';

import EmojiMap from './emoji_map';
import * as Emoticons from './emoticons';

const CHANNEL_SWITCH_IGNORE_ENTER_THRESHOLD_MS = 500;

export function isSystemMessage(post: Post): boolean {
    return Boolean(post.type && (post.type.lastIndexOf(Constants.SYSTEM_MESSAGE_PREFIX) === 0));
}

export function fromAutoResponder(post: Post): boolean {
    return Boolean(post.type && (post.type === Constants.AUTO_RESPONDER));
}

export function isFromWebhook(post: Post): boolean {
    return post.props && post.props.from_webhook === 'true';
}

export function isFromBot(post: Post): boolean {
    return post.props && post.props.from_bot === 'true';
}

export function isPostOwner(state: GlobalState, post: Post): boolean {
    return getCurrentUserId(state) === post.user_id;
}

export function isComment(post: Post): boolean {
    if ('root_id' in post) {
        return post.root_id !== '' && post.root_id != null;
    }
    return false;
}

export function isEdited(post: Post): boolean {
    return post.edit_at > 0;
}

export function getImageSrc(src: string, hasImageProxy = false): string {
    if (!src) {
        return src;
    }

    const imageAPI = Client4.getBaseRoute() + '/image?url=';

    if (hasImageProxy && !src.startsWith(imageAPI)) {
        return imageAPI + encodeURIComponent(src);
    }

    return src;
}

export function canDeletePost(state: GlobalState, post: Post, channel: Channel): boolean {
    if (post.type === Constants.PostTypes.FAKE_PARENT_DELETED) {
        return false;
    }

    if (channel && channel.delete_at !== 0) {
        return false;
    }

    if (isPostOwner(state, post)) {
        return haveIChannelPermission(state, channel && channel.team_id, post.channel_id, Permissions.DELETE_POST);
    }
    return haveIChannelPermission(state, channel && channel.team_id, post.channel_id, Permissions.DELETE_OTHERS_POSTS);
}

export function canEditPost(
    state: GlobalState,
    post: Post,
    license?: ClientLicense,
    config?: Partial<ClientConfig>,
    channel?: Channel,
    userId?: string,
): boolean {
    return canEditPostRedux(state, config, license, channel?.team_id ?? '', channel?.id ?? '', userId ?? '', post);
}

export function shouldShowDotMenu(state: GlobalState, post: Post, channel: Channel): boolean {
    if (post && post.state === Posts.POST_DELETED) {
        return false;
    }

    if (getIsMobileView(state)) {
        return true;
    }

    if (!isSystemMessage(post)) {
        return true;
    }

    if (canDeletePost(state, post, channel)) {
        return true;
    }

    if (canEditPost(state, post)) {
        return true;
    }

    return false;
}

export function shouldShowActionsMenu(state: GlobalState, post: Post): boolean {
    const config = getConfig(state);
    const pluginsEnabled = config.PluginsEnabled === 'true';
    if (!pluginsEnabled) {
        return false;
    }

    if (isSystemMessage(post)) {
        return false;
    }

    return true;
}

export function containsAtChannel(text: string, options?: {checkAllMentions: boolean}): boolean {
    // Don't warn for slash commands
    if (!text || text.startsWith('/')) {
        return false;
    }

    let mentionsRegex;
    if (options?.checkAllMentions) {
        mentionsRegex = new RegExp(Constants.SPECIAL_MENTIONS_REGEX);
    } else {
        mentionsRegex = new RegExp(Constants.ALL_MEMBERS_MENTIONS_REGEX);
    }

    const mentionableText = formatWithRenderer(text, new MentionableRenderer());
    return mentionsRegex.test(mentionableText);
}

export function specialMentionsInText(text: string): {[key: string]: boolean} {
    const mentions = {
        all: false,
        channel: false,
        here: false,
    };

    // Don't warn for slash commands
    if (!text || text.startsWith('/')) {
        return mentions;
    }

    const mentionableText = formatWithRenderer(text, new MentionableRenderer());

    mentions.all = new RegExp(Constants.ALL_MENTION_REGEX).test(mentionableText);
    mentions.channel = new RegExp(Constants.CHANNEL_MENTION_REGEX).test(mentionableText);
    mentions.here = new RegExp(Constants.HERE_MENTION_REGEX).test(mentionableText);

    return mentions;
}

export const groupsMentionedInText = (text: string, groups: Map<string, Group> | null): Group[] => {
    // Don't warn for slash commands
    if (!text || text.startsWith('/')) {
        return [];
    }

    if (!groups) {
        return [];
    }

    const mentionableText = formatWithRenderer(text, new MentionableRenderer());
    const mentions = allAtMentions(mentionableText);

    const ret: Group[] = [];
    for (const mention of mentions) {
        const group = groups.get(mention);

        if (group) {
            ret.push(group);
        }
    }
    return ret;
};

export function shouldFocusMainTextbox(e: React.KeyboardEvent | KeyboardEvent, activeElement: Element | null): boolean {
    if (!e) {
        return false;
    }

    // Do not focus if we're currently focused on a textarea or input
    const keepFocusTags = ['TEXTAREA', 'INPUT'];
    if (!activeElement || keepFocusTags.includes(activeElement.tagName)) {
        return false;
    }

    // Focus if it is an attempted paste
    if (Keyboard.cmdOrCtrlPressed(e) && Keyboard.isKeyPressed(e, Constants.KeyCodes.V)) {
        return true;
    }

    // Do not focus if a modifier key is pressed
    if (e.ctrlKey || e.metaKey || e.altKey) {
        return false;
    }

    // Do not focus if the key is undefined or null
    if (e.key == null) {
        return false;
    }

    // Do not focus for non-character or non-number keys
    if (e.key.length !== 1 || !e.key.match(/./)) {
        return false;
    }

    // Do not focus when pressing space on link elements
    const spaceKeepFocusTags = ['BUTTON', 'A'];
    if (Keyboard.isKeyPressed(e, Constants.KeyCodes.SPACE) && spaceKeepFocusTags.includes(activeElement.tagName)) {
        return false;
    }

    return true;
}

function canAutomaticallyCloseBackticks(message: string) {
    const splitMessage = message.split('\n').filter((line) => line.trim() !== '');
    const lastPart = splitMessage[splitMessage.length - 1];

    if (splitMessage.length > 1 && !lastPart.includes('```')) {
        return {
            allowSending: true,
            message: message.endsWith('\n') ? message.concat('```') : message.concat('\n```'),
            withClosedCodeBlock: true,
        };
    }

    return {allowSending: true};
}

function sendOnCtrlEnter(message: string, ctrlOrMetaKeyPressed: boolean, isSendMessageOnCtrlEnter: boolean, caretPosition: number) {
    const match = message.substring(0, caretPosition).match(Constants.TRIPLE_BACK_TICKS);
    if (isSendMessageOnCtrlEnter && ctrlOrMetaKeyPressed && (!match || match.length % 2 === 0)) {
        return {allowSending: true};
    } else if (!isSendMessageOnCtrlEnter && (!match || match.length % 2 === 0)) {
        return {allowSending: true};
    } else if (ctrlOrMetaKeyPressed && match && match.length % 2 !== 0) {
        return canAutomaticallyCloseBackticks(message);
    }

    return {allowSending: false};
}

export function postMessageOnKeyPress(
    event: React.KeyboardEvent,
    message: string,
    sendMessageOnCtrlEnter: boolean,
    sendCodeBlockOnCtrlEnter: boolean,
    now = 0,
    lastChannelSwitchAt = 0,
    caretPosition = 0,
): {allowSending: boolean; ignoreKeyPress?: boolean} {
    if (!event) {
        return {allowSending: false};
    }

    // Typing enter on mobile never sends.
    if (isMobile()) {
        return {allowSending: false};
    }

    // Only ENTER sends, unless shift or alt key pressed.
    if (!Keyboard.isKeyPressed(event, Constants.KeyCodes.ENTER) || event.shiftKey || event.altKey) {
        return {allowSending: false};
    }

    // Don't send if we just switched channels within a threshold.
    if (lastChannelSwitchAt > 0 && now > 0 && now - lastChannelSwitchAt <= CHANNEL_SWITCH_IGNORE_ENTER_THRESHOLD_MS) {
        return {allowSending: false, ignoreKeyPress: true};
    }

    if (
        message.trim() === '' ||
        !(sendMessageOnCtrlEnter || sendCodeBlockOnCtrlEnter)
    ) {
        return {allowSending: true};
    }

    const ctrlOrMetaKeyPressed = event.ctrlKey || event.metaKey;

    if (sendMessageOnCtrlEnter) {
        return sendOnCtrlEnter(message, ctrlOrMetaKeyPressed, true, caretPosition);
    } else if (sendCodeBlockOnCtrlEnter) {
        return sendOnCtrlEnter(message, ctrlOrMetaKeyPressed, false, caretPosition);
    }

    return {allowSending: false};
}

export function isErrorInvalidSlashCommand(error: ServerError | null): boolean {
    if (error && error.server_error_id) {
        return error.server_error_id === 'api.command.execute_command.not_found.app_error';
    }

    return false;
}

export function isIdNotPost(postId: string): boolean {
    return (
        PostListUtils.isStartOfNewMessages(postId) ||
        PostListUtils.isDateLine(postId) ||
        postId in PostListRowListIds
    );
}

// getOldestPostId returns the oldest valid post ID in the given list of post IDs. This function is copied from
// mattermost-redux, except it also includes additional special IDs that are only used in the web app.
export function getOldestPostId(postIds: string[]): string {
    for (let i = postIds.length - 1; i >= 0; i--) {
        const item = postIds[i];

        if (isIdNotPost(item)) {
            // This is not a post at all
            continue;
        }

        if (PostListUtils.isCombinedUserActivityPost(item)) {
            // This is a combined post, so find the first post ID from it
            const combinedIds = PostListUtils.getPostIdsForCombinedUserActivityPost(item);

            return combinedIds[combinedIds.length - 1];
        }

        // This is a post ID
        return item;
    }

    return '';
}

export function getPreviousPostId(postIds: string[], startIndex: number): string {
    for (let i = startIndex + 1; i < postIds.length; i++) {
        const itemId = postIds[i];

        if (isIdNotPost(itemId)) {
            // This is not a post at all
            continue;
        }

        if (PostListUtils.isCombinedUserActivityPost(itemId)) {
            // This is a combined post, so find the last post ID from it
            const combinedIds = PostListUtils.getPostIdsForCombinedUserActivityPost(itemId);

            return combinedIds[0];
        }

        // This is a post ID
        return itemId;
    }

    return '';
}

// getLatestPostId returns the most recent valid post ID in the given list of post IDs. This function is copied from
// mattermost-redux, except it also includes additional special IDs that are only used in the web app.
export function getLatestPostId(postIds: string[]): string {
    for (let i = 0; i < postIds.length; i++) {
        const item = postIds[i];

        if (isIdNotPost(item)) {
            // This is not a post at all
            continue;
        }

        if (PostListUtils.isCombinedUserActivityPost(item)) {
            // This is a combined post, so find the lastest post ID from it
            const combinedIds = PostListUtils.getPostIdsForCombinedUserActivityPost(item);

            return combinedIds[0];
        }

        // This is a post ID
        return item;
    }

    return '';
}

export function makeGetMentionsFromMessage(): (state: GlobalState, post: Post) => Record<string, UserProfile> {
    return createSelector(
        'getMentionsFromMessage',
        (state: GlobalState, post: Post) => post,
        (state: GlobalState) => getUsersByUsername(state),
        (post, users) => {
            const mentions: Record<string, UserProfile> = {};
            const mentionsArray = post.message.match(Constants.MENTIONS_REGEX) || [];
            for (let i = 0; i < mentionsArray.length; i++) {
                const mention = mentionsArray[i];
                const user = getUserOrGroupFromMentionName(users, mention.substring(1)) as UserProfile | '';

                if (user) {
                    mentions[mention] = user;
                }
            }

            return mentions;
        },
    );
}

export function usePostAriaLabel(post: Post | undefined) {
    const intl = useIntl();

    const getDisplayName = useMemo(makeGetDisplayName, []);
    const getReactionsForPost = useMemo(makeGetReactionsForPost, []);
    const getMentionsFromMessage = useMemo(makeGetMentionsFromMessage, []);

    const createAriaLabelMemoized = memoizeResult(createAriaLabelForPost);

    return useSelector((state: GlobalState) => {
        if (!post) {
            return '';
        }

        const authorDisplayName = getDisplayName(state, post.user_id);
        const reactions = getReactionsForPost(state, post?.id);
        const isFlagged = get(state, Preferences.CATEGORY_FLAGGED_POST, post.id, null) != null;
        const emojiMap = getEmojiMap(state);
        const mentions = getMentionsFromMessage(state, post);
        const teammateNameDisplaySetting = getTeammateNameDisplaySetting(state);

        return createAriaLabelMemoized(
            post,
            authorDisplayName,
            isFlagged,
            reactions,
            intl,
            emojiMap,
            mentions,
            teammateNameDisplaySetting,
        );
    });
}

export function createAriaLabelForPost(post: Post, author: string, isFlagged: boolean, reactions: Record<string, Reaction> | undefined, intl: IntlShape, emojiMap: EmojiMap, mentions: Record<string, UserProfile>, teammateNameDisplaySetting: string): string {
    const {formatMessage, formatTime, formatDate} = intl;

    let message = post.state === Posts.POST_DELETED ? formatMessage({
        id: 'post_body.deleted',
        defaultMessage: '(message deleted)',
    }) : post.message || '';
    let match;

    // Match all the shorthand forms of emojis first
    for (const name of Object.keys(Emoticons.emoticonPatterns)) {
        const pattern = Emoticons.emoticonPatterns[name];
        message = message.replace(pattern, `:${name}:`);
    }

    while ((match = Emoticons.EMOJI_PATTERN.exec(message)) !== null) {
        if (emojiMap.has(match[2])) {
            message = message.replace(match[0], `${match[2].replace(/_/g, ' ')} emoji`);
        }
    }

    // Replace mentions with preferred username
    for (const mention of Object.keys(mentions)) {
        const user = mentions[mention];
        if (user) {
            message = message.replace(mention, `@${displayUsername(user, teammateNameDisplaySetting)}`);
        }
    }

    let ariaLabel;
    if (post.root_id) {
        ariaLabel = formatMessage({
            id: 'post.ariaLabel.replyMessage',
            defaultMessage: 'At {time} {date}, {authorName} replied, {message}',
        },
        {
            authorName: author,
            time: formatTime(post.create_at),
            date: formatDate(post.create_at, {weekday: 'long', month: 'long', day: 'numeric'}),
            message,
        });
    } else {
        ariaLabel = formatMessage({
            id: 'post.ariaLabel.message',
            defaultMessage: 'At {time} {date}, {authorName} wrote, {message}',
        },
        {
            authorName: author,
            time: formatTime(post.create_at),
            date: formatDate(post.create_at, {weekday: 'long', month: 'long', day: 'numeric'}),
            message,
        });
    }

    let attachmentCount = 0;
    if (post.props && post.props.attachments) {
        attachmentCount += post.props.attachments.length;
    }
    if (post.file_ids) {
        attachmentCount += post.file_ids.length;
    }

    if (attachmentCount) {
        if (attachmentCount > 1) {
            ariaLabel += formatMessage({
                id: 'post.ariaLabel.attachmentMultiple',
                defaultMessage: ', {attachmentCount} attachments',
            },
            {
                attachmentCount,
            });
        } else {
            ariaLabel += formatMessage({
                id: 'post.ariaLabel.attachment',
                defaultMessage: ', 1 attachment',
            });
        }
    }

    if (reactions) {
        const emojiNames = [];
        for (const reaction of Object.values(reactions)) {
            const emojiName = reaction.emoji_name;

            if (emojiNames.indexOf(emojiName) < 0) {
                emojiNames.push(emojiName);
            }
        }

        if (emojiNames.length > 1) {
            ariaLabel += formatMessage({
                id: 'post.ariaLabel.reactionMultiple',
                defaultMessage: ', {reactionCount} reactions',
            },
            {
                reactionCount: emojiNames.length,
            });
        } else if (emojiNames.length === 1) {
            ariaLabel += formatMessage({
                id: 'post.ariaLabel.reaction',
                defaultMessage: ', 1 reaction',
            });
        }
    }

    if (isFlagged) {
        if (post.is_pinned) {
            ariaLabel += formatMessage({
                id: 'post.ariaLabel.messageIsFlaggedAndPinned',
                defaultMessage: ', message is saved and pinned',
            });
        } else {
            ariaLabel += formatMessage({
                id: 'post.ariaLabel.messageIsFlagged',
                defaultMessage: ', message is saved',
            });
        }
    } else if (!isFlagged && post.is_pinned) {
        ariaLabel += formatMessage({
            id: 'post.ariaLabel.messageIsPinned',
            defaultMessage: ', message is pinned',
        });
    }

    return ariaLabel;
}

// Splits text message based on the current caret position
export function splitMessageBasedOnCaretPosition(caretPosition: number, message: string): {firstPiece: string; lastPiece: string} {
    const firstPiece = message.substring(0, caretPosition);
    const lastPiece = message.substring(caretPosition, message.length);
    return {firstPiece, lastPiece};
}

export function splitMessageBasedOnTextSelection(selectionStart: number, selectionEnd: number, message: string): {firstPiece: string; lastPiece: string} {
    const firstPiece = message.substring(0, selectionStart);
    const lastPiece = message.substring(selectionEnd, message.length);
    return {firstPiece, lastPiece};
}

export function getNewMessageIndex(postListIds: string[]): number {
    return postListIds.findIndex(
        (item) => item.indexOf(PostListRowListIds.START_OF_NEW_MESSAGES) === 0,
    );
}

export function areConsecutivePostsBySameUser(post: Post, previousPost: Post): boolean {
    if (!(post && previousPost)) {
        return false;
    }
    return post.user_id === previousPost.user_id && // The post is by the same user
        post.create_at - previousPost.create_at <= Posts.POST_COLLAPSE_TIMEOUT && // And was within a short time period
        !(post.props && post.props.from_webhook) && !(previousPost.props && previousPost.props.from_webhook) && // And neither is from a webhook
        !isSystemMessage(post) && !isSystemMessage(previousPost); // And neither is a system message
}

// Constructs the URL of a post.
// Was made to be used with permalinks.
//
// If the post is a reply and CRT is enabled
// the URL constructed is the URL of the channel instead.
//
// Note: In the case of DM_CHANNEL, users must be fetched beforehand.
export function getPostURL(state: GlobalState, post: Post): string {
    const channel = getChannel(state, post.channel_id);
    const currentUserId = getCurrentUserId(state);
    const team = getTeam(state, channel.team_id || getCurrentTeamId(state));

    const postURI = isCollapsedThreadsEnabled(state) && isComment(post) ? '' : `/${post.id}`;

    switch (channel.type) {
    case Constants.DM_CHANNEL: {
        const userId = getUserIdFromChannelName(currentUserId, channel.name);
        const user = getUser(state, userId);
        return `/${team.name}/messages/@${user.username}${postURI}`;
    }
    case Constants.GM_CHANNEL:
        return `/${team.name}/messages/${channel.name}${postURI}`;
    default:
        return `/${team.name}/channels/${channel.name}${postURI}`;
    }
}

export function matchUserMentionTriggersWithMessageMentions(userMentionKeys: UserMentionKey[],
    messageMentionKeys: RegExpMatchArray): boolean {
    let isMentioned = false;
    for (const mentionKey of userMentionKeys) {
        const isPresentInMessage = messageMentionKeys.includes(mentionKey.key);
        if (isPresentInMessage) {
            isMentioned = true;
            break;
        }
    }
    return isMentioned;
}

/**
 * This removes custom emoji reactions of a post, which are deleted from the custom emoji store.
 */
export function makeGetUniqueReactionsToPost(): (state: GlobalState, postId: Post['id']) => Record<string, Reaction> | undefined | null {
    const getReactionsForPost = makeGetReactionsForPost();

    return createSelector(
        'makeGetUniqueReactionsToPost',
        (state: GlobalState, postId: string) => getReactionsForPost(state, postId),
        getEmojiMap,
        (reactions, emojiMap) => {
            if (!reactions) {
                return null;
            }

            const reactionsForPost: Record<string, Reaction> = {};

            Object.entries(reactions).forEach(([userIdEmojiKey, emojiReaction]) => {
                if (emojiMap.get(emojiReaction.emoji_name)) {
                    reactionsForPost[userIdEmojiKey] = emojiReaction;
                }
            });

            return reactionsForPost;
        },
    );
}

export function getUserOrGroupFromMentionName(usersByUsername: Record<string, UserProfile | Group>, mentionName: string) {
    let mentionNameToLowerCase = mentionName.toLowerCase();

    while (mentionNameToLowerCase.length > 0) {
        if (usersByUsername.hasOwnProperty(mentionNameToLowerCase)) {
            return usersByUsername[mentionNameToLowerCase];
        }

        // Repeatedly trim off trailing punctuation in case this is at the end of a sentence
        if ((/[._-]$/).test(mentionNameToLowerCase)) {
            mentionNameToLowerCase = mentionNameToLowerCase.substring(0, mentionNameToLowerCase.length - 1);
        } else {
            break;
        }
    }

    return '';
}

export function mentionsMinusSpecialMentionsInText(message: string) {
    const allMentions = message.match(Constants.MENTIONS_REGEX) || [];
    const mentions = [];
    for (let i = 0; i < allMentions.length; i++) {
        const mention = allMentions[i];
        if (!Constants.SPECIAL_MENTIONS_REGEX.test(mention)) {
            mentions.push(mention.substring(1).trim());
        }
    }

    return mentions;
}

function isUserProfile(entity: UserProfile | Group): entity is UserProfile {
    return (entity as UserProfile).username !== undefined;
}

export function makeGetUserOrGroupMentionCountFromMessage(): (state: GlobalState, message: Post['message']) => number {
    return createSelector(
        'getUserOrGroupMentionCountFromMessage',
        (_state: GlobalState, message: Post['message']) => message,
        getUsersByUsername,
        getAllGroupsForReferenceByName,
        (message, users, groups) => {
            let count = 0;
            const markdownCleanedText = formatWithRenderer(message, new MentionableRenderer());
            const mentions = new Set(markdownCleanedText.match(Constants.MENTIONS_REGEX) || []);
            mentions.forEach((mention) => {
                const data = {...groups, ...users};
                const userOrGroup = getUserOrGroupFromMentionName(data, mention.substring(1));

                if (userOrGroup) {
                    if (isUserProfile(userOrGroup)) {
                        count++;
                    } else {
                        count += userOrGroup.member_count;
                    }
                }
            });
            return count;
        },
    );
}

export function hasRequestedPersistentNotifications(priority?: PostPriorityMetadata) {
    return (
        priority?.priority === PostPriority.URGENT &&
        priority?.persistent_notifications
    );
}

export function extractCommand(message: string) {
    if (message[0] !== '/') {
        return '';
    }

    const tokens = message.split(' ');
    if (tokens.length > 0) {
        return tokens[0].substring(1);
    }

    return '';
}
export function isStatusSlashCommand(command: string) {
    return command === 'online' || command === 'away' || command === 'dnd' || command === 'offline';
}
