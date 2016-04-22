// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as Utils from 'utils/utils.jsx';

import AdminSettings from './admin_settings.jsx';
import {FormattedMessage} from 'react-intl';
import SettingsGroup from './settings_group.jsx';
import TextSetting from './text_setting.jsx';

export class SessionSettingsPage extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);

        this.state = Object.assign(this.state, {
            sessionLengthWebInDays: props.config.ServiceSettings.SessionLengthWebInDays,
            sessionLengthMobileInDays: props.config.ServiceSettings.SessionLengthMobileInDays,
            sessionLengthSSOInDays: props.config.ServiceSettings.SessionLengthSSOInDays,
            sessionCacheInMinutes: props.config.ServiceSettings.SessionCacheInMinutes
        });
    }

    getConfigFromState(config) {
        config.ServiceSettings.SessionLengthWebInDays = this.parseIntNonZero(this.state.sessionLengthWebInDays);
        config.ServiceSettings.SessionLengthMobileInDays = this.parseIntNonZero(this.state.sessionLengthMobileInDays);
        config.ServiceSettings.SessionLengthSSOInDays = this.parseIntNonZero(this.state.sessionLengthSSOInDays);
        config.ServiceSettings.SessionCacheInMinutes = this.parseIntNonZero(this.state.sessionCacheInMinutes);

        return config;
    }

    renderTitle() {
        return (
            <h3>
                <FormattedMessage
                    id='admin.security.title'
                    defaultMessage='Security Settings'
                />
            </h3>
        );
    }

    renderSettings() {
        return (
            <SessionSettings
                sessionLengthWebInDays={this.state.sessionLengthWebInDays}
                sessionLengthMobileInDays={this.state.sessionLengthMobileInDays}
                sessionLengthSSOInDays={this.state.sessionLengthSSOInDays}
                sessionCacheInMinutes={this.state.sessionCacheInMinutes}
                onChange={this.handleChange}
            />
        );
    }
}

export class SessionSettings extends React.Component {
    static get propTypes() {
        return {
            sessionLengthWebInDays: React.PropTypes.oneOfType([
                React.PropTypes.string,
                React.PropTypes.number
            ]).isRequired,
            sessionLengthMobileInDays: React.PropTypes.oneOfType([
                React.PropTypes.string,
                React.PropTypes.number
            ]).isRequired,
            sessionLengthSSOInDays: React.PropTypes.oneOfType([
                React.PropTypes.string,
                React.PropTypes.number
            ]).isRequired,
            sessionCacheInMinutes: React.PropTypes.oneOfType([
                React.PropTypes.string,
                React.PropTypes.number
            ]).isRequired,
            onChange: React.PropTypes.func.isRequired
        };
    }

    render() {
        return (
            <SettingsGroup
                header={
                    <FormattedMessage
                        id='admin.security.session'
                        defaultMessage='Sessions'
                    />
                }
            >
                <TextSetting
                    id='sessionLengthWebInDays'
                    label={
                        <FormattedMessage
                            id='admin.service.webSessionDays'
                            defaultMessage='Session Length for Web in Days:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.service.sessionDaysEx', 'Ex "30"')}
                    helpText={
                        <FormattedMessage
                            id='admin.service.webSessionDaysDesc'
                            defaultMessage='The web session will expire after the number of days specified and will require a user to login again.'
                        />
                    }
                    value={this.props.sessionLengthWebInDays}
                    onChange={this.props.onChange}
                />
                <TextSetting
                    id='sessionLengthMobileInDays'
                    label={
                        <FormattedMessage
                            id='admin.service.mobileSessionDays'
                            defaultMessage='Session Length for Mobile Device in Days:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.service.sessionDaysEx', 'Ex "30"')}
                    helpText={
                        <FormattedMessage
                            id='admin.service.mobileSessionDaysDesc'
                            defaultMessage='The native mobile session will expire after the number of days specified and will require a user to login again.'
                        />
                    }
                    value={this.props.sessionLengthMobileInDays}
                    onChange={this.props.onChange}
                />
                <TextSetting
                    id='sessionLengthSSOInDays'
                    label={
                        <FormattedMessage
                            id='admin.service.ssoSessionDays'
                            defaultMessage='Session Length for SSO in Days:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.service.sessionDaysEx', 'Ex "30"')}
                    helpText={
                        <FormattedMessage
                            id='admin.service.ssoSessionDaysDesc'
                            defaultMessage='The SSO session will expire after the number of days specified and will require a user to login again.'
                        />
                    }
                    value={this.props.sessionLengthSSOInDays}
                    onChange={this.props.onChange}
                />
                <TextSetting
                    id='sessionCacheInMinutes'
                    label={
                        <FormattedMessage
                            id='admin.service.sessionCache'
                            defaultMessage='Session Cache in Minutes:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.service.sessionDaysEx', 'Ex "30"')}
                    helpText={
                        <FormattedMessage
                            id='admin.service.sessionCacheDesc'
                            defaultMessage='The number of minutes to cache a session in memory.'
                        />
                    }
                    value={this.props.sessionCacheInMinutes}
                    onChange={this.props.onChange}
                />
            </SettingsGroup>
        );
    }
}
