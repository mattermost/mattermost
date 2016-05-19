// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import ReactDOM from 'react-dom';
import SettingItemMin from '../setting_item_min.jsx';
import SettingItemMax from '../setting_item_max.jsx';

import UserStore from 'stores/user_store.jsx';

import Client from 'utils/web_client.jsx';
import * as AsyncClient from 'utils/async_client.jsx';
import * as Utils from 'utils/utils.jsx';

import {intlShape, injectIntl, defineMessages, FormattedMessage} from 'react-intl';

function getNotificationsStateFromStores() {
    var user = UserStore.getCurrentUser();
    var soundNeeded = !Utils.isBrowserFirefox();

    var sound = 'true';
    if (user.notify_props && user.notify_props.desktop_sound) {
        sound = user.notify_props.desktop_sound;
    }
    var desktop = 'default';
    if (user.notify_props && user.notify_props.desktop) {
        desktop = user.notify_props.desktop;
    }
    var email = 'true';
    if (user.notify_props && user.notify_props.email) {
        email = user.notify_props.email;
    }
    var push = 'mention';
    if (user.notify_props && user.notify_props.push) {
        push = user.notify_props.push;
    }

    var usernameKey = false;
    var mentionKey = false;
    var customKeys = '';
    var firstNameKey = false;
    var allKey = false;
    var channelKey = false;

    if (user.notify_props) {
        if (user.notify_props.mention_keys) {
            var keys = user.notify_props.mention_keys.split(',');

            if (keys.indexOf(user.username) === -1) {
                usernameKey = false;
            } else {
                usernameKey = true;
                keys.splice(keys.indexOf(user.username), 1);
            }

            if (keys.indexOf('@' + user.username) === -1) {
                mentionKey = false;
            } else {
                mentionKey = true;
                keys.splice(keys.indexOf('@' + user.username), 1);
            }

            customKeys = keys.join(',');
        }

        if (user.notify_props.first_name) {
            firstNameKey = user.notify_props.first_name === 'true';
        }

        if (user.notify_props.all) {
            allKey = user.notify_props.all === 'true';
        }

        if (user.notify_props.channel) {
            channelKey = user.notify_props.channel === 'true';
        }
    }

    return {
        notifyLevel: desktop,
        notifyPushLevel: push,
        enableEmail: email,
        soundNeeded,
        enableSound: sound,
        usernameKey,
        mentionKey,
        customKeys,
        customKeysChecked: customKeys.length > 0,
        firstNameKey,
        allKey,
        channelKey
    };
}

const holders = defineMessages({
    desktop: {
        id: 'user.settings.notifications.desktop',
        defaultMessage: 'Send desktop notifications'
    },
    desktopSounds: {
        id: 'user.settings.notifications.desktopSounds',
        defaultMessage: 'Desktop notification sounds'
    },
    emailNotifications: {
        id: 'user.settings.notifications.emailNotifications',
        defaultMessage: 'Email notifications'
    },
    wordsTrigger: {
        id: 'user.settings.notifications.wordsTrigger',
        defaultMessage: 'Words that trigger mentions'
    },
    close: {
        id: 'user.settings.notifications.close',
        defaultMessage: 'Close'
    }
});

import React from 'react';

class NotificationsTab extends React.Component {
    constructor(props) {
        super(props);

        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleCancel = this.handleCancel.bind(this);
        this.updateSection = this.updateSection.bind(this);
        this.updateState = this.updateState.bind(this);
        this.onListenerChange = this.onListenerChange.bind(this);
        this.handleNotifyRadio = this.handleNotifyRadio.bind(this);
        this.handleEmailRadio = this.handleEmailRadio.bind(this);
        this.handleSoundRadio = this.handleSoundRadio.bind(this);
        this.updateUsernameKey = this.updateUsernameKey.bind(this);
        this.updateMentionKey = this.updateMentionKey.bind(this);
        this.updateFirstNameKey = this.updateFirstNameKey.bind(this);
        this.updateAllKey = this.updateAllKey.bind(this);
        this.updateChannelKey = this.updateChannelKey.bind(this);
        this.updateCustomMentionKeys = this.updateCustomMentionKeys.bind(this);
        this.onCustomChange = this.onCustomChange.bind(this);
        this.createPushNotificationSection = this.createPushNotificationSection.bind(this);

        this.state = getNotificationsStateFromStores();
    }
    handleSubmit() {
        var data = {};
        data.user_id = this.props.user.id;
        data.email = this.state.enableEmail;
        data.desktop_sound = this.state.enableSound;
        data.desktop = this.state.notifyLevel;
        data.push = this.state.notifyPushLevel;

        var mentionKeys = [];
        if (this.state.usernameKey) {
            mentionKeys.push(this.props.user.username);
        }
        if (this.state.mentionKey) {
            mentionKeys.push('@' + this.props.user.username);
        }

        var stringKeys = mentionKeys.join(',');
        if (this.state.customKeys.length > 0 && this.state.customKeysChecked) {
            stringKeys += ',' + this.state.customKeys;
        }

        data.mention_keys = stringKeys;
        data.first_name = this.state.firstNameKey.toString();
        data.all = this.state.allKey.toString();
        data.channel = this.state.channelKey.toString();

        Client.updateUserNotifyProps(data,
            () => {
                this.props.updateSection('');
                AsyncClient.getMe();
            },
            (err) => {
                this.setState({serverError: err.message});
            }
        );
    }
    handleCancel(e) {
        this.updateState();
        this.props.updateSection('');
        e.preventDefault();
        $('.settings-modal .modal-body').scrollTop(0).perfectScrollbar('update');
    }
    updateSection(section) {
        this.updateState();
        this.props.updateSection(section);
    }
    updateState() {
        const newState = getNotificationsStateFromStores();
        if (!Utils.areObjectsEqual(newState, this.state)) {
            this.setState(newState);
        }
    }
    componentDidMount() {
        UserStore.addChangeListener(this.onListenerChange);
    }
    componentWillUnmount() {
        UserStore.removeChangeListener(this.onListenerChange);
    }
    onListenerChange() {
        this.updateState();
    }
    handleNotifyRadio(notifyLevel) {
        this.setState({notifyLevel});
        ReactDOM.findDOMNode(this.refs.wrapper).focus();
    }

    handlePushRadio(notifyPushLevel) {
        this.setState({notifyPushLevel});
        ReactDOM.findDOMNode(this.refs.wrapper).focus();
    }

    handleEmailRadio(enableEmail) {
        this.setState({enableEmail});
        ReactDOM.findDOMNode(this.refs.wrapper).focus();
    }
    handleSoundRadio(enableSound) {
        this.setState({enableSound});
        ReactDOM.findDOMNode(this.refs.wrapper).focus();
    }
    updateUsernameKey(val) {
        this.setState({usernameKey: val});
    }
    updateMentionKey(val) {
        this.setState({mentionKey: val});
    }
    updateFirstNameKey(val) {
        this.setState({firstNameKey: val});
    }
    updateAllKey(val) {
        this.setState({allKey: val});
    }
    updateChannelKey(val) {
        this.setState({channelKey: val});
    }
    updateCustomMentionKeys() {
        var checked = ReactDOM.findDOMNode(this.refs.customcheck).checked;

        if (checked) {
            var text = ReactDOM.findDOMNode(this.refs.custommentions).value;

            // remove all spaces and split string into individual keys
            this.setState({customKeys: text.replace(/ /g, ''), customKeysChecked: true});
        } else {
            this.setState({customKeys: '', customKeysChecked: false});
        }
    }
    onCustomChange() {
        ReactDOM.findDOMNode(this.refs.customcheck).checked = true;
        this.updateCustomMentionKeys();
    }
    createPushNotificationSection() {
        var handleUpdateDesktopSection;
        if (this.props.activeSection === 'push') {
            var notifyActive = [false, false, false];
            if (this.state.notifyPushLevel === 'all') {
                notifyActive[0] = true;
            } else if (this.state.notifyPushLevel === 'none') {
                notifyActive[2] = true;
            } else {
                notifyActive[1] = true;
            }

            let inputs = [];

            inputs.push(
                <div key='userNotificationLevelOption'>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                checked={notifyActive[0]}
                                onChange={this.handlePushRadio.bind(this, 'all')}
                            />
                            <FormattedMessage
                                id='user.settings.push_notification.allActivity'
                                defaultMessage='For all activity'
                            />
                        </label>
                        <br/>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                checked={notifyActive[1]}
                                onChange={this.handlePushRadio.bind(this, 'mention')}
                            />
                            <FormattedMessage
                                id='user.settings.push_notifications.onlyMentions'
                                defaultMessage='For mentions and direct messages'
                            />
                        </label>
                        <br/>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                checked={notifyActive[2]}
                                onChange={this.handlePushRadio.bind(this, 'none')}
                            />
                            <FormattedMessage
                                id='user.settings.push_notifications.off'
                                defaultMessage='Off'
                            />
                        </label>
                    </div>
                </div>
            );

            const extraInfo = (
                <span>
                    <FormattedMessage
                        id='user.settings.push_notifications.info'
                        defaultMessage='Notification alerts are pushed to your mobile device when there is activity in Mattermost.'
                    />
                </span>
            );

            return (
                <SettingItemMax
                    title={Utils.localizeMessage('user.settings.notifications.push', 'Mobile push notifications')}
                    extraInfo={extraInfo}
                    inputs={inputs}
                    submit={this.handleSubmit}
                    server_error={this.state.serverError}
                    updateSection={this.handleCancel}
                />
            );
        }

        let describe = '';
        if (this.state.notifyPushLevel === 'all') {
            describe = (
                <FormattedMessage
                    id='user.settings.push_notification.allActivity'
                    defaultMessage='For all activity'
                />
            );
        } else if (this.state.notifyPushLevel === 'none') {
            describe = (
                <FormattedMessage
                    id='user.settings.push_notifications.off'
                    defaultMessage='Off'
                />
            );
        } else {
            describe = (
                <FormattedMessage
                    id='user.settings.push_notifications.onlyMentions'
                    defaultMessage='For mentions and direct messages'
                />
            );
        }

        handleUpdateDesktopSection = function updateDesktopSection() {
            this.props.updateSection('push');
        }.bind(this);

        return (
            <SettingItemMin
                title={Utils.localizeMessage('user.settings.notifications.push', 'Mobile push notifications')}
                describe={describe}
                updateSection={handleUpdateDesktopSection}
            />
        );
    }
    render() {
        const {formatMessage} = this.props.intl;
        const serverError = this.state.serverError;

        var user = this.props.user;

        var desktopSection;
        var handleUpdateDesktopSection;
        if (this.props.activeSection === 'desktop') {
            var notifyActive = [false, false, false];
            if (this.state.notifyLevel === 'mention') {
                notifyActive[1] = true;
            } else if (this.state.notifyLevel === 'none') {
                notifyActive[2] = true;
            } else {
                notifyActive[0] = true;
            }

            let inputs = [];

            inputs.push(
                <div key='userNotificationLevelOption'>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                checked={notifyActive[0]}
                                onChange={this.handleNotifyRadio.bind(this, 'all')}
                            />
                            <FormattedMessage
                                id='user.settings.notification.allActivity'
                                defaultMessage='For all activity'
                            />
                        </label>
                        <br/>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                checked={notifyActive[1]}
                                onChange={this.handleNotifyRadio.bind(this, 'mention')}
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
                                type='radio'
                                checked={notifyActive[2]}
                                onChange={this.handleNotifyRadio.bind(this, 'none')}
                            />
                            <FormattedMessage
                                id='user.settings.notifications.never'
                                defaultMessage='Never'
                            />
                        </label>
                    </div>
                </div>
            );

            const extraInfo = (
                <span>
                    <FormattedMessage
                        id='user.settings.notifications.info'
                        defaultMessage='Desktop notifications are available on Firefox, Safari, Chrome, Internet Explorer, and Edge.'
                    />
                </span>
            );

            desktopSection = (
                <SettingItemMax
                    title={formatMessage(holders.desktop)}
                    extraInfo={extraInfo}
                    inputs={inputs}
                    submit={this.handleSubmit}
                    server_error={serverError}
                    updateSection={this.handleCancel}
                />
            );
        } else {
            let describe = '';
            if (this.state.notifyLevel === 'mention') {
                describe = (
                    <FormattedMessage
                        id='user.settings.notifications.onlyMentions'
                        defaultMessage='Only for mentions and direct messages'
                    />
                );
            } else if (this.state.notifyLevel === 'none') {
                describe = (
                    <FormattedMessage
                        id='user.settings.notifications.never'
                        defaultMessage='Never'
                    />
                );
            } else {
                describe = (
                    <FormattedMessage
                        id='user.settings.notification.allActivity'
                        defaultMessage='For all activity'
                    />
                );
            }

            handleUpdateDesktopSection = function updateDesktopSection() {
                this.props.updateSection('desktop');
            }.bind(this);

            desktopSection = (
                <SettingItemMin
                    title={formatMessage(holders.desktop)}
                    describe={describe}
                    updateSection={handleUpdateDesktopSection}
                />
            );
        }

        var soundSection;
        var handleUpdateSoundSection;
        if (this.props.activeSection === 'sound' && this.state.soundNeeded) {
            var soundActive = [false, false];
            if (this.state.enableSound === 'false') {
                soundActive[1] = true;
            } else {
                soundActive[0] = true;
            }

            let inputs = [];

            inputs.push(
                <div key='userNotificationSoundOptions'>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                checked={soundActive[0]}
                                onChange={this.handleSoundRadio.bind(this, 'true')}
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
                                type='radio'
                                checked={soundActive[1]}
                                onChange={this.handleSoundRadio.bind(this, 'false')}
                            />
                            <FormattedMessage
                                id='user.settings.notifications.off'
                                defaultMessage='Off'
                            />
                        </label>
                        <br/>
                    </div>
                </div>
            );

            const extraInfo = (
                <span>
                    <FormattedMessage
                        id='user.settings.notifications.sounds_info'
                        defaultMessage='Desktop notifications sounds are available on Firefox, Safari, Chrome, Internet Explorer, and Edge.'
                    />
                </span>
            );

            soundSection = (
                <SettingItemMax
                    title={formatMessage(holders.desktopSounds)}
                    extraInfo={extraInfo}
                    inputs={inputs}
                    submit={this.handleSubmit}
                    server_error={serverError}
                    updateSection={this.handleCancel}
                />
            );
        } else {
            let describe = '';
            if (!this.state.soundNeeded) {
                describe = (
                    <FormattedMessage
                        id='user.settings.notification.soundConfig'
                        defaultMessage='Please configure notification sounds in your browser settings'
                    />
                );
            } else if (this.state.enableSound === 'false') {
                describe = (
                    <FormattedMessage
                        id='user.settings.notifications.off'
                        defaultMessage='Off'
                    />
                );
            } else {
                describe = (
                    <FormattedMessage
                        id='user.settings.notifications.on'
                        defaultMessage='On'
                    />
                );
            }

            handleUpdateSoundSection = function updateSoundSection() {
                this.props.updateSection('sound');
            }.bind(this);

            soundSection = (
                <SettingItemMin
                    title={formatMessage(holders.desktopSounds)}
                    describe={describe}
                    updateSection={handleUpdateSoundSection}
                    disableOpen={!this.state.soundNeeded}
                />
            );
        }

        var emailSection;
        var handleUpdateEmailSection;
        if (this.props.activeSection === 'email') {
            var emailActive = [false, false];
            if (this.state.enableEmail === 'false') {
                emailActive[1] = true;
            } else {
                emailActive[0] = true;
            }

            let inputs = [];

            inputs.push(
                <div key='userNotificationEmailOptions'>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                checked={emailActive[0]}
                                onChange={this.handleEmailRadio.bind(this, 'true')}
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
                                type='radio'
                                checked={emailActive[1]}
                                onChange={this.handleEmailRadio.bind(this, 'false')}
                            />
                            <FormattedMessage
                                id='user.settings.notifications.off'
                                defaultMessage='Off'
                            />
                        </label>
                        <br/>
                    </div>
                    <div><br/>
                        <FormattedMessage
                            id='user.settings.notifications.emailInfo'
                            defaultMessage='Email notifications are sent for mentions and direct messages after you’ve been offline for more than 60 seconds or away from {siteName} for more than 5 minutes.'
                            values={{
                                siteName: global.window.mm_config.SiteName
                            }}
                        />
                    </div>
                </div>
            );

            emailSection = (
                <SettingItemMax
                    title={formatMessage(holders.emailNotifications)}
                    inputs={inputs}
                    submit={this.handleSubmit}
                    server_error={serverError}
                    updateSection={this.handleCancel}
                />
            );
        } else {
            let describe = '';
            if (this.state.enableEmail === 'false') {
                describe = (
                    <FormattedMessage
                        id='user.settings.notifications.off'
                        defaultMessage='Off'
                    />
                );
            } else {
                describe = (
                    <FormattedMessage
                        id='user.settings.notifications.on'
                        defaultMessage='On'
                    />
                );
            }

            handleUpdateEmailSection = function updateEmailSection() {
                this.props.updateSection('email');
            }.bind(this);

            emailSection = (
                <SettingItemMin
                    title={formatMessage(holders.emailNotifications)}
                    describe={describe}
                    updateSection={handleUpdateEmailSection}
                />
            );
        }

        var keysSection;
        var handleUpdateKeysSection;
        if (this.props.activeSection === 'keys') {
            let inputs = [];

            let handleUpdateFirstNameKey;
            let handleUpdateUsernameKey;
            let handleUpdateMentionKey;
            let handleUpdateAllKey;
            let handleUpdateChannelKey;

            if (user.first_name) {
                handleUpdateFirstNameKey = function handleFirstNameKeyChange(e) {
                    this.updateFirstNameKey(e.target.checked);
                }.bind(this);
                inputs.push(
                    <div key='userNotificationFirstNameOption'>
                        <div className='checkbox'>
                            <label>
                                <input
                                    type='checkbox'
                                    checked={this.state.firstNameKey}
                                    onChange={handleUpdateFirstNameKey}
                                />
                                <FormattedMessage
                                    id='user.settings.notifications.sensitiveName'
                                    defaultMessage='Your case sensitive first name "{first_name}"'
                                    values={{
                                        first_name: user.first_name
                                    }}
                                />
                            </label>
                        </div>
                    </div>
                );
            }

            handleUpdateUsernameKey = function handleUsernameKeyChange(e) {
                this.updateUsernameKey(e.target.checked);
            }.bind(this);
            inputs.push(
                <div key='userNotificationUsernameOption'>
                    <div className='checkbox'>
                        <label>
                            <input
                                type='checkbox'
                                checked={this.state.usernameKey}
                                onChange={handleUpdateUsernameKey}
                            />
                            <FormattedMessage
                                id='user.settings.notifications.sensitiveUsername'
                                defaultMessage='Your non-case sensitive username "{username}"'
                                values={{
                                    username: user.username
                                }}
                            />
                        </label>
                    </div>
                </div>
            );

            handleUpdateMentionKey = function handleMentionKeyChange(e) {
                this.updateMentionKey(e.target.checked);
            }.bind(this);
            inputs.push(
                <div key='userNotificationMentionOption'>
                    <div className='checkbox'>
                        <label>
                            <input
                                type='checkbox'
                                checked={this.state.mentionKey}
                                onChange={handleUpdateMentionKey}
                            />
                            <FormattedMessage
                                id='user.settings.notifications.usernameMention'
                                defaultMessage='Your username mentioned "@{username}"'
                                values={{
                                    username: user.username
                                }}
                            />
                        </label>
                    </div>
                </div>
            );

            handleUpdateAllKey = function handleAllKeyChange(e) {
                this.updateAllKey(e.target.checked);
            }.bind(this);
            inputs.push(
                <div key='userNotificationAllOption'>
                    <div className='checkbox hidden'>
                        <label>
                            <input
                                type='checkbox'
                                checked={this.state.allKey}
                                onChange={handleUpdateAllKey}
                            />
                            <FormattedMessage
                                id='user.settings.notifications.teamWide'
                                defaultMessage='Team-wide mentions "@all"'
                            />
                        </label>
                    </div>
                </div>
            );

            handleUpdateChannelKey = function handleChannelKeyChange(e) {
                this.updateChannelKey(e.target.checked);
            }.bind(this);
            inputs.push(
                <div key='userNotificationChannelOption'>
                    <div className='checkbox'>
                        <label>
                            <input
                                type='checkbox'
                                checked={this.state.channelKey}
                                onChange={handleUpdateChannelKey}
                            />
                            <FormattedMessage
                                id='user.settings.notifications.channelWide'
                                defaultMessage='Channel-wide mentions "@channel"'
                            />
                        </label>
                    </div>
                </div>
            );

            inputs.push(
                <div key='userNotificationCustomOption'>
                    <div className='checkbox'>
                        <label>
                            <input
                                ref='customcheck'
                                type='checkbox'
                                checked={this.state.customKeysChecked}
                                onChange={this.updateCustomMentionKeys}
                            />
                            <FormattedMessage
                                id='user.settings.notifications.sensitiveWords'
                                defaultMessage='Other non-case sensitive words, separated by commas:'
                            />
                        </label>
                    </div>
                    <input
                        ref='custommentions'
                        className='form-control mentions-input'
                        type='text'
                        defaultValue={this.state.customKeys}
                        onChange={this.onCustomChange}
                    />
                </div>
            );

            keysSection = (
                <SettingItemMax
                    title={formatMessage(holders.wordsTrigger)}
                    inputs={inputs}
                    submit={this.handleSubmit}
                    server_error={serverError}
                    updateSection={this.handleCancel}
                />
            );
        } else {
            let keys = [];
            if (this.state.firstNameKey) {
                keys.push(user.first_name);
            }
            if (this.state.usernameKey) {
                keys.push(user.username);
            }
            if (this.state.mentionKey) {
                keys.push('@' + user.username);
            }

            // if (this.state.allKey) {
            //     keys.push('@all');
            // }

            if (this.state.channelKey) {
                keys.push('@channel');
            }
            if (this.state.customKeys.length > 0) {
                keys = keys.concat(this.state.customKeys.split(','));
            }

            let describe = '';
            for (var i = 0; i < keys.length; i++) {
                describe += '"' + keys[i] + '", ';
            }

            if (describe.length > 0) {
                describe = describe.substring(0, describe.length - 2);
            } else {
                describe = (
                    <FormattedMessage
                        id='user.settings.notifications.noWords'
                        defaultMessage='No words configured'
                    />
                );
            }

            handleUpdateKeysSection = function updateKeysSection() {
                this.props.updateSection('keys');
            }.bind(this);

            keysSection = (
                <SettingItemMin
                    title={formatMessage(holders.wordsTrigger)}
                    describe={describe}
                    updateSection={handleUpdateKeysSection}
                />
            );
        }

        let pushNotificationSection;
        if (global.window.mm_config.SendPushNotifications === 'true') {
            pushNotificationSection = this.createPushNotificationSection();
        }

        return (
            <div>
                <div className='modal-header'>
                    <button
                        type='button'
                        className='close'
                        data-dismiss='modal'
                        aria-label={formatMessage(holders.close)}
                        onClick={this.props.closeModal}
                    >
                        <span aria-hidden='true'>{'×'}</span>
                    </button>
                    <h4
                        className='modal-title'
                        ref='title'
                    >
                        <div className='modal-back'>
                            <i
                                className='fa fa-angle-left'
                                onClick={this.props.collapseModal}
                            />
                        </div>
                        <FormattedMessage
                            id='user.settings.notifications.title'
                            defaultMessage='Notification Settings'
                        />
                    </h4>
                </div>
                <div
                    ref='wrapper'
                    className='user-settings'
                >
                    <h3 className='tab-header'>
                        <FormattedMessage
                            id='user.settings.notifications.header'
                            defaultMessage='Notifications'
                        />
                    </h3>
                    <div className='divider-dark first'/>
                    {desktopSection}
                    <div className='divider-light'/>
                    {soundSection}
                    <div className='divider-light'/>
                    {emailSection}
                    <div className='divider-light'/>
                    {pushNotificationSection}
                    <div className='divider-light'/>
                    {keysSection}
                    <div className='divider-dark'/>
                </div>
            </div>

        );
    }
}

NotificationsTab.defaultProps = {
    user: null,
    activeSection: '',
    activeTab: ''
};
NotificationsTab.propTypes = {
    intl: intlShape.isRequired,
    user: React.PropTypes.object,
    updateSection: React.PropTypes.func,
    updateTab: React.PropTypes.func,
    activeSection: React.PropTypes.string,
    activeTab: React.PropTypes.string,
    closeModal: React.PropTypes.func.isRequired,
    collapseModal: React.PropTypes.func.isRequired
};

export default injectIntl(NotificationsTab);
