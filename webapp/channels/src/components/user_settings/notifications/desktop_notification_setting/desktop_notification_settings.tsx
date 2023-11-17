// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ChangeEvent, RefObject, useEffect, useState} from 'react';
import ReactSelect, {ValueType} from 'react-select';
import {FormattedMessage} from 'react-intl';

import semver from 'semver';

import {NotificationLevels} from 'utils/constants';
import {isDesktopApp} from 'utils/user_agent';
import { hasSoundOptions, notificationSounds, tryNotificationSound } from 'utils/notification_sounds';

type SelectOption = {
    label: string;
    value: string;
};

type Props = {
    activity: string;
    threads?: string;
    sound: string;
    updateSection: (section: string) => void;
    setParentState: (key: string, value: string | boolean) => void;
    submit: () => void;
    cancel: () => void;
    error: string;
    active: boolean;
    saving: boolean;
    selectedSound: string;
    isCollapsedThreadsEnabled: boolean;
};

export default function DesktopNotificationSettings(props: Props) {
    const dropdownSoundRef: RefObject<ReactSelect> = React.createRef();

    const [selectedOption, setSelectedOption] = useState<ValueType<SelectOption>>({value: props.selectedSound, label: props.selectedSound});
    const [blurDropdownBool, setBlurDropdown] = useState(false);

    function handleOnChange(e: ChangeEvent<HTMLInputElement>): void {
        const key = e.currentTarget.getAttribute('data-key');
        const value = e.currentTarget.getAttribute('data-value');
        if (key && value) {
            props.setParentState(key, value);
        }
    }

    function handleThreadsOnChange(e: ChangeEvent<HTMLInputElement>): void {
        const value = e.target.checked ? NotificationLevels.ALL : NotificationLevels.MENTION;
        props.setParentState('desktopThreads', value);
    }

    function setDesktopNotificationSound(selectedOptionValue: ValueType<SelectOption>): void {
        if (selectedOption && 'value' in selectedOption) {
            props.setParentState('desktopNotificationSound', selectedOption.value);
            setSelectedOption(selectedOptionValue);
            tryNotificationSound(selectedOption.value);
        }
    }

    useEffect(() => {
        blurDropdown();
    });

    function blurDropdown(): void {
        if (!blurDropdownBool) {
            setBlurDropdown(true);
            if (dropdownSoundRef.current) {
                dropdownSoundRef.current.blur();
            }
        }
    }

    function buildMaximizedSetting() {
        const inputs = [];

        const activityRadio = [false, false, false];
        if (props.activity === NotificationLevels.MENTION) {
            activityRadio[1] = true;
        } else if (props.activity === NotificationLevels.NONE) {
            activityRadio[2] = true;
        } else {
            activityRadio[0] = true;
        }

        let soundSection;
        let notificationSelection;
        let threadsNotificationSelection;
        if (props.activity !== NotificationLevels.NONE) {
            const soundRadio = [false, false];
            if (props.sound === 'false') {
                soundRadio[1] = true;
            } else {
                soundRadio[0] = true;
            }

            if (props.sound === 'true') {
                const sounds = Array.from(notificationSounds.keys());
                const options = sounds.map((sound) => {
                    return {value: sound, label: sound};
                });

                if (!isDesktopApp() || (window.desktop && semver.gte(window.desktop.version || '', '4.6.0'))) {
                    notificationSelection = (<div className='pt-2'>
                        <ReactSelect
                            className='react-select notification-sound-dropdown'
                            classNamePrefix='react-select'
                            id='displaySoundNotification'
                            options={options}
                            clearable={false}
                            onChange={setDesktopNotificationSound}
                            value={selectedOption}
                            isSearchable={false}
                            ref={dropdownSoundRef}
                        /></div>);
                }
            }

            if (hasSoundOptions()) {
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
                                    onChange={handleOnChange}
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
                                    onChange={handleOnChange}
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

        if (props.isCollapsedThreadsEnabled && NotificationLevels.MENTION === props.activity) {
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
                                    checked={props.threads === NotificationLevels.ALL}
                                    onChange={handleThreadsOnChange}
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
                                onChange={handleOnChange}
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
                                onChange={handleOnChange}
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
                                onChange={handleOnChange}
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
            </div>,
        );

        return (
            <>
                {inputs}
            </>
        );
    }
    return buildMaximizedSetting();
}
