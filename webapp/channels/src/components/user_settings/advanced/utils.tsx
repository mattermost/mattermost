// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {t} from 'utils/i18n';

import {FieldsetRadio} from 'components/widgets/modals/components/radio_setting_item';
import {FieldsetCheckbox} from 'components/widgets/modals/components/checkbox_setting_item';
import { isMac } from 'utils/user_agent';

export enum AdvanceSettings {
    CTRL_SEND='ctrlSend',
    SEND_ON_CTRL_ENTER= 'send_on_ctrl_enter',
    CODE_BLOCK_CTRL_ENTER= 'code_block_ctrl_enter',
    FORMATTING='formatting',
    JOIN_LEAVE='join_leave',
    NAME_DISABLE_CLIENT_PLUGINS= 'disable_client_plugins',
    NAME_DISABLE_TELEMETRY= 'disable_telemetry',
    NAME_DISABLE_TYPING_MESSAGES= 'disable_typing_messages',
    UNREAD_SCROLL_POSITION= 'unread_scroll_position',

}

export const enum OnAndOff {
    ON= 'on',
    OFF= 'off',
}

export const enum UnreadScrollPosition {
    'LEFT'= 'start_from_left_off',
    'NEWEST'= 'start_from_newest',
}

export const getCtrlSelectedOption = (sendOnCtrlEnter: string, codeBlockOnCtrlEnter: string) => {
    if (sendOnCtrlEnter === 'true' && codeBlockOnCtrlEnter === 'false') {
        return AdvanceSettings.SEND_ON_CTRL_ENTER;
    } else if (sendOnCtrlEnter === 'false' && codeBlockOnCtrlEnter === 'true') {
        return AdvanceSettings.CODE_BLOCK_CTRL_ENTER;
    }
    return OnAndOff.OFF;
};

export const getCtrlSendPreferenceValue = (value: string): {[AdvanceSettings.SEND_ON_CTRL_ENTER]: string;[AdvanceSettings.CODE_BLOCK_CTRL_ENTER]: string} => {
    if (value === AdvanceSettings.SEND_ON_CTRL_ENTER) {
        return {[AdvanceSettings.SEND_ON_CTRL_ENTER]: 'true', [AdvanceSettings.CODE_BLOCK_CTRL_ENTER]: 'false'};
    } else if (value === AdvanceSettings.CODE_BLOCK_CTRL_ENTER) {
        return {[AdvanceSettings.SEND_ON_CTRL_ENTER]: 'false', [AdvanceSettings.CODE_BLOCK_CTRL_ENTER]: 'true'};
    }
    return {[AdvanceSettings.SEND_ON_CTRL_ENTER]: 'false', [AdvanceSettings.CODE_BLOCK_CTRL_ENTER]: 'false'};
};

export const ctrlSendInputFieldData: FieldsetRadio = {
    options: [
        {
            dataTestId: `${AdvanceSettings.CTRL_SEND}-${AdvanceSettings.SEND_ON_CTRL_ENTER}`,
            title: {
                id: 'user.settings.advance.onForAllMessages',
                defaultMessage: 'On for all messages',
            },
            name: `${AdvanceSettings.CTRL_SEND}-${AdvanceSettings.SEND_ON_CTRL_ENTER}`,
            key: `${AdvanceSettings.CTRL_SEND}-${AdvanceSettings.SEND_ON_CTRL_ENTER}`,
            value: AdvanceSettings.SEND_ON_CTRL_ENTER,
        },
        {
            dataTestId: `${AdvanceSettings.CTRL_SEND}-${AdvanceSettings.CODE_BLOCK_CTRL_ENTER}`,
            title: {
                id: 'user.settings.advance.onForCode',
                defaultMessage: 'On only for code blocks starting with ```',
            },
            name: `${AdvanceSettings.CTRL_SEND}-${AdvanceSettings.CODE_BLOCK_CTRL_ENTER}`,
            key: `${AdvanceSettings.CTRL_SEND}-${AdvanceSettings.CODE_BLOCK_CTRL_ENTER}`,
            value: AdvanceSettings.CODE_BLOCK_CTRL_ENTER,
        },
        {
            dataTestId: `${AdvanceSettings.CTRL_SEND}-${OnAndOff.OFF}`,
            title: {
                id: 'user.settings.advance.off',
                defaultMessage: 'Off',
            },
            name: `${AdvanceSettings.CTRL_SEND}-${OnAndOff.OFF}`,
            key: `${AdvanceSettings.CTRL_SEND}-${OnAndOff.OFF}`,
            value: OnAndOff.OFF,
        },
    ],
};

export const FormattingInputFieldData: FieldsetRadio = {
    options: [
        {
            dataTestId: `${AdvanceSettings.FORMATTING}-${OnAndOff.ON}`,
            title: {
                id: 'user.settings.advance.on',
                defaultMessage: 'On',
            },
            name: `${AdvanceSettings.FORMATTING}-${OnAndOff.ON}`,
            key: `${AdvanceSettings.FORMATTING}-${OnAndOff.ON}`,
            value: OnAndOff.ON,
        },
        {
            dataTestId: `${AdvanceSettings.FORMATTING}-${OnAndOff.OFF}`,
            title: {
                id: 'user.settings.advance.off',
                defaultMessage: 'Off',
            },
            name: `${AdvanceSettings.FORMATTING}-${OnAndOff.OFF}`,
            key: `${AdvanceSettings.FORMATTING}-${OnAndOff.OFF}`,
            value: OnAndOff.OFF,
        },
    ],
};

export const JoinLeaveInputFieldData: FieldsetRadio = {
    options: [
        {
            dataTestId: `${AdvanceSettings.JOIN_LEAVE}-${OnAndOff.ON}`,
            title: {
                id: 'user.settings.advance.on',
                defaultMessage: 'On',
            },
            name: `${AdvanceSettings.JOIN_LEAVE}-${OnAndOff.ON}`,
            key: `${AdvanceSettings.JOIN_LEAVE}-${OnAndOff.ON}`,
            value: OnAndOff.ON,
        },
        {
            dataTestId: `${AdvanceSettings.JOIN_LEAVE}-${OnAndOff.OFF}`,
            title: {
                id: 'user.settings.advance.off',
                defaultMessage: 'Off',
            },
            name: `${AdvanceSettings.JOIN_LEAVE}-${OnAndOff.OFF}`,
            key: `${AdvanceSettings.JOIN_LEAVE}-${OnAndOff.OFF}`,
            value: OnAndOff.OFF,
        },
    ],
};

export const UnreadScrollPositionInputFieldData: FieldsetRadio = {
    options: [
        {
            dataTestId: `${AdvanceSettings.UNREAD_SCROLL_POSITION}-${OnAndOff.ON}`,
            title: {
                id: 'user.settings.advance.startFromLeftOff',
                defaultMessage: 'Start me where I left off',
            },
            name: `${AdvanceSettings.UNREAD_SCROLL_POSITION}-${OnAndOff.ON}`,
            key: `${AdvanceSettings.UNREAD_SCROLL_POSITION}-${OnAndOff.ON}`,
            value: UnreadScrollPosition.LEFT,
        },
        {
            dataTestId: `${AdvanceSettings.UNREAD_SCROLL_POSITION}-${OnAndOff.OFF}`,
            title: {
                id: 'user.settings.advance.startFromNewest',
                defaultMessage: 'Start me at the newest message',
            },
            name: `${AdvanceSettings.UNREAD_SCROLL_POSITION}-${OnAndOff.OFF}`,
            key: `${AdvanceSettings.UNREAD_SCROLL_POSITION}-${OnAndOff.OFF}`,
            value: UnreadScrollPosition.NEWEST,
        },
    ],
};

export const getCtrlSendText = () => {
    const description = {
        default: {
            id: t('user.settings.advance.sendDesc'),
            defaultMessage: 'When enabled, CTRL + ENTER will send the message and ENTER inserts a new line.',
        },
        mac: {
            id: t('user.settings.advance.sendDesc.mac'),
            defaultMessage: 'When enabled, ⌘ + ENTER will send the message and ENTER inserts a new line.',
        },
    };
    const title = {
        default: {
            id: t('user.settings.advance.sendTitle'),
            defaultMessage: 'Send Messages on CTRL+ENTER',
        },
        mac: {
            id: t('user.settings.advance.sendTitle.mac'),
            defaultMessage: 'Send Messages on ⌘+ENTER',
        },
    };
    if (isMac()) {
        return {
            ctrlSendTitle: title.mac,
            ctrlSendDesc: description.mac,
        };
    }
    return {
        ctrlSendTitle: title.default,
        ctrlSendDesc: description.default,
    };
};

export const FormattingSectionTitle = {
    id: t('user.settings.advance.formattingTitle'),
    defaultMessage: 'Enable Post Formatting',
};

export const FormattingSectionDesc = {
    id: t('user.settings.advance.formattingDesc'),
    defaultMessage: `If enabled, posts will be formatted to create links, show emoji,
     style the text, and add line breaks. By default, this setting is enabled.`,
};

export const JoinLeaveSectionTitle = {
    id: t('user.settings.advance.joinLeaveTitle'),
    defaultMessage: 'Join/leave messages',
};

export const JoinLeaveSectionDesc = {
    id: t('user.settings.advance.joinLeaveDesc'),
    defaultMessage: 'When enabled, system messages display when users join or leave Mattermost channels.',
};

export const UnreadScrollPositionSectionTitle = {
    id: t('user.settings.advance.unreadScrollPositionTitle'),
    defaultMessage: 'Scroll position when viewing an unread channel',
};

export const UnreadScrollPositionSectionDesc = {
    id: t('user.settings.advance.unreadScrollPositionDesc'),
    defaultMessage: `Choose your scroll position when you view an unread channel.
     Channels will always be marked as read when viewed.`,
};

export const PerformanceDebuggingSectionTitle = {
    id: t('user.settings.advance.performance.title'),
    defaultMessage: 'Performance Debugging',
};

export const PerformanceDebuggingSectionDesc = {
    id: t('user.settings.advance.performance.info1'),
    defaultMessage: `You may enable these settings temporarily to help isolate performance issues while debugging.
     We don't recommend leaving these settings enabled for an extended period of time as they can negatively impact your user experience.
     You may need to refresh the page before these settings take effect.`,
};

export const DebuggingPluginInputFieldData: FieldsetCheckbox = {
    title: {
        id: t('user.settings.advance.performance.disableClientPlugins'),
        defaultMessage: 'Disable Client-side Plugins',
    },
    name: 'plugin',
    dataTestId: 'plugin',
};

export const DebuggingTelemetryInputFieldData: FieldsetCheckbox = {
    title: {
        id: t('user.settings.advance.performance.disableTelemetry'),
        defaultMessage: 'Disable telemetry events sent from the client',
    },
    name: 'telemetry',
    dataTestId: 'telemetry',
};

export const DebuggingTypingInputFieldData: FieldsetCheckbox = {
    title: {
        id: t('user.settings.advance.performance.disableTypingMessages'),
        defaultMessage: 'Disable "User is typing..." messages',
    },
    name: 'typing',
    dataTestId: 'typing',
};
