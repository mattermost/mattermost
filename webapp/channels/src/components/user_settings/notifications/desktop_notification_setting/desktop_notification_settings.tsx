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
import {a11yFocus} from 'utils/utils';

import type {Props as UserSettingsNotificationsProps} from '../user_settings_notifications';

type SelectedOption = {
    label: string;
    value: string;
};

export type PushNotificationOption = {
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

    handleMinUpdateSection = (section: string): void => {
        this.props.updateSection(section);
        this.props.onCancel();
    };

    handleMaxUpdateSection = (section: string): void => this.props.updateSection(section);

    handleOnChange = (e: ChangeEvent<HTMLInputElement>): void => {
        const key = e.currentTarget.getAttribute('data-key');
        const value = e.currentTarget.getAttribute('data-value');
        if (key && value) {
            this.props.setParentState(key, value);
            a11yFocus(e.currentTarget);
        }
        if (key === 'callsDesktopSound' && value === 'false') {
            NotificationSounds.stopTryNotificationRing();
        }
    };

    handleChangeForThreadsNotify = (e: ChangeEvent<HTMLInputElement>): void => {
        const value = e.target.checked ? NotificationLevels.ALL : NotificationLevels.MENTION;

        // We set thread notification for desktop and mobile to the same value
        this.props.setParentState('desktopThreads', value);
        this.props.setParentState('pushThreads', value);
    };

    setDesktopNotificationSound: ReactSelect['onChange'] = (selectedOption: ValueType<SelectedOption>): void => {
        if (selectedOption && 'value' in selectedOption) {
            this.props.setParentState('desktopNotificationSound', selectedOption.value);
            this.setState({selectedOption});
            NotificationSounds.tryNotificationSound(selectedOption.value);
        }
    };

    handlePushNotificationChange = (selectedOption: ValueType<PushNotificationOption>): void => {
        if (selectedOption && 'value' in selectedOption) {
            this.props.setParentState('pushStatus', selectedOption.value);
        }
    };

    setCallsNotificationRing: ReactSelect['onChange'] = (selectedOption: ValueType<SelectedOption>): void => {
        if (selectedOption && 'value' in selectedOption) {
            this.props.setParentState('callsNotificationSound', selectedOption.value);
            this.setState({callsSelectedOption: selectedOption});
            NotificationSounds.tryNotificationRing(selectedOption.value);
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

        const activityRadio = [false, false, false];
        if (this.props.desktopActivity === NotificationLevels.MENTION) {
            activityRadio[1] = true;
        } else if (this.props.desktopActivity === NotificationLevels.NONE) {
            activityRadio[2] = true;
        } else {
            activityRadio[0] = true;
        }

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
                                id='desktopNotificationAllActivity'
                                type='radio'
                                name='desktopNotificationLevel'
                                checked={activityRadio[0]}
                                data-key={'desktopActivity'}
                                data-value={NotificationLevels.ALL}
                                onChange={this.handleOnChange}
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
                                id='desktopNotificationMentions'
                                type='radio'
                                name='desktopNotificationLevel'
                                checked={activityRadio[1]}
                                data-key={'desktopActivity'}
                                data-value={NotificationLevels.MENTION}
                                onChange={this.handleOnChange}
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
                                id='desktopNotificationNever'
                                type='radio'
                                name='desktopNotificationLevel'
                                checked={activityRadio[2]}
                                data-key={'desktopActivity'}
                                data-value={NotificationLevels.NONE}
                                onChange={this.handleOnChange}
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

        maxizimedSettingInputs.push(<hr key='desktopAndMobileNotificationDivider'/>);

        // Thread notifications section for desktop and mobile
        if (this.props.sendPushNotifications && this.props.isCollapsedThreadsEnabled && this.props.desktopActivity === NotificationLevels.MENTION) {
            const isChecked = getCheckedStateForDesktopThreads(this.props.pushThreads, this.props.desktopThreads);

            const threadNotificationSection = (
                <Fragment key='threadNotificationSection'>
                    <div className='checkbox single-checkbox'>
                        <label>
                            <input
                                id='desktopThreadsNotificationAllActivity'
                                type='checkbox'
                                name='desktopThreadsNotificationLevel'
                                checked={isChecked}
                                onChange={this.handleChangeForThreadsNotify}
                            />
                            <FormattedMessage
                                id='user.settings.notifications.desktopAndMobile.notifyForthreads'
                                defaultMessage={'Notify me about replies to threads I\'m following'}
                            />
                        </label>
                    </div>
                    <hr/>
                </Fragment>
            );
            maxizimedSettingInputs.push(threadNotificationSection);
        }

        // Push mobile notifications section
        if (this.props.sendPushNotifications && this.props.pushActivity !== NotificationLevels.NONE) {
            const pushMobileNotificationSection = (
                <React.Fragment key='userNotificationPushStatusOptions'>
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
                        options={pushMobileNotificationOptions}
                        clearable={false}
                        isClearable={false}
                        isSearchable={false}
                        onChange={this.handlePushNotificationChange}
                        value={getPushNotificationOptionValue(this.props.pushStatus)}
                        components={{IndicatorSeparator: NoIndicatorSeparatorComponent}}
                    />
                </React.Fragment>
            );
            maxizimedSettingInputs.push(pushMobileNotificationSection);
        }

        // let soundSection;
        // let notificationSelection;
        // let callsSection;
        // let callsNotificationSelection;
        // if (this.props.activity !== NotificationLevels.NONE) {
        //     const soundRadio = [false, false];
        //     if (this.props.sound === 'false') {
        //         soundRadio[1] = true;
        //     } else {
        //         soundRadio[0] = true;
        //     }

        //     if (this.props.sound === 'true') {
        //         const sounds = Array.from(NotificationSounds.notificationSounds.keys());
        //         const options = sounds.map((sound) => {
        //             return {value: sound, label: sound};
        //         });

        //         notificationSelection = (<div className='pt-2'>
        //             <ReactSelect
        //                 className='react-select notification-sound-dropdown'
        //                 classNamePrefix='react-select'
        //                 id='displaySoundNotification'
        //                 options={options}
        //                 clearable={false}
        //                 onChange={this.setDesktopNotificationSound}
        //                 value={this.state.selectedOption}
        //                 isSearchable={false}
        //                 ref={this.dropdownSoundRef}
        //                 components={{SingleValue: (props) => <div data-testid='displaySoundNotificationValue'>{props.children}</div>}}
        //             /></div>);
        //     }

        //     if (this.props.isCallsRingingEnabled) {
        //         const callsSoundRadio = [false, false];
        //         if (this.props.callsSound === 'false') {
        //             callsSoundRadio[1] = true;
        //         } else {
        //             callsSoundRadio[0] = true;
        //         }

        //         if (this.props.callsSound === 'true') {
        //             const callsSounds = Array.from(NotificationSounds.callsNotificationSounds.keys());
        //             const callsOptions = callsSounds.map((sound) => {
        //                 return {value: sound, label: sound};
        //             });

        //             callsNotificationSelection = (<div className='pt-2'>
        //                 <ReactSelect
        //                     className='react-select notification-sound-dropdown'
        //                     classNamePrefix='react-select'
        //                     id='displayCallsSoundNotification'
        //                     options={callsOptions}
        //                     clearable={false}
        //                     onChange={this.setCallsNotificationRing}
        //                     value={this.state.callsSelectedOption}
        //                     isSearchable={false}
        //                     ref={this.callsDropdownRef}
        //                     components={{SingleValue: (props) => <div data-testid='displayCallsSoundNotificationValue'>{props.children}</div>}}
        //                 /></div>);
        //         }

        //         callsSection = (
        //             <>
        //                 <hr/>
        //                 <fieldset>
        //                     <legend className='form-legend'>
        //                         <FormattedMessage
        //                             id='user.settings.notifications.desktop.calls_sound'
        //                             defaultMessage='Notification sound for incoming calls'
        //                         />
        //                     </legend>
        //                     <div className='radio'>
        //                         <label>
        //                             <input
        //                                 id='callsSoundOn'
        //                                 type='radio'
        //                                 name='callsNotificationSounds'
        //                                 checked={callsSoundRadio[0]}
        //                                 data-key={'callsDesktopSound'}
        //                                 data-value={'true'}
        //                                 onChange={this.handleOnChange}
        //                             />
        //                             <FormattedMessage
        //                                 id='user.settings.notifications.on'
        //                                 defaultMessage='On'
        //                             />
        //                         </label>
        //                         <br/>
        //                     </div>
        //                     <div className='radio'>
        //                         <label>
        //                             <input
        //                                 id='soundOff'
        //                                 type='radio'
        //                                 name='callsNotificationSounds'
        //                                 checked={callsSoundRadio[1]}
        //                                 data-key={'callsDesktopSound'}
        //                                 data-value={'false'}
        //                                 onChange={this.handleOnChange}
        //                             />
        //                             <FormattedMessage
        //                                 id='user.settings.notifications.off'
        //                                 defaultMessage='Off'
        //                             />
        //                         </label>
        //                         <br/>
        //                     </div>
        //                     {callsNotificationSelection}
        //                 </fieldset>
        //             </>
        //         );
        //     }

        //     if (NotificationSounds.hasSoundOptions()) {
        //         soundSection = (
        //             <fieldset>
        //                 <legend className='form-legend'>
        //                     <FormattedMessage
        //                         id='user.settings.notifications.desktop.sound'
        //                         defaultMessage='Notification sound'
        //                     />
        //                 </legend>
        //                 <div className='radio'>
        //                     <label>
        //                         <input
        //                             id='soundOn'
        //                             type='radio'
        //                             name='notificationSounds'
        //                             checked={soundRadio[0]}
        //                             data-key={'desktopSound'}
        //                             data-value={'true'}
        //                             onChange={this.handleOnChange}
        //                         />
        //                         <FormattedMessage
        //                             id='user.settings.notifications.on'
        //                             defaultMessage='On'
        //                         />
        //                     </label>
        //                     <br/>
        //                 </div>
        //                 <div className='radio'>
        //                     <label>
        //                         <input
        //                             id='soundOff'
        //                             type='radio'
        //                             name='notificationSounds'
        //                             checked={soundRadio[1]}
        //                             data-key={'desktopSound'}
        //                             data-value={'false'}
        //                             onChange={this.handleOnChange}
        //                         />
        //                         <FormattedMessage
        //                             id='user.settings.notifications.off'
        //                             defaultMessage='Off'
        //                         />
        //                     </label>
        //                     <br/>
        //                 </div>
        //                 {notificationSelection}
        //                 <div className='mt-5'>
        //                     <FormattedMessage
        //                         id='user.settings.notifications.sounds_info'
        //                         defaultMessage='Notification sounds are available on Firefox, Edge, Safari, Chrome and Mattermost Desktop Apps.'
        //                     />
        //                 </div>
        //             </fieldset>
        //         );
        //     } else {
        //         soundSection = (
        //             <fieldset>
        //                 <legend className='form-legend'>
        //                     <FormattedMessage
        //                         id='user.settings.notifications.desktop.sound'
        //                         defaultMessage='Notification sound'
        //                     />
        //                 </legend>
        //                 <br/>
        //                 <FormattedMessage
        //                     id='user.settings.notifications.soundConfig'
        //                     defaultMessage='Please configure notification sounds in your browser settings'
        //                 />
        //             </fieldset>
        //         );
        //     }
        // }

        // maxizimedSettingInputs.push(
        //     <>
        //         {soundSection}
        //         {callsSection}
        //     </>,
        // );

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
                updateSection={this.handleMaxUpdateSection}
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
                updateSection={this.handleMinUpdateSection}
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

const pushMobileNotificationOptions: OptionsType<PushNotificationOption> = [
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

export function getPushNotificationOptionValue(pushStatus?: UserNotifyProps['push_status']): ValueType<PushNotificationOption> {
    if (!pushStatus) {
        return pushMobileNotificationOptions[2];
    }
    const option = pushMobileNotificationOptions.find((option) => option.value === pushStatus);
    if (!option) {
        return pushMobileNotificationOptions[2];
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
