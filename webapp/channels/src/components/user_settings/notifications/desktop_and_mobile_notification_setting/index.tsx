// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {Fragment, useCallback, useEffect, useMemo, useRef, memo} from 'react';
import type {ChangeEvent, ReactNode} from 'react';
import {FormattedMessage} from 'react-intl';
import ReactSelect from 'react-select';
import type {ValueType, OptionsType} from 'react-select';

import type {UserNotifyProps} from '@mattermost/types/users';

import SettingItemMax from 'components/setting_item_max';
import SettingItemMin from 'components/setting_item_min';
import type SettingItemMinComponent from 'components/setting_item_min';

import Constants, {NotificationLevels, UserSettingsNotificationSections} from 'utils/constants';

import type {Props as UserSettingsNotificationsProps} from '../user_settings_notifications';

export type SelectOption = {
    label: ReactNode;
    value: string;
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
    isCollapsedThreadsEnabled: boolean;
    desktopActivity: UserNotifyProps['desktop'];
    sendPushNotifications: UserSettingsNotificationsProps['sendPushNotifications'];
    pushActivity: UserNotifyProps['push'];
    pushStatus: UserNotifyProps['push_status'];
    desktopThreads: UserNotifyProps['desktop_threads'];
    pushThreads: UserNotifyProps['push_threads'];
    desktopAndMobileSettingsDifferent: boolean;
};

function DesktopAndMobileNotificationSettings({
    active,
    updateSection,
    onSubmit,
    onCancel,
    saving,
    error,
    setParentState,
    areAllSectionsInactive,
    isCollapsedThreadsEnabled,
    desktopActivity,
    sendPushNotifications,
    pushActivity,
    pushStatus,
    desktopThreads,
    pushThreads,
    desktopAndMobileSettingsDifferent,
}: Props) {
    const editButtonRef = useRef<SettingItemMinComponent>(null);
    const previousActiveRef = useRef(active);

    // Focus back on the edit button, after this section was closed after it was opened
    useEffect(() => {
        if (previousActiveRef.current && !active && areAllSectionsInactive) {
            editButtonRef.current?.focus();
        }

        previousActiveRef.current = active;
    }, [active, areAllSectionsInactive]);

    const handleChangeForSendDesktopNotificationsRadio = useCallback((event: ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        setParentState('desktopActivity', value);
    }, [setParentState]);

    const handleChangeForDesktopThreadsCheckbox = useCallback((event: ChangeEvent<HTMLInputElement>) => {
        const value = event.target.checked ? NotificationLevels.ALL : NotificationLevels.MENTION;
        setParentState('desktopThreads', value);
    }, [setParentState]);

    const handleChangeForDifferentMobileNotificationsCheckbox = useCallback((event: ChangeEvent<HTMLInputElement>) => {
        const value = event.target.checked;
        setParentState('desktopAndMobileSettingsDifferent', value);
    }, [setParentState]);

    const handleChangeForSendMobileNotificationsSelect = useCallback((selectedOption: ValueType<SelectOption>) => {
        if (selectedOption && 'value' in selectedOption) {
            setParentState('pushActivity', selectedOption.value);
        }
    }, [setParentState]);

    const handleChangeForMobileThreadsCheckbox = useCallback((event: ChangeEvent<HTMLInputElement>) => {
        const value = event.target.checked ? NotificationLevels.ALL : NotificationLevels.MENTION;
        setParentState('pushThreads', value);
    }, [setParentState]);

    const handleChangeForTriggerMobileNotificationsSelect = useCallback((selectedOption: ValueType<SelectOption>) => {
        if (selectedOption && 'value' in selectedOption) {
            setParentState('pushStatus', selectedOption.value);
        }
    }, [setParentState]);

    const maximizedSettingsInputs = useMemo(() => {
        const maximizedSettingInputs = [];

        const sendDesktopNotificationsSection = (
            <fieldset
                id='sendDesktopNotificationsSection'
                key='sendDesktopNotificationsSection'
            >
                <legend className='form-legend'>
                    <FormattedMessage
                        id='user.settings.notifications.desktopAndMobile.sendDesktopNotificationFor'
                        defaultMessage='Send notifications for:'
                    />
                </legend>
                {optionsOfSendNotifications.map((optionOfSendNotifications) => (
                    <div
                        key={optionOfSendNotifications.value}
                        className='radio'
                    >
                        <label>
                            <input
                                type='radio'
                                checked={desktopActivity === optionOfSendNotifications.value}
                                value={optionOfSendNotifications.value}
                                onChange={handleChangeForSendDesktopNotificationsRadio}
                            />
                            {optionOfSendNotifications.label}
                        </label>
                    </div>
                ))}
            </fieldset>
        );
        maximizedSettingInputs.push(sendDesktopNotificationsSection);

        if (shouldShowDesktopThreadsSection(isCollapsedThreadsEnabled, desktopActivity)) {
            const desktopThreadNotificationSection = (
                <Fragment key='desktopThreadNotificationSection'>
                    <br/>
                    <div className='checkbox single-checkbox'>
                        <label>
                            <input
                                type='checkbox'
                                checked={desktopThreads === NotificationLevels.ALL}
                                onChange={handleChangeForDesktopThreadsCheckbox}
                            />
                            <FormattedMessage
                                id='user.settings.notifications.desktopAndMobile.notifyForDesktopthreads'
                                defaultMessage={'Notify me about replies to threads I\'m following'}
                            />
                        </label>
                    </div>
                </Fragment>
            );
            maximizedSettingInputs.push(desktopThreadNotificationSection);
        }

        if (sendPushNotifications) {
            const differentMobileNotificationsSection = (
                <Fragment key='differentMobileNotificationsSection'>
                    <hr/>
                    <div className='checkbox single-checkbox'>
                        <label>
                            <input
                                type='checkbox'
                                checked={desktopAndMobileSettingsDifferent}
                                onChange={handleChangeForDifferentMobileNotificationsCheckbox}
                            />
                            <FormattedMessage
                                id='user.settings.notifications.desktopAndMobile.differentMobileNotificationsTitle'
                                defaultMessage='Use different settings for my mobile devices'
                            />
                        </label>
                    </div>
                </Fragment>
            );
            maximizedSettingInputs.push(differentMobileNotificationsSection);
        }

        if (shouldShowSendMobileNotificationsSection(sendPushNotifications, desktopAndMobileSettingsDifferent)) {
            const sendMobileNotificationsSection = (
                <React.Fragment key='sendMobileNotificationsSection'>
                    <br/>
                    <label
                        id='sendMobileNotificationsLabel'
                        htmlFor='sendMobileNotificationsSelectInput'
                        className='singleSelectLabel'
                    >
                        <FormattedMessage
                            id='user.settings.notifications.desktopAndMobile.sendMobileNotificationsFor'
                            defaultMessage='Send mobile notifications for:'
                        />
                    </label>
                    <ReactSelect
                        inputId='sendMobileNotificationsSelectInput'
                        aria-labelledby='sendMobileNotificationsLabel'
                        className='react-select singleSelect'
                        classNamePrefix='react-select'
                        options={optionsOfSendNotifications}
                        clearable={false}
                        isClearable={false}
                        isSearchable={false}
                        components={{IndicatorSeparator: NoIndicatorSeparatorComponent}}
                        value={getValueOfSendMobileNotificationForSelect(pushActivity)}
                        onChange={handleChangeForSendMobileNotificationsSelect}
                    />
                </React.Fragment>
            );
            maximizedSettingInputs.push(sendMobileNotificationsSection);
        }

        if (shouldShowMobileThreadsSection(sendPushNotifications, isCollapsedThreadsEnabled, desktopAndMobileSettingsDifferent, pushActivity)) {
            const threadNotificationSection = (
                <Fragment key='threadNotificationSection'>
                    <br/>
                    <div className='checkbox single-checkbox'>
                        <label>
                            <input
                                type='checkbox'
                                checked={pushThreads === NotificationLevels.ALL}
                                onChange={handleChangeForMobileThreadsCheckbox}
                            />
                            <FormattedMessage
                                id='user.settings.notifications.desktopAndMobile.notifyForMobilethreads'
                                defaultMessage={'Notify me on mobile about replies to threads I\'m following'}
                            />
                        </label>
                    </div>
                </Fragment>
            );
            maximizedSettingInputs.push(threadNotificationSection);
        }

        if (shouldShowTriggerMobileNotificationsSection(sendPushNotifications, desktopActivity, pushActivity, desktopAndMobileSettingsDifferent)) {
            const triggerMobileNotificationsSection = (
                <React.Fragment key='triggerMobileNotificationsSection'>
                    <br/>
                    <label
                        id='pushMobileNotificationsLabel'
                        htmlFor='pushMobileNotificationSelectInput'
                        className='singleSelectLabel'
                    >
                        <FormattedMessage
                            id='user.settings.notifications.desktopAndMobile.pushNotification'
                            defaultMessage='Trigger mobile notifications when I am:'
                        />
                    </label>
                    <ReactSelect
                        inputId='pushMobileNotificationSelectInput'
                        aria-labelledby='pushMobileNotificationsLabel'
                        className='react-select singleSelect'
                        classNamePrefix='react-select'
                        options={optionsOfSendMobileNotificationsWhenSelect}
                        clearable={false}
                        isClearable={false}
                        isSearchable={false}
                        components={{IndicatorSeparator: NoIndicatorSeparatorComponent}}
                        value={getValueOfSendMobileNotificationWhenSelect(pushStatus)}
                        onChange={handleChangeForTriggerMobileNotificationsSelect}
                    />
                </React.Fragment>
            );
            maximizedSettingInputs.push(triggerMobileNotificationsSection);
        }

        if (!sendPushNotifications) {
            const disabledPushNotificationsSection = (
                <>
                    <br/>
                    <FormattedMessage
                        id='user.settings.notifications.desktopAndMobile.pushNotificationsDisabled'
                        defaultMessage={'Mobile push notifications haven\'t been enabled by your system administrator.'}
                    />
                </>
            );
            maximizedSettingInputs.push(disabledPushNotificationsSection);
        }

        return maximizedSettingInputs;
    },
    [
        desktopActivity,
        handleChangeForSendDesktopNotificationsRadio,
        isCollapsedThreadsEnabled,
        desktopThreads,
        handleChangeForDesktopThreadsCheckbox,
        sendPushNotifications,
        desktopAndMobileSettingsDifferent,
        handleChangeForDifferentMobileNotificationsCheckbox,
        pushActivity,
        handleChangeForSendMobileNotificationsSelect,
        pushThreads,
        handleChangeForMobileThreadsCheckbox,
        pushStatus,
        handleChangeForTriggerMobileNotificationsSelect,
    ]);

    function handleChangeForMaxSection(section: string) {
        updateSection(section);
    }

    function handleChangeForMinSection(section: string) {
        updateSection(section);
        onCancel();
    }

    if (active) {
        return (
            <SettingItemMax
                title={
                    <FormattedMessage
                        id={'user.settings.notifications.desktopAndMobile.title'}
                        defaultMessage='Desktop and mobile notifications'
                    />
                }
                inputs={maximizedSettingsInputs}
                submit={onSubmit}
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
                    id='user.settings.notifications.desktopAndMobile.title'
                    defaultMessage='Desktop and mobile notifications'
                />
            }
            describe={getCollapsedText(desktopActivity, pushActivity)}
            section={UserSettingsNotificationSections.DESKTOP_AND_MOBILE}
            updateSection={handleChangeForMinSection}
        />
    );
}

function NoIndicatorSeparatorComponent() {
    return null;
}

const optionsOfSendNotifications = [
    {
        label: (
            <FormattedMessage
                id='user.settings.notifications.desktopAndMobile.allNewMessages'
                defaultMessage='All new messages'
            />
        ),
        value: NotificationLevels.ALL,
    },
    {
        label: (
            <FormattedMessage
                id='user.settings.notifications.desktopAndMobile.onlyMentions'
                defaultMessage='Mentions, direct messages, and group messages'
            />
        ),
        value: NotificationLevels.MENTION,
    },
    {
        label: (
            <FormattedMessage
                id='user.settings.notifications.desktopAndMobile.nothing'
                defaultMessage='Nothing'
            />
        ),
        value: NotificationLevels.NONE,
    },
];

export function shouldShowDesktopThreadsSection(isCollapsedThreadsEnabled: boolean, desktopActivity: UserNotifyProps['desktop']) {
    if (!isCollapsedThreadsEnabled) {
        return false;
    }

    if (desktopActivity === NotificationLevels.ALL || desktopActivity === NotificationLevels.NONE) {
        return false;
    }

    return true;
}

export function shouldShowMobileThreadsSection(sendPushNotifications: UserSettingsNotificationsProps['sendPushNotifications'], isCollapsedThreadsEnabled: boolean, desktopAndMobileSettingsDifferent: boolean, pushActivity: UserNotifyProps['push']) {
    if (!sendPushNotifications) {
        return false;
    }

    if (!isCollapsedThreadsEnabled) {
        return false;
    }

    if (!desktopAndMobileSettingsDifferent) {
        return false;
    }

    if (pushActivity === NotificationLevels.ALL || pushActivity === NotificationLevels.NONE) {
        return false;
    }

    return true;
}

function shouldShowSendMobileNotificationsSection(sendPushNotifications: UserSettingsNotificationsProps['sendPushNotifications'], desktopAndMobileSettingsDifferent: boolean) {
    if (!sendPushNotifications) {
        return false;
    }

    if (desktopAndMobileSettingsDifferent) {
        return true;
    }

    return false;
}

export function getValueOfSendMobileNotificationForSelect(pushActivity: UserNotifyProps['push']): ValueType<SelectOption> {
    if (!pushActivity) {
        return optionsOfSendNotifications[1];
    }

    const option = optionsOfSendNotifications.find((option) => option.value === pushActivity);
    if (!option) {
        return optionsOfSendNotifications[1];
    }

    return option;
}

export function shouldShowTriggerMobileNotificationsSection(sendPushNotifications: UserSettingsNotificationsProps['sendPushNotifications'], desktopActivity: UserNotifyProps['desktop'], pushActivity: UserNotifyProps['push'], desktopAndMobileSettingsDifferent: boolean): boolean {
    if (!sendPushNotifications) {
        return false;
    }

    if (!desktopActivity || !pushActivity) {
        return true;
    }

    if (!desktopAndMobileSettingsDifferent) {
        if (desktopActivity === NotificationLevels.NONE) {
            return false;
        }
        return true;
    }

    if (pushActivity === NotificationLevels.NONE) {
        return false;
    }

    return true;
}

const optionsOfSendMobileNotificationsWhenSelect: OptionsType<SelectOption> = [
    {
        label: (
            <FormattedMessage
                id='user.settings.notifications.desktopAndMobile.online'
                defaultMessage='Online, away, or offline'
            />
        ),
        value: Constants.UserStatuses.ONLINE,
    },
    {
        label: (
            <FormattedMessage
                id='user.settings.notifications.desktopAndMobile.away'
                defaultMessage='Away or offline'
            />
        ),
        value: Constants.UserStatuses.AWAY,
    },
    {
        label: (
            <FormattedMessage
                id='user.settings.notifications.desktopAndMobile.offline'
                defaultMessage='Offline'
            />
        ),
        value: Constants.UserStatuses.OFFLINE,
    },
];

export function getValueOfSendMobileNotificationWhenSelect(pushStatus?: UserNotifyProps['push_status']): ValueType<SelectOption> {
    if (!pushStatus) {
        return optionsOfSendMobileNotificationsWhenSelect[2];
    }

    const option = optionsOfSendMobileNotificationsWhenSelect.find((option) => option.value === pushStatus);
    if (!option) {
        return optionsOfSendMobileNotificationsWhenSelect[2];
    }

    return option;
}

function getCollapsedText(desktopActivity: UserNotifyProps['desktop'], pushActivity: UserNotifyProps['push']): ReactNode {
    if (desktopActivity === NotificationLevels.ALL) {
        if (pushActivity === NotificationLevels.ALL) {
            return (
                <FormattedMessage
                    id='user.settings.notifications.desktopAndMobile.allForDesktopAndMobile'
                    defaultMessage='All new messages'
                />
            );
        } else if (pushActivity === NotificationLevels.MENTION) {
            return (
                <FormattedMessage
                    id='user.settings.notifications.desktopAndMobile.allDesktopButMobileMentions'
                    defaultMessage='All new messages on desktop; mentions, direct messages, and group messages on mobile'
                />
            );
        } else if (pushActivity === NotificationLevels.NONE) {
            return (
                <FormattedMessage
                    id='user.settings.notifications.desktopAndMobile.allDesktopButMobileNone'
                    defaultMessage='All new messages on desktop; never on mobile'
                />
            );
        }
    } else if (desktopActivity === NotificationLevels.MENTION) {
        if (pushActivity === NotificationLevels.ALL) {
            return (
                <FormattedMessage
                    id='user.settings.notifications.desktopAndMobile.mentionsDesktopButMobileAll'
                    defaultMessage='Mentions, direct messages, and group messages on desktop; all new messages on mobile'
                />
            );
        } else if (pushActivity === NotificationLevels.MENTION) {
            return (
                <FormattedMessage
                    id='user.settings.notifications.desktopAndMobile.mentionsForDesktopAndMobile'
                    defaultMessage='Mentions, direct messages, and group messages'
                />
            );
        } else if (pushActivity === NotificationLevels.NONE) {
            return (
                <FormattedMessage
                    id='user.settings.notifications.desktopAndMobile.mentionsForDesktopButMobileNone'
                    defaultMessage='Mentions, direct messages, and group messages on desktop; never on mobile'
                />
            );
        }
    } else if (desktopActivity === NotificationLevels.NONE) {
        if (pushActivity === NotificationLevels.ALL) {
            return (
                <FormattedMessage
                    id='user.settings.notifications.desktopAndMobile.noneDesktopButMobileAll'
                    defaultMessage='Never on desktop; all new messages on mobile'
                />
            );
        } else if (pushActivity === NotificationLevels.MENTION) {
            return (
                <FormattedMessage
                    id='user.settings.notifications.desktopAndMobile.noneDesktopButMobileMentions'
                    defaultMessage='Never on desktop; mentions, direct messages, and group messages on mobile'
                />
            );
        } else if (pushActivity === NotificationLevels.NONE) {
            return (
                <FormattedMessage
                    id='user.settings.notifications.desktopAndMobile.noneForDesktopAndMobile'
                    defaultMessage='Never'
                />
            );
        }
    }

    return (
        <FormattedMessage
            id='user.settings.notifications.desktopAndMobile.noValidSettings'
            defaultMessage='Configure desktop and mobile settings'
        />
    );
}

export default memo(DesktopAndMobileNotificationSettings);
