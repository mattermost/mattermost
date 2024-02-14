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
import * as NotificationSounds from 'utils/notification_sounds';

import type {Props as UserSettingsNotificationsProps} from '../user_settings_notifications';

type SelectedOption = {
    label: string;
    value: string;
};

export type SelectOptions = {
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
    desktopThreads?: UserNotifyProps['desktop_threads'];
    pushThreads: UserNotifyProps['push_threads'];
    desktopAndMobileSettingsDifferent: boolean;
    sound: string;
    callsSound: string;
    selectedSound: string;
    callsSelectedSound: string;
    isCallsRingingEnabled: boolean;
};

type State = {
    selectedOption: SelectedOption;
    callsSelectedOption: SelectedOption;
    blurDropdown: boolean;
};

export default class DesktopNotificationSettings extends React.PureComponent<Props, State> {
    dropdownSoundRef: RefObject<ReactSelect>;
    callsDropdownRef: RefObject<ReactSelect>;
    editButtonRef: RefObject<SettingItemMinComponent>;

    constructor(props: Props) {
        super(props);

        this.state = {
            selectedOption: {value: props.selectedSound, label: props.selectedSound},
            callsSelectedOption: {value: props.callsSelectedSound, label: props.callsSelectedSound},
            blurDropdown: false,
        };

        this.dropdownSoundRef = React.createRef();
        this.callsDropdownRef = React.createRef();
        this.editButtonRef = React.createRef();
    }

    focusEditButton(): void {
        this.editButtonRef.current?.focus();
    }

    handleChangeForMinSection = (section: string): void => {
        this.props.updateSection(section);
        this.props.onCancel();
    };

    handleChangeForMaxSection = (section: string): void => {
        this.props.updateSection(section);
    };

    handleChangeForSendNotificationForRadio = (event: ChangeEvent<HTMLInputElement>): void => {
        const value = event.target.value;
        this.props.setParentState('desktopActivity', value);
    };

    handleChangeForDesktopAndMobileDifferentCheckbox = (event: ChangeEvent<HTMLInputElement>): void => {
        const value = event.target.checked;
        this.props.setParentState('desktopAndMobileSettingsDifferent', value);
    };

    handleChangeForSendMobileNotificationForSelect = (selectedOption: ValueType<SelectOptions>): void => {
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

    handleChangeForSendMobileNotificationsWhen = (selectedOption: ValueType<SelectOptions>): void => {
        if (selectedOption && 'value' in selectedOption) {
            this.props.setParentState('pushStatus', selectedOption.value);
        }
    };

    blurDropdown(): void {
        if (!this.state.blurDropdown) {
            this.setState({blurDropdown: true});
            if (this.dropdownSoundRef.current) {
                this.dropdownSoundRef.current.blur();
            }
            if (this.callsDropdownRef.current) {
                this.callsDropdownRef.current.blur();
            }
        }
    }

    buildMaximizedSetting = (): JSX.Element => {
        const maxizimedSettingInputs = [];

        // Desktop notification activity section
        const desktopNotificationSection = (
            <Fragment key='desktopNotificationSection'>
                <fieldset>
                    <legend className='form-legend'>
                        <FormattedMessage
                            id='user.settings.notifications.desktopAndMobile.sendNotificationFor'
                            defaultMessage='Send notifications for:'
                        />
                    </legend>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                checked={this.props.desktopActivity === NotificationLevels.ALL}
                                value={NotificationLevels.ALL}
                                onChange={this.handleChangeForSendNotificationForRadio}
                            />
                            <FormattedMessage
                                id='user.settings.notifications.desktopAndMobile.allActivity'
                                defaultMessage='All new messages'
                            />
                        </label>
                        <br/>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                checked={this.props.desktopActivity === NotificationLevels.MENTION}
                                value={NotificationLevels.MENTION}
                                onChange={this.handleChangeForSendNotificationForRadio}
                            />
                            <FormattedMessage
                                id='user.settings.notifications.desktopAndMobile.onlyMentions'
                                defaultMessage='Mentions, direct messages, and group messages'
                            />
                        </label>
                        <br/>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                checked={this.props.desktopActivity === NotificationLevels.NONE}
                                value={NotificationLevels.NONE}
                                onChange={this.handleChangeForSendNotificationForRadio}
                            />
                            <FormattedMessage
                                id='user.settings.notifications.desktopAndMobile.never'
                                defaultMessage='Nothing'
                            />
                        </label>
                    </div>
                </fieldset>
            </Fragment>
        );
        maxizimedSettingInputs.push(desktopNotificationSection);

        if (this.props.sendPushNotifications) {
            const threadNotificationSection = (
                <Fragment key='differentMobileNotification'>
                    <br/>
                    <div className='checkbox single-checkbox'>
                        <label>
                            <input
                                type='checkbox'
                                checked={this.props.desktopAndMobileSettingsDifferent}
                                onChange={this.handleChangeForDesktopAndMobileDifferentCheckbox}
                            />
                            <FormattedMessage
                                id='user.settings.notifications.desktopAndMobile.diffentMobileNotification.title'
                                defaultMessage='Use different settings for mobile notifications'
                            />
                        </label>
                    </div>
                </Fragment>
            );
            maxizimedSettingInputs.push(threadNotificationSection);
        }

        if (this.props.sendPushNotifications && this.props.desktopAndMobileSettingsDifferent) {
            const mobileNotificationSection = (
                <React.Fragment key='sendMobileNotificationForKey'>
                    <br/>
                    <label
                        id='sendMobileNotificationForLabel'
                        htmlFor='sendMobileNotificationForSelectInput'
                        className='singleSelectLabel'
                    >
                        <FormattedMessage
                            id='user.settings.notifications.desktopAndMobile.sendNotificationFor.mobile'
                            defaultMessage='Send mobile notifications for:'
                        />
                    </label>
                    <ReactSelect
                        inputId='sendMobileNotificationForSelectInput'
                        aria-labelledby='sendMobileNotificationForLabel'
                        className='react-select singleSelect'
                        classNamePrefix='react-select'
                        options={sendMobileNotificationsForOptions}
                        clearable={false}
                        isClearable={false}
                        isSearchable={false}
                        onChange={this.handleChangeForSendMobileNotificationForSelect}
                        value={getValueOfSendMobileNotificationForSelect(this.props.pushActivity)}
                        components={{IndicatorSeparator: NoIndicatorSeparatorComponent}}
                    />
                    <hr/>
                </React.Fragment>
            );
            maxizimedSettingInputs.push(mobileNotificationSection);
        }

        maxizimedSettingInputs.push(<hr key='desktopAndMobileNotificationDivider'/>);

        // Thread notifications section for desktop and mobile
        if (this.props.sendPushNotifications && this.props.isCollapsedThreadsEnabled && this.props.desktopActivity === NotificationLevels.MENTION) {
            const isChecked = getCheckedStateForDesktopThreads(this.props.pushThreads, this.props.desktopThreads);

            const threadNotificationSection = (
                <Fragment key='threadNotificationSection'>
                    <div className='checkbox single-checkbox'>
                        <label>
                            <input
                                type='checkbox'
                                checked={isChecked}
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

        // Push mobile notifications section
        if (this.props.sendPushNotifications && shouldShowSendMobileNotificationsForSelect(this.props.desktopActivity, this.props.pushActivity, this.props.desktopAndMobileSettingsDifferent)) {
            const pushMobileNotificationSection = (
                <React.Fragment key='userNotificationPushStatusOptions'>
                    <hr/>
                    <label
                        id='pushNotificationLabel'
                        htmlFor='pushNotificationSelectInput'
                        className='singleSelectLabel'
                    >
                        <FormattedMessage
                            id='user.settings.notifications.desktopAndMobile.pushNotification'
                            defaultMessage='Send mobile notifications when I am:'
                        />
                    </label>
                    <ReactSelect
                        inputId='pushNotificationSelectInput'
                        aria-labelledby='pushNotificationLabel'
                        className='react-select singleSelect'
                        classNamePrefix='react-select'
                        options={sendMobileNotificationWhenOptions}
                        clearable={false}
                        isClearable={false}
                        isSearchable={false}
                        onChange={this.handleChangeForSendMobileNotificationsWhen}
                        value={getValueOfSendMobileNotificationWhenSelect(this.props.pushStatus)}
                        components={{IndicatorSeparator: NoIndicatorSeparatorComponent}}
                    />
                </React.Fragment>
            );
            maxizimedSettingInputs.push(pushMobileNotificationSection);
        }

        return (
            <SettingItemMax
                title={
                    <FormattedMessage
                        id={'user.settings.notifications.desktopAndMobile.title'}
                        defaultMessage='Desktop and mobile notifications'
                    />
                }
                inputs={maxizimedSettingInputs}
                submit={this.props.onSubmit}
                saving={this.props.saving}
                serverError={this.props.error}
                updateSection={this.handleChangeForMaxSection}
            />
        );
    };

    buildMinimizedSetting = () => {
        const hasSoundOption = NotificationSounds.hasSoundOptions();
        let collapsedDescription: ReactNode = null;

        if (this.props.desktopActivity === NotificationLevels.MENTION) {
            if (hasSoundOption && this.props.sound !== 'false') {
                collapsedDescription = (
                    <FormattedMessage
                        id='user.settings.notifications.desktop.mentionsSound'
                        defaultMessage='For mentions and direct messages, with sound'
                    />
                );
            } else if (hasSoundOption && this.props.sound === 'false') {
                collapsedDescription = (
                    <FormattedMessage
                        id='user.settings.notifications.desktop.mentionsNoSound'
                        defaultMessage='For mentions and direct messages, without sound'
                    />
                );
            } else {
                collapsedDescription = (
                    <FormattedMessage
                        id='user.settings.notifications.desktop.mentionsSoundHidden'
                        defaultMessage='For mentions and direct messages'
                    />
                );
            }
        } else if (this.props.desktopActivity === NotificationLevels.NONE) {
            collapsedDescription = (
                <FormattedMessage
                    id='user.settings.notifications.off'
                    defaultMessage='Off'
                />
            );
        } else {
            if (hasSoundOption && this.props.sound !== 'false') { //eslint-disable-line no-lonely-if
                collapsedDescription = (
                    <FormattedMessage
                        id='user.settings.notifications.desktop.allSound'
                        defaultMessage='For all activity, with sound'
                    />
                );
            } else if (hasSoundOption && this.props.sound === 'false') {
                collapsedDescription = (
                    <FormattedMessage
                        id='user.settings.notifications.desktop.allNoSound'
                        defaultMessage='For all activity, without sound'
                    />
                );
            } else {
                collapsedDescription = (
                    <FormattedMessage
                        id='user.settings.notifications.desktop.allSoundHidden'
                        defaultMessage='For all activity'
                    />
                );
            }
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
                describe={collapsedDescription}
                section={UserSettingsNotificationSections.DESKTOP_AND_MOBILE}
                updateSection={this.handleChangeForMinSection}
            />
        );
    };

    componentDidUpdate(prevProps: Props) {
        this.blurDropdown();
        if (prevProps.active && !this.props.active && this.props.areAllSectionsInactive) {
            this.focusEditButton();
        }
        if (this.props.selectedSound !== prevProps.selectedSound) {
            this.setState({selectedOption: {value: this.props.selectedSound, label: this.props.selectedSound}});
        }
        if (this.props.callsSelectedSound !== prevProps.callsSelectedSound) {
            this.setState({callsSelectedOption: {value: this.props.callsSelectedSound, label: this.props.callsSelectedSound}});
        }
    }

    render() {
        if (this.props.active) {
            return this.buildMaximizedSetting();
        }

        return this.buildMinimizedSetting();
    }
}

function NoIndicatorSeparatorComponent() {
    return null;
}

const sendMobileNotificationWhenOptions: OptionsType<SelectOptions> = [
    {
        label: (
            <FormattedMessage
                id='user.settings.push_notification.online'
                defaultMessage='Online, away or offline'
            />
        ),
        value: Constants.UserStatuses.ONLINE,
    },
    {
        label: (
            <FormattedMessage
                id='user.settings.push_notification.away'
                defaultMessage='Away or offline'
            />
        ),
        value: Constants.UserStatuses.AWAY,
    },
    {
        label: (
            <FormattedMessage
                id='user.settings.push_notification.offline'
                defaultMessage='Offline'
            />
        ),
        value: Constants.UserStatuses.OFFLINE,
    },
];

export function getValueOfSendMobileNotificationWhenSelect(pushStatus?: UserNotifyProps['push_status']): ValueType<SelectOptions> {
    if (!pushStatus) {
        return sendMobileNotificationWhenOptions[2];
    }
    const option = sendMobileNotificationWhenOptions.find((option) => option.value === pushStatus);
    if (!option) {
        return sendMobileNotificationWhenOptions[2];
    }

    return option;
}

export function getCheckedStateForDesktopThreads(pushThreads: UserNotifyProps['push_threads'], desktopThreads?: UserNotifyProps['desktop_threads']): boolean {
    if (!desktopThreads) {
        return false;
    } else if (desktopThreads === NotificationLevels.ALL && pushThreads === NotificationLevels.ALL) {
        return true;
    }

    return false;
}

export const validNotificationLevels = [NotificationLevels.DEFAULT, NotificationLevels.ALL, NotificationLevels.MENTION, NotificationLevels.NONE];

export function getCheckedStateForDissimilarDesktopAndMobileNotification(desktopActivity: UserNotifyProps['desktop'], pushActivity: UserNotifyProps['push']): boolean {
    const validActivities = [NotificationLevels.DEFAULT, NotificationLevels.ALL, NotificationLevels.MENTION, NotificationLevels.NONE];
    if (!validActivities.includes(desktopActivity) || !validActivities.includes(pushActivity)) {
        return false;
    }

    return desktopActivity === pushActivity;
}

export function getDefaultMobileNotificationLevelWhenUsedDifferent(desktopActivity: UserNotifyProps['desktop']): UserNotifyProps['push'] {
    if (!validNotificationLevels.includes(desktopActivity)) {
        return NotificationLevels.MENTION;
    }
    const currentIndex = validNotificationLevels.indexOf(desktopActivity);
    const nextIndex = (currentIndex + 1) % validNotificationLevels.length;
    const nextActivity = validNotificationLevels[nextIndex];
    if (nextActivity === NotificationLevels.DEFAULT) {
        return NotificationLevels.MENTION;
    }
    return nextActivity;
}

const sendMobileNotificationsForOptions: OptionsType<SelectOptions> = [
    {
        label: (
            <FormattedMessage
                id='user.settings.notifications.desktopAndMobile.mobilePush.allActivity'
                defaultMessage='All new messages'
            />
        ),
        value: NotificationLevels.ALL,
    },
    {
        label: (
            <FormattedMessage
                id='user.settings.notifications.desktopAndMobile.mobilePush.onlyMentions'
                defaultMessage='Mentions, direct messages, and group messages'
            />
        ),
        value: NotificationLevels.MENTION,
    },
    {
        label: (
            <FormattedMessage
                id='user.settings.notifications.desktopAndMobile.mobilePush.never'
                defaultMessage='Nothing'
            />
        ),
        value: NotificationLevels.NONE,
    },
];

function getValueOfSendMobileNotificationForSelect(pushActivity: UserNotifyProps['push']): ValueType<SelectOptions> {
    if (!pushActivity) {
        return sendMobileNotificationsForOptions[2];
    }

    const option = sendMobileNotificationsForOptions.find((option) => option.value === pushActivity);
    if (!option) {
        return sendMobileNotificationsForOptions[2];
    }

    return option;
}

function shouldShowSendMobileNotificationsForSelect(desktopActivity: UserNotifyProps['desktop'], pushActivity: UserNotifyProps['push'], desktopAndMobileSettingsDifferent: boolean): boolean {
    if (desktopActivity === NotificationLevels.ALL || desktopActivity === NotificationLevels.MENTION) {
        if (desktopAndMobileSettingsDifferent === false) {
            return true;
        }
        if (pushActivity === NotificationLevels.ALL || pushActivity === NotificationLevels.MENTION) {
            return true;
        }
        return false;
    }
    return false;
}
