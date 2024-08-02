// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineMessage, defineMessages, type MessageDescriptor} from 'react-intl';

export type KeyboardShortcutDescriptor =
	| MessageDescriptor
	| {default: MessageDescriptor; mac?: MessageDescriptor};

const callsKBShortcuts = {
    global: {
        callsJoinCall: defineMessages({
            default: {
                id: 'shortcuts.calls.join_call',
                defaultMessage: 'Join call in current channel:\tCtrl|Alt|S',
            },
            mac: {
                id: 'shortcuts.calls.join_call.mac',
                defaultMessage: 'Join call in current channel:\t⌘|⌥|S',
            },
        }),
    },
    widget: {
        callsMuteToggle: defineMessages({
            default: {
                id: 'shortcuts.calls.mute_toggle',
                defaultMessage: 'Mute or unmute:\tCtrl|Shift|Space',
            },
            mac: {
                id: 'shortcuts.calls.mute_toggle.mac',
                defaultMessage: 'Mute or unmute:\t⌘|Shift|Space',
            },
        }),
        callsRaiseHandToggle: defineMessages({
            default: {
                id: 'shortcuts.calls.raise_hand_toggle',
                defaultMessage: 'Raise or lower hand:\tCtrl|Shift|Y',
            },
            mac: {
                id: 'shortcuts.calls.raise_hand_toggle.mac',
                defaultMessage: 'Raise or lower hand:\t⌘|Shift|Y',
            },
        }),
        callsShareScreenToggle: defineMessages({
            default: {
                id: 'shortcuts.calls.share_screen_toggle',
                defaultMessage: 'Share or unshare the screen:\tCtrl|Shift|E',
            },
            mac: {
                id: 'shortcuts.calls.share_screen_toggle.mac',
                defaultMessage: 'Share or unshare the screen:\t⌘|Shift|E',
            },
        }),
        callsParticipantsListToggle: defineMessages({
            default: {
                id: 'shortcuts.calls.participants_list_toggle',
                defaultMessage: 'Show or hide participants list:\tAlt|P\tCtrl|Shift|P',
            },
            mac: {
                id: 'shortcuts.calls.participants_list_toggle.mac',
                defaultMessage: 'Show or hide participants list:\t⌥|P\t⌘|Shift|P',
            },
        }),
        callsLeaveCall: defineMessages({
            default: {
                id: 'shortcuts.calls.leave_call',
                defaultMessage: 'Leave current call:\tCtrl|Shift|L',
            },
            mac: {
                id: 'shortcuts.calls.leave_call.mac',
                defaultMessage: 'Leave current call:\t⌘|Shift|L',
            },
        }),
    },
    popout: {
        callsPushToTalk: defineMessages({
            default: {
                id: 'shortcuts.calls.push_to_talk',
                defaultMessage: 'Hold to unmute (push to talk):\tSpace',
            },
        }),
    },
};

export const KEYBOARD_SHORTCUTS = {
    mainHeader: defineMessages({
        default: {
            id: 'shortcuts.header',
            defaultMessage: 'Keyboard shortcuts\tCtrl|/',
        },
        mac: {
            id: 'shortcuts.header.mac',
            defaultMessage: 'Keyboard shortcuts\t⌘|/',
        },
    }),
    navPrev: defineMessages({
        default: {
            id: 'shortcuts.nav.prev',
            defaultMessage: 'Previous channel:\tAlt|Up',
        },
        mac: {
            id: 'shortcuts.nav.prev.mac',
            defaultMessage: 'Previous channel:\t⌥|Up',
        },
    }),
    navNext: defineMessages({
        default: {
            id: 'shortcuts.nav.next',
            defaultMessage: 'Next channel:\tAlt|Down',
        },
        mac: {
            id: 'shortcuts.nav.next.mac',
            defaultMessage: 'Next channel:\t⌥|Down',
        },
    }),
    navUnreadPrev: defineMessages({
        default: {
            id: 'shortcuts.nav.unread_prev',
            defaultMessage: 'Previous unread channel:\tAlt|Shift|Up',
        },
        mac: {
            id: 'shortcuts.nav.unread_prev.mac',
            defaultMessage: 'Previous unread channel:\t⌥|Shift|Up',
        },
    }),
    navUnreadNext: defineMessages({
        default: {
            id: 'shortcuts.nav.unread_next',
            defaultMessage: 'Next unread channel:\tAlt|Shift|Down',
        },
        mac: {
            id: 'shortcuts.nav.unread_next.mac',
            defaultMessage: 'Next unread channel:\t⌥|Shift|Down',
        },
    }),
    teamNavPrev: defineMessages({
        default: {
            id: 'shortcuts.team_nav.prev',
            defaultMessage: 'Previous team:\tCtrl|Alt|Up',
        },
        mac: {
            id: 'shortcuts.team_nav.prev.mac',
            defaultMessage: 'Previous team:\t⌘|⌥|Up',
        },
    }),
    teamNavNext: defineMessages({
        default: {
            id: 'shortcuts.team_nav.next',
            defaultMessage: 'Next team:\tCtrl|Alt|Down',
        },
        mac: {
            id: 'shortcuts.team_nav.next.mac',
            defaultMessage: 'Next team:\t⌘|⌥|Down',
        },
    }),
    teamNavSwitcher: defineMessages({
        default: {
            id: 'shortcuts.team_nav.switcher',
            defaultMessage: 'Navigate to a specific team:\tCtrl|Alt|[1-9]',
        },
        mac: {
            id: 'shortcuts.team_nav.switcher.mac',
            defaultMessage: 'Navigate to a specific team:\t⌘|⌥|[1-9]',
        },
    }),
    navSwitcher: defineMessages({
        default: {
            id: 'shortcuts.nav.switcher',
            defaultMessage: 'Quick channel navigation:\tCtrl|K',
        },
        mac: {
            id: 'shortcuts.nav.switcher.mac',
            defaultMessage: 'Quick channel navigation:\t⌘|K',
        },
    }),
    navDMMenu: defineMessages({
        default: {
            id: 'shortcuts.nav.direct_messages_menu',
            defaultMessage: 'Direct messages menu:\tCtrl|Shift|K',
        },
        mac: {
            id: 'shortcuts.nav.direct_messages_menu.mac',
            defaultMessage: 'Direct messages menu:\t⌘|Shift|K',
        },
    }),
    navSettings: defineMessages({
        default: {
            id: 'shortcuts.nav.settings',
            defaultMessage: 'Settings:\tCtrl|Shift|A',
        },
        mac: {
            id: 'shortcuts.nav.settings.mac',
            defaultMessage: 'Settings:\t⌘|Shift|A',
        },
    }),
    navMentions: defineMessages({
        default: {
            id: 'shortcuts.nav.recent_mentions',
            defaultMessage: 'Recent mentions:\tCtrl|Shift|M',
        },
        mac: {
            id: 'shortcuts.nav.recent_mentions.mac',
            defaultMessage: 'Recent mentions:\t⌘|Shift|M',
        },
    }),
    navFocusCenter: defineMessages({
        default: {
            id: 'shortcuts.nav.focus_center',
            defaultMessage: 'Set focus to input field:\tCtrl|Shift|L',
        },
        mac: {
            id: 'shortcuts.nav.focus_center.mac',
            defaultMessage: 'Set focus to input field:\t⌘|Shift|L',
        },
    }),
    navOpenCloseSidebar: defineMessages({
        default: {
            id: 'shortcuts.nav.open_close_sidebar',
            defaultMessage: 'Open or close the right sidebar:\tCtrl|.',
        },
        mac: {
            id: 'shortcuts.nav.open_close_sidebar.mac',
            defaultMessage: 'Open or close the right sidebar:\t⌘|.',
        },
    }),
    navExpandSidebar: defineMessages({
        default: {
            id: 'shortcuts.nav.expand_sidebar',
            defaultMessage: 'Expand the right sidebar:\tCtrl|Shift|.',
        },
        mac: {
            id: 'shortcuts.nav.expand_sidebar.mac',
            defaultMessage: 'Expand the right sidebar:\t⌘|Shift|.',
        },
    }),
    navOpenChannelInfo: defineMessages({
        default: {
            id: 'shortcuts.nav.open_channel_info',
            defaultMessage: 'View channel info:\tCtrl|Alt|I',
        },
        mac: {
            id: 'shortcuts.nav.open_channel_info.mac',
            defaultMessage: 'View channel info:\t⌘|Shift|I',
        },
    }),
    navToggleUnreads: defineMessages({
        default: {
            id: 'shortcuts.nav.toggle_unreads',
            defaultMessage: 'Toggle unread/all channels:\tCtrl|Shift|U',
        },
        mac: {
            id: 'shortcuts.nav.toggle_unreads.mac',
            defaultMessage: 'Toggle unread/all channels:\t⌘|Shift|U',
        },
    }),
    msgEdit: defineMessage({
        id: 'shortcuts.msgs.edit',
        defaultMessage: 'Edit last message in channel:\tUp',
    }),
    msgReply: defineMessage({
        id: 'shortcuts.msgs.reply',
        defaultMessage: 'Reply to last message in channel:\tShift|Up',
    }),
    msgReprintPrev: defineMessages({
        default: {
            id: 'shortcuts.msgs.reprint_prev',
            defaultMessage: 'Reprint previous message:\tCtrl|Up',
        },
        mac: {
            id: 'shortcuts.msgs.reprint_prev.mac',
            defaultMessage: 'Reprint previous message:\t⌘|Up',
        },
    }),
    msgReprintNext: defineMessages({
        default: {
            id: 'shortcuts.msgs.reprint_next',
            defaultMessage: 'Reprint next message:\tCtrl|Down',
        },
        mac: {
            id: 'shortcuts.msgs.reprint_next.mac',
            defaultMessage: 'Reprint next message:\t⌘|Down',
        },
    }),
    msgCompUsername: defineMessage({
        id: 'shortcuts.msgs.comp.username',
        defaultMessage: 'Username:\t@|[a-z]|Tab',
    }),
    msgCompChannel: defineMessage({
        id: 'shortcuts.msgs.comp.channel',
        defaultMessage: 'Channel:\t~|[a-z]|Tab',
    }),
    msgCompEmoji: defineMessage({
        id: 'shortcuts.msgs.comp.emoji',
        defaultMessage: 'Emoji:\t:|[a-z]|Tab',
    }),
    msgLastReaction: defineMessages({
        default: {
            id: 'shortcuts.msgs.comp.last_reaction',
            defaultMessage: 'React to last message:\tCtrl|Shift|\u29F5',
        },
        mac: {
            id: 'shortcuts.msgs.comp.last_reaction.mac',
            defaultMessage: 'React to last message:\t⌘|Shift|\u29F5',
        },
    }),
    msgMarkdownBold: defineMessages({
        default: {
            id: 'shortcuts.msgs.markdown.bold',
            defaultMessage: 'Bold:\tCtrl|B',
        },
        mac: {
            id: 'shortcuts.msgs.markdown.bold.mac',
            defaultMessage: 'Bold:\t⌘|B',
        },
    }),
    msgMarkdownCode: defineMessages({
        default: {
            id: 'shortcuts.msgs.markdown.code',
            defaultMessage: 'Code',
        },
        mac: {
            id: 'shortcuts.msgs.markdown.code.mac',
            defaultMessage: 'Code',
        },
    }),
    msgMarkdownStrike: defineMessages({
        default: {
            id: 'shortcuts.msgs.markdown.strike',
            defaultMessage: 'Strikethrough:\tCtrl|Shift|X',
        },
        mac: {
            id: 'shortcuts.msgs.markdown.strike.mac',
            defaultMessage: 'Strikethrough:\t⌘|Shift|X',
        },
    }),
    msgMarkdownH3: defineMessages({
        default: {
            id: 'shortcuts.msgs.markdown.h3',
            defaultMessage: 'Heading',
        },
        mac: {
            id: 'shortcuts.msgs.markdown.h3.mac',
            defaultMessage: 'Heading',
        },
    }),
    msgMarkdownQuote: defineMessages({
        default: {
            id: 'shortcuts.msgs.markdown.quote',
            defaultMessage: 'Quote',
        },
        mac: {
            id: 'shortcuts.msgs.markdown.quote.mac',
            defaultMessage: 'Quote',
        },
    }),
    msgMarkdownOl: defineMessages({
        default: {
            id: 'shortcuts.msgs.markdown.ordered',
            defaultMessage: 'Numbered List',
        },
        mac: {
            id: 'shortcuts.msgs.markdown.ordered.mac',
            defaultMessage: 'Numbered List',
        },
    }),
    msgMarkdownUl: defineMessages({
        default: {
            id: 'shortcuts.msgs.markdown.unordered',
            defaultMessage: 'Bulleted List',
        },
        mac: {
            id: 'shortcuts.msgs.markdown.unordered.mac',
            defaultMessage: 'Bulleted List',
        },
    }),
    msgShowFormatting: defineMessages({
        default: {
            id: 'shortcuts.msgs.markdown.formatting.show',
            defaultMessage: 'Show Formatting:\tCtrl|Alt|T',
        },
        mac: {
            id: 'shortcuts.msgs.markdown.formatting.show.mac',
            defaultMessage: 'Show Formatting:\t⌘|⌥|T',
        },
    }),
    msgHideFormatting: defineMessages({
        default: {
            id: 'shortcuts.msgs.markdown.formatting.hide',
            defaultMessage: 'Hide Formatting:\tCtrl|Alt|T',
        },
        mac: {
            id: 'shortcuts.msgs.markdown.formatting.hide.mac',
            defaultMessage: 'Hide Formatting:\t⌘|⌥|T',
        },
    }),
    msgShowEmojiPicker: defineMessages({
        default: {
            id: 'shortcuts.msgs.markdown.emoji',
            defaultMessage: 'Emoji / Gif picker:\tCtrl|Shift|E',
        },
        mac: {
            id: 'shortcuts.msgs.markdown.emoji.mac',
            defaultMessage: 'Emoji / Gif picker:\t⌘|Shift|E',
        },
    }),
    msgMarkdownPreview: defineMessages({
        default: {
            id: 'shortcuts.msgs.markdown.preview',
            defaultMessage: 'Show/Hide Preview:\tCtrl|Alt|P',
        },
        mac: {
            id: 'shortcuts.msgs.markdown.preview.mac',
            defaultMessage: 'Show/Hide Preview:\t⌘|Shift|P',
        },
    }),
    msgMarkdownItalic: defineMessages({
        default: {
            id: 'shortcuts.msgs.markdown.italic',
            defaultMessage: 'Italic:\tCtrl|I',
        },
        mac: {
            id: 'shortcuts.msgs.markdown.italic.mac',
            defaultMessage: 'Italic:\t⌘|I',
        },
    }),
    msgMarkdownLink: defineMessages({
        default: {
            id: 'shortcuts.msgs.markdown.link',
            defaultMessage: 'Link:\tCtrl|Alt|K',
        },
        mac: {
            id: 'shortcuts.msgs.markdown.link.mac',
            defaultMessage: 'Link:\t⌘|⌥|K',
        },
    }),
    filesUpload: defineMessages({
        default: {
            id: 'shortcuts.files.upload',
            defaultMessage: 'Upload files:\tCtrl|U',
        },
        mac: {
            id: 'shortcuts.files.upload.mac',
            defaultMessage: 'Upload files:\t⌘|U',
        },
    }),
    browserChannelPrev: defineMessages({
        default: {
            id: 'shortcuts.browser.channel_prev',
            defaultMessage: 'Back in history:\tAlt|Left',
        },
        mac: {
            id: 'shortcuts.browser.channel_prev.mac',
            defaultMessage: 'Back in history:\t⌘|[',
        },
    }),
    browserChannelNext: defineMessages({
        default: {
            id: 'shortcuts.browser.channel_next',
            defaultMessage: 'Forward in history:\tAlt|Right',
        },
        mac: {
            id: 'shortcuts.browser.channel_next.mac',
            defaultMessage: 'Forward in history:\t⌘|]',
        },
    }),
    browserFontIncrease: defineMessages({
        default: {
            id: 'shortcuts.browser.font_increase',
            defaultMessage: 'Zoom in:\tCtrl|+',
        },
        mac: {
            id: 'shortcuts.browser.font_increase.mac',
            defaultMessage: 'Zoom in:\t⌘|+',
        },
    }),
    browserFontDecrease: defineMessages({
        default: {
            id: 'shortcuts.browser.font_decrease',
            defaultMessage: 'Zoom out:\tCtrl|-',
        },
        mac: {
            id: 'shortcuts.browser.font_decrease.mac',
            defaultMessage: 'Zoom out:\t⌘|-',
        },
    }),
    browserHighlightPrev: defineMessage({
        id: 'shortcuts.browser.highlight_prev',
        defaultMessage: 'Highlight text to the previous line:\tShift|Up',
    }),
    browserHighlightNext: defineMessage({
        id: 'shortcuts.browser.highlight_next',
        defaultMessage: 'Highlight text to the next line:\tShift|Down',
    }),
    browserNewline: defineMessage({
        id: 'shortcuts.browser.newline',
        defaultMessage: 'Create a new line:\tShift|Enter',
    }),
    msgSearchChannel: defineMessages({
        default: {
            id: 'shortcuts.msgs.search_channel',
            defaultMessage: 'In channel:\tCtrl|F',
        },
        mac: {
            id: 'shortcuts.msgs.search_channel.mac',
            defaultMessage: 'In channel:\t⌘|F',
        },
    }),
    msgPostPriority: defineMessages({
        default: {
            id: 'shortcuts.msgs.formatting_bar.post_priority',
            defaultMessage: 'Message priority',
        },
        mac: {
            id: 'shortcuts.msgs.formatting_bar.post_priority',
            defaultMessage: 'Message priority',
        },
    }),
    calls: callsKBShortcuts,
};
