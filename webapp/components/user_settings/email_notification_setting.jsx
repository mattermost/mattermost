// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import PropTypes from 'prop-types';

import {savePreference} from 'actions/user_actions.jsx';
import PreferenceStore from 'stores/preference_store.jsx';
import {localizeMessage} from 'utils/utils.jsx';

import {FormattedMessage} from 'react-intl';
import SettingItemMin from 'components/setting_item_min.jsx';
import SettingItemMax from 'components/setting_item_max.jsx';

import {Preferences} from 'utils/constants.jsx';

export default class EmailNotificationSetting extends React.Component {
    static propTypes = {
        activeSection: PropTypes.string.isRequired,
        updateSection: PropTypes.func.isRequired,
        enableEmail: PropTypes.bool.isRequired,
        onChange: PropTypes.func.isRequired,
        onSubmit: PropTypes.func.isRequired,
        serverError: PropTypes.string
    };

    constructor(props) {
        super(props);

        this.submit = this.submit.bind(this);
        this.expand = this.expand.bind(this);
        this.collapse = this.collapse.bind(this);

        if (global.mm_config.EnableEmailBatching === 'true') {
            // when email batching is enabled, the default interval is 15 minutes
            this.state = {
                emailInterval: PreferenceStore.getInt(Preferences.CATEGORY_NOTIFICATIONS, Preferences.EMAIL_INTERVAL, Preferences.INTERVAL_FIFTEEN_MINUTES)
            };
        } else {
            // otherwise, the default interval is immediately
            this.state = {
                emailInterval: PreferenceStore.getInt(Preferences.CATEGORY_NOTIFICATIONS, Preferences.EMAIL_INTERVAL, Preferences.INTERVAL_IMMEDIATE)
            };
        }
    }

    handleChange(enableEmail, emailInterval) {
        this.props.onChange(enableEmail);
        this.setState({emailInterval});
    }

    submit() {
        // until the rest of the notification settings are moved to preferences, we have to do this separately
        savePreference(Preferences.CATEGORY_NOTIFICATIONS, Preferences.EMAIL_INTERVAL, this.state.emailInterval.toString());

        this.props.onSubmit();
    }

    expand() {
        this.props.updateSection('email');
    }

    collapse() {
        this.props.updateSection('');
    }

    render() {
        if (global.window.mm_config.SendEmailNotifications !== 'true' && this.props.activeSection === 'email') {
            const inputs = [];

            inputs.push(
                <div
                    key='oauthEmailInfo'
                    className='padding-top'
                >
                    <FormattedMessage
                        id='user.settings.notifications.email.disabled_long'
                        defaultMessage='Email notifications have been disabled by your System Administrator.'
                    />
                </div>
            );

            return (
                <SettingItemMax
                    title={localizeMessage('user.settings.notifications.emailNotifications', 'Email notifications')}
                    inputs={inputs}
                    server_error={this.state.serverError}
                    updateSection={this.collapse}
                />
            );
        }

        if (this.props.activeSection !== 'email') {
            let description;

            if (global.window.mm_config.SendEmailNotifications !== 'true') {
                description = (
                    <FormattedMessage
                        id='user.settings.notifications.email.disabled'
                        defaultMessage='Disabled by System Administrator'
                    />
                );
            } else if (this.props.enableEmail) {
                switch (this.state.emailInterval) {
                case Preferences.INTERVAL_IMMEDIATE:
                    description = (
                        <FormattedMessage
                            id='user.settings.notifications.email.immediately'
                            defaultMessage='Immediately'
                        />
                    );
                    break;
                case Preferences.INTERVAL_HOUR:
                    description = (
                        <FormattedMessage
                            id='user.settings.notifications.email.everyHour'
                            defaultMessage='Every hour'
                        />
                    );
                    break;
                default:
                    description = (
                        <FormattedMessage
                            id='user.settings.notifications.email.everyXMinutes'
                            defaultMessage='Every {count, plural, one {minute} other {{count, number} minutes}}'
                            values={{count: this.state.emailInterval / 60}}
                        />
                    );
                }
            } else {
                description = (
                    <FormattedMessage
                        id='user.settings.notifications.email.never'
                        defaultMessage='Never'
                    />
                );
            }

            return (
                <SettingItemMin
                    title={localizeMessage('user.settings.notifications.emailNotifications', 'Email notifications')}
                    describe={description}
                    updateSection={this.expand}
                />
            );
        }

        let batchingOptions = null;
        let batchingInfo = null;
        if (window.mm_config.EnableEmailBatching === 'true') {
            batchingOptions = (
                <div>
                    <div className='radio'>
                        <label>
                            <input
                                id='emailNotificationMinutes'
                                type='radio'
                                name='emailNotifications'
                                checked={this.props.enableEmail && this.state.emailInterval === Preferences.INTERVAL_FIFTEEN_MINUTES}
                                onChange={this.handleChange.bind(this, 'true', Preferences.INTERVAL_FIFTEEN_MINUTES)}
                            />
                            <FormattedMessage
                                id='user.settings.notifications.email.everyXMinutes'
                                defaultMessage='Every {count} minutes'
                                values={{count: Preferences.INTERVAL_FIFTEEN_MINUTES / 60}}
                            />
                        </label>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                id='emailNotificationHour'
                                type='radio'
                                name='emailNotifications'
                                checked={this.props.enableEmail && this.state.emailInterval === Preferences.INTERVAL_HOUR}
                                onChange={this.handleChange.bind(this, 'true', Preferences.INTERVAL_HOUR)}
                            />
                            <FormattedMessage
                                id='user.settings.notifications.email.everyHour'
                                defaultMessage='Every hour'
                            />
                        </label>
                    </div>
                </div>
            );

            batchingInfo = (
                <FormattedMessage
                    id='user.settings.notifications.emailBatchingInfo'
                    defaultMessage='Notifications received over the time period selected are combined and sent in a single email.'
                />
            );
        }

        return (
            <SettingItemMax
                title={localizeMessage('user.settings.notifications.emailNotifications', 'Email notifications')}
                inputs={[
                    <div key='userNotificationEmailOptions'>
                        <label>
                            <FormattedMessage
                                id='user.settings.notifications.email.send'
                                defaultMessage='Send email notifications'
                            />
                        </label>
                        <div className='radio'>
                            <label>
                                <input
                                    id='emailNotificationImmediately'
                                    type='radio'
                                    name='emailNotifications'
                                    checked={this.props.enableEmail && this.state.emailInterval === Preferences.INTERVAL_IMMEDIATE}
                                    onChange={this.handleChange.bind(this, 'true', Preferences.INTERVAL_IMMEDIATE)}
                                />
                                <FormattedMessage
                                    id='user.settings.notifications.email.immediately'
                                    defaultMessage='Immediately'
                                />
                            </label>
                        </div>
                        {batchingOptions}
                        <div className='radio'>
                            <label>
                                <input
                                    id='emailNotificationNever'
                                    type='radio'
                                    name='emailNotifications'
                                    checked={!this.props.enableEmail}
                                    onChange={this.handleChange.bind(this, 'false', Preferences.INTERVAL_IMMEDIATE)}
                                />
                                <FormattedMessage
                                    id='user.settings.notifications.email.never'
                                    defaultMessage='Never'
                                />
                            </label>
                        </div>
                        <br/>
                        <div>
                            <FormattedMessage
                                id='user.settings.notifications.emailInfo'
                                defaultMessage='Email notifications are sent for mentions and direct messages when you are offline or away from {siteName} for more than 5 minutes.'
                                values={{
                                    siteName: global.window.mm_config.SiteName
                                }}
                            />
                            {' '}
                            {batchingInfo}
                        </div>
                    </div>
                ]}
                submit={this.submit}
                server_error={this.props.serverError}
                updateSection={this.collapse}
            />
        );
    }
}
