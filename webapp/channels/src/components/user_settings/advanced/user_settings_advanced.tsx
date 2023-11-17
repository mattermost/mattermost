// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useCallback, useState} from 'react';
import {ActionResult} from 'mattermost-redux/types/actions';
import Constants from 'utils/constants';

import {Preferences} from 'mattermost-redux/constants';

import {UserProfile} from '@mattermost/types/users';
import {PreferenceType} from '@mattermost/types/preferences';
import SectionCreator from 'components/widgets/modals/components/modal_section';
import RadioItemCreator from 'components/widgets/modals/components/radio_setting_item';
import SaveChangesPanel from 'components/widgets/modals/components/save_changes_panel';

import CheckboxItemCreator from 'components/widgets/modals/components/checkbox_setting_item';

import {
    AdvanceSettings,
    ctrlSendInputFieldData,
    DebuggingPluginInputFieldData,
    DebuggingTelemetryInputFieldData,
    DebuggingTypingInputFieldData,
    FormattingInputFieldData,
    FormattingSectionDesc,
    FormattingSectionTitle,
    getCtrlSelectedOption,
    getCtrlSendPreferenceValue,
    getCtrlSendText,
    JoinLeaveInputFieldData,
    JoinLeaveSectionDesc,
    JoinLeaveSectionTitle,
    OnAndOff,
    PerformanceDebuggingSectionDesc,
    PerformanceDebuggingSectionTitle,
    UnreadScrollPositionSectionDesc,
    UnreadScrollPositionSectionTitle,
    UnreadScrollPosition,
    UnreadScrollPositionInputFieldData,
} from './utils';

type SettingsType = {
    [key: string]: string | undefined;
    [AdvanceSettings.SEND_ON_CTRL_ENTER]: string;
    [AdvanceSettings.CODE_BLOCK_CTRL_ENTER]: string;
    [AdvanceSettings.FORMATTING]: string;
    [AdvanceSettings.JOIN_LEAVE]: string;
    [AdvanceSettings.NAME_DISABLE_TYPING_MESSAGES]: string;
    [AdvanceSettings.NAME_DISABLE_TELEMETRY]: string;
    [AdvanceSettings.NAME_DISABLE_CLIENT_PLUGINS]: string;
}

export type Props = {
    currentUser: UserProfile;
    advancedSettingsCategory: PreferenceType[];
    sendOnCtrlEnter: string;
    codeBlockOnCtrlEnter: string;
    formatting: string;
    joinLeave: string;
    unreadScrollPosition: string;
    enablePreviewFeatures: boolean;
    enableUserDeactivation: boolean;
    disableClientPlugins: string;
    disableTelemetry: string;
    disableTypingMessages: string;
    performanceDebuggingEnabled: boolean;
    actions: {
        savePreferences: (userId: string, preferences: PreferenceType[]) => Promise<ActionResult>;
        updateUserActive: (userId: string, active: boolean) => Promise<ActionResult>;
        revokeAllSessionsForUser: (userId: string) => Promise<ActionResult>;
    };
};

export default function AdvancedSettingsDisplay(props: Props) {
    const [haveChanges, setHaveChanges] = useState(false);

    const [settings, setSettings] = useState<SettingsType>({
        [AdvanceSettings.SEND_ON_CTRL_ENTER]: props.sendOnCtrlEnter,
        [AdvanceSettings.CODE_BLOCK_CTRL_ENTER]: props.codeBlockOnCtrlEnter,
        [AdvanceSettings.FORMATTING]: props.formatting,
        [AdvanceSettings.JOIN_LEAVE]: props.joinLeave,
        [AdvanceSettings.NAME_DISABLE_TYPING_MESSAGES]: props.disableTypingMessages,
        [AdvanceSettings.NAME_DISABLE_TELEMETRY]: props.disableTelemetry,
        [AdvanceSettings.NAME_DISABLE_CLIENT_PLUGINS]: props.disableClientPlugins,
    });

    const handleChange = useCallback((values: Record<string, string>) => {
        setSettings({...settings, ...values});
        setHaveChanges(true);
    }, [settings]);

    const handleSubmit = async (): Promise<void> => {
        const preferences: PreferenceType[] = [];
        const {actions, currentUser} = props;
        const userId = currentUser.id;

        Object.keys(settings).forEach((setting) => {
            let category = Constants.Preferences.CATEGORY_ADVANCED_SETTINGS;
            if (setting === Preferences.NAME_DISABLE_CLIENT_PLUGINS ||
                setting === Preferences.NAME_DISABLE_TELEMETRY ||
                setting === Preferences.NAME_DISABLE_TYPING_MESSAGES
            ) {
                category = Preferences.CATEGORY_PERFORMANCE_DEBUGGING;
            }
            preferences.push({
                user_id: userId,
                category,
                name: setting,
                value: settings[setting],
            });
        });

        await actions.savePreferences(userId, preferences);
        setHaveChanges(false);
    };

    const ctrlSendTitleAndDesc = getCtrlSendText();
    const ctrlSendContent = (
        <RadioItemCreator
            inputFieldValue={getCtrlSelectedOption(settings[AdvanceSettings.SEND_ON_CTRL_ENTER], settings[AdvanceSettings.CODE_BLOCK_CTRL_ENTER])}
            inputFieldData={ctrlSendInputFieldData}
            handleChange={(e) => handleChange(getCtrlSendPreferenceValue(e.target.value))}
        />
    );

    const formattingSectionContent = (
        <RadioItemCreator
            inputFieldValue={settings.formatting === 'true' ? OnAndOff.ON : OnAndOff.OFF}
            inputFieldData={FormattingInputFieldData}
            handleChange={(e) => (
                handleChange({[AdvanceSettings.FORMATTING]: e.target.value === OnAndOff.ON ? 'true' : 'false'})
            )}
        />
    );

    const JoinLeaveSectionContent = (
        <RadioItemCreator
            inputFieldValue={settings.formatting === 'true' ? OnAndOff.ON : OnAndOff.OFF}
            inputFieldData={JoinLeaveInputFieldData}
            handleChange={(e) => (
                handleChange({[AdvanceSettings.JOIN_LEAVE]: e.target.value === OnAndOff.ON ? 'true' : 'false'})
            )}
        />
    );

    const UnreadScrollPositionSectionContent = (
        <RadioItemCreator
            inputFieldValue={settings.unreadScrollPosition === UnreadScrollPosition.LEFT ? UnreadScrollPosition.LEFT : UnreadScrollPosition.NEWEST}
            inputFieldData={UnreadScrollPositionInputFieldData}
            handleChange={(e) => (
                handleChange({[AdvanceSettings.UNREAD_SCROLL_POSITION]: e.target.value === UnreadScrollPosition.LEFT ? UnreadScrollPosition.LEFT : UnreadScrollPosition.NEWEST})
            )}
        />
    );

    const PerformanceDebuggingSectionContent = (
        <>
            <CheckboxItemCreator
                inputFieldValue={settings[AdvanceSettings.NAME_DISABLE_CLIENT_PLUGINS] === 'true'}
                inputFieldData={DebuggingPluginInputFieldData}
                handleChange={(e) => handleChange({[AdvanceSettings.NAME_DISABLE_CLIENT_PLUGINS]: e.target.value})}
            />
            <CheckboxItemCreator
                inputFieldValue={settings[AdvanceSettings.NAME_DISABLE_TELEMETRY] === 'true'}
                inputFieldData={DebuggingTelemetryInputFieldData}
                handleChange={(e) => handleChange({[AdvanceSettings.NAME_DISABLE_TELEMETRY]: e.target.value})}
            />
            <CheckboxItemCreator
                inputFieldValue={settings[AdvanceSettings.NAME_DISABLE_TYPING_MESSAGES] === 'true'}
                inputFieldData={DebuggingTypingInputFieldData}
                handleChange={(e) => handleChange({[AdvanceSettings.NAME_DISABLE_TYPING_MESSAGES]: e.target.value})}
            />
        </>
    );

    function handleCancel() {
        setSettings({
            [AdvanceSettings.SEND_ON_CTRL_ENTER]: props.sendOnCtrlEnter,
            [AdvanceSettings.CODE_BLOCK_CTRL_ENTER]: props.codeBlockOnCtrlEnter,
            [AdvanceSettings.FORMATTING]: props.formatting,
            [AdvanceSettings.JOIN_LEAVE]: props.joinLeave,
            [AdvanceSettings.NAME_DISABLE_TYPING_MESSAGES]: props.disableTypingMessages,
            [AdvanceSettings.NAME_DISABLE_TELEMETRY]: props.disableTelemetry,
            [AdvanceSettings.NAME_DISABLE_CLIENT_PLUGINS]: props.disableClientPlugins,
        });
        setHaveChanges(false);
    }

    return (
        <>
            <SectionCreator
                title={ctrlSendTitleAndDesc.ctrlSendTitle}
                content={ctrlSendContent}
                description={ctrlSendTitleAndDesc.ctrlSendDesc}
            />
            <div className='user-settings-modal__divider'/>
            <SectionCreator
                title={FormattingSectionTitle}
                content={formattingSectionContent}
                description={FormattingSectionDesc}
            />
            <div className='user-settings-modal__divider'/>
            <SectionCreator
                title={JoinLeaveSectionTitle}
                content={JoinLeaveSectionContent}
                description={JoinLeaveSectionDesc}
            />
            <div className='user-settings-modal__divider'/>
            <SectionCreator
                title={UnreadScrollPositionSectionTitle}
                content={UnreadScrollPositionSectionContent}
                description={UnreadScrollPositionSectionDesc}
            />
            { props.performanceDebuggingEnabled && <>
                <div className='user-settings-modal__divider'/>
                <SectionCreator
                    title={PerformanceDebuggingSectionTitle}
                    description={PerformanceDebuggingSectionDesc}
                    content={PerformanceDebuggingSectionContent}
                />
            </>
            }
            {haveChanges &&
                <SaveChangesPanel
                    handleSubmit={handleSubmit}
                    handleCancel={handleCancel}
                />
            }
        </>
    );
}
