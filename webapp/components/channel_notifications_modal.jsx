// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import SettingItemMin from 'components/setting_item_min.jsx';
import SettingItemMax from 'components/setting_item_max.jsx';

import ChannelStore from 'stores/channel_store.jsx';
import PreferenceStore from 'stores/preference_store.jsx';

import $ from 'jquery';
import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage, FormattedHTMLMessage} from 'react-intl';

import {updateChannelNotifyProps} from 'actions/channel_actions.jsx';
import {Preferences} from 'utils/constants.jsx';

export default class ChannelNotificationsModal extends React.Component {
    constructor(props) {
        super(props);

        this.updateSection = this.updateSection.bind(this);
        this.onHide = this.onHide.bind(this);

        this.handleSubmitDesktopNotifyLevel = this.handleSubmitDesktopNotifyLevel.bind(this);
        this.handleUpdateDesktopNotifyLevel = this.handleUpdateDesktopNotifyLevel.bind(this);
        this.createDesktopNotifyLevelSection = this.createDesktopNotifyLevelSection.bind(this);

        this.handleSubmitMarkUnreadLevel = this.handleSubmitMarkUnreadLevel.bind(this);
        this.handleUpdateMarkUnreadLevel = this.handleUpdateMarkUnreadLevel.bind(this);
        this.createMarkUnreadLevelSection = this.createMarkUnreadLevelSection.bind(this);

        this.handleSubmitEmailNotification = this.handleSubmitEmailNotification.bind(this);
        this.handleUpdateEmailNotification = this.handleUpdateEmailNotification.bind(this);
        this.createEmailNotificationSection = this.createEmailNotificationSection.bind(this);

        this.handleSubmitPushNotificationLevel = this.handleSubmitPushNotificationLevel.bind(this);
        this.handleUpdatePushNotificationLevel = this.handleUpdatePushNotificationLevel.bind(this);
        this.createPushNotificationLevelSection = this.createPushNotificationLevelSection.bind(this);

        this.state = {
            activeSection: '',
            show: true,
            notifyLevel: props.channelMember.notify_props.desktop,
            unreadLevel: props.channelMember.notify_props.mark_unread,
            pushLevel: props.channelMember.notify_props.push || 'default',
            shouldSendEmail: props.channelMember.notify_props.email || 'default'
        };
    }

    updateSection(section) {
        if ($('.section-max').length) {
            $('.settings-modal .modal-body').scrollTop(0).perfectScrollbar('update');
        }
        this.setState({activeSection: section});
    }

    onHide() {
        this.setState({show: false});
    }

    handleSubmitDesktopNotifyLevel() {
        const channelId = this.props.channel.id;
        const notifyLevel = this.state.notifyLevel;
        const currentUserId = this.props.currentUser.id;

        if (this.props.channelMember.notify_props.desktop === notifyLevel) {
            this.updateSection('');
            return;
        }

        const data = {
            channel_id: channelId,
            user_id: currentUserId,
            desktop: notifyLevel
        };

        updateChannelNotifyProps(data,
            () => {
                // YUCK
                var member = ChannelStore.getMyMember(channelId);
                member.notify_props.desktop = notifyLevel;
                ChannelStore.storeMyChannelMember(member);

                this.updateSection('');
            },
            (err) => {
                this.setState({serverError: err.message});
            }
        );
    }

    handleUpdateDesktopNotifyLevel(notifyLevel) {
        this.setState({notifyLevel});
    }

    createDesktopNotifyLevelSection(serverError) {
        // Get glabal user setting for notifications
        const globalNotifyLevel = this.props.currentUser.notify_props ? this.props.currentUser.notify_props.desktop : 'all';
        let globalNotifyLevelName;
        if (globalNotifyLevel === 'all') {
            globalNotifyLevelName = (
                <FormattedMessage
                    id='channel_notifications.allActivity'
                    defaultMessage='For all activity'
                />
            );
        } else if (globalNotifyLevel === 'mention') {
            globalNotifyLevelName = (
                <FormattedMessage
                    id='channel_notifications.onlyMentions'
                    defaultMessage='Only for mentions'
                />
            );
        } else {
            globalNotifyLevelName = (
                <FormattedMessage
                    id='channel_notifications.never'
                    defaultMessage='Never'
                />
            );
        }

        const sendDesktop = (
            <FormattedMessage
                id='channel_notifications.sendDesktop'
                defaultMessage='Send desktop notifications'
            />
        );

        const notificationLevel = this.state.notifyLevel;

        if (this.state.activeSection === 'desktop') {
            const notifyActive = [false, false, false, false];
            if (notificationLevel === 'default') {
                notifyActive[0] = true;
            } else if (notificationLevel === 'all') {
                notifyActive[1] = true;
            } else if (notificationLevel === 'mention') {
                notifyActive[2] = true;
            } else {
                notifyActive[3] = true;
            }

            var inputs = [];

            inputs.push(
                <div key='channel-notification-level-radio'>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                name='desktopNotificationLevel'
                                checked={notifyActive[0]}
                                onChange={this.handleUpdateDesktopNotifyLevel.bind(this, 'default')}
                            />
                            <FormattedMessage
                                id='channel_notifications.globalDefault'
                                defaultMessage='Global default ({notifyLevel})'
                                values={{
                                    notifyLevel: (globalNotifyLevelName)
                                }}
                            />
                        </label>
                        <br/>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                name='desktopNotificationLevel'
                                checked={notifyActive[1]}
                                onChange={this.handleUpdateDesktopNotifyLevel.bind(this, 'all')}
                            />
                            <FormattedMessage id='channel_notifications.allActivity'/>
                        </label>
                        <br/>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                name='desktopNotificationLevel'
                                checked={notifyActive[2]}
                                onChange={this.handleUpdateDesktopNotifyLevel.bind(this, 'mention')}
                            />
                            <FormattedMessage id='channel_notifications.onlyMentions'/>
                        </label>
                        <br/>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                name='desktopNotificationLevel'
                                checked={notifyActive[3]}
                                onChange={this.handleUpdateDesktopNotifyLevel.bind(this, 'none')}
                            />
                            <FormattedMessage id='channel_notifications.never'/>
                        </label>
                    </div>
                </div>
            );

            const handleUpdateSection = function updateSection(e) {
                this.updateSection('');
                e.preventDefault();
            }.bind(this);

            const extraInfo = (
                <span>
                    <FormattedMessage
                        id='channel_notifications.override'
                        defaultMessage='Selecting an option other than "Default" will override the global notification settings. Desktop notifications are available on Firefox, Safari, and Chrome.'
                    />
                </span>
            );

            return (
                <SettingItemMax
                    title={sendDesktop}
                    inputs={inputs}
                    submit={this.handleSubmitDesktopNotifyLevel}
                    server_error={serverError}
                    updateSection={handleUpdateSection}
                    extraInfo={extraInfo}
                />
            );
        }

        var describe;
        if (notificationLevel === 'default') {
            describe = (
                <FormattedMessage
                    id='channel_notifications.globalDefault'
                    values={{
                        notifyLevel: (globalNotifyLevelName)
                    }}
                />
            );
        } else if (notificationLevel === 'mention') {
            describe = (<FormattedMessage id='channel_notifications.onlyMentions'/>);
        } else if (notificationLevel === 'all') {
            describe = (<FormattedMessage id='channel_notifications.allActivity'/>);
        } else {
            describe = (<FormattedMessage id='channel_notifications.never'/>);
        }

        return (
            <SettingItemMin
                title={sendDesktop}
                describe={describe}
                updateSection={() => {
                    this.updateSection('desktop');
                }}
            />
        );
    }

    handleSubmitMarkUnreadLevel() {
        const channelId = this.props.channel.id;
        const markUnreadLevel = this.state.unreadLevel;

        if (this.props.channelMember.notify_props.mark_unread === markUnreadLevel) {
            this.updateSection('');
            return;
        }

        const data = {
            channel_id: channelId,
            user_id: this.props.currentUser.id,
            mark_unread: markUnreadLevel
        };

        updateChannelNotifyProps(data,
            () => {
                // Yuck...
                var member = ChannelStore.getMyMember(channelId);
                member.notify_props.mark_unread = markUnreadLevel;
                ChannelStore.storeMyChannelMember(member);
                this.updateSection('');
            },
            (err) => {
                this.setState({serverError: err.message});
            }
        );
    }

    handleUpdateMarkUnreadLevel(unreadLevel) {
        this.setState({unreadLevel});
    }

    createMarkUnreadLevelSection(serverError) {
        let content;

        const markUnread = (
            <FormattedMessage
                id='channel_notifications.markUnread'
                defaultMessage='Mark Channel Unread'
            />
        );
        if (this.state.activeSection === 'markUnreadLevel') {
            const inputs = [(
                <div key='channel-notification-unread-radio'>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                name='markUnreadLevel'
                                checked={this.state.unreadLevel === 'all'}
                                onChange={this.handleUpdateMarkUnreadLevel.bind(this, 'all')}
                            />
                            <FormattedMessage
                                id='channel_notifications.allUnread'
                                defaultMessage='For all unread messages'
                            />
                        </label>
                        <br/>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                name='markUnreadLevel'
                                checked={this.state.unreadLevel === 'mention'}
                                onChange={this.handleUpdateMarkUnreadLevel.bind(this, 'mention')}
                            />
                            <FormattedMessage id='channel_notifications.onlyMentions'/>
                        </label>
                        <br/>
                    </div>
                </div>
            )];

            const handleUpdateSection = function handleUpdateSection(e) {
                this.updateSection('');
                e.preventDefault();
            }.bind(this);

            const extraInfo = (
                <span>
                    <FormattedMessage
                        id='channel_notifications.unreadInfo'
                        defaultMessage='The channel name is bolded in the sidebar when there are unread messages. Selecting "Only for mentions" will bold the channel only when you are mentioned.'
                    />
                </span>
            );

            content = (
                <SettingItemMax
                    title={markUnread}
                    inputs={inputs}
                    submit={this.handleSubmitMarkUnreadLevel}
                    server_error={serverError}
                    updateSection={handleUpdateSection}
                    extraInfo={extraInfo}
                />
            );
        } else {
            let describe;

            if (!this.state.unreadLevel || this.state.unreadLevel === 'all') {
                describe = (
                    <FormattedMessage
                        id='channel_notifications.allUnread'
                        defaultMessage='For all unread messages'
                    />
                );
            } else {
                describe = (<FormattedMessage id='channel_notifications.onlyMentions'/>);
            }

            const handleUpdateSection = function handleUpdateSection(e) {
                this.updateSection('markUnreadLevel');
                e.preventDefault();
            }.bind(this);

            content = (
                <SettingItemMin
                    title={markUnread}
                    describe={describe}
                    updateSection={handleUpdateSection}
                />
            );
        }

        return content;
    }

    handleSubmitEmailNotification() {
        const channelId = this.props.channel.id;
        const shouldSendEmail = this.state.shouldSendEmail;
        const currentUserId = this.props.currentUser.id;

        if (this.props.channelMember.notify_props.email === shouldSendEmail) {
            this.updateSection('');
            return;
        }

        const data = {
            channel_id: channelId,
            user_id: currentUserId,
            email: shouldSendEmail
        };

        updateChannelNotifyProps(data,
            () => {
                // YUCK
                const member = ChannelStore.getMyMember(channelId);
                member.notify_props.email = shouldSendEmail;
                ChannelStore.storeMyChannelMember(member);

                this.updateSection('');
            },
            (err) => {
                this.setState({serverError: err.message});
            }
        );
    }

    handleUpdateEmailNotification(shouldSendEmail) {
        this.setState({shouldSendEmail});
    }

    createEmailNotificationSection(serverError) {
        if (global.mm_config.SendEmailNotifications === 'false') {
            return null;
        }

        // Get glabal user setting for notifications
        const globalNotifyLevel = this.props.currentUser.notify_props ? this.props.currentUser.notify_props.email : 'true';
        const emailInterval = PreferenceStore.getInt(Preferences.CATEGORY_NOTIFICATIONS, Preferences.EMAIL_INTERVAL, Preferences.INTERVAL_IMMEDIATE);

        let globalNotifyLevelName;
        let dynamicOptionName;
        if (globalNotifyLevel === 'false') {
            globalNotifyLevelName = (
                <FormattedMessage
                    id='user.settings.notifications.email.never'
                    defaultMessage='Never'
                />
            );

            dynamicOptionName = (
                <FormattedMessage
                    id='user.settings.notifications.email.immediately'
                    defaultMessage='Immediately'
                />
            );
        } else {
            switch (emailInterval) {
            case Preferences.INTERVAL_IMMEDIATE:
                globalNotifyLevelName = (
                    <FormattedMessage
                        id='user.settings.notifications.email.immediately'
                        defaultMessage='Immediately'
                    />
                );
                break;
            case Preferences.INTERVAL_HOUR:
                globalNotifyLevelName = (
                    <FormattedMessage
                        id='user.settings.notifications.email.everyHour'
                        defaultMessage='Every hour'
                    />
                );
                break;
            default:
                globalNotifyLevelName = (
                    <FormattedMessage
                        id='user.settings.notifications.email.everyXMinutes'
                        defaultMessage='Every {count, plural, one {minute} other {{count, number} minutes}}'
                        values={{count: emailInterval / 60}}
                    />
                );
            }

            dynamicOptionName = globalNotifyLevelName;
        }

        const sendEmailNotifications = (
            <FormattedMessage
                id='channel_notifications.email'
                defaultMessage='Email notifications'
            />
        );

        const notificationLevel = this.state.shouldSendEmail;

        let content;
        if (this.state.activeSection === 'email') {
            const notifyActive = [false, false, false];
            if (notificationLevel === 'default') {
                notifyActive[0] = true;
            } else if (notificationLevel === 'true') {
                notifyActive[1] = true;
            } else if (notificationLevel === 'false') {
                notifyActive[2] = true;
            }

            const inputs = [];

            inputs.push(
                <div key='channel-notification-level-radio'>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                name='emailNotificationLevel'
                                checked={notifyActive[0]}
                                onChange={this.handleUpdateEmailNotification.bind(this, 'default')}
                            />
                            <FormattedMessage
                                id='channel_notifications.globalDefault'
                                defaultMessage='Global default ({notifyLevel})'
                                values={{
                                    notifyLevel: (globalNotifyLevelName)
                                }}
                            />
                        </label>
                        <br/>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                name='emailNotificationLevel'
                                checked={notifyActive[1]}
                                onChange={this.handleUpdateEmailNotification.bind(this, 'true')}
                            />
                            {dynamicOptionName}
                        </label>
                        <br/>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                name='emailNotificationLevel'
                                checked={notifyActive[2]}
                                onChange={this.handleUpdateEmailNotification.bind(this, 'false')}
                            />
                            <FormattedMessage id='channel_notifications.never'/>
                        </label>
                    </div>
                </div>
            );

            const handleUpdateSection = function updateSection(e) {
                this.updateSection('');
                e.preventDefault();
            }.bind(this);

            const extraInfo = (
                <span>
                    <FormattedHTMLMessage
                        id='channel_notifications.overrideEmail'
                        defaultMessage='To change the global default, go to <strong>Account Settings > Notifications > Email notifications<strong>.'
                    />
                </span>
            );

            content = (
                <SettingItemMax
                    title={sendEmailNotifications}
                    inputs={inputs}
                    submit={this.handleSubmitEmailNotification}
                    server_error={serverError}
                    updateSection={handleUpdateSection}
                    extraInfo={extraInfo}
                />
            );
        } else {
            let describe;
            if (notificationLevel === 'default') {
                describe = (
                    <FormattedMessage
                        id='channel_notifications.globalDefault'
                        values={{
                            notifyLevel: (globalNotifyLevelName)
                        }}
                    />
                );
            } else if (notificationLevel === 'true') {
                describe = dynamicOptionName;
            } else if (notificationLevel === 'false') {
                describe = (<FormattedMessage id='channel_notifications.never'/>);
            }

            content = (
                <SettingItemMin
                    title={sendEmailNotifications}
                    describe={describe}
                    updateSection={() => {
                        this.updateSection('email');
                    }}
                />
            );
        }

        return (
            <div>
                <div className='divider-light'/>
                {content}
            </div>
        );
    }

    handleSubmitPushNotificationLevel() {
        const channelId = this.props.channel.id;
        const notifyLevel = this.state.pushLevel;
        const currentUserId = this.props.currentUser.id;

        if (this.props.channelMember.notify_props.push === notifyLevel) {
            this.updateSection('');
            return;
        }

        const data = {
            channel_id: channelId,
            user_id: currentUserId,
            push: notifyLevel
        };

        updateChannelNotifyProps(data,
            () => {
                // YUCK
                const member = ChannelStore.getMyMember(channelId);
                member.notify_props.push = notifyLevel;
                ChannelStore.storeMyChannelMember(member);

                this.updateSection('');
            },
            (err) => {
                this.setState({serverError: err.message});
            }
        );
    }

    handleUpdatePushNotificationLevel(pushLevel) {
        this.setState({pushLevel});
    }

    createPushNotificationLevelSection(serverError) {
        if (global.mm_config.SendPushNotifications === 'false') {
            return null;
        }

        // Get glabal user setting for notifications
        const globalNotifyLevel = this.props.currentUser.notify_props ? this.props.currentUser.notify_props.push : 'all';
        let globalNotifyLevelName;
        if (globalNotifyLevel === 'all') {
            globalNotifyLevelName = (
                <FormattedMessage
                    id='channel_notifications.allActivity'
                    defaultMessage='For all activity'
                />
            );
        } else if (globalNotifyLevel === 'mention') {
            globalNotifyLevelName = (
                <FormattedMessage
                    id='channel_notifications.onlyMentions'
                    defaultMessage='Only for mentions'
                />
            );
        } else {
            globalNotifyLevelName = (
                <FormattedMessage
                    id='channel_notifications.never'
                    defaultMessage='Never'
                />
            );
        }

        const sendPushNotifications = (
            <FormattedMessage
                id='channel_notifications.push'
                defaultMessage='Mobile push notifications'
            />
        );

        const notificationLevel = this.state.pushLevel;

        let content;
        if (this.state.activeSection === 'push') {
            const notifyActive = [false, false, false, false];
            if (notificationLevel === 'default') {
                notifyActive[0] = true;
            } else if (notificationLevel === 'all') {
                notifyActive[1] = true;
            } else if (notificationLevel === 'mention') {
                notifyActive[2] = true;
            } else {
                notifyActive[3] = true;
            }

            const inputs = [];

            inputs.push(
                <div key='channel-notification-level-radio'>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                name='pushNotificationLevel'
                                checked={notifyActive[0]}
                                onChange={this.handleUpdatePushNotificationLevel.bind(this, 'default')}
                            />
                            <FormattedMessage
                                id='channel_notifications.globalDefault'
                                defaultMessage='Global default ({notifyLevel})'
                                values={{
                                    notifyLevel: (globalNotifyLevelName)
                                }}
                            />
                        </label>
                        <br/>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                name='pushNotificationLevel'
                                checked={notifyActive[1]}
                                onChange={this.handleUpdatePushNotificationLevel.bind(this, 'all')}
                            />
                            <FormattedMessage id='channel_notifications.allActivity'/>
                        </label>
                        <br/>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                name='pushNotificationLevel'
                                checked={notifyActive[2]}
                                onChange={this.handleUpdatePushNotificationLevel.bind(this, 'mention')}
                            />
                            <FormattedMessage id='channel_notifications.onlyMentions'/>
                        </label>
                        <br/>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                name='pushNotificationLevel'
                                checked={notifyActive[3]}
                                onChange={this.handleUpdatePushNotificationLevel.bind(this, 'none')}
                            />
                            <FormattedMessage id='channel_notifications.never'/>
                        </label>
                    </div>
                </div>
            );

            const handleUpdateSection = function updateSection(e) {
                this.updateSection('');
                e.preventDefault();
            }.bind(this);

            const extraInfo = (
                <span>
                    <FormattedMessage
                        id='channel_notifications.overridePush'
                        defaultMessage='Selecting an option other than "Global default" will override the global notification settings for mobile push notifications in account settings. Push notifications must be enabled by the System Admin.'
                    />
                </span>
            );

            content = (
                <SettingItemMax
                    title={sendPushNotifications}
                    inputs={inputs}
                    submit={this.handleSubmitPushNotificationLevel}
                    server_error={serverError}
                    updateSection={handleUpdateSection}
                    extraInfo={extraInfo}
                />
            );
        } else {
            let describe;
            if (notificationLevel === 'default') {
                describe = (
                    <FormattedMessage
                        id='channel_notifications.globalDefault'
                        values={{
                            notifyLevel: (globalNotifyLevelName)
                        }}
                    />
                );
            } else if (notificationLevel === 'mention') {
                describe = (<FormattedMessage id='channel_notifications.onlyMentions'/>);
            } else if (notificationLevel === 'all') {
                describe = (<FormattedMessage id='channel_notifications.allActivity'/>);
            } else {
                describe = (<FormattedMessage id='channel_notifications.never'/>);
            }

            content = (
                <SettingItemMin
                    title={sendPushNotifications}
                    describe={describe}
                    updateSection={() => {
                        this.updateSection('push');
                    }}
                />
            );
        }

        return (
            <div>
                <div className='divider-light'/>
                {content}
            </div>
        );
    }

    render() {
        let serverError = null;
        if (this.state.serverError) {
            serverError = <div className='form-group has-error'><label className='control-label'>{this.state.serverError}</label></div>;
        }

        return (
            <Modal
                show={this.state.show}
                dialogClassName='settings-modal settings-modal--tabless'
                onHide={this.onHide}
                onExited={this.props.onHide}
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title>
                        <FormattedMessage
                            id='channel_notifications.preferences'
                            defaultMessage='Notification Preferences for '
                        />
                        <span className='name'>{this.props.channel.display_name}</span>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className='settings-table'>
                        <div className='settings-content'>
                            <div
                                ref='wrapper'
                                className='user-settings'
                            >
                                <br/>
                                <div className='divider-dark first'/>
                                {this.createDesktopNotifyLevelSection(serverError)}
                                <div className='divider-light'/>
                                {this.createMarkUnreadLevelSection(serverError)}
                                {this.createEmailNotificationSection(serverError)}
                                {this.createPushNotificationLevelSection(serverError)}
                                <div className='divider-dark'/>
                            </div>
                        </div>
                    </div>
                    {serverError}
                </Modal.Body>
            </Modal>
        );
    }
}

ChannelNotificationsModal.propTypes = {
    onHide: React.PropTypes.func.isRequired,
    channel: React.PropTypes.object.isRequired,
    channelMember: React.PropTypes.object.isRequired,
    currentUser: React.PropTypes.object.isRequired
};
