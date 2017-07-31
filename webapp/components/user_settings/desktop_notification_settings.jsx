// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import SettingItemMin from 'components/setting_item_min.jsx';
import SettingItemMax from 'components/setting_item_max.jsx';

import * as Utils from 'utils/utils.jsx';

import PropTypes from 'prop-types';

import React from 'react';
import {FormattedMessage} from 'react-intl';

export default class DesktopNotificationSettings extends React.Component {
    constructor(props) {
        super(props);

        this.buildMaximizedSetting = this.buildMaximizedSetting.bind(this);
        this.buildMinimizedSetting = this.buildMinimizedSetting.bind(this);

        this.state = {};
    }

    buildMaximizedSetting() {
        const inputs = [];
        let extraInfo = null;

        const activityRadio = [false, false, false];
        if (this.props.activity === 'mention') {
            activityRadio[1] = true;
        } else if (this.props.activity === 'none') {
            activityRadio[2] = true;
        } else {
            activityRadio[0] = true;
        }

        let soundSection;
        let durationSection;
        if (this.props.activity !== 'none') {
            const soundRadio = [false, false];
            if (this.props.sound === 'false') {
                soundRadio[1] = true;
            } else {
                soundRadio[0] = true;
            }

            if (Utils.hasSoundOptions()) {
                soundSection = (
                    <div>
                        <hr/>
                        <label>
                            <FormattedMessage
                                id='user.settings.notifications.desktop.sound'
                                defaultMessage='Notification sound'
                            />
                        </label>
                        <br/>
                        <div className='radio'>
                            <label>
                                <input
                                    id='soundOn'
                                    type='radio'
                                    name='notificationSounds'
                                    checked={soundRadio[0]}
                                    onChange={() => this.props.setParentState('desktopSound', 'true')}
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
                                    onChange={() => this.props.setParentState('desktopSound', 'false')}
                                />
                                <FormattedMessage
                                    id='user.settings.notifications.off'
                                    defaultMessage='Off'
                                />
                            </label>
                            <br/>
                        </div>
                        <br/>
                        <span>
                            <FormattedMessage
                                id='user.settings.notifications.sounds_info'
                                defaultMessage='Notification sounds are available on IE11, Safari, Chrome and Mattermost Desktop Apps.'
                            />
                        </span>
                    </div>
                );
            } else {
                soundSection = (
                    <div>
                        <hr/>
                        <label>
                            <FormattedMessage
                                id='user.settings.notifications.desktop.sound'
                                defaultMessage='Notification sound'
                            />
                        </label>
                        <br/>
                        <FormattedMessage
                            id='user.settings.notifications.soundConfig'
                            defaultMessage='Please configure notification sounds in your browser settings'
                        />
                    </div>
                );
            }

            const durationRadio = [false, false, false, false];
            if (this.props.duration === '3') {
                durationRadio[0] = true;
            } else if (this.props.duration === '10') {
                durationRadio[2] = true;
            } else if (this.props.duration === '0') {
                durationRadio[3] = true;
            } else {
                durationRadio[1] = true;
            }

            durationSection = (
                <div>
                    <hr/>
                    <label>
                        <FormattedMessage
                            id='user.settings.notifications.desktop.duration'
                            defaultMessage='Notification duration'
                        />
                    </label>
                    <br/>
                    <div className='radio'>
                        <label>
                            <input
                                id='soundDuration3'
                                type='radio'
                                name='desktopDuration'
                                checked={durationRadio[0]}
                                onChange={() => this.props.setParentState('desktopDuration', '3')}
                            />
                            <FormattedMessage
                                id='user.settings.notifications.desktop.seconds'
                                defaultMessage='{seconds} seconds'
                                values={{
                                    seconds: '3'
                                }}
                            />
                        </label>
                        <br/>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                id='soundDuration5'
                                type='radio'
                                name='desktopDuration'
                                checked={durationRadio[1]}
                                onChange={() => this.props.setParentState('desktopDuration', '5')}
                            />
                            <FormattedMessage
                                id='user.settings.notifications.desktop.seconds'
                                defaultMessage='{seconds} seconds'
                                values={{
                                    seconds: '5'
                                }}
                            />
                        </label>
                        <br/>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                id='soundDuration10'
                                type='radio'
                                name='desktopDuration'
                                checked={durationRadio[2]}
                                onChange={() => this.props.setParentState('desktopDuration', '10')}
                            />
                            <FormattedMessage
                                id='user.settings.notifications.desktop.seconds'
                                defaultMessage='{seconds} seconds'
                                values={{
                                    seconds: '10'
                                }}
                            />
                        </label>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                id='soundDurationUnlimited'
                                type='radio'
                                name='desktopDuration'
                                checked={durationRadio[3]}
                                onChange={() => this.props.setParentState('desktopDuration', '0')}
                            />
                            <FormattedMessage
                                id='user.settings.notifications.desktop.unlimited'
                                defaultMessage='Unlimited'
                            />
                        </label>
                    </div>
                </div>
            );

            extraInfo = (
                <span>
                    <FormattedMessage
                        id='user.settings.notifications.desktop.durationInfo'
                        defaultMessage='Sets how long desktop notifications will remain on screen when using Firefox or Chrome. Desktop notifications in Edge and Safari can only stay on screen for a maximum of 5 seconds.'
                    />
                </span>
            );
        }

        inputs.push(
            <div key='userNotificationLevelOption'>
                <label>
                    <FormattedMessage
                        id='user.settings.notifications.desktop'
                        defaultMessage='Send desktop notifications'
                    />
                </label>
                <br/>
                <div className='radio'>
                    <label>
                        <input
                            id='desktopNotificationAllActivity'
                            type='radio'
                            name='desktopNotificationLevel'
                            checked={activityRadio[0]}
                            onChange={() => this.props.setParentState('desktopActivity', 'all')}
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
                            onChange={() => this.props.setParentState('desktopActivity', 'mention')}
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
                            onChange={() => this.props.setParentState('desktopActivity', 'none')}
                        />
                        <FormattedMessage
                            id='user.settings.notifications.never'
                            defaultMessage='Never'
                        />
                    </label>
                </div>
                <br/>
                <span>
                    <FormattedMessage
                        id='user.settings.notifications.info'
                        defaultMessage='Desktop notifications are available on Edge, Firefox, Safari, Chrome and Mattermost Desktop Apps.'
                    />
                </span>
                {soundSection}
                {durationSection}
            </div>
        );

        return (
            <SettingItemMax
                title={Utils.localizeMessage('user.settings.notifications.desktop.title', 'Desktop notifications')}
                extraInfo={extraInfo}
                inputs={inputs}
                submit={this.props.submit}
                server_error={this.props.error}
                updateSection={this.props.cancel}
            />
        );
    }

    buildMinimizedSetting() {
        let describe = '';
        if (this.props.activity === 'mention') {
            if (Utils.hasSoundOptions() && this.props.sound !== 'false') {
                if (this.props.duration === '0') { //eslint-disable-line no-lonely-if
                    describe = (
                        <FormattedMessage
                            id='user.settings.notifications.desktop.mentionsSoundForever'
                            defaultMessage='For mentions and direct messages, with sound, shown indefinitely'
                        />
                    );
                } else {
                    describe = (
                        <FormattedMessage
                            id='user.settings.notifications.desktop.mentionsSoundTimed'
                            defaultMessage='For mentions and direct messages, with sound, shown for {seconds} seconds'
                            values={{
                                seconds: this.props.duration
                            }}
                        />
                    );
                }
            } else if (Utils.hasSoundOptions() && this.props.sound === 'false') {
                if (this.props.duration === '0') {
                    describe = (
                        <FormattedMessage
                            id='user.settings.notifications.desktop.mentionsNoSoundForever'
                            defaultMessage='For mentions and direct messages, without sound, shown indefinitely'
                        />
                    );
                } else {
                    describe = (
                        <FormattedMessage
                            id='user.settings.notifications.desktop.mentionsNoSoundTimed'
                            defaultMessage='For mentions and direct messages, without sound, shown for {seconds} seconds'
                            values={{
                                seconds: this.props.duration
                            }}
                        />
                    );
                }
            } else {
                if (this.props.duration === '0') { //eslint-disable-line no-lonely-if
                    describe = (
                        <FormattedMessage
                            id='user.settings.notifications.desktop.mentionsSoundHiddenForever'
                            defaultMessage='For mentions and direct messages, shown indefinitely'
                        />
                    );
                } else {
                    describe = (
                        <FormattedMessage
                            id='user.settings.notifications.desktop.mentionsSoundHiddenTimed'
                            defaultMessage='For mentions and direct messages, shown for {seconds} seconds'
                            values={{
                                seconds: this.props.duration
                            }}
                        />
                    );
                }
            }
        } else if (this.props.activity === 'none') {
            describe = (
                <FormattedMessage
                    id='user.settings.notifications.off'
                    defaultMessage='Off'
                />
            );
        } else {
            if (Utils.hasSoundOptions() && this.props.sound !== 'false') {  //eslint-disable-line no-lonely-if
                if (this.props.duration === '0') { //eslint-disable-line no-lonely-if
                    describe = (
                        <FormattedMessage
                            id='user.settings.notifications.desktop.allSoundForever'
                            defaultMessage='For all activity, with sound, shown indefinitely'
                        />
                    );
                } else {
                    describe = (
                        <FormattedMessage
                            id='user.settings.notifications.desktop.allSoundTimed'
                            defaultMessage='For all activity, with sound, shown for {seconds} seconds'
                            values={{
                                seconds: this.props.duration
                            }}
                        />
                    );
                }
            } else if (Utils.hasSoundOptions() && this.props.sound === 'false') {
                if (this.props.duration === '0') {
                    describe = (
                        <FormattedMessage
                            id='user.settings.notifications.desktop.allNoSoundForever'
                            defaultMessage='For all activity, without sound, shown indefinitely'
                        />
                    );
                } else {
                    describe = (
                        <FormattedMessage
                            id='user.settings.notifications.desktop.allNoSoundTimed'
                            defaultMessage='For all activity, without sound, shown for {seconds} seconds'
                            values={{
                                seconds: this.props.duration
                            }}
                        />
                    );
                }
            } else {
                if (this.props.duration === '0') { //eslint-disable-line no-lonely-if
                    describe = (
                        <FormattedMessage
                            id='user.settings.notifications.desktop.allSoundHiddenForever'
                            defaultMessage='For all activity, shown indefinitely'
                        />
                    );
                } else {
                    describe = (
                        <FormattedMessage
                            id='user.settings.notifications.desktop.allSoundHiddenTimed'
                            defaultMessage='For all activity, shown for {seconds} seconds'
                            values={{
                                seconds: this.props.duration
                            }}
                        />
                    );
                }
            }
        }

        const handleUpdateDesktopSection = function updateDesktopSection() {
            this.props.updateSection('desktop');
        }.bind(this);

        return (
            <SettingItemMin
                title={Utils.localizeMessage('user.settings.notifications.desktop.title', 'Desktop notifications')}
                describe={describe}
                updateSection={handleUpdateDesktopSection}
            />
        );
    }

    render() {
        if (this.props.active) {
            return this.buildMaximizedSetting();
        }

        return this.buildMinimizedSetting();
    }
}

DesktopNotificationSettings.propTypes = {
    activity: PropTypes.string.isRequired,
    sound: PropTypes.string.isRequired,
    duration: PropTypes.string.isRequired,
    updateSection: PropTypes.func,
    setParentState: PropTypes.func,
    submit: PropTypes.func,
    cancel: PropTypes.func,
    error: PropTypes.string,
    active: PropTypes.bool
};
