// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ChangeEvent, ReactNode} from 'react';
import React, {memo, useEffect, useRef, Fragment, useMemo, useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import type {ValueType} from 'react-select';
import ReactSelect from 'react-select';

import type {UserNotifyProps} from '@mattermost/types/users';

import SettingItemMax from 'components/setting_item_max';
import SettingItemMin from 'components/setting_item_min';
import type SettingItemMinComponent from 'components/setting_item_min';

import {UserSettingsNotificationSections} from 'utils/constants';
import {
    notificationSoundKeys,
    stopTryNotificationRing,
    tryNotificationSound,
    tryNotificationRing,
    getValueOfNotificationSoundsSelect,
    getValueOfIncomingCallSoundsSelect,
    optionsOfMessageNotificationSoundsSelect,
    optionsOfIncomingCallSoundsSelect,
    callNotificationSoundKeys,
} from 'utils/notification_sounds';

import type {Props as UserSettingsNotificationsProps} from '../user_settings_notifications';

export type SelectOption = {
    value: string;
    label: ReactNode;
};

export type Props = {
    active: boolean;
    updateSection: (section: string) => void;
    onSubmit: () => void;
    onCancel: () => void;
    saving: boolean;
    error: string;
    setParentState: (key: string, value: string | boolean) => void;
    areAllSectionsInactive: boolean;
    desktopSound: UserNotifyProps['desktop_sound'];
    desktopNotificationSound: UserNotifyProps['desktop_notification_sound'];
    isCallsRingingEnabled: UserSettingsNotificationsProps['isCallsRingingEnabled'];
    callsDesktopSound: UserNotifyProps['calls_desktop_sound'];
    callsNotificationSound: UserNotifyProps['calls_notification_sound'];
};

function DesktopNotificationSoundsSettings({
    active,
    updateSection,
    onSubmit,
    onCancel,
    saving,
    error,
    setParentState,
    areAllSectionsInactive,
    desktopSound,
    desktopNotificationSound,
    isCallsRingingEnabled,
    callsDesktopSound,
    callsNotificationSound,
}: Props) {
    const intl = useIntl();

    const editButtonRef = useRef<SettingItemMinComponent>(null);
    const previousActiveRef = useRef(active);

    // Focus back on the edit button, after this section was closed after it was opened
    useEffect(() => {
        if (previousActiveRef.current && !active && areAllSectionsInactive) {
            editButtonRef.current?.focus();
        }

        previousActiveRef.current = active;
    }, [active, areAllSectionsInactive]);

    const handleChangeForMessageNotificationSoundCheckbox = useCallback((event: ChangeEvent<HTMLInputElement>) => {
        const value = event.target.checked ? 'true' : 'false';
        setParentState('desktopSound', value);

        if (value === 'false') {
            stopTryNotificationRing();
        }
    }, [setParentState]);

    const handleChangeForIncomginCallSoundCheckbox = useCallback((event: ChangeEvent<HTMLInputElement>) => {
        const value = event.target.checked ? 'true' : 'false';
        setParentState('callsDesktopSound', value);

        if (value === 'false') {
            stopTryNotificationRing();
        }
    }, [setParentState]);

    const handleChangeForMessageNotificationSoundSelect = useCallback((selectedOption: ValueType<SelectOption>) => {
        stopTryNotificationRing();

        if (selectedOption && 'value' in selectedOption) {
            setParentState('desktopNotificationSound', selectedOption.value);
            tryNotificationSound(selectedOption.value);
        }
    }, [setParentState]);

    const handleChangeForIncomingCallSoundSelect = useCallback((selectedOption: ValueType<SelectOption>) => {
        stopTryNotificationRing();

        if (selectedOption && 'value' in selectedOption) {
            setParentState('callsNotificationSound', selectedOption.value);
            tryNotificationRing(selectedOption.value);
        }
    }, [setParentState]);

    const maximizedSettingInputs = useMemo(() => {
        const maximizedSettingInputs = [];

        const isMessageNotificationSoundChecked = desktopSound === 'true';
        const messageSoundSection = (
            <Fragment key='messageSoundSection'>
                <div className='checkbox inlineCheckboxSelect'>
                    <label>
                        <input
                            type='checkbox'
                            checked={desktopSound === 'true'}
                            onChange={handleChangeForMessageNotificationSoundCheckbox}
                        />
                        <FormattedMessage
                            id='user.settings.notifications.desktopNotificationSound.messageNotificationSound'
                            defaultMessage='Message notification sound'
                        />
                    </label>
                    <ReactSelect
                        id='messageNotificationSoundSelect'
                        inputId='messageNotificationSoundSelectInput'
                        className='react-select inlineSelect'
                        classNamePrefix='react-select'
                        options={optionsOfMessageNotificationSoundsSelect}
                        clearable={false}
                        isClearable={false}
                        isSearchable={false}
                        isDisabled={!isMessageNotificationSoundChecked}
                        placeholder={intl.formatMessage({
                            id: 'user.settings.notifications.desktopNotificationSound.soundSelectPlaceholder',
                            defaultMessage: 'Select a sound',
                        })}
                        components={{IndicatorSeparator: NoIndicatorSeparatorComponent}}
                        value={getValueOfNotificationSoundsSelect(desktopNotificationSound)}
                        onChange={handleChangeForMessageNotificationSoundSelect}
                    />
                </div>
            </Fragment>
        );
        maximizedSettingInputs.push(messageSoundSection);

        if (isCallsRingingEnabled) {
            const isIncomingCallSoundChecked = callsDesktopSound === 'true';
            const callSoundSection = (
                <Fragment key='callSoundSection'>
                    <br/>
                    <div className='checkbox inlineCheckboxSelect'>
                        <label>
                            <input
                                type='checkbox'
                                checked={isIncomingCallSoundChecked}
                                onChange={handleChangeForIncomginCallSoundCheckbox}
                            />
                            <FormattedMessage
                                id='user.settings.notifications.desktopNotificationSound.incomingCallSound'
                                defaultMessage='Incoming call sound'
                            />
                        </label>
                        <ReactSelect
                            id='incomingCallSoundNotificationSelect'
                            inputId='incomingCallSoundNotificationSelectInput'
                            className='react-select inlineSelect'
                            classNamePrefix='react-select'
                            options={optionsOfIncomingCallSoundsSelect}
                            clearable={false}
                            isClearable={false}
                            isSearchable={false}
                            isDisabled={!isIncomingCallSoundChecked}
                            components={{IndicatorSeparator: NoIndicatorSeparatorComponent}}
                            placeholder={intl.formatMessage({
                                id: 'user.settings.notifications.desktopNotificationSound.soundSelectPlaceholder',
                                defaultMessage: 'Select a sound',
                            })}
                            value={getValueOfIncomingCallSoundsSelect(callsNotificationSound)}
                            onChange={handleChangeForIncomingCallSoundSelect}
                        />
                    </div>
                </Fragment>
            );
            maximizedSettingInputs.push(callSoundSection);
        }
        return maximizedSettingInputs;
    },
    [
        desktopSound,
        handleChangeForMessageNotificationSoundCheckbox,
        handleChangeForMessageNotificationSoundSelect,
        desktopNotificationSound,
        isCallsRingingEnabled,
        callsDesktopSound,
        handleChangeForIncomginCallSoundCheckbox,
        callsNotificationSound,
        handleChangeForIncomingCallSoundSelect,
    ]);

    function handleChangeForMaxSection(section: string) {
        stopTryNotificationRing();
        updateSection(section);
    }

    function handleChangeForMinSection(section: string) {
        stopTryNotificationRing();
        updateSection(section);
        onCancel();
    }

    function handleSubmit() {
        stopTryNotificationRing();
        onSubmit();
    }

    if (active) {
        return (
            <SettingItemMax
                title={
                    <FormattedMessage
                        id='user.settings.notifications.desktopNotificationSounds.title'
                        defaultMessage='Desktop notification sounds'
                    />
                }
                inputs={maximizedSettingInputs}
                submit={handleSubmit}
                saving={saving}
                serverError={error}
                updateSection={handleChangeForMaxSection}
            />
        );
    }

    return (
        <SettingItemMin
            ref={editButtonRef}
            title={
                <FormattedMessage
                    id='user.settings.notifications.desktopNotificationSounds.title'
                    defaultMessage='Desktop notification sounds'
                />
            }
            describe={getCollapsedText(isCallsRingingEnabled, desktopSound, desktopNotificationSound, callsDesktopSound, callsNotificationSound)}
            section={UserSettingsNotificationSections.DESKTOP_NOTIFICATION_SOUND}
            updateSection={handleChangeForMinSection}
        />
    );
}

function NoIndicatorSeparatorComponent() {
    return null;
}

function getCollapsedText(
    isCallsRingingEnabled: UserSettingsNotificationsProps['isCallsRingingEnabled'],
    desktopSound: UserNotifyProps['desktop_sound'],
    desktopNotificationSound: UserNotifyProps['desktop_notification_sound'],
    callsDesktopSound: UserNotifyProps['calls_desktop_sound'],
    callsNotificationSound: UserNotifyProps['calls_notification_sound'],
) {
    const desktopNotificationSoundIsSelected = notificationSoundKeys.includes(desktopNotificationSound as string);
    const callNotificationSoundIsSelected = callNotificationSoundKeys.includes(callsNotificationSound as string);

    let hasCallsSound: boolean | null = null;
    if (isCallsRingingEnabled && callNotificationSoundIsSelected) {
        if (callsDesktopSound === 'true') {
            hasCallsSound = true;
        } else {
            hasCallsSound = false;
        }
    }

    let hasDesktopSound: boolean | null = null;
    if (desktopNotificationSoundIsSelected) {
        if (desktopSound === 'true') {
            hasDesktopSound = true;
        } else {
            hasDesktopSound = false;
        }
    }

    if (hasDesktopSound !== null && hasCallsSound !== null) {
        if (hasDesktopSound && hasCallsSound) {
            return (
                <FormattedMessage
                    id='user.settings.notifications.desktopNotificationSound.hasDesktopAndCallsSound'
                    defaultMessage='"{desktopSound}" for messages, "{callsSound}" for calls'
                    values={{
                        desktopSound: desktopNotificationSound,
                        callsSound: callsNotificationSound,
                    }}
                />
            );
        } else if (!hasDesktopSound && hasCallsSound) {
            return (
                <FormattedMessage
                    id='user.settings.notifications.desktopNotificationSound.noDesktopAndhasCallsSound'
                    defaultMessage='No sound for messages, "{callsSound}" for calls'
                    values={{callsSound: callsNotificationSound}}
                />
            );
        } else if (hasDesktopSound && !hasCallsSound) {
            return (
                <FormattedMessage
                    id='user.settings.notifications.desktopNotificationSound.hasDesktopAndNoCallsSound'
                    defaultMessage='"{desktopSound}" for messages, no sound for calls'
                    values={{desktopSound: desktopNotificationSound}}
                />
            );
        }

        return (
            <FormattedMessage
                id='user.settings.notifications.desktopNotificationSound.noDesktopAndNoCallsSound'
                defaultMessage='No sound'
            />
        );
    } else if (hasDesktopSound !== null && hasCallsSound === null) {
        if (hasDesktopSound) {
            return (
                <FormattedMessage
                    id='user.settings.notifications.desktopNotificationSound.hasDesktopSound'
                    defaultMessage='"{desktopSound}" for messages'
                    values={{desktopSound: desktopNotificationSound}}
                />
            );
        }

        return (
            <FormattedMessage
                id='user.settings.notifications.desktopNotificationSound.noDesktopSound'
                defaultMessage='No sound'
            />
        );
    }

    return (
        <FormattedMessage
            id='user.settings.notifications.desktopNotificationSound.noValidSound'
            defaultMessage='Configure desktop notification sounds'
        />
    );
}

export default memo(DesktopNotificationSoundsSettings);
