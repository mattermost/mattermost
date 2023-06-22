// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ChangeEvent, RefObject} from 'react';
import ReactSelect, {ValueType} from 'react-select';
import {FormattedMessage} from 'react-intl';

import {NotificationLevels} from 'utils/constants';
import * as NotificationSounds from 'utils/notification_sounds';
import * as Utils from 'utils/utils';
import {t} from 'utils/i18n';

import SettingItemMin from 'components/setting_item_min';
import SettingItemMax from 'components/setting_item_max';
import SettingItemMinComponent from 'components/setting_item_min/setting_item_min';

type SelectedOption = {
    label: string;
    value: string;
};

type Props = {
    activity: string;
    threads?: string;
    sound: string;
    callsSound: string;
    updateSection: (section: string) => void;
    setParentState: (key: string, value: string | boolean) => void;
    submit: () => void;
    cancel: () => void;
    error: string;
    active: boolean;
    areAllSectionsInactive: boolean;
    saving: boolean;
    selectedSound: string;
    callsSelectedSound: string;
    isCollapsedThreadsEnabled: boolean;
    isCallsEnabled: boolean;
};

type State = {
    selectedOption: SelectedOption;
    callsSelectedOption: SelectedOption;
    blurDropdown: boolean;
};

export default class DesktopNotificationSettings extends React.PureComponent<Props, State> {
    dropdownSoundRef: RefObject<ReactSelect>;
    callsDropdownRef: RefObject<ReactSelect>;
    minRef: RefObject<SettingItemMinComponent>;

    constructor(props: Props) {
        super(props);
        const selectedOption = {value: props.selectedSound, label: props.selectedSound};
        const callsSelectedOption = {value: props.callsSelectedSound, label: props.callsSelectedSound};
        this.state = {
            selectedOption,
            callsSelectedOption,
            blurDropdown: false,
        };
        this.dropdownSoundRef = React.createRef();
        this.callsDropdownRef = React.createRef();
        this.minRef = React.createRef();
    }

    focusEditButton(): void {
        this.minRef.current?.focus();
    }

    handleMinUpdateSection = (section: string): void => {
        this.props.updateSection(section);
        this.props.cancel();
    };

    handleMaxUpdateSection = (section: string): void => this.props.updateSection(section);

    handleOnChange = (e: ChangeEvent<HTMLInputElement>): void => {
        const key = e.currentTarget.getAttribute('data-key');
        const value = e.currentTarget.getAttribute('data-value');
        if (key && value) {
            this.props.setParentState(key, value);
            Utils.a11yFocus(e.currentTarget);
        }
        if (key === 'callsDesktopSound' && value === 'false') {
            NotificationSounds.stopTryNotificationRing();
        }
    };

    handleThreadsOnChange = (e: ChangeEvent<HTMLInputElement>): void => {
        const value = e.target.checked ? NotificationLevels.ALL : NotificationLevels.MENTION;
        this.props.setParentState('desktopThreads', value);
    };

    setDesktopNotificationSound: ReactSelect['onChange'] = (selectedOption: ValueType<SelectedOption>): void => {
        if (selectedOption && 'value' in selectedOption) {
            this.props.setParentState('desktopNotificationSound', selectedOption.value);
            this.setState({selectedOption});
            NotificationSounds.tryNotificationSound(selectedOption.value);
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
        const inputs = [];

        const activityRadio = [false, false, false];
        if (this.props.activity === NotificationLevels.MENTION) {
            activityRadio[1] = true;
        } else if (this.props.activity === NotificationLevels.NONE) {
            activityRadio[2] = true;
        } else {
            activityRadio[0] = true;
        }

        let soundSection;
        let notificationSelection;
        let threadsNotificationSelection;
        let callsSection;
        let callsNotificationSelection;
        if (this.props.activity !== NotificationLevels.NONE) {
            const soundRadio = [false, false];
            if (this.props.sound === 'false') {
                soundRadio[1] = true;
            } else {
                soundRadio[0] = true;
            }

            if (this.props.sound === 'true') {
                const sounds = Array.from(NotificationSounds.notificationSounds.keys());
                const options = sounds.map((sound) => {
                    return {value: sound, label: sound};
                });

                notificationSelection = (<div className='pt-2'>
                    <ReactSelect
                        className='react-select notification-sound-dropdown'
                        classNamePrefix='react-select'
                        id='displaySoundNotification'
                        options={options}
                        clearable={false}
                        onChange={this.setDesktopNotificationSound}
                        value={this.state.selectedOption}
                        isSearchable={false}
                        ref={this.dropdownSoundRef}
                    /></div>);
            }

            if (this.props.isCallsEnabled) {
                const callsSoundRadio = [false, false];
                if (this.props.callsSound === 'false') {
                    callsSoundRadio[1] = true;
                } else {
                    callsSoundRadio[0] = true;
                }

                if (this.props.callsSound === 'true') {
                    const callsSounds = Array.from(NotificationSounds.callsNotificationSounds.keys());
                    const callsOptions = callsSounds.map((sound) => {
                        return {value: sound, label: sound};
                    });

                    callsNotificationSelection = (<div className='pt-2'>
                        <ReactSelect
                            className='react-select notification-sound-dropdown'
                            classNamePrefix='react-select'
                            id='displayCallsSoundNotification'
                            options={callsOptions}
                            clearable={false}
                            onChange={this.setCallsNotificationRing}
                            value={this.state.callsSelectedOption}
                            isSearchable={false}
                            ref={this.callsDropdownRef}
                        /></div>);
                }

                callsSection = (
                    <>
                        <hr/>
                        <fieldset>
                            <legend className='form-legend'>
                                <FormattedMessage
                                    id='user.settings.notifications.desktop.calls_sound'
                                    defaultMessage='Notification sound for incoming calls'
                                />
                            </legend>
                            <div className='radio'>
                                <label>
                                    <input
                                        id='callsSoundOn'
                                        type='radio'
                                        name='callsNotificationSounds'
                                        checked={callsSoundRadio[0]}
                                        data-key={'callsDesktopSound'}
                                        data-value={'true'}
                                        onChange={this.handleOnChange}
                                    />
                                    <FormattedMessage
                                        id='user.settings.notifications.on'
                                        defaultMessage='On'
                                    />
                                </label>
                                <br/>
                            </div>
                            <div className='radio'>
                                <label>
                                    <input
                                        id='soundOff'
                                        type='radio'
                                        name='callsNotificationSounds'
                                        checked={callsSoundRadio[1]}
                                        data-key={'callsDesktopSound'}
                                        data-value={'false'}
                                        onChange={this.handleOnChange}
                                    />
                                    <FormattedMessage
                                        id='user.settings.notifications.off'
                                        defaultMessage='Off'
                                    />
                                </label>
                                <br/>
                            </div>
                            {callsNotificationSelection}
                        </fieldset>
                    </>
                );
            }

            if (NotificationSounds.hasSoundOptions()) {
                soundSection = (
                    <fieldset>
                        <legend className='form-legend'>
                            <FormattedMessage
                                id='user.settings.notifications.desktop.sound'
                                defaultMessage='Notification sound'
                            />
                        </legend>
                        <div className='radio'>
                            <label>
                                <input
                                    id='soundOn'
                                    type='radio'
                                    name='notificationSounds'
                                    checked={soundRadio[0]}
                                    data-key={'desktopSound'}
                                    data-value={'true'}
                                    onChange={this.handleOnChange}
                                />
                                <FormattedMessage
                                    id='user.settings.notifications.on'
                                    defaultMessage='On'
                                />
                            </label>
                            <br/>
                        </div>
                        <div className='radio'>
                            <label>
                                <input
                                    id='soundOff'
                                    type='radio'
                                    name='notificationSounds'
                                    checked={soundRadio[1]}
                                    data-key={'desktopSound'}
                                    data-value={'false'}
                                    onChange={this.handleOnChange}
                                />
                                <FormattedMessage
                                    id='user.settings.notifications.off'
                                    defaultMessage='Off'
                                />
                            </label>
                            <br/>
                        </div>
                        {notificationSelection}
                        <div className='mt-5'>
                            <FormattedMessage
                                id='user.settings.notifications.sounds_info'
                                defaultMessage='Notification sounds are available on Firefox, Edge, Safari, Chrome and Mattermost Desktop Apps.'
                            />
                        </div>
                    </fieldset>
                );
            } else {
                soundSection = (
                    <fieldset>
                        <legend className='form-legend'>
                            <FormattedMessage
                                id='user.settings.notifications.desktop.sound'
                                defaultMessage='Notification sound'
                            />
                        </legend>
                        <br/>
                        <FormattedMessage
                            id='user.settings.notifications.soundConfig'
                            defaultMessage='Please configure notification sounds in your browser settings'
                        />
                    </fieldset>
                );
            }
        }

        if (this.props.isCollapsedThreadsEnabled && NotificationLevels.MENTION === this.props.activity) {
            threadsNotificationSelection = (
                <>
                    <fieldset>
                        <legend className='form-legend'>
                            <FormattedMessage
                                id='user.settings.notifications.threads.desktop'
                                defaultMessage='Thread reply notifications'
                            />
                        </legend>
                        <div className='checkbox'>
                            <label>
                                <input
                                    id='desktopThreadsNotificationAllActivity'
                                    type='checkbox'
                                    name='desktopThreadsNotificationLevel'
                                    checked={this.props.threads === NotificationLevels.ALL}
                                    onChange={this.handleThreadsOnChange}
                                />
                                <FormattedMessage
                                    id='user.settings.notifications.threads.allActivity'
                                    defaultMessage={'Notify me about threads I\'m following'}
                                />
                            </label>
                            <br/>
                        </div>
                        <div className='mt-5'>
                            <FormattedMessage
                                id='user.settings.notifications.threads'
                                defaultMessage={'When enabled, any reply to a thread you\'re following will send a desktop notification.'}
                            />
                        </div>
                    </fieldset>
                    <hr/>
                </>
            );
        }

        inputs.push(
            <div key='userNotificationLevelOption'>
                <fieldset>
                    <legend className='form-legend'>
                        <FormattedMessage
                            id='user.settings.notifications.desktop'
                            defaultMessage='Send desktop notifications'
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
                                id='user.settings.notifications.allActivity'
                                defaultMessage='For all activity'
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
                                id='user.settings.notifications.onlyMentions'
                                defaultMessage='Only for mentions and direct messages'
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
                                id='user.settings.notifications.never'
                                defaultMessage='Never'
                            />
                        </label>
                    </div>
                    <div className='mt-5'>
                        <FormattedMessage
                            id='user.settings.notifications.info'
                            defaultMessage='Desktop notifications are available on Edge, Firefox, Safari, Chrome and Mattermost Desktop Apps.'
                        />
                    </div>
                </fieldset>
                <hr/>
                {threadsNotificationSelection}
                {soundSection}
                {callsSection}
            </div>,
        );

        return (
            <SettingItemMax
                title={Utils.localizeMessage('user.settings.notifications.desktop.title', 'Desktop Notifications')}
                inputs={inputs}
                submit={this.props.submit}
                saving={this.props.saving}
                serverError={this.props.error}
                updateSection={this.handleMaxUpdateSection}
            />
        );
    };

    buildMinimizedSetting = () => {
        let formattedMessageProps;
        const hasSoundOption = NotificationSounds.hasSoundOptions();
        if (this.props.activity === NotificationLevels.MENTION) {
            if (hasSoundOption && this.props.sound !== 'false') {
                formattedMessageProps = {
                    id: t('user.settings.notifications.desktop.mentionsSound'),
                    defaultMessage: 'For mentions and direct messages, with sound',
                };
            } else if (hasSoundOption && this.props.sound === 'false') {
                formattedMessageProps = {
                    id: t('user.settings.notifications.desktop.mentionsNoSound'),
                    defaultMessage: 'For mentions and direct messages, without sound',
                };
            } else {
                formattedMessageProps = {
                    id: t('user.settings.notifications.desktop.mentionsSoundHidden'),
                    defaultMessage: 'For mentions and direct messages',
                };
            }
        } else if (this.props.activity === NotificationLevels.NONE) {
            formattedMessageProps = {
                id: t('user.settings.notifications.off'),
                defaultMessage: 'Off',
            };
        } else {
            if (hasSoundOption && this.props.sound !== 'false') { //eslint-disable-line no-lonely-if
                formattedMessageProps = {
                    id: t('user.settings.notifications.desktop.allSound'),
                    defaultMessage: 'For all activity, with sound',
                };
            } else if (hasSoundOption && this.props.sound === 'false') {
                formattedMessageProps = {
                    id: t('user.settings.notifications.desktop.allNoSound'),
                    defaultMessage: 'For all activity, without sound',
                };
            } else {
                formattedMessageProps = {
                    id: t('user.settings.notifications.desktop.allSoundHidden'),
                    defaultMessage: 'For all activity',
                };
            }
        }

        return (
            <SettingItemMin
                title={Utils.localizeMessage('user.settings.notifications.desktop.title', 'Desktop Notifications')}
                describe={<FormattedMessage {...formattedMessageProps}/>}
                section={'desktop'}
                updateSection={this.handleMinUpdateSection}
                ref={this.minRef}
            />
        );
    };

    componentDidUpdate(prevProps: Props) {
        this.blurDropdown();

        if (prevProps.active && !this.props.active && this.props.areAllSectionsInactive) {
            this.focusEditButton();
        }
    }

    render() {
        if (this.props.active) {
            return this.buildMaximizedSetting();
        }

        return this.buildMinimizedSetting();
    }
}
