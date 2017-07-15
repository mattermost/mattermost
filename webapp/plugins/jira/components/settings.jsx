// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import AdminSettings from '../../../components/admin_console/admin_settings.jsx';
import {FormattedMessage} from 'react-intl';
import SettingsGroup from '../../../components/admin_console/settings_group.jsx';
import TextSetting from '../../../components/admin_console/text_setting.jsx';
import GeneratedSetting from '../../../components/admin_console/generated_setting.jsx';

export default class JIRASettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);
        this.renderSettings = this.renderSettings.bind(this);
    }

    getConfigFromState(config) {
        config.PluginSettings.Plugins = {
            jira: {
                Secret: this.state.jiraSecret,
                UserId: this.state.jiraUserId
            }
        };

        return config;
    }

    getStateFromConfig(config) {
        const settings = config.PluginSettings;

        const ret = {
            jiraSecret: '',
            jiraUserId: '',
            siteURL: config.ServiceSettings.SiteURL
        };

        if (typeof settings.Plugins !== 'undefined' && typeof settings.Plugins.jira !== 'undefined') {
            ret.jiraSecret = settings.Plugins.jira.Secret || settings.Plugins.jira.secret || '';
            ret.jiraUserId = settings.Plugins.jira.UserId || settings.Plugins.jira.userid || '';
        }

        return ret;
    }

    renderTitle() {
        return (
            <FormattedMessage
                id='admin.plugins.jira'
                defaultMessage='JIRA'
            />
        );
    }

    renderSettings() {
        return (
            <SettingsGroup>
                <GeneratedSetting
                    id='jiraSecret'
                    label={
                        <FormattedMessage
                            id='admin.plugins.jira.secretLabel'
                            defaultMessage='Secret:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.plugins.jira.secretDescription'
                            defaultMessage='This secret is used to authenticate JIRA. Changing it will invalidate your existing JIRA integrations.'
                        />
                    }
                    value={this.state.jiraSecret}
                    onChange={this.handleChange}
                />
                <TextSetting
                    id='jiraUserId'
                    label={
                        <FormattedMessage
                            id='admin.plugins.jira.userIdLabel'
                            defaultMessage='User Id:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.plugins.jira.userIdDescription'
                            defaultMessage='This is the id of the user that will post messages in response to JIRA events.'
                        />
                    }
                    value={this.state.jiraUserId}
                    onChange={this.handleChange}
                />
                <div className='banner'>
                    <div className='banner__content'>
                        <p>
                            <FormattedMessage
                                id='admin.plugins.jira.setupDescription'
                                defaultMessage='Once a secret and user id are configured, you can complete your JIRA integration by adding issue-created/updated/deleted webhooks of this form to your projects in JIRA:'
                            />
                        </p>
                        <p>
                            <code dangerouslySetInnerHTML={{__html: encodeURI(this.state.siteURL) + '/plugins/jira/webhook?secret=' + encodeURIComponent(this.state.jiraSecret) + '&team=<b>[some team id]</b>&channel=<b>[some channel name or id]</b>'}}/>
                        </p>
                    </div>
                </div>
            </SettingsGroup>
        );
    }
}

