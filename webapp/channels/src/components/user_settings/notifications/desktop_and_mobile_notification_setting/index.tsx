// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {Fragment, useEffect, useRef} from 'react';
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

export default function DesktopAndMobileNotificationSettings(props: Props) {
    const editButtonRef = useRef<SettingItemMinComponent>(null);
    const previousActiveRef = useRef(props.active);

    // Focus back on the edit button, after this section was closed after it was opened
    useEffect(() => {
        if (previousActiveRef.current && !props.active && props.areAllSectionsInactive) {
            editButtonRef.current?.focus();
        }

        previousActiveRef.current = props.active;
    }, [props.active, props.areAllSectionsInactive]);

    function handleChangeForMinSection(section: string) {
        props.updateSection(section);
        props.onCancel();
    }

    function handleChangeForMaxSection(section: string) {
        props.updateSection(section);
    }

    function handleChangeForSendNotificationsRadio(event: ChangeEvent<HTMLInputElement>) {
        const value = event.target.value;
        props.setParentState('desktopActivity', value);
    }

    function handleChangeForDifferentMobileNotificationsCheckbox(event: ChangeEvent<HTMLInputElement>) {
        const value = event.target.checked;
        props.setParentState('desktopAndMobileSettingsDifferent', value);
    }

    function handleChangeForSendMobileNotificationForSelect(selectedOption: ValueType<SelectOption>) {
        if (selectedOption && 'value' in selectedOption) {
            props.setParentState('pushActivity', selectedOption.value);
        }
    }

    function handleChangeForThreadsNotificationCheckbox(event: ChangeEvent<HTMLInputElement>) {
        const value = event.target.checked ? NotificationLevels.ALL : NotificationLevels.MENTION;

        // We set thread notification for desktop and mobile to the same value
        props.setParentState('desktopThreads', value);
        props.setParentState('pushThreads', value);
    }

    function handleChangeForSendMobileNotificationsWhenSelect(selectedOption: ValueType<SelectOption>) {
        if (selectedOption && 'value' in selectedOption) {
            props.setParentState('pushStatus', selectedOption.value);
        }
    }

    function getSettingItemMaxInputs() {
        const maximizedSettingInputs = [];

        const sendNotificationsSection = (
            <Fragment key='sendNotificationsSection'>
                <fieldset>
                    <legend className='form-legend'>
                        <FormattedMessage
                            id='user.settings.notifications.desktopAndMobile.sendNotificationFor'
                            defaultMessage='Send notifications for:'
                        />
                    </legend>
                    {optionsOfSendDesktopOrMobileNotifications.map((radioInput) => (
                        <div
                            key={radioInput.value}
                            className='radio'
                        >
                            <label>
                                <input
                                    type='radio'
                                    checked={props.desktopActivity === radioInput.value}
                                    value={radioInput.value}
                                    onChange={handleChangeForSendNotificationsRadio}
                                />
                                {radioInput.label}
                            </label>
                        </div>
                    ))}
                </fieldset>
            </Fragment>
        );
        maximizedSettingInputs.push(sendNotificationsSection);

        if (!props.sendPushNotifications) {
            // If push notifications are disabled, we don't show the rest of the settings and return early
            return maximizedSettingInputs;
        }

        const differentMobileNotificationsSection = (
            <Fragment key='differentMobileNotificationsSection'>
                <br/>
                <div className='checkbox single-checkbox'>
                    <label>
                        <input
                            type='checkbox'
                            checked={props.desktopAndMobileSettingsDifferent}
                            onChange={handleChangeForDifferentMobileNotificationsCheckbox}
                        />
                        <FormattedMessage
                            id='user.settings.notifications.desktopAndMobile.differentMobileNotificationsTitle'
                            defaultMessage='Use different settings for mobile notifications'
                        />
                    </label>
                </div>
            </Fragment>
        );
        maximizedSettingInputs.push(differentMobileNotificationsSection);

        if (props.desktopAndMobileSettingsDifferent) {
            const mobileNotificationsSection = (
                <React.Fragment key='mobileNotificationsSection'>
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
                        options={optionsOfSendDesktopOrMobileNotifications}
                        clearable={false}
                        isClearable={false}
                        isSearchable={false}
                        components={{IndicatorSeparator: NoIndicatorSeparatorComponent}}
                        value={getValueOfSendMobileNotificationForSelect(props.pushActivity)}
                        onChange={handleChangeForSendMobileNotificationForSelect}
                    />
                </React.Fragment>
            );
            maximizedSettingInputs.push(mobileNotificationsSection);
        }

        if (shouldShowDesktopAndMobileThreadNotificationCheckbox(props.isCollapsedThreadsEnabled, props.desktopActivity, props.pushActivity)) {
            const threadNotificationSection = (
                <Fragment key='threadNotificationSection'>
                    <hr/>
                    <div className='checkbox single-checkbox'>
                        <label>
                            <input
                                type='checkbox'
                                checked={getValueOfDesktopAndMobileThreads(props.pushThreads, props.desktopThreads)}
                                onChange={handleChangeForThreadsNotificationCheckbox}
                            />
                            <FormattedMessage
                                id='user.settings.notifications.desktopAndMobile.notifyForthreads'
                                defaultMessage={'Notify me about replies to threads I\'m following'}
                            />
                        </label>
                    </div>
                </Fragment>
            );
            maximizedSettingInputs.push(threadNotificationSection);
        }

        if (shouldShowSendMobileNotificationsWhenSelect(props.desktopActivity, props.pushActivity, props.desktopAndMobileSettingsDifferent)) {
            const pushMobileNotificationsSection = (
                <React.Fragment key='pushMobileNotificationsSection'>
                    <hr/>
                    <label
                        id='pushMobileNotificationsLabel'
                        htmlFor='pushMobileNotificationSelectInput'
                        className='singleSelectLabel'
                    >
                        <FormattedMessage
                            id='user.settings.notifications.desktopAndMobile.pushNotification'
                            defaultMessage='Send mobile notifications when I am:'
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
                        value={getValueOfSendMobileNotificationWhenSelect(props.pushStatus)}
                        onChange={handleChangeForSendMobileNotificationsWhenSelect}
                    />
                </React.Fragment>
            );
            maximizedSettingInputs.push(pushMobileNotificationsSection);
        }

        return maximizedSettingInputs;
    }

    if (props.active) {
        return (
            <SettingItemMax
                title={
                    <FormattedMessage
                        id={'user.settings.notifications.desktopAndMobile.title'}
                        defaultMessage='Desktop and mobile notifications'
                    />
                }
                inputs={getSettingItemMaxInputs()}
                submit={props.onSubmit}
                saving={props.saving}
                serverError={props.error}
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
            describe={getCollapsedText(props.desktopActivity, props.pushActivity)}
            section={UserSettingsNotificationSections.DESKTOP_AND_MOBILE}
            updateSection={handleChangeForMinSection}
        />
    );
}

function NoIndicatorSeparatorComponent() {
    return null;
}

const optionsOfSendDesktopOrMobileNotifications = [
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

const validNotificationLevels = Object.values(NotificationLevels);

export function areDesktopAndMobileSettingsDifferent(desktopActivity: UserNotifyProps['desktop'], pushActivity: UserNotifyProps['push']): boolean {
    if (!desktopActivity || !pushActivity) {
        return true;
    }

    if (!validNotificationLevels.includes(desktopActivity) || !validNotificationLevels.includes(pushActivity)) {
        return true;
    }

    if (desktopActivity === pushActivity) {
        return false;
    }

    return true;
}

export function getValueOfSendMobileNotificationForSelect(pushActivity: UserNotifyProps['push']): ValueType<SelectOption> {
    if (!pushActivity) {
        return optionsOfSendDesktopOrMobileNotifications[1];
    }

    const option = optionsOfSendDesktopOrMobileNotifications.find((option) => option.value === pushActivity);
    if (!option) {
        return optionsOfSendDesktopOrMobileNotifications[1];
    }

    return option;
}

export function shouldShowSendMobileNotificationsWhenSelect(desktopActivity: UserNotifyProps['desktop'], pushActivity: UserNotifyProps['push'], desktopAndMobileSettingsDifferent: boolean): boolean {
    if (!desktopActivity || !pushActivity) {
        return true;
    }

    let shouldShow: boolean;
    if (desktopActivity === NotificationLevels.ALL || desktopActivity === NotificationLevels.MENTION) {
        //  Here we explicitly pass the state of desktopAndMobileSettingsDifferent instead of deriving as
        //  we need to show the select for mobile notifications when the desktop and mobile settings are different
        if (desktopAndMobileSettingsDifferent === true) {
            if (pushActivity === NotificationLevels.NONE) {
                shouldShow = false;
            } else {
                shouldShow = true;
            }
        } else {
            shouldShow = true;
        }
    } else if (desktopActivity === NotificationLevels.NONE) {
        if (desktopAndMobileSettingsDifferent === true) {
            if (pushActivity === NotificationLevels.NONE) {
                shouldShow = false;
            } else {
                shouldShow = true;
            }
        } else {
            shouldShow = false;
        }
    } else {
        shouldShow = true;
    }

    return shouldShow;
}

const optionsOfSendMobileNotificationsWhenSelect: OptionsType<SelectOption> = [
    {
        label: (
            <FormattedMessage
                id='user.settings.notifications.desktopAndMobile.online'
                defaultMessage='Online, away or offline'
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

export function shouldShowDesktopAndMobileThreadNotificationCheckbox(isCollapsedThreadsEnabled: boolean, desktopActivity: UserNotifyProps['desktop'], pushActivity: UserNotifyProps['push']) {
    if (!isCollapsedThreadsEnabled) {
        return false;
    }

    if (!desktopActivity || !pushActivity) {
        return true;
    }

    if (desktopActivity === NotificationLevels.MENTION || pushActivity === NotificationLevels.MENTION) {
        return true;
    }

    if (validNotificationLevels.includes(desktopActivity) && validNotificationLevels.includes(pushActivity)) {
        return false;
    }

    return true;
}

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

export function getValueOfDesktopAndMobileThreads(pushThreads: UserNotifyProps['push_threads'], desktopThreads: UserNotifyProps['desktop_threads']): boolean {
    if (!desktopThreads || !pushThreads) {
        if (!desktopThreads && pushThreads) {
            if (pushThreads === NotificationLevels.ALL) {
                return true;
            }
        } else if (desktopThreads && !pushThreads) {
            if (desktopThreads === NotificationLevels.ALL) {
                return true;
            }
        }
    } else if (desktopThreads === NotificationLevels.ALL || pushThreads === NotificationLevels.ALL) {
        return true;
    }

    return false;
}

function getCollapsedText(desktopActivity: UserNotifyProps['desktop'], pushActivity: UserNotifyProps['push']) {
    let collapsedText: ReactNode = null;
    if (desktopActivity === NotificationLevels.ALL) {
        if (pushActivity === NotificationLevels.ALL) {
            collapsedText = (
                <FormattedMessage
                    id='user.settings.notifications.desktopAndMobile.allForDesktopAndMobile'
                    defaultMessage='All new messages'
                />
            );
        } else if (pushActivity === NotificationLevels.MENTION) {
            collapsedText = (
                <FormattedMessage
                    id='user.settings.notifications.desktopAndMobile.allDesktopButMobileMentions'
                    defaultMessage='All new messages on desktop; Mentions, direct messages, and group messages on mobile'
                />
            );
        } else if (pushActivity === NotificationLevels.NONE) {
            collapsedText = (
                <FormattedMessage
                    id='user.settings.notifications.desktopAndMobile.allDesktopButMobileNone'
                    defaultMessage='All new messages on desktop; Never on mobile'
                />
            );
        }
    } else if (desktopActivity === NotificationLevels.MENTION) {
        if (pushActivity === NotificationLevels.ALL) {
            collapsedText = (
                <FormattedMessage
                    id='user.settings.notifications.desktopAndMobile.mentionsDesktopButMobileAll'
                    defaultMessage='Mentions, direct messages, and group messages on desktop; All new messages on mobile'
                />
            );
        } else if (pushActivity === NotificationLevels.MENTION) {
            collapsedText = (
                <FormattedMessage
                    id='user.settings.notifications.desktopAndMobile.mentionsForDesktopAndMobile'
                    defaultMessage='Mentions, direct messages, and group messages'
                />
            );
        } else if (pushActivity === NotificationLevels.NONE) {
            collapsedText = (
                <FormattedMessage
                    id='user.settings.notifications.desktopAndMobile.mentionsForDesktopButMobileNone'
                    defaultMessage='Mentions, direct messages, and group messages on desktop; Never on mobile'
                />
            );
        }
    } else if (desktopActivity === NotificationLevels.NONE) {
        if (pushActivity === NotificationLevels.ALL) {
            collapsedText = (
                <FormattedMessage
                    id='user.settings.notifications.desktopAndMobile.noneDesktopButMobileAll'
                    defaultMessage='Never on desktop; All new messages on mobile'
                />
            );
        } else if (pushActivity === NotificationLevels.MENTION) {
            collapsedText = (
                <FormattedMessage
                    id='user.settings.notifications.desktopAndMobile.noneDesktopButMobileMentions'
                    defaultMessage='Never on desktop, Mentions, direct messages, and group messages on mobile'
                />
            );
        } else if (pushActivity === NotificationLevels.NONE) {
            collapsedText = (
                <FormattedMessage
                    id='user.settings.notifications.desktopAndMobile.noneForDesktopAndMobile'
                    defaultMessage='Never'
                />
            );
        }
    }

    return collapsedText;
}
