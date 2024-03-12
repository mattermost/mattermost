// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ChangeEvent, ReactNode} from 'react';
import React, {memo, useEffect, useRef, Fragment, useMemo, useCallback} from 'react';
import type {IntlShape} from 'react-intl';
import {FormattedMessage, useIntl} from 'react-intl';
import type {ValueType} from 'react-select';
import ReactSelect from 'react-select';

import type {UserNotifyProps} from '@mattermost/types/users';

import SettingItemMax from 'components/setting_item_max';
import SettingItemMin from 'components/setting_item_min';
import type SettingItemMinComponent from 'components/setting_item_min';

import {UserSettingsNotificationSections} from 'utils/constants';
import {callsNotificationSounds, notificationSounds, stopTryNotificationRing, tryNotificationSound, tryNotificationRing} from 'utils/notification_sounds';

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
        const messageNotificationSoundSection = (
            <Fragment key='messageNotificationSoundSection'>
                <div className='checkbox inlineCheckboxSelect'>
                    <label>
                        <input
                            type='checkbox'
                            checked={isMessageNotificationSoundChecked}
                            onChange={handleChangeForMessageNotificationSoundCheckbox}
                        />
                        <FormattedMessage
                            id='user.settings.notifications.desktopNotificationSound.messageNotificationSound'
                            defaultMessage='Message notification sound'
                        />
                    </label>
                    <ReactSelect
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
                        value={getValueOfMessageNotificationSoundsSelect(desktopNotificationSound)}
                        onChange={handleChangeForMessageNotificationSoundSelect}
                    />
                </div>
            </Fragment>
        );
        maximizedSettingInputs.push(messageNotificationSoundSection);

        if (isCallsRingingEnabled) {
            const isChecked = callsDesktopSound === 'true';

            const incomingCallSoundNotificationSection = (
                <Fragment key='incomingCallSoundNotificationSection'>
                    <br/>
                    <div className='checkbox inlineCheckboxSelect'>
                        <label>
                            <input
                                type='checkbox'
                                checked={isChecked}
                                onChange={handleChangeForIncomginCallSoundCheckbox}
                            />
                            <FormattedMessage
                                id='user.settings.notifications.desktopNotificationSound.incomingCallSound'
                                defaultMessage='Incoming call sound'
                            />
                        </label>
                        <ReactSelect
                            inputId='incomingCallSoundNotificationSelectInput'
                            className='react-select inlineSelect'
                            classNamePrefix='react-select'
                            options={optionsOfIncomingCallSoundsSelect}
                            clearable={false}
                            isClearable={false}
                            isSearchable={false}
                            isDisabled={!isChecked}
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
            maximizedSettingInputs.push(incomingCallSoundNotificationSection);
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
            describe={getCollapsedText(isCallsRingingEnabled, desktopSound, desktopNotificationSound, callsDesktopSound, callsNotificationSound, intl)}
            section={UserSettingsNotificationSections.DESKTOP_NOTIFICATION_SOUND}
            updateSection={handleChangeForMinSection}
        />
    );
}

function NoIndicatorSeparatorComponent() {
    return null;
}

const notificationSoundKeys = Array.from(notificationSounds.keys());

const optionsOfMessageNotificationSoundsSelect: SelectOption[] = notificationSoundKeys.map((soundName) => {
    if (soundName === 'Bing') {
        return {
            value: soundName,
            label: (
                <FormattedMessage
                    id='user.settings.notifications.desktopNotificationSound.soundBing'
                    defaultMessage='Bing'
                />
            ),
        };
    } else if (soundName === 'Crackle') {
        return {
            value: soundName,
            label: (
                <FormattedMessage
                    id='user.settings.notifications.desktopNotificationSound.soundCrackle'
                    defaultMessage='Crackle'
                />
            ),
        };
    } else if (soundName === 'Down') {
        return {
            value: soundName,
            label: (
                <FormattedMessage
                    id='user.settings.notifications.desktopNotificationSound.soundDown'
                    defaultMessage='Down'
                />
            ),
        };
    } else if (soundName === 'Hello') {
        return {
            value: soundName,
            label: (
                <FormattedMessage
                    id='user.settings.notifications.desktopNotificationSound.soundHello'
                    defaultMessage='Hello'
                />
            ),
        };
    } else if (soundName === 'Ripple') {
        return {
            value: soundName,
            label: (
                <FormattedMessage
                    id='user.settings.notifications.desktopNotificationSound.soundRipple'
                    defaultMessage='Ripple'
                />
            ),
        };
    } else if (soundName === 'Upstairs') {
        return {
            value: soundName,
            label: (
                <FormattedMessage
                    id='user.settings.notifications.desktopNotificationSound.soundUpstairs'
                    defaultMessage='Upstairs'
                />
            ),
        };
    }
    return {
        value: '',
        label: '',
    };
});

function getValueOfMessageNotificationSoundsSelect(soundName?: string) {
    const soundOption = optionsOfMessageNotificationSoundsSelect.find((option) => option.value === soundName);

    if (!soundOption) {
        return undefined;
    }

    return soundOption;
}

const callNotificationSoundKeys = Array.from(callsNotificationSounds.keys());

const optionsOfIncomingCallSoundsSelect: SelectOption[] = callNotificationSoundKeys.map((soundName) => {
    if (soundName === 'Dynamic') {
        return {
            value: soundName,
            label: (
                <FormattedMessage
                    id='user.settings.notifications.desktopNotificationSound.soundDynamic'
                    defaultMessage='Dynamic'
                />
            ),
        };
    } else if (soundName === 'Calm') {
        return {
            value: soundName,
            label: (
                <FormattedMessage
                    id='user.settings.notifications.desktopNotificationSound.soundCalm'
                    defaultMessage='Calm'
                />
            ),
        };
    } else if (soundName === 'Urgent') {
        return {
            value: soundName,
            label: (
                <FormattedMessage
                    id='user.settings.notifications.desktopNotificationSound.soundUrgent'
                    defaultMessage='Urgent'
                />
            ),
        };
    } else if (soundName === 'Cheerful') {
        return {
            value: soundName,
            label: (
                <FormattedMessage
                    id='user.settings.notifications.desktopNotificationSound.soundCheerful'
                    defaultMessage='Cheerful'
                />
            ),
        };
    }
    return {
        value: '',
        label: '',
    };
});

function getValueOfIncomingCallSoundsSelect(soundName?: string) {
    const soundOption = optionsOfIncomingCallSoundsSelect.find((option) => option.value === soundName);

    if (!soundOption) {
        return undefined;
    }

    return soundOption;
}

function getCollapsedText(
    isCallsRingingEnabled: UserSettingsNotificationsProps['isCallsRingingEnabled'],
    desktopSound: UserNotifyProps['desktop_sound'],
    desktopNotificationSound: UserNotifyProps['desktop_notification_sound'],
    callsDesktopSound: UserNotifyProps['calls_desktop_sound'],
    callsNotificationSound: UserNotifyProps['calls_notification_sound'],
    intl: IntlShape,
): ReactNode {
    if (desktopSound === 'false' && isCallsRingingEnabled && callsDesktopSound === 'false') {
        return intl.formatMessage({id: 'user.settings.notifications.desktopNotificationSound.noSound', defaultMessage: 'None'});
    }

    const desktopNotificationSoundIsSelected = notificationSoundKeys.includes(desktopNotificationSound as string);
    const callNotificationSoundIsSelected = callNotificationSoundKeys.includes(callsNotificationSound as string);

    let desktopSoundText: string;
    if (desktopSound === 'true' && desktopNotificationSoundIsSelected) {
        desktopSoundText = intl.formatMessage(
            {
                id: 'user.settings.notifications.desktopNotificationSound.messageNotificationSoundOn',
                defaultMessage: '"{desktopNotificationSound}" for messages',
            },
            {desktopNotificationSound});
    } else {
        desktopSoundText = intl.formatMessage({
            id: 'user.settings.notifications.desktopNotificationSound.messageNotificationNone',
            defaultMessage: 'None for messages',
        });
    }

    let callsSoundText: string;
    if (isCallsRingingEnabled) {
        if (callsDesktopSound === 'true' && callNotificationSoundIsSelected) {
            callsSoundText = intl.formatMessage(
                {
                    id: 'user.settings.notifications.desktopNotificationSound.incomingCallSoundOn',
                    defaultMessage: '"{callsNotificationSound}" for calls',
                },
                {callsNotificationSound});
        } else {
            callsSoundText = intl.formatMessage({
                id: 'user.settings.notifications.desktopNotificationSound.incomingCallNone',
                defaultMessage: 'None for calls',
            });
        }
    } else {
        callsSoundText = '';
    }

    let collapsedText: ReactNode;
    if (callsSoundText.length > 0) {
        collapsedText = `${desktopSoundText}, ${callsSoundText}`;
    } else {
        collapsedText = desktopSoundText;
    }

    return collapsedText;
}

export default memo(DesktopNotificationSoundsSettings);
