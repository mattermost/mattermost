// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {Fragment} from 'react';
import type {ChangeEvent, ReactNode, RefObject} from 'react';
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

type Props = {
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

export default class DesktopNotificationSettings extends React.PureComponent<Props> {
    editButtonRef: RefObject<SettingItemMinComponent>;

    constructor(props: Props) {
        super(props);

        this.editButtonRef = React.createRef();
    }

    handleChangeForMinSection = (section: string): void => {
        this.props.updateSection(section);
        this.props.onCancel();
    };

    handleChangeForMaxSection = (section: string): void => {
        this.props.updateSection(section);
    };

    handleChangeForSendNotificationsRadio = (event: ChangeEvent<HTMLInputElement>): void => {
        const value = event.target.value;
        this.props.setParentState('desktopActivity', value);
    };

    handleChangeForDifferentMobileNotificationsCheckbox = (event: ChangeEvent<HTMLInputElement>): void => {
        const value = event.target.checked;
        this.props.setParentState('desktopAndMobileSettingsDifferent', value);
    };

    handleChangeForSendMobileNotificationForSelect = (selectedOption: ValueType<SelectOption>): void => {
        if (selectedOption && 'value' in selectedOption) {
            this.props.setParentState('pushActivity', selectedOption.value);
        }
    };

    handleChangeForThreadsNotificationCheckbox = (e: ChangeEvent<HTMLInputElement>): void => {
        const value = e.target.checked ? NotificationLevels.ALL : NotificationLevels.MENTION;

        // We set thread notification for desktop and mobile to the same value
        this.props.setParentState('desktopThreads', value);
        this.props.setParentState('pushThreads', value);
    };

    handleChangeForSendMobileNotificationsWhenSelect = (selectedOption: ValueType<SelectOption>): void => {
        if (selectedOption && 'value' in selectedOption) {
            this.props.setParentState('pushStatus', selectedOption.value);
        }
    };

    getSettingItemMaxInputs = () => {
        const maxizimedSettingInputs = [];

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
                                    checked={this.props.desktopActivity === radioInput.value}
                                    value={radioInput.value}
                                    onChange={this.handleChangeForSendNotificationsRadio}
                                />
                                {radioInput.label}
                            </label>
                        </div>
                    ))}
                </fieldset>
            </Fragment>
        );
        maxizimedSettingInputs.push(sendNotificationsSection);

        if (!this.props.sendPushNotifications) {
            // If push notifications are disabled, we don't show the rest of the settings and return early
            return maxizimedSettingInputs;
        }

        const differentMobileNotificationsSection = (
            <Fragment key='differentMobileNotificationsSection'>
                <br/>
                <div className='checkbox single-checkbox'>
                    <label>
                        <input
                            type='checkbox'
                            checked={this.props.desktopAndMobileSettingsDifferent}
                            onChange={this.handleChangeForDifferentMobileNotificationsCheckbox}
                        />
                        <FormattedMessage
                            id='user.settings.notifications.desktopAndMobile.differentMobileNotificationsTitle'
                            defaultMessage='Use different settings for mobile notifications'
                        />
                    </label>
                </div>
            </Fragment>
        );
        maxizimedSettingInputs.push(differentMobileNotificationsSection);

        if (this.props.desktopAndMobileSettingsDifferent) {
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
                        value={getValueOfSendMobileNotificationForSelect(this.props.pushActivity)}
                        onChange={this.handleChangeForSendMobileNotificationForSelect}
                    />
                </React.Fragment>
            );
            maxizimedSettingInputs.push(mobileNotificationsSection);
        }

        if (shouldShowDesktopAndMobileThreadNotificationCheckbox(this.props.isCollapsedThreadsEnabled, this.props.desktopActivity, this.props.pushActivity)) {
            const threadNotificationSection = (
                <Fragment key='threadNotificationSection'>
                    <hr/>
                    <div className='checkbox single-checkbox'>
                        <label>
                            <input
                                type='checkbox'
                                checked={getValueOfDesktopAndMobileThreads(this.props.pushThreads, this.props.desktopThreads)}
                                onChange={this.handleChangeForThreadsNotificationCheckbox}
                            />
                            <FormattedMessage
                                id='user.settings.notifications.desktopAndMobile.notifyForthreads'
                                defaultMessage={'Notify me about replies to threads I\'m following'}
                            />
                        </label>
                    </div>
                </Fragment>
            );
            maxizimedSettingInputs.push(threadNotificationSection);
        }

        if (shouldShowSendMobileNotificationsWhenSelect(this.props.desktopActivity, this.props.pushActivity, this.props.desktopAndMobileSettingsDifferent)) {
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
                        value={getValueOfSendMobileNotificationWhenSelect(this.props.pushStatus)}
                        onChange={this.handleChangeForSendMobileNotificationsWhenSelect}
                    />
                </React.Fragment>
            );
            maxizimedSettingInputs.push(pushMobileNotificationsSection);
        }

        return maxizimedSettingInputs;
    };

    componentDidUpdate(prevProps: Props) {
        if (prevProps.active && !this.props.active && this.props.areAllSectionsInactive) {
            this.editButtonRef.current?.focus();
        }
    }

    render() {
        if (this.props.active) {
            return (
                <SettingItemMax
                    title={
                        <FormattedMessage
                            id={'user.settings.notifications.desktopAndMobile.title'}
                            defaultMessage='Desktop and mobile notifications'
                        />
                    }
                    inputs={this.getSettingItemMaxInputs()}
                    submit={this.props.onSubmit}
                    saving={this.props.saving}
                    serverError={this.props.error}
                    updateSection={this.handleChangeForMaxSection}
                />
            );
        }

        return (
            <SettingItemMin
                ref={this.editButtonRef}
                title={
                    <FormattedMessage
                        id='user.settings.notifications.desktopAndMobile.title'
                        defaultMessage='Desktop and mobile notifications'
                    />
                }
                describe={getCollapsedText(this.props.desktopActivity, this.props.pushActivity)}
                section={UserSettingsNotificationSections.DESKTOP_AND_MOBILE}
                updateSection={this.handleChangeForMinSection}
            />
        );
    }
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
