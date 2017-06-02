// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import SettingItemMin from 'components/setting_item_min.jsx';
import SettingItemMax from 'components/setting_item_max.jsx';
import DesktopNotificationSettings from './desktop_notification_settings.jsx';

import UserStore from 'stores/user_store.jsx';

import * as Utils from 'utils/utils.jsx';
import Constants from 'utils/constants.jsx';
import {updateUserNotifyProps} from 'actions/user_actions.jsx';

import EmailNotificationSetting from './email_notification_setting.jsx';
import {FormattedMessage} from 'react-intl';

function getNotificationsStateFromStores() {
    const user = UserStore.getCurrentUser();

    let desktop = 'default';
    let sound = 'true';
    let desktopDuration = '5';
    let comments = 'never';
    let enableEmail = 'true';
    let pushActivity = 'mention';
    let pushStatus = Constants.UserStatuses.ONLINE;

    if (user.notify_props) {
        if (user.notify_props.desktop) {
            desktop = user.notify_props.desktop;
        }
        if (user.notify_props.desktop_sound) {
            sound = user.notify_props.desktop_sound;
        }
        if (user.notify_props.desktop_duration) {
            desktopDuration = user.notify_props.desktop_duration;
        }
        if (user.notify_props.comments) {
            comments = user.notify_props.comments;
        }
        if (user.notify_props.email) {
            enableEmail = user.notify_props.email;
        }
        if (user.notify_props.push) {
            pushActivity = user.notify_props.push;
        }
        if (user.notify_props.push_status) {
            pushStatus = user.notify_props.push_status;
        }
    }

    let usernameKey = false;
    let customKeys = '';
    let firstNameKey = false;
    let channelKey = false;

    if (user.notify_props) {
        if (user.notify_props.mention_keys) {
            const keys = user.notify_props.mention_keys.split(',');

            if (keys.indexOf(user.username) === -1) {
                usernameKey = false;
            } else {
                usernameKey = true;
                keys.splice(keys.indexOf(user.username), 1);
                if (keys.indexOf(`@${user.username}`) !== -1) {
                    keys.splice(keys.indexOf(`@${user.username}`), 1);
                }
            }

            customKeys = keys.join(',');
        }

        if (user.notify_props.first_name) {
            firstNameKey = user.notify_props.first_name === 'true';
        }

        if (user.notify_props.channel) {
            channelKey = user.notify_props.channel === 'true';
        }
    }

    return {
        desktopActivity: desktop,
        desktopDuration,
        enableEmail,
        pushActivity,
        pushStatus,
        desktopSound: sound,
        usernameKey,
        customKeys,
        customKeysChecked: customKeys.length > 0,
        firstNameKey,
        channelKey,
        notifyCommentsLevel: comments
    };
}

import PropTypes from 'prop-types';

import React from 'react';

export default class NotificationsTab extends React.Component {
    constructor(props) {
        super(props);

        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleCancel = this.handleCancel.bind(this);
        this.updateSection = this.updateSection.bind(this);
        this.setStateValue = this.setStateValue.bind(this);
        this.onListenerChange = this.onListenerChange.bind(this);
        this.handleEmailRadio = this.handleEmailRadio.bind(this);
        this.updateUsernameKey = this.updateUsernameKey.bind(this);
        this.updateFirstNameKey = this.updateFirstNameKey.bind(this);
        this.updateChannelKey = this.updateChannelKey.bind(this);
        this.updateCustomMentionKeys = this.updateCustomMentionKeys.bind(this);
        this.updateState = this.updateState.bind(this);
        this.onCustomChange = this.onCustomChange.bind(this);
        this.createPushNotificationSection = this.createPushNotificationSection.bind(this);

        this.state = getNotificationsStateFromStores();
    }

    handleSubmit() {
        const data = {};
        data.user_id = this.props.user.id;
        data.email = this.state.enableEmail;
        data.desktop_sound = this.state.desktopSound;
        data.desktop = this.state.desktopActivity;
        data.desktop_duration = this.state.desktopDuration;
        data.push = this.state.pushActivity;
        data.push_status = this.state.pushStatus;
        data.comments = this.state.notifyCommentsLevel;

        const mentionKeys = [];
        if (this.state.usernameKey) {
            mentionKeys.push(this.props.user.username);
        }

        let stringKeys = mentionKeys.join(',');
        if (this.state.customKeys.length > 0 && this.state.customKeysChecked) {
            stringKeys += ',' + this.state.customKeys;
        }

        data.mention_keys = stringKeys;
        data.first_name = this.state.firstNameKey.toString();
        data.channel = this.state.channelKey.toString();

        updateUserNotifyProps(
            data,
            () => {
                this.props.updateSection('');
                $('.settings-modal .modal-body').scrollTop(0).perfectScrollbar('update');
            },
            (err) => {
                this.setState({serverError: err.message});
            }
        );
    }

    handleCancel(e) {
        e.preventDefault();
        this.updateState();
        this.props.updateSection('');
        $('.settings-modal .modal-body').scrollTop(0).perfectScrollbar('update');
    }

    setStateValue(key, value) {
        const data = {};
        data[key] = value;
        this.setState(data);
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

    handleNotifyCommentsRadio(notifyCommentsLevel) {
        this.setState({notifyCommentsLevel});
        this.refs.wrapper.focus();
    }

    handlePushRadio(pushActivity) {
        this.setState({pushActivity});
        this.refs.wrapper.focus();
    }

    handlePushStatusRadio(pushStatus) {
        this.setState({pushStatus});
        this.refs.wrapper.focus();
    }

    handleEmailRadio(enableEmail) {
        this.setState({enableEmail});
        this.refs.wrapper.focus();
    }

    updateUsernameKey(val) {
        this.setState({usernameKey: val});
    }

    updateFirstNameKey(val) {
        this.setState({firstNameKey: val});
    }

    updateChannelKey(val) {
        this.setState({channelKey: val});
    }

    updateCustomMentionKeys() {
        const checked = this.refs.customcheck.checked;

        if (checked) {
            const text = this.refs.custommentions.value;

            // remove all spaces and split string into individual keys
            this.setState({customKeys: text.replace(/ /g, ''), customKeysChecked: true});
        } else {
            this.setState({customKeys: '', customKeysChecked: false});
        }
    }

    onCustomChange() {
        this.refs.customcheck.checked = true;
        this.updateCustomMentionKeys();
    }

    createPushNotificationSection() {
        if (this.props.activeSection === 'push') {
            const inputs = [];
            let extraInfo = null;
            let submit = null;

            if (global.window.mm_config.SendPushNotifications === 'true') {
                const pushActivityRadio = [false, false, false];
                if (this.state.pushActivity === 'all') {
                    pushActivityRadio[0] = true;
                } else if (this.state.pushActivity === 'none') {
                    pushActivityRadio[2] = true;
                } else {
                    pushActivityRadio[1] = true;
                }

                const pushStatusRadio = [false, false, false];
                if (this.state.pushStatus === Constants.UserStatuses.ONLINE) {
                    pushStatusRadio[0] = true;
                } else if (this.state.pushStatus === Constants.UserStatuses.AWAY) {
                    pushStatusRadio[1] = true;
                } else {
                    pushStatusRadio[2] = true;
                }

                let pushStatusSettings;
                if (this.state.pushActivity !== 'none') {
                    pushStatusSettings = (
                        <div>
                            <hr/>
                            <label>
                                <FormattedMessage
                                    id='user.settings.notifications.push_notification.status'
                                    defaultMessage='Trigger push notifications when'
                                />
                            </label>
                            <br/>
                            <div className='radio'>
                                <label>
                                    <input
                                        id='pushNotificationOnline'
                                        type='radio'
                                        name='pushNotificationStatus'
                                        checked={pushStatusRadio[0]}
                                        onChange={this.handlePushStatusRadio.bind(this, Constants.UserStatuses.ONLINE)}
                                    />
                                    <FormattedMessage
                                        id='user.settings.push_notification.online'
                                        defaultMessage='Online, away or offline'
                                    />
                                </label>
                                <br/>
                            </div>
                            <div className='radio'>
                                <label>
                                    <input
                                        id='pushNotificationAway'
                                        type='radio'
                                        name='pushNotificationStatus'
                                        checked={pushStatusRadio[1]}
                                        onChange={this.handlePushStatusRadio.bind(this, Constants.UserStatuses.AWAY)}
                                    />
                                    <FormattedMessage
                                        id='user.settings.push_notification.away'
                                        defaultMessage='Away or offline'
                                    />
                                </label>
                                <br/>
                            </div>
                            <div className='radio'>
                                <label>
                                    <input
                                        id='pushNotificationOffline'
                                        type='radio'
                                        name='pushNotificationStatus'
                                        checked={pushStatusRadio[2]}
                                        onChange={this.handlePushStatusRadio.bind(this, Constants.UserStatuses.OFFLINE)}
                                    />
                                    <FormattedMessage
                                        id='user.settings.push_notification.offline'
                                        defaultMessage='Offline'
                                    />
                                </label>
                            </div>
                        </div>
                    );

                    extraInfo = (
                        <span>
                            <FormattedMessage
                                id='user.settings.push_notification.status_info'
                                defaultMessage='Notification alerts are only pushed to your mobile device when your online status matches the selection above.'
                            />
                        </span>
                    );
                }

                inputs.push(
                    <div key='userNotificationLevelOption'>
                        <label>
                            <FormattedMessage
                                id='user.settings.push_notification.send'
                                defaultMessage='Send mobile push notifications'
                            />
                        </label>
                        <br/>
                        <div className='radio'>
                            <label>
                                <input
                                    id='pushNotificationAllActivity'
                                    type='radio'
                                    name='pushNotificationLevel'
                                    checked={pushActivityRadio[0]}
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
                                    id='pushNotificationMentions'
                                    type='radio'
                                    name='pushNotificationLevel'
                                    checked={pushActivityRadio[1]}
                                    onChange={this.handlePushRadio.bind(this, 'mention')}
                                />
                                <FormattedMessage
                                    id='user.settings.push_notification.onlyMentions'
                                    defaultMessage='For mentions and direct messages'
                                />
                            </label>
                            <br/>
                        </div>
                        <div className='radio'>
                            <label>
                                <input
                                    id='pushNotificationNever'
                                    type='radio'
                                    name='pushNotificationLevel'
                                    checked={pushActivityRadio[2]}
                                    onChange={this.handlePushRadio.bind(this, 'none')}
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
                                id='user.settings.push_notification.info'
                                defaultMessage='Notification alerts are pushed to your mobile device when there is activity in Mattermost.'
                            />
                        </span>
                        {pushStatusSettings}
                    </div>
                );

                submit = this.handleSubmit;
            } else {
                inputs.push(
                    <div
                        key='oauthEmailInfo'
                        className='padding-top'
                    >
                        <FormattedMessage
                            id='user.settings.push_notification.disabled_long'
                            defaultMessage='Push notifications for mobile devices have been disabled by your System Administrator.'
                        />
                    </div>
                );
            }

            return (
                <SettingItemMax
                    title={Utils.localizeMessage('user.settings.notifications.push', 'Mobile push notifications')}
                    extraInfo={extraInfo}
                    inputs={inputs}
                    submit={submit}
                    server_error={this.state.serverError}
                    updateSection={this.handleCancel}
                />
            );
        }

        let describe = '';
        if (this.state.pushActivity === 'all') {
            if (this.state.pushStatus === Constants.UserStatuses.AWAY) {
                describe = (
                    <FormattedMessage
                        id='user.settings.push_notification.allActivityAway'
                        defaultMessage='For all activity when away or offline'
                    />
                );
            } else if (this.state.pushStatus === Constants.UserStatuses.OFFLINE) {
                describe = (
                    <FormattedMessage
                        id='user.settings.push_notification.allActivityOffline'
                        defaultMessage='For all activity when offline'
                    />
                );
            } else {
                describe = (
                    <FormattedMessage
                        id='user.settings.push_notification.allActivityOnline'
                        defaultMessage='For all activity when online, away or offline'
                    />
                );
            }
        } else if (this.state.pushActivity === 'none') {
            describe = (
                <FormattedMessage
                    id='user.settings.notifications.never'
                    defaultMessage='Never'
                />
            );
        } else if (global.window.mm_config.SendPushNotifications === 'false') {
            describe = (
                <FormattedMessage
                    id='user.settings.push_notification.disabled'
                    defaultMessage='Disabled by System Administrator'
                />
            );
        } else {
            if (this.state.pushStatus === Constants.UserStatuses.AWAY) { //eslint-disable-line no-lonely-if
                describe = (
                    <FormattedMessage
                        id='user.settings.push_notification.onlyMentionsAway'
                        defaultMessage='For mentions and direct messages when away or offline'
                    />
                );
            } else if (this.state.pushStatus === Constants.UserStatuses.OFFLINE) {
                describe = (
                    <FormattedMessage
                        id='user.settings.push_notification.onlyMentionsOffline'
                        defaultMessage='For mentions and direct messages when offline'
                    />
                );
            } else {
                describe = (
                    <FormattedMessage
                        id='user.settings.push_notification.onlyMentionsOnline'
                        defaultMessage='For mentions and direct messages when online, away or offline'
                    />
                );
            }
        }

        const handleUpdatePushSection = () => {
            this.props.updateSection('push');
        };

        return (
            <SettingItemMin
                title={Utils.localizeMessage('user.settings.notifications.push', 'Mobile push notifications')}
                describe={describe}
                updateSection={handleUpdatePushSection}
            />
        );
    }

    render() {
        const serverError = this.state.serverError;
        const user = this.props.user;

        let keysSection;
        let handleUpdateKeysSection;
        if (this.props.activeSection === 'keys') {
            const inputs = [];

            if (user.first_name) {
                const handleUpdateFirstNameKey = (e) => {
                    this.updateFirstNameKey(e.target.checked);
                };
                inputs.push(
                    <div key='userNotificationFirstNameOption'>
                        <div className='checkbox'>
                            <label>
                                <input
                                    id='notificationTriggerFirst'
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

            const handleUpdateUsernameKey = (e) => {
                this.updateUsernameKey(e.target.checked);
            };
            inputs.push(
                <div key='userNotificationUsernameOption'>
                    <div className='checkbox'>
                        <label>
                            <input
                                id='notificationTriggerUsername'
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

            const handleUpdateChannelKey = (e) => {
                this.updateChannelKey(e.target.checked);
            };
            inputs.push(
                <div key='userNotificationChannelOption'>
                    <div className='checkbox'>
                        <label>
                            <input
                                id='notificationTriggerShouts'
                                type='checkbox'
                                checked={this.state.channelKey}
                                onChange={handleUpdateChannelKey}
                            />
                            <FormattedMessage
                                id='user.settings.notifications.channelWide'
                                defaultMessage='Channel-wide mentions "@channel", "@all", "@here"'
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
                                id='notificationTriggerCustom'
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
                        id='notificationTriggerCustomText'
                        ref='custommentions'
                        className='form-control mentions-input'
                        type='text'
                        defaultValue={this.state.customKeys}
                        onChange={this.onCustomChange}
                    />
                </div>
            );

            const extraInfo = (
                <span>
                    <FormattedMessage
                        id='user.settings.notifications.mentionsInfo'
                        defaultMessage='Mentions trigger when someone sends a message that includes your username (@{username}) or any of the options selected above.'
                        values={{
                            username: user.username
                        }}
                    />
                </span>
            );

            keysSection = (
                <SettingItemMax
                    title={Utils.localizeMessage('user.settings.notifications.wordsTrigger', 'Words that trigger mentions')}
                    inputs={inputs}
                    submit={this.handleSubmit}
                    server_error={serverError}
                    updateSection={this.handleCancel}
                    extraInfo={extraInfo}
                />
            );
        } else {
            let keys = ['@' + user.username];
            if (this.state.firstNameKey) {
                keys.push(user.first_name);
            }
            if (this.state.usernameKey) {
                keys.push(user.username);
            }

            if (this.state.channelKey) {
                keys.push('@channel');
                keys.push('@all');
                keys.push('@here');
            }
            if (this.state.customKeys.length > 0) {
                keys = keys.concat(this.state.customKeys.split(','));
            }

            let describe = '';
            for (let i = 0; i < keys.length; i++) {
                if (keys[i] !== '') {
                    describe += '"' + keys[i] + '", ';
                }
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
                    title={Utils.localizeMessage('user.settings.notifications.wordsTrigger', 'Words that trigger mentions')}
                    describe={describe}
                    updateSection={handleUpdateKeysSection}
                />
            );
        }

        let commentsSection;
        let handleUpdateCommentsSection;
        if (this.props.activeSection === 'comments') {
            const commentsActive = [false, false, false];
            if (this.state.notifyCommentsLevel === 'never') {
                commentsActive[2] = true;
            } else if (this.state.notifyCommentsLevel === 'root') {
                commentsActive[1] = true;
            } else {
                commentsActive[0] = true;
            }

            const inputs = [];

            inputs.push(
                <div key='userNotificationLevelOption'>
                    <div className='radio'>
                        <label>
                            <input
                                id='notificationCommentsAny'
                                type='radio'
                                name='commentsNotificationLevel'
                                checked={commentsActive[0]}
                                onChange={this.handleNotifyCommentsRadio.bind(this, 'any')}
                            />
                            <FormattedMessage
                                id='user.settings.notifications.commentsAny'
                                defaultMessage='Mention any comments in a thread you participated in (This will include both mentions to your root post and any comments after you commented on a post)'
                            />
                        </label>
                        <br/>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                id='notificationCommentsRoot'
                                type='radio'
                                name='commentsNotificationLevel'
                                checked={commentsActive[1]}
                                onChange={this.handleNotifyCommentsRadio.bind(this, 'root')}
                            />
                            <FormattedMessage
                                id='user.settings.notifications.commentsRoot'
                                defaultMessage='Mention any comments on your post'
                            />
                        </label>
                        <br/>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                id='notificationCommentsNever'
                                type='radio'
                                name='commentsNotificationLevel'
                                checked={commentsActive[2]}
                                onChange={this.handleNotifyCommentsRadio.bind(this, 'never')}
                            />
                            <FormattedMessage
                                id='user.settings.notifications.commentsNever'
                                defaultMessage='No mentions for comments'
                            />
                        </label>
                    </div>
                </div>
            );

            const extraInfo = (
                <span>
                    <FormattedMessage
                        id='user.settings.notifications.commentsInfo'
                        defaultMessage="In addition to notifications for when you're mentioned, select if you would like to receive notifications on reply threads."
                    />
                </span>
            );

            commentsSection = (
                <SettingItemMax
                    title={Utils.localizeMessage('user.settings.notifications.comments', 'Reply notifications')}
                    extraInfo={extraInfo}
                    inputs={inputs}
                    submit={this.handleSubmit}
                    server_error={serverError}
                    updateSection={this.handleCancel}
                />
            );
        } else {
            let describe = '';
            if (this.state.notifyCommentsLevel === 'never') {
                describe = (
                    <FormattedMessage
                        id='user.settings.notifications.commentsNever'
                        defaultMessage="Do not trigger notifications on messages in reply threads unless I'm mentioned"
                    />
                );
            } else if (this.state.notifyCommentsLevel === 'root') {
                describe = (
                    <FormattedMessage
                        id='user.settings.notifications.commentsRoot'
                        defaultMessage='Trigger notifications on messages in threads that I start'
                    />
                );
            } else {
                describe = (
                    <FormattedMessage
                        id='user.settings.notifications.commentsAny'
                        defaultMessage='Trigger notifications on messages in reply threads that I start or participate in'
                    />
                );
            }

            handleUpdateCommentsSection = function updateCommentsSection() {
                this.props.updateSection('comments');
            }.bind(this);

            commentsSection = (
                <SettingItemMin
                    title={Utils.localizeMessage('user.settings.notifications.comments', 'Reply notifications')}
                    describe={describe}
                    updateSection={handleUpdateCommentsSection}
                />
            );
        }

        const pushNotificationSection = this.createPushNotificationSection();

        return (
            <div>
                <div className='modal-header'>
                    <button
                        id='closeButton'
                        type='button'
                        className='close'
                        data-dismiss='modal'
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
                    <DesktopNotificationSettings
                        activity={this.state.desktopActivity}
                        sound={this.state.desktopSound}
                        duration={this.state.desktopDuration}
                        updateSection={this.updateSection}
                        setParentState={this.setStateValue}
                        submit={this.handleSubmit}
                        cancel={this.handleCancel}
                        error={this.state.serverError}
                        active={this.props.activeSection === 'desktop'}
                    />
                    <div className='divider-light'/>
                    <EmailNotificationSetting
                        activeSection={this.props.activeSection}
                        updateSection={this.props.updateSection}
                        enableEmail={this.state.enableEmail === 'true'}
                        onChange={this.handleEmailRadio}
                        onSubmit={this.handleSubmit}
                        serverError={this.state.serverError}
                    />
                    <div className='divider-light'/>
                    {pushNotificationSection}
                    <div className='divider-light'/>
                    {keysSection}
                    <div className='divider-light'/>
                    {commentsSection}
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
    user: PropTypes.object,
    updateSection: PropTypes.func,
    updateTab: PropTypes.func,
    activeSection: PropTypes.string,
    activeTab: PropTypes.string,
    closeModal: PropTypes.func.isRequired,
    collapseModal: PropTypes.func.isRequired
};
