// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import {savePreference} from 'utils/async_client.jsx';
import PreferenceStore from 'stores/preference_store.jsx';
import {localizeMessage} from 'utils/utils.jsx';

import {FormattedMessage} from 'react-intl';
import SettingItemMin from 'components/setting_item_min.jsx';
import SettingItemMax from 'components/setting_item_max.jsx';

import {Preferences} from 'utils/constants.jsx';

export default class EmailNotificationSetting extends React.Component {
    static propTypes = {
        activeSection: React.PropTypes.string.isRequired,
        updateSection: React.PropTypes.func.isRequired,
        enableEmail: React.PropTypes.bool.isRequired,
        onChange: React.PropTypes.func.isRequired,
        onSubmit: React.PropTypes.func.isRequired,
        serverError: React.PropTypes.string.isRequired
    };

    constructor(props) {
        super(props);

        this.submit = this.submit.bind(this);

        this.expand = this.expand.bind(this);
        this.collapse = this.collapse.bind(this);

        this.state = {
            emailInterval: PreferenceStore.getInt(Preferences.CATEGORY_NOTIFICATIONS, Preferences.EMAIL_INTERVAL, 0)
        };
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
        if (this.props.activeSection !== 'email') {
            let description;

            if (this.props.enableEmail === 'true') {
                switch (this.state.emailInterval) {
                case 0:
                    description = (
                        <FormattedMessage
                            id='user.settings.notifications.email.immediately'
                            defaultMessage='Immediately'
                        />
                    );
                    break;
                case 60:
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
                            defaultMessage='Every {count, number} {count, plural, one {minute} other {minutes}}'
                            values={{count: this.state.emailInterval}}
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
                    title={localizeMessage('user.settings.notifications.emailNotifications', 'Send Email notifications')}
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
                                type='radio'
                                name='emailNotifications'
                                checked={this.props.enableEmail === 'true' && this.state.emailInterval === 15}
                                onChange={this.handleChange.bind(this, 'true', 15)}
                            />
                            <FormattedMessage
                                id='user.settings.notifications.email.everyXMinutes'
                                defaultMessage='Every {count} minutes'
                                values={{count: 15}}
                            />
                        </label>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                name='emailNotifications'
                                checked={this.props.enableEmail === 'true' && this.state.emailInterval === 60}
                                onChange={this.handleChange.bind(this, 'true', 60)}
                            />
                            <FormattedMessage
                                id='user.settings.notifications.everyHour'
                                defaultMessage='Every hour'
                            />
                        </label>
                    </div>
                </div>
            );

            batchingInfo = (
                <FormattedMessage
                    id='user.settings.notifications.emailBatchingInfo'
                    defaultMessage='Notifications are combined into a single email and sent at the maximum frequency selected here.'
                />
            );
        }

        return (
            <SettingItemMax
                title={localizeMessage('user.settings.notifications.emailNotifications', 'Send Email notifications')}
                inputs={[
                    <div key='userNotificationEmailOptions'>
                        <div className='radio'>
                            <label>
                                <input
                                    type='radio'
                                    name='emailNotifications'
                                    checked={this.props.enableEmail === 'true' && this.state.emailInterval === 0}
                                    onChange={this.handleChange.bind(this, 'true', 0)}
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
                                    type='radio'
                                    name='emailNotifications'
                                    checked={this.props.enableEmail === 'false'}
                                    onChange={this.handleChange.bind(this, 'false', 0)}
                                />
                                <FormattedMessage
                                    id='user.settings.notifications.never'
                                    defaultMessage='Never'
                                />
                            </label>
                        </div>
                        <br/>
                        <div>
                            <FormattedMessage
                                id='user.settings.notifications.emailInfo'
                                defaultMessage='Email notifications that are sent for mentions and direct messages when you are offline or away from {siteName} for more than 5 minutes.'
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