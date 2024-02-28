// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {PreferenceType} from '@mattermost/types/preferences';
import type {UserProfile} from '@mattermost/types/users';

import {Preferences} from 'mattermost-redux/constants';

import CheckboxSettingItem from 'components/widgets/modals/components/checkbox_setting_item';
import SectionCreator from 'components/widgets/modals/components/modal_section';
import RadioSettingItem from 'components/widgets/modals/components/radio_setting_item';
import SaveChangesPanel from 'components/widgets/modals/components/save_changes_panel';

import Constants from 'utils/constants';

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
    SyncedDraftSectionTitle,
    SyncedDraftSectionDesc,
    SyncedDraftInputFieldData,
} from './utils';

import type {PropsFromRedux} from './index';

type SettingsType = {
    [key: string]: string | undefined;
    [AdvanceSettings.SEND_ON_CTRL_ENTER]: string;
    [AdvanceSettings.CODE_BLOCK_CTRL_ENTER]: string;
    [AdvanceSettings.FORMATTING]: string;
    [AdvanceSettings.JOIN_LEAVE]: string;
    [AdvanceSettings.NAME_DISABLE_TYPING_MESSAGES]: string;
    [AdvanceSettings.NAME_DISABLE_TELEMETRY]: string;
    [AdvanceSettings.NAME_DISABLE_CLIENT_PLUGINS]: string;
    [AdvanceSettings.UNREAD_SCROLL_POSITION]: string;
    [AdvanceSettings.SYNCED_DRAFTS_ARE_ALLOWED]: string;
}

export type OwnProps = {
    userId?: UserProfile['id'];
}

export type Props = OwnProps & PropsFromRedux;

export default function AdvancedDisplaySettings(props: Props) {
    const [haveChanges, setHaveChanges] = useState(false);
    const {formatMessage} = useIntl();

    const [settings, setSettings] = useState<SettingsType>({
        [AdvanceSettings.SEND_ON_CTRL_ENTER]: props.sendOnCtrlEnter,
        [AdvanceSettings.CODE_BLOCK_CTRL_ENTER]: props.codeBlockOnCtrlEnter,
        [AdvanceSettings.FORMATTING]: props.formatting,
        [AdvanceSettings.JOIN_LEAVE]: props.joinLeave,
        [AdvanceSettings.NAME_DISABLE_TYPING_MESSAGES]: props.disableTypingMessages,
        [AdvanceSettings.NAME_DISABLE_TELEMETRY]: props.disableTelemetry,
        [AdvanceSettings.NAME_DISABLE_CLIENT_PLUGINS]: props.disableClientPlugins,
        [AdvanceSettings.UNREAD_SCROLL_POSITION]: props.unreadScrollPosition,
        [AdvanceSettings.SYNCED_DRAFTS_ARE_ALLOWED]: props.syncedDraftsAreAllowed ? 'true' : 'false',
    });

    const handleChange = useCallback((values: Record<string, string>) => {
        setSettings({...settings, ...values});
        setHaveChanges(true);
    }, [settings]);

    const handleSubmit = async (): Promise<void> => {
        const preferences: PreferenceType[] = [];
        const {actions, userId} = props;

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
        <RadioSettingItem
            inputFieldValue={getCtrlSelectedOption(settings[AdvanceSettings.SEND_ON_CTRL_ENTER], settings[AdvanceSettings.CODE_BLOCK_CTRL_ENTER])}
            inputFieldData={ctrlSendInputFieldData}
            handleChange={(e) => handleChange(getCtrlSendPreferenceValue(e.target.value))}
        />
    );

    const formattingSectionContent = (
        <RadioSettingItem
            inputFieldValue={settings.formatting === 'true' ? OnAndOff.ON : OnAndOff.OFF}
            inputFieldData={FormattingInputFieldData}
            handleChange={(e) => (
                handleChange({[AdvanceSettings.FORMATTING]: e.target.value === OnAndOff.ON ? 'true' : 'false'})
            )}
        />
    );

    const joinLeaveSectionContent = (
        <RadioSettingItem
            inputFieldValue={settings[AdvanceSettings.JOIN_LEAVE] === 'true' ? OnAndOff.ON : OnAndOff.OFF}
            inputFieldData={JoinLeaveInputFieldData}
            handleChange={(e) => (
                handleChange({[AdvanceSettings.JOIN_LEAVE]: e.target.value === OnAndOff.ON ? 'true' : 'false'})
            )}
        />
    );

    const syncedDraftSectionContent = (
        <RadioSettingItem
            inputFieldValue={settings[AdvanceSettings.SYNCED_DRAFTS_ARE_ALLOWED] === 'true' ? OnAndOff.ON : OnAndOff.OFF}
            inputFieldData={SyncedDraftInputFieldData}
            handleChange={(e) => (
                handleChange({[AdvanceSettings.SYNCED_DRAFTS_ARE_ALLOWED]: e.target.value === OnAndOff.ON ? 'true' : 'false'})
            )}
        />
    );

    const unreadScrollPositionSectionContent = (
        <RadioSettingItem
            inputFieldValue={settings[AdvanceSettings.UNREAD_SCROLL_POSITION] === UnreadScrollPosition.LEFT ? UnreadScrollPosition.LEFT : UnreadScrollPosition.NEWEST}
            inputFieldData={UnreadScrollPositionInputFieldData}
            handleChange={(e) => (
                handleChange({[AdvanceSettings.UNREAD_SCROLL_POSITION]: e.target.value === UnreadScrollPosition.LEFT ? UnreadScrollPosition.LEFT : UnreadScrollPosition.NEWEST})
            )}
        />
    );

    const performanceDebuggingSectionContent = (
        <>
            <CheckboxSettingItem
                inputFieldTitle={
                    <FormattedMessage
                        id='user.settings.advance.performance.disableClientPlugins'
                        defaultMessage='Disable Client-side Plugins'
                    />}
                inputFieldValue={settings[AdvanceSettings.NAME_DISABLE_CLIENT_PLUGINS] === 'true'}
                inputFieldData={DebuggingPluginInputFieldData}
                handleChange={(e) => handleChange({[AdvanceSettings.NAME_DISABLE_CLIENT_PLUGINS]: e ? 'true' : 'false'})}
            />
            <CheckboxSettingItem
                inputFieldTitle={
                    <FormattedMessage
                        id='user.settings.advance.performance.disableTelemetry'
                        defaultMessage='Disable telemetry events sent from the client'
                    />}
                inputFieldValue={settings[AdvanceSettings.NAME_DISABLE_TELEMETRY] === 'true'}
                inputFieldData={DebuggingTelemetryInputFieldData}
                handleChange={(e) => handleChange({[AdvanceSettings.NAME_DISABLE_TELEMETRY]: e ? 'true' : 'false'})}
            />
            <CheckboxSettingItem
                inputFieldTitle={
                    <FormattedMessage
                        id='user.settings.advance.performance.disableTypingMessages'
                        defaultMessage='Disable "User is typing..." messages'
                    />}
                inputFieldValue={settings[AdvanceSettings.NAME_DISABLE_TYPING_MESSAGES] === 'true'}
                inputFieldData={DebuggingTypingInputFieldData}
                handleChange={(e) => handleChange({[AdvanceSettings.NAME_DISABLE_TYPING_MESSAGES]: e ? 'true' : 'false'})}
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
            [AdvanceSettings.UNREAD_SCROLL_POSITION]: props.unreadScrollPosition,
            [AdvanceSettings.SYNCED_DRAFTS_ARE_ALLOWED]: props.syncedDraftsAreAllowed ? 'true' : 'false',
        });
        setHaveChanges(false);
    }

    return (
        <>
            <SectionCreator
                title={formatMessage(ctrlSendTitleAndDesc.ctrlSendTitle)}
                content={ctrlSendContent}
                description={formatMessage(ctrlSendTitleAndDesc.ctrlSendDesc)}
            />
            <div className='user-settings-modal__divider'/>
            <SectionCreator
                title={formatMessage(FormattingSectionTitle)}
                content={formattingSectionContent}
                description={formatMessage(FormattingSectionDesc)}
            />
            <div className='user-settings-modal__divider'/>
            <SectionCreator
                title={formatMessage(JoinLeaveSectionTitle)}
                content={joinLeaveSectionContent}
                description={formatMessage(JoinLeaveSectionDesc)}
            />
            <div className='user-settings-modal__divider'/>
            <SectionCreator
                title={formatMessage(UnreadScrollPositionSectionTitle)}
                content={unreadScrollPositionSectionContent}
                description={formatMessage(UnreadScrollPositionSectionDesc)}
            />
            <div className='user-settings-modal__divider'/>
            <SectionCreator
                title={formatMessage(SyncedDraftSectionTitle)}
                content={syncedDraftSectionContent}
                description={formatMessage(SyncedDraftSectionDesc)}
            />
            { props.performanceDebuggingEnabled && <>
                <div className='user-settings-modal__divider'/>
                <SectionCreator
                    title={formatMessage(PerformanceDebuggingSectionTitle)}
                    description={formatMessage(PerformanceDebuggingSectionDesc)}
                    content={performanceDebuggingSectionContent}
                />
            </>
            }
            {haveChanges && <div className='user-settings-modal__filler'/>}
            {haveChanges &&
                <SaveChangesPanel
                    handleSubmit={handleSubmit}
                    handleCancel={handleCancel}
                    handleClose={handleCancel}
                    state='editing'
                />
            }
        </>
    );
}
