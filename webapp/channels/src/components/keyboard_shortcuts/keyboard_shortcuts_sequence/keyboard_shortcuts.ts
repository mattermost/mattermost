// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MessageDescriptor} from 'react-intl';

import {t} from 'utils/i18n';

export type KeyboardShortcutDescriptor =
	| MessageDescriptor
	| {default: MessageDescriptor; mac?: MessageDescriptor};

export function isMessageDescriptor(
    descriptor: KeyboardShortcutDescriptor,
): descriptor is MessageDescriptor {
    return Boolean((descriptor as MessageDescriptor).id);
}

const callsKBShortcuts = {
    global: {
        callsJoinCall: {
            default: {
                id: t('shortcuts.calls.join_call'),
                defaultMessage: 'Join call in current channel:\tCtrl|Alt|S',
            },
            mac: {
                id: t('shortcuts.calls.join_call.mac'),
                defaultMessage: 'Join call in current channel:\t⌘|⌥|S',
            },
        },
    },
    widget: {
        callsMuteToggle: {
            default: {
                id: t('shortcuts.calls.mute_toggle'),
                defaultMessage: 'Mute or unmute:\tCtrl|Shift|Space',
            },
            mac: {
                id: t('shortcuts.calls.mute_toggle.mac'),
                defaultMessage: 'Mute or unmute:\t⌘|Shift|Space',
            },
        },
        callsRaiseHandToggle: {
            default: {
                id: t('shortcuts.calls.raise_hand_toggle'),
                defaultMessage: 'Raise or lower hand:\tCtrl|Shift|Y',
            },
            mac: {
                id: t('shortcuts.calls.raise_hand_toggle.mac'),
                defaultMessage: 'Raise or lower hand:\t⌘|Shift|Y',
            },
        },
        callsShareScreenToggle: {
            default: {
                id: t('shortcuts.calls.share_screen_toggle'),
                defaultMessage: 'Share or unshare the screen:\tCtrl|Shift|E',
            },
            mac: {
                id: t('shortcuts.calls.share_screen_toggle.mac'),
                defaultMessage: 'Share or unshare the screen:\t⌘|Shift|E',
            },
        },
        callsParticipantsListToggle: {
            default: {
                id: t('shortcuts.calls.participants_list_toggle'),
                defaultMessage: 'Show or hide participants list:\tAlt|P\tCtrl|Shift|P',
            },
            mac: {
                id: t('shortcuts.calls.participants_list_toggle.mac'),
                defaultMessage: 'Show or hide participants list:\t⌥|P\t⌘|Shift|P',
            },
        },
        callsLeaveCall: {
            default: {
                id: t('shortcuts.calls.leave_call'),
                defaultMessage: 'Leave current call:\tCtrl|Shift|L',
            },
            mac: {
                id: t('shortcuts.calls.leave_call.mac'),
                defaultMessage: 'Leave current call:\t⌘|Shift|L',
            },
        },
    },
    popout: {
        callsPushToTalk: {
            default: {
                id: t('shortcuts.calls.push_to_talk'),
                defaultMessage: 'Hold to unmute (push to talk):\tSpace',
            },
        },
    },
};

export const KEYBOARD_SHORTCUTS = {
    mainHeader: {
        default: {
            id: t('shortcuts.header'),
            defaultMessage: 'Keyboard shortcuts\tCtrl|/',
        },
        mac: {
            id: t('shortcuts.header.mac'),
            defaultMessage: 'Keyboard shortcuts\t⌘|/',
        },
    },
    navPrev: {
        default: {
            id: t('shortcuts.nav.prev'),
            defaultMessage: 'Previous channel:\tAlt|Up',
        },
        mac: {
            id: t('shortcuts.nav.prev.mac'),
            defaultMessage: 'Previous channel:\t⌥|Up',
        },
    },
    navNext: {
        default: {
            id: t('shortcuts.nav.next'),
            defaultMessage: 'Next channel:\tAlt|Down',
        },
        mac: {
            id: t('shortcuts.nav.next.mac'),
            defaultMessage: 'Next channel:\t⌥|Down',
        },
    },
    navUnreadPrev: {
        default: {
            id: t('shortcuts.nav.unread_prev'),
            defaultMessage: 'Previous unread channel:\tAlt|Shift|Up',
        },
        mac: {
            id: t('shortcuts.nav.unread_prev.mac'),
            defaultMessage: 'Previous unread channel:\t⌥|Shift|Up',
        },
    },
    navUnreadNext: {
        default: {
            id: t('shortcuts.nav.unread_next'),
            defaultMessage: 'Next unread channel:\tAlt|Shift|Down',
        },
        mac: {
            id: t('shortcuts.nav.unread_next.mac'),
            defaultMessage: 'Next unread channel:\t⌥|Shift|Down',
        },
    },
    teamNavPrev: {
        default: {
            id: t('shortcuts.team_nav.prev'),
            defaultMessage: 'Previous team:\tCtrl|Alt|Up',
        },
        mac: {
            id: t('shortcuts.team_nav.prev.mac'),
            defaultMessage: 'Previous team:\t⌘|⌥|Up',
        },
    },
    teamNavNext: {
        default: {
            id: t('shortcuts.team_nav.next'),
            defaultMessage: 'Next team:\tCtrl|Alt|Down',
        },
        mac: {
            id: t('shortcuts.team_nav.next.mac'),
            defaultMessage: 'Next team:\t⌘|⌥|Down',
        },
    },
    teamNavSwitcher: {
        default: {
            id: t('shortcuts.team_nav.switcher'),
            defaultMessage: 'Navigate to a specific team:\tCtrl|Alt|[1-9]',
        },
        mac: {
            id: t('shortcuts.team_nav.switcher.mac'),
            defaultMessage: 'Navigate to a specific team:\t⌘|⌥|[1-9]',
        },
    },
    teamNavigation: {
        default: {
            id: t('team.button.tooltip'),
            defaultMessage: 'Ctrl|Alt|{order}',
        },
        mac: {
            id: t('team.button.tooltip.mac'),
            defaultMessage: '⌘|⌥|{order}',
        },
    },
    navSwitcher: {
        default: {
            id: t('shortcuts.nav.switcher'),
            defaultMessage: 'Quick channel navigation:\tCtrl|K',
        },
        mac: {
            id: t('shortcuts.nav.switcher.mac'),
            defaultMessage: 'Quick channel navigation:\t⌘|K',
        },
    },
    navDMMenu: {
        default: {
            id: t('shortcuts.nav.direct_messages_menu'),
            defaultMessage: 'Direct messages menu:\tCtrl|Shift|K',
        },
        mac: {
            id: t('shortcuts.nav.direct_messages_menu.mac'),
            defaultMessage: 'Direct messages menu:\t⌘|Shift|K',
        },
    },
    navSettings: {
        default: {
            id: t('shortcuts.nav.settings'),
            defaultMessage: 'Settings:\tCtrl|Shift|A',
        },
        mac: {
            id: t('shortcuts.nav.settings.mac'),
            defaultMessage: 'Settings:\t⌘|Shift|A',
        },
    },
    navMentions: {
        default: {
            id: t('shortcuts.nav.recent_mentions'),
            defaultMessage: 'Recent mentions:\tCtrl|Shift|M',
        },
        mac: {
            id: t('shortcuts.nav.recent_mentions.mac'),
            defaultMessage: 'Recent mentions:\t⌘|Shift|M',
        },
    },
    navFocusCenter: {
        default: {
            id: t('shortcuts.nav.focus_center'),
            defaultMessage: 'Set focus to input field:\tCtrl|Shift|L',
        },
        mac: {
            id: t('shortcuts.nav.focus_center.mac'),
            defaultMessage: 'Set focus to input field:\t⌘|Shift|L',
        },
    },
    navOpenCloseSidebar: {
        default: {
            id: t('shortcuts.nav.open_close_sidebar'),
            defaultMessage: 'Open or close the right sidebar:\tCtrl|.',
        },
        mac: {
            id: t('shortcuts.nav.open_close_sidebar.mac'),
            defaultMessage: 'Open or close the right sidebar:\t⌘|.',
        },
    },
    navExpandSidebar: {
        default: {
            id: t('shortcuts.nav.expand_sidebar'),
            defaultMessage: 'Expand the right sidebar:\tCtrl|Shift|.',
        },
        mac: {
            id: t('shortcuts.nav.expand_sidebar.mac'),
            defaultMessage: 'Expand the right sidebar:\t⌘|Shift|.',
        },
    },
    navOpenChannelInfo: {
        default: {
            id: t('shortcuts.nav.open_channel_info'),
            defaultMessage: 'View channel info:\tCtrl|Alt|I',
        },
        mac: {
            id: t('shortcuts.nav.open_channel_info.mac'),
            defaultMessage: 'View channel info:\t⌘|Shift|I',
        },
    },
    navToggleUnreads: {
        default: {
            id: t('shortcuts.nav.toggle_unreads'),
            defaultMessage: 'Toggle unread/all channels:\tCtrl|Shift|U',
        },
        mac: {
            id: t('shortcuts.nav.toggle_unreads.mac'),
            defaultMessage: 'Toggle unread/all channels:\t⌘|Shift|U',
        },
    },
    msgEdit: {
        id: t('shortcuts.msgs.edit'),
        defaultMessage: 'Edit last message in channel:\tUp',
    },
    msgReply: {
        id: t('shortcuts.msgs.reply'),
        defaultMessage: 'Reply to last message in channel:\tShift|Up',
    },
    msgReprintPrev: {
        default: {
            id: t('shortcuts.msgs.reprint_prev'),
            defaultMessage: 'Reprint previous message:\tCtrl|Up',
        },
        mac: {
            id: t('shortcuts.msgs.reprint_prev.mac'),
            defaultMessage: 'Reprint previous message:\t⌘|Up',
        },
    },
    msgReprintNext: {
        default: {
            id: t('shortcuts.msgs.reprint_next'),
            defaultMessage: 'Reprint next message:\tCtrl|Down',
        },
        mac: {
            id: t('shortcuts.msgs.reprint_next.mac'),
            defaultMessage: 'Reprint next message:\t⌘|Down',
        },
    },
    msgCompUsername: {
        id: t('shortcuts.msgs.comp.username'),
        defaultMessage: 'Username:\t@|[a-z]|Tab',
    },
    msgCompChannel: {
        id: t('shortcuts.msgs.comp.channel'),
        defaultMessage: 'Channel:\t~|[a-z]|Tab',
    },
    msgCompEmoji: {
        id: t('shortcuts.msgs.comp.emoji'),
        defaultMessage: 'Emoji:\t:|[a-z]|Tab',
    },
    msgLastReaction: {
        default: {
            id: t('shortcuts.msgs.comp.last_reaction'),
            defaultMessage: 'React to last message:\tCtrl|Shift|\u29F5',
        },
        mac: {
            id: t('shortcuts.msgs.comp.last_reaction.mac'),
            defaultMessage: 'React to last message:\t⌘|Shift|\u29F5',
        },
    },
    msgMarkdownBold: {
        default: {
            id: t('shortcuts.msgs.markdown.bold'),
            defaultMessage: 'Bold:\tCtrl|B',
        },
        mac: {
            id: t('shortcuts.msgs.markdown.bold.mac'),
            defaultMessage: 'Bold:\t⌘|B',
        },
    },
    msgMarkdownCode: {
        default: {
            id: t('shortcuts.msgs.markdown.code'),
            defaultMessage: 'Code',
        },
        mac: {
            id: t('shortcuts.msgs.markdown.code.mac'),
            defaultMessage: 'Code',
        },
    },
    msgMarkdownStrike: {
        default: {
            id: t('shortcuts.msgs.markdown.strike'),
            defaultMessage: 'Strikethrough:\tCtrl|Shift|X',
        },
        mac: {
            id: t('shortcuts.msgs.markdown.strike.mac'),
            defaultMessage: 'Strikethrough:\t⌘|Shift|X',
        },
    },
    msgMarkdownH3: {
        default: {
            id: t('shortcuts.msgs.markdown.h3'),
            defaultMessage: 'Heading',
        },
        mac: {
            id: t('shortcuts.msgs.markdown.h3.mac'),
            defaultMessage: 'Heading',
        },
    },
    msgMarkdownQuote: {
        default: {
            id: t('shortcuts.msgs.markdown.quote'),
            defaultMessage: 'Quote',
        },
        mac: {
            id: t('shortcuts.msgs.markdown.quote.mac'),
            defaultMessage: 'Quote',
        },
    },
    msgMarkdownOl: {
        default: {
            id: t('shortcuts.msgs.markdown.ordered'),
            defaultMessage: 'Numbered List',
        },
        mac: {
            id: t('shortcuts.msgs.markdown.ordered.mac'),
            defaultMessage: 'Numbered List',
        },
    },
    msgMarkdownUl: {
        default: {
            id: t('shortcuts.msgs.markdown.unordered'),
            defaultMessage: 'Bulleted List',
        },
        mac: {
            id: t('shortcuts.msgs.markdown.unordered.mac'),
            defaultMessage: 'Bulleted List',
        },
    },
    msgShowFormatting: {
        default: {
            id: t('shortcuts.msgs.markdown.formatting.show'),
            defaultMessage: 'Show Formatting:\tCtrl|Alt|T',
        },
        mac: {
            id: t('shortcuts.msgs.markdown.formatting.show.mac'),
            defaultMessage: 'Show Formatting:\t⌘|⌥|T',
        },
    },
    msgHideFormatting: {
        default: {
            id: t('shortcuts.msgs.markdown.formatting.hide'),
            defaultMessage: 'Hide Formatting:\tCtrl|Alt|T',
        },
        mac: {
            id: t('shortcuts.msgs.markdown.formatting.hide.mac'),
            defaultMessage: 'Hide Formatting:\t⌘|⌥|T',
        },
    },
    msgShowEmojiPicker: {
        default: {
            id: t('shortcuts.msgs.markdown.emoji'),
            defaultMessage: 'Emoji / Gif picker:\tCtrl|Shift|E',
        },
        mac: {
            id: t('shortcuts.msgs.markdown.emoji.mac'),
            defaultMessage: 'Emoji / Gif picker:\t⌘|Shift|E',
        },
    },
    msgMarkdownPreview: {
        default: {
            id: t('shortcuts.msgs.markdown.preview'),
            defaultMessage: 'Show/Hide Preview:\tCtrl|Alt|P',
        },
        mac: {
            id: t('shortcuts.msgs.markdown.preview.mac'),
            defaultMessage: 'Show/Hide Preview:\t⌘|Shift|P',
        },
    },
    msgMarkdownItalic: {
        default: {
            id: t('shortcuts.msgs.markdown.italic'),
            defaultMessage: 'Italic:\tCtrl|I',
        },
        mac: {
            id: t('shortcuts.msgs.markdown.italic.mac'),
            defaultMessage: 'Italic:\t⌘|I',
        },
    },
    msgMarkdownLink: {
        default: {
            id: t('shortcuts.msgs.markdown.link'),
            defaultMessage: 'Link:\tCtrl|Alt|K',
        },
        mac: {
            id: t('shortcuts.msgs.markdown.link.mac'),
            defaultMessage: 'Link:\t⌘|⌥|K',
        },
    },
    filesUpload: {
        default: {
            id: t('shortcuts.files.upload'),
            defaultMessage: 'Upload files:\tCtrl|U',
        },
        mac: {
            id: t('shortcuts.files.upload.mac'),
            defaultMessage: 'Upload files:\t⌘|U',
        },
    },
    browserChannelPrev: {
        default: {
            id: t('shortcuts.browser.channel_prev'),
            defaultMessage: 'Back in history:\tAlt|Left',
        },
        mac: {
            id: t('shortcuts.browser.channel_prev.mac'),
            defaultMessage: 'Back in history:\t⌘|[',
        },
    },
    browserChannelNext: {
        default: {
            id: t('shortcuts.browser.channel_next'),
            defaultMessage: 'Forward in history:\tAlt|Right',
        },
        mac: {
            id: t('shortcuts.browser.channel_next.mac'),
            defaultMessage: 'Forward in history:\t⌘|]',
        },
    },
    browserFontIncrease: {
        default: {
            id: t('shortcuts.browser.font_increase'),
            defaultMessage: 'Zoom in:\tCtrl|+',
        },
        mac: {
            id: t('shortcuts.browser.font_increase.mac'),
            defaultMessage: 'Zoom in:\t⌘|+',
        },
    },
    browserFontDecrease: {
        default: {
            id: t('shortcuts.browser.font_decrease'),
            defaultMessage: 'Zoom out:\tCtrl|-',
        },
        mac: {
            id: t('shortcuts.browser.font_decrease.mac'),
            defaultMessage: 'Zoom out:\t⌘|-',
        },
    },
    browserHighlightPrev: {
        id: t('shortcuts.browser.highlight_prev'),
        defaultMessage: 'Highlight text to the previous line:\tShift|Up',
    },
    browserHighlightNext: {
        id: t('shortcuts.browser.highlight_next'),
        defaultMessage: 'Highlight text to the next line:\tShift|Down',
    },
    browserNewline: {
        id: t('shortcuts.browser.newline'),
        defaultMessage: 'Create a new line:\tShift|Enter',
    },
    msgSearchChannel: {
        default: {
            id: t('shortcuts.msgs.search_channel'),
            defaultMessage: 'In channel:\tCtrl|F',
        },
        mac: {
            id: t('shortcuts.msgs.search_channel.mac'),
            defaultMessage: 'In channel:\t⌘|F',
        },
    },
    msgPostPriority: {
        default: {
            id: t('shortcuts.msgs.formatting_bar.post_priority'),
            defaultMessage: 'Message priority',
        },
        mac: {
            id: t('shortcuts.msgs.formatting_bar.post_priority'),
            defaultMessage: 'Message priority',
        },
    },
    calls: callsKBShortcuts,
};
