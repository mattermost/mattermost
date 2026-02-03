// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Shared preference definitions for user settings and admin preference overrides.
 * This file is the single source of truth for preference options, labels, and descriptions.
 * Both user_settings_display.tsx and preference_overrides_dashboard.tsx should import from here.
 */

import {defineMessage} from 'react-intl';
import type {MessageDescriptor} from 'react-intl';

// Re-export constants for preference names
export const PreferenceNames = {
    // Display settings
    USE_MILITARY_TIME: 'use_military_time',
    CHANNEL_DISPLAY_MODE: 'channel_display_mode',
    MESSAGE_DISPLAY: 'message_display',
    COLLAPSE_DISPLAY: 'collapse_previews',
    LINK_PREVIEW_DISPLAY: 'link_preview_display',
    COLORIZE_USERNAMES: 'colorize_usernames',
    NAME_FORMAT: 'name_format',
    AVAILABILITY_STATUS_ON_POSTS: 'availability_status_on_posts',
    COLLAPSED_REPLY_THREADS: 'collapsed_reply_threads',
    CLICK_TO_REPLY: 'click_to_reply',
    ONE_CLICK_REACTIONS_ENABLED: 'one_click_reactions_enabled',
    ALWAYS_SHOW_REMOTE_USER_HOUR: 'always_show_remote_user_hour',
    RENDER_EMOTICONS_AS_EMOJI: 'render_emoticons_as_emoji',

    // Notifications
    EMAIL_INTERVAL: 'email_interval',

    // Advanced settings
    FORMATTING: 'formatting',
    SEND_ON_CTRL_ENTER: 'send_on_ctrl_enter',
    CODE_BLOCK_CTRL_ENTER: 'code_block_ctrl_enter',
    JOIN_LEAVE: 'join_leave',
    SYNC_DRAFTS: 'sync_drafts',
    UNREAD_SCROLL_POSITION: 'unread_scroll_position',

    // Sidebar settings
    SHOW_UNREAD_SECTION: 'show_unread_section',
    LIMIT_VISIBLE_DMS_GMS: 'limit_visible_dms_gms',
} as const;

export type PreferenceOption = {
    value: string;
    label: MessageDescriptor;
    description?: MessageDescriptor;
};

export type PreferenceDefinition = {
    category: string;
    name: string;
    title: MessageDescriptor;
    description: MessageDescriptor;
    options: PreferenceOption[];
    defaultValue: string;
};

/**
 * Complete preference definitions with all options, labels, and descriptions.
 * The key format is "category:name" to match the database storage format.
 */
export const PREFERENCE_DEFINITIONS: Record<string, PreferenceDefinition> = {
    // Display Settings
    'display_settings:use_military_time': {
        category: 'display_settings',
        name: 'use_military_time',
        title: defineMessage({
            id: 'user.settings.display.clockDisplay',
            defaultMessage: 'Clock Display',
        }),
        description: defineMessage({
            id: 'user.settings.display.preferTime',
            defaultMessage: 'Select how you prefer time displayed.',
        }),
        options: [
            {
                value: 'false',
                label: defineMessage({
                    id: 'user.settings.display.normalClock',
                    defaultMessage: '12-hour clock (example: 4:00 PM)',
                }),
            },
            {
                value: 'true',
                label: defineMessage({
                    id: 'user.settings.display.militaryClock',
                    defaultMessage: '24-hour clock (example: 16:00)',
                }),
            },
        ],
        defaultValue: 'false',
    },

    'display_settings:channel_display_mode': {
        category: 'display_settings',
        name: 'channel_display_mode',
        title: defineMessage({
            id: 'user.settings.display.channelDisplayTitle',
            defaultMessage: 'Channel Display',
        }),
        description: defineMessage({
            id: 'user.settings.display.channeldisplaymode',
            defaultMessage: 'Select the width of the center channel.',
        }),
        options: [
            {
                value: 'full',
                label: defineMessage({
                    id: 'user.settings.display.fullScreen',
                    defaultMessage: 'Full width',
                }),
            },
            {
                value: 'centered',
                label: defineMessage({
                    id: 'user.settings.display.fixedWidthCentered',
                    defaultMessage: 'Fixed width, centered',
                }),
            },
        ],
        defaultValue: 'full',
    },

    'display_settings:message_display': {
        category: 'display_settings',
        name: 'message_display',
        title: defineMessage({
            id: 'user.settings.display.messageDisplayTitle',
            defaultMessage: 'Message Display',
        }),
        description: defineMessage({
            id: 'user.settings.display.messageDisplayDescription',
            defaultMessage: 'Select how messages in a channel should be displayed.',
        }),
        options: [
            {
                value: 'clean',
                label: defineMessage({
                    id: 'user.settings.display.messageDisplayClean',
                    defaultMessage: 'Standard',
                }),
            },
            {
                value: 'compact',
                label: defineMessage({
                    id: 'user.settings.display.messageDisplayCompact',
                    defaultMessage: 'Compact',
                }),
            },
        ],
        defaultValue: 'clean',
    },

    'display_settings:collapse_previews': {
        category: 'display_settings',
        name: 'collapse_previews',
        title: defineMessage({
            id: 'user.settings.display.collapseDisplay',
            defaultMessage: 'Default Appearance of Image Previews',
        }),
        description: defineMessage({
            id: 'user.settings.display.collapseDesc',
            defaultMessage: 'Set whether previews of image links and image attachment thumbnails show as expanded or collapsed by default. This setting can also be controlled using the slash commands /expand and /collapse.',
        }),
        options: [
            {
                value: 'false',
                label: defineMessage({
                    id: 'user.settings.display.collapseOn',
                    defaultMessage: 'Expanded',
                }),
            },
            {
                value: 'true',
                label: defineMessage({
                    id: 'user.settings.display.collapseOff',
                    defaultMessage: 'Collapsed',
                }),
            },
        ],
        defaultValue: 'false',
    },

    'display_settings:link_preview_display': {
        category: 'display_settings',
        name: 'link_preview_display',
        title: defineMessage({
            id: 'user.settings.display.linkPreviewDisplay',
            defaultMessage: 'Website Link Previews',
        }),
        description: defineMessage({
            id: 'user.settings.display.linkPreviewDesc',
            defaultMessage: 'When available, the first web link in a message will show a preview of the website content below the message.',
        }),
        options: [
            {
                value: 'true',
                label: defineMessage({
                    id: 'user.settings.display.linkPreviewOn',
                    defaultMessage: 'On',
                }),
            },
            {
                value: 'false',
                label: defineMessage({
                    id: 'user.settings.display.linkPreviewOff',
                    defaultMessage: 'Off',
                }),
            },
        ],
        defaultValue: 'true',
    },

    'display_settings:colorize_usernames': {
        category: 'display_settings',
        name: 'colorize_usernames',
        title: defineMessage({
            id: 'user.settings.display.colorize',
            defaultMessage: 'Colorize usernames',
        }),
        description: defineMessage({
            id: 'user.settings.display.colorizeDes',
            defaultMessage: 'Use colors to distinguish users in compact mode',
        }),
        options: [
            {
                value: 'true',
                label: defineMessage({
                    id: 'user.settings.sidebar.on',
                    defaultMessage: 'On',
                }),
            },
            {
                value: 'false',
                label: defineMessage({
                    id: 'user.settings.sidebar.off',
                    defaultMessage: 'Off',
                }),
            },
        ],
        defaultValue: 'false',
    },

    'display_settings:name_format': {
        category: 'display_settings',
        name: 'name_format',
        title: defineMessage({
            id: 'user.settings.display.teammateNameDisplayTitle',
            defaultMessage: 'Teammate Name Display',
        }),
        description: defineMessage({
            id: 'user.settings.display.teammateNameDisplayDescription',
            defaultMessage: "Set how to display other user's names in posts and the Direct Messages list.",
        }),
        options: [
            {
                value: 'username',
                label: defineMessage({
                    id: 'user.settings.display.teammateNameDisplayUsername',
                    defaultMessage: 'Show username',
                }),
            },
            {
                value: 'nickname_full_name',
                label: defineMessage({
                    id: 'user.settings.display.teammateNameDisplayNicknameFullname',
                    defaultMessage: 'Show nickname if one exists, otherwise show first and last name',
                }),
            },
            {
                value: 'full_name',
                label: defineMessage({
                    id: 'user.settings.display.teammateNameDisplayFullname',
                    defaultMessage: 'Show first and last name',
                }),
            },
        ],
        defaultValue: 'username',
    },

    'display_settings:availability_status_on_posts': {
        category: 'display_settings',
        name: 'availability_status_on_posts',
        title: defineMessage({
            id: 'user.settings.display.availabilityStatusOnPostsTitle',
            defaultMessage: 'Show user availability on posts',
        }),
        description: defineMessage({
            id: 'user.settings.display.availabilityStatusOnPostsDescription',
            defaultMessage: 'When enabled, online availability is displayed on profile images in the message list.',
        }),
        options: [
            {
                value: 'true',
                label: defineMessage({
                    id: 'user.settings.sidebar.on',
                    defaultMessage: 'On',
                }),
            },
            {
                value: 'false',
                label: defineMessage({
                    id: 'user.settings.sidebar.off',
                    defaultMessage: 'Off',
                }),
            },
        ],
        defaultValue: 'true',
    },

    'display_settings:collapsed_reply_threads': {
        category: 'display_settings',
        name: 'collapsed_reply_threads',
        title: defineMessage({
            id: 'user.settings.display.collapsedReplyThreadsTitle',
            defaultMessage: 'Threaded Discussions',
        }),
        description: defineMessage({
            id: 'user.settings.display.collapsedReplyThreadsDescription',
            defaultMessage: "When enabled, reply messages are not shown in the channel and you'll be notified about threads you're following in the \"Threads\" view.",
        }),
        options: [
            {
                value: 'on',
                label: defineMessage({
                    id: 'user.settings.display.collapsedReplyThreadsOn',
                    defaultMessage: 'On',
                }),
            },
            {
                value: 'off',
                label: defineMessage({
                    id: 'user.settings.display.collapsedReplyThreadsOff',
                    defaultMessage: 'Off',
                }),
            },
        ],
        defaultValue: 'off',
    },

    'display_settings:click_to_reply': {
        category: 'display_settings',
        name: 'click_to_reply',
        title: defineMessage({
            id: 'user.settings.display.clickToReply',
            defaultMessage: 'Click to open threads',
        }),
        description: defineMessage({
            id: 'user.settings.display.clickToReplyDescription',
            defaultMessage: 'When enabled, click anywhere on a message to open the reply thread.',
        }),
        options: [
            {
                value: 'true',
                label: defineMessage({
                    id: 'user.settings.sidebar.on',
                    defaultMessage: 'On',
                }),
            },
            {
                value: 'false',
                label: defineMessage({
                    id: 'user.settings.sidebar.off',
                    defaultMessage: 'Off',
                }),
            },
        ],
        defaultValue: 'true',
    },

    'display_settings:one_click_reactions_enabled': {
        category: 'display_settings',
        name: 'one_click_reactions_enabled',
        title: defineMessage({
            id: 'user.settings.display.oneClickReactionsOnPostsTitle',
            defaultMessage: 'Quick reactions on messages',
        }),
        description: defineMessage({
            id: 'user.settings.display.oneClickReactionsOnPostsDescription',
            defaultMessage: 'When enabled, you can react in one-click with recently used reactions when hovering over a message.',
        }),
        options: [
            {
                value: 'true',
                label: defineMessage({
                    id: 'user.settings.sidebar.on',
                    defaultMessage: 'On',
                }),
            },
            {
                value: 'false',
                label: defineMessage({
                    id: 'user.settings.sidebar.off',
                    defaultMessage: 'Off',
                }),
            },
        ],
        defaultValue: 'true',
    },

    'display_settings:always_show_remote_user_hour': {
        category: 'display_settings',
        name: 'always_show_remote_user_hour',
        title: defineMessage({
            id: 'user.settings.display.alwaysShowRemoteUserHourTitle',
            defaultMessage: 'Teammate Time Display',
        }),
        description: defineMessage({
            id: 'user.settings.display.alwaysShowRemoteUserHourDescription',
            defaultMessage: "Select whether to always show the teammate's local time in Direct Messages, or only when it is outside of their normal working hours.",
        }),
        options: [
            {
                value: 'true',
                label: defineMessage({
                    id: 'user.settings.display.alwaysShowRemoteUserHourOn',
                    defaultMessage: 'Always show',
                }),
            },
            {
                value: 'false',
                label: defineMessage({
                    id: 'user.settings.display.alwaysShowRemoteUserHourOff',
                    defaultMessage: 'Only show when it is late or early for the teammate',
                }),
            },
        ],
        defaultValue: 'false',
    },

    'display_settings:render_emoticons_as_emoji': {
        category: 'display_settings',
        name: 'render_emoticons_as_emoji',
        title: defineMessage({
            id: 'user.settings.display.renderEmoticonsAsEmojiTitle',
            defaultMessage: 'Render emoticons as emojis',
        }),
        description: defineMessage({
            id: 'user.settings.display.renderEmoticonsAsEmojiDescription',
            defaultMessage: 'When enabled, text emoticons like :) will be converted to emojis.',
        }),
        options: [
            {
                value: 'true',
                label: defineMessage({
                    id: 'user.settings.advance.on',
                    defaultMessage: 'On',
                }),
            },
            {
                value: 'false',
                label: defineMessage({
                    id: 'user.settings.advance.off',
                    defaultMessage: 'Off',
                }),
            },
        ],
        defaultValue: 'true',
    },

    // Notification Settings
    'notifications:email_interval': {
        category: 'notifications',
        name: 'email_interval',
        title: defineMessage({
            id: 'user.settings.notifications.emailInterval.title',
            defaultMessage: 'Email Notifications',
        }),
        description: defineMessage({
            id: 'user.settings.notifications.emailInterval.description',
            defaultMessage: 'How often to receive email notifications for mentions and direct messages.',
        }),
        options: [
            {
                value: '30',
                label: defineMessage({
                    id: 'user.settings.notifications.emailInterval.immediately',
                    defaultMessage: 'Immediately',
                }),
            },
            {
                value: '900',
                label: defineMessage({
                    id: 'user.settings.notifications.emailInterval.fifteenMinutes',
                    defaultMessage: 'Every 15 minutes',
                }),
            },
            {
                value: '3600',
                label: defineMessage({
                    id: 'user.settings.notifications.emailInterval.everyHour',
                    defaultMessage: 'Every hour',
                }),
            },
            {
                value: '0',
                label: defineMessage({
                    id: 'user.settings.notifications.emailInterval.never',
                    defaultMessage: 'Never',
                }),
            },
        ],
        defaultValue: '30',
    },

    // Advanced Settings
    'advanced_settings:formatting': {
        category: 'advanced_settings',
        name: 'formatting',
        title: defineMessage({
            id: 'user.settings.advance.formattingTitle',
            defaultMessage: 'Enable Post Formatting',
        }),
        description: defineMessage({
            id: 'user.settings.advance.formattingDesc',
            defaultMessage: 'Format posts with links, emoji, text styling, and line breaks.',
        }),
        options: [
            {
                value: 'true',
                label: defineMessage({
                    id: 'user.settings.advance.on',
                    defaultMessage: 'On',
                }),
            },
            {
                value: 'false',
                label: defineMessage({
                    id: 'user.settings.advance.off',
                    defaultMessage: 'Off',
                }),
            },
        ],
        defaultValue: 'true',
    },

    'advanced_settings:send_on_ctrl_enter': {
        category: 'advanced_settings',
        name: 'send_on_ctrl_enter',
        title: defineMessage({
            id: 'user.settings.advance.sendTitle',
            defaultMessage: 'Send Messages on CTRL+ENTER',
        }),
        description: defineMessage({
            id: 'user.settings.advance.sendDesc',
            defaultMessage: 'When enabled, CTRL+ENTER sends the message and ENTER inserts a new line.',
        }),
        options: [
            {
                value: 'true',
                label: defineMessage({
                    id: 'user.settings.advance.on',
                    defaultMessage: 'On',
                }),
            },
            {
                value: 'false',
                label: defineMessage({
                    id: 'user.settings.advance.off',
                    defaultMessage: 'Off',
                }),
            },
        ],
        defaultValue: 'false',
    },

    'advanced_settings:code_block_ctrl_enter': {
        category: 'advanced_settings',
        name: 'code_block_ctrl_enter',
        title: defineMessage({
            id: 'user.settings.advance.codeBlockTitle',
            defaultMessage: 'CTRL+ENTER for Code Blocks',
        }),
        description: defineMessage({
            id: 'user.settings.advance.codeBlockDesc',
            defaultMessage: 'When enabled, CTRL+ENTER is required to send messages starting with ```.',
        }),
        options: [
            {
                value: 'true',
                label: defineMessage({
                    id: 'user.settings.advance.on',
                    defaultMessage: 'On',
                }),
            },
            {
                value: 'false',
                label: defineMessage({
                    id: 'user.settings.advance.off',
                    defaultMessage: 'Off',
                }),
            },
        ],
        defaultValue: 'true',
    },

    'advanced_settings:join_leave': {
        category: 'advanced_settings',
        name: 'join_leave',
        title: defineMessage({
            id: 'user.settings.advance.joinLeaveTitle',
            defaultMessage: 'Enable Join/Leave Messages',
        }),
        description: defineMessage({
            id: 'user.settings.advance.joinLeaveDesc',
            defaultMessage: 'Show system messages when users join or leave channels.',
        }),
        options: [
            {
                value: 'true',
                label: defineMessage({
                    id: 'user.settings.advance.on',
                    defaultMessage: 'On',
                }),
            },
            {
                value: 'false',
                label: defineMessage({
                    id: 'user.settings.advance.off',
                    defaultMessage: 'Off',
                }),
            },
        ],
        defaultValue: 'true',
    },

    'advanced_settings:sync_drafts': {
        category: 'advanced_settings',
        name: 'sync_drafts',
        title: defineMessage({
            id: 'user.settings.advance.syncDrafts.title',
            defaultMessage: 'Sync Drafts',
        }),
        description: defineMessage({
            id: 'user.settings.advance.syncDrafts.desc',
            defaultMessage: 'Sync message drafts with the server so they can be accessed from any device.',
        }),
        options: [
            {
                value: 'true',
                label: defineMessage({
                    id: 'user.settings.advance.on',
                    defaultMessage: 'On',
                }),
            },
            {
                value: 'false',
                label: defineMessage({
                    id: 'user.settings.advance.off',
                    defaultMessage: 'Off',
                }),
            },
        ],
        defaultValue: 'true',
    },

    'advanced_settings:unread_scroll_position': {
        category: 'advanced_settings',
        name: 'unread_scroll_position',
        title: defineMessage({
            id: 'user.settings.advance.unreadScrollPosition.title',
            defaultMessage: 'Unread Scroll Position',
        }),
        description: defineMessage({
            id: 'user.settings.advance.unreadScrollPosition.desc',
            defaultMessage: 'Choose your scroll position when viewing an unread channel.',
        }),
        options: [
            {
                value: 'start_from_left_off',
                label: defineMessage({
                    id: 'user.settings.advance.unreadScrollPosition.startFromLeftOff',
                    defaultMessage: 'Start where I left off',
                }),
            },
            {
                value: 'start_from_newest',
                label: defineMessage({
                    id: 'user.settings.advance.unreadScrollPosition.startFromNewest',
                    defaultMessage: 'Start at newest message',
                }),
            },
        ],
        defaultValue: 'start_from_left_off',
    },

    // Sidebar Settings
    'sidebar_settings:show_unread_section': {
        category: 'sidebar_settings',
        name: 'show_unread_section',
        title: defineMessage({
            id: 'user.settings.sidebar.showUnreadSection.title',
            defaultMessage: 'Group Unread Channels',
        }),
        description: defineMessage({
            id: 'user.settings.sidebar.showUnreadSection.desc',
            defaultMessage: 'Group unread channels in a separate section in the sidebar.',
        }),
        options: [
            {
                value: 'true',
                label: defineMessage({
                    id: 'user.settings.sidebar.on',
                    defaultMessage: 'On',
                }),
            },
            {
                value: 'false',
                label: defineMessage({
                    id: 'user.settings.sidebar.off',
                    defaultMessage: 'Off',
                }),
            },
        ],
        defaultValue: 'true',
    },

    'sidebar_settings:limit_visible_dms_gms': {
        category: 'sidebar_settings',
        name: 'limit_visible_dms_gms',
        title: defineMessage({
            id: 'user.settings.sidebar.limitVisibleDmsGms.title',
            defaultMessage: 'Number of Direct Messages',
        }),
        description: defineMessage({
            id: 'user.settings.sidebar.limitVisibleDmsGms.desc',
            defaultMessage: 'Maximum number of direct/group messages to show in the sidebar.',
        }),
        options: [
            {value: '10', label: defineMessage({id: 'user.settings.sidebar.limitVisibleDmsGms.10', defaultMessage: '10'})},
            {value: '15', label: defineMessage({id: 'user.settings.sidebar.limitVisibleDmsGms.15', defaultMessage: '15'})},
            {value: '20', label: defineMessage({id: 'user.settings.sidebar.limitVisibleDmsGms.20', defaultMessage: '20'})},
            {value: '40', label: defineMessage({id: 'user.settings.sidebar.limitVisibleDmsGms.40', defaultMessage: '40'})},
        ],
        defaultValue: '20',
    },
};

/**
 * Get a preference definition by category and name.
 */
export function getPreferenceDefinition(category: string, name: string): PreferenceDefinition | undefined {
    return PREFERENCE_DEFINITIONS[`${category}:${name}`];
}

/**
 * Get all preference definitions for a category.
 */
export function getPreferenceDefinitionsByCategory(category: string): PreferenceDefinition[] {
    return Object.values(PREFERENCE_DEFINITIONS).filter((def) => def.category === category);
}

/**
 * Check if a preference has a known definition.
 */
export function hasPreferenceDefinition(category: string, name: string): boolean {
    return `${category}:${name}` in PREFERENCE_DEFINITIONS;
}
