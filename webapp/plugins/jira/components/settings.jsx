// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import crypto from 'crypto';

import Suggestion from 'components/suggestion/suggestion.jsx';
import Provider from 'components/suggestion/provider.jsx';
import SuggestionBox from 'components/suggestion/suggestion_box.jsx';
import SuggestionList from 'components/suggestion/suggestion_list.jsx';
import {autocompleteUsersInTeam} from 'actions/user_actions.jsx';

import AppDispatcher from 'dispatcher/app_dispatcher.jsx';
import {Client4} from 'mattermost-redux/client';
import {ActionTypes} from 'utils/constants.jsx';
import * as Utils from 'utils/utils.jsx';

import AdminSettings from 'components/admin_console/admin_settings.jsx';
import {FormattedMessage} from 'react-intl';
import SettingsGroup from 'components/admin_console/settings_group.jsx';
import BooleanSetting from 'components/admin_console/boolean_setting.jsx';
import GeneratedSetting from 'components/admin_console/generated_setting.jsx';
import Setting from 'components/admin_console/setting.jsx';

import './style.scss';

class UserSuggestion extends Suggestion {
    render() {
        const {item, isSelection} = this.props;

        let className = 'suggestion-list__item mentions__name';
        if (isSelection) {
            className += ' suggestion--selected';
        }

        const username = item.username;
        let description = '';

        if ((item.first_name || item.last_name) && item.nickname) {
            description = `- ${Utils.getFullName(item)} (${item.nickname})`;
        } else if (item.nickname) {
            description = `- (${item.nickname})`;
        } else if (item.first_name || item.last_name) {
            description = `- ${Utils.getFullName(item)}`;
        }

        return (
            <div
                className={className}
                onClick={this.handleClick}
            >
                <div className='pull-left'>
                    <img
                        className='jirabot__image'
                        src={Client4.getUsersRoute() + '/' + item.id + '/image?_=' + (item.last_picture_update || 0)}
                    />
                </div>
                <div className='pull-left jirabot--align'>
                    <span>
                        {'@' + username}
                    </span>
                    <span className='jirabot__fullname'>
                        {' '}
                        {description}
                    </span>
                </div>
            </div>
        );
    }
}

class UserProvider extends Provider {
    handlePretextChanged(suggestionId, pretext) {
        const normalizedPretext = pretext.toLowerCase();
        this.startNewRequest(suggestionId, normalizedPretext);

        autocompleteUsersInTeam(
            normalizedPretext,
            (data) => {
                if (this.shouldCancelDispatch(normalizedPretext)) {
                    return;
                }

                const users = Object.assign([], data.users);

                AppDispatcher.handleServerAction({
                    type: ActionTypes.SUGGESTION_RECEIVED_SUGGESTIONS,
                    id: suggestionId,
                    matchedPretext: normalizedPretext,
                    terms: users.map((user) => user.username),
                    items: users,
                    component: UserSuggestion
                });
            }
        );

        return true;
    }
}

export default class JIRASettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);
        this.renderSettings = this.renderSettings.bind(this);
        this.handleSecretChange = this.handleSecretChange.bind(this);
        this.handleEnabledChange = this.handleEnabledChange.bind(this);
        this.handleUserSelected = this.handleUserSelected.bind(this);

        this.userSuggestionProviders = [new UserProvider()];
    }

    getConfigFromState(config) {
        config.PluginSettings.Plugins = {
            jira: {
                Enabled: this.state.enabled,
                Secret: this.state.secret,
                UserName: this.state.userName
            }
        };

        return config;
    }

    getStateFromConfig(config) {
        const settings = config.PluginSettings;

        const ret = {
            enabled: false,
            secret: '',
            userName: '',
            siteURL: config.ServiceSettings.SiteURL
        };

        if (typeof settings.Plugins !== 'undefined' && typeof settings.Plugins.jira !== 'undefined') {
            ret.enabled = settings.Plugins.jira.Enabled || settings.Plugins.jira.enabled || false;
            ret.secret = settings.Plugins.jira.Secret || settings.Plugins.jira.secret || '';
            ret.userName = settings.Plugins.jira.UserName || settings.Plugins.jira.username || '';
        }

        return ret;
    }

    handleSecretChange(id, secret) {
        this.handleChange(id, secret.replace('+', '-').replace('/', '_'));
    }

    handleEnabledChange(enabled) {
        if (enabled && this.state.secret === '') {
            this.handleSecretChange('secret', crypto.randomBytes(256).toString('base64').substring(0, 32));
        }
        this.handleChange('enabled', enabled);
    }

    handleUserSelected(user) {
        this.handleChange('userName', user.username);
    }

    renderTitle() {
        return Utils.localizeMessage('admin.plugins.jira', 'JIRA (Beta)');
    }

    renderSettings() {
        var webhookDocsLink = (
            <a
                href='https://about.mattermost.com/default-jira-plugin'
                target='_blank'
                rel='noopener noreferrer'
            >
                <FormattedMessage
                    id='admin.plugins.jira.webhookDocsLink'
                    defaultMessage='documentation'
                />
            </a>
        );

        return (
            <SettingsGroup>
                <BooleanSetting
                    id='enabled'
                    label={Utils.localizeMessage('admin.plugins.jira.enabledLabel', 'Enabled:')}
                    helpText={Utils.localizeMessage('admin.plugins.jira.enabledDescription', 'When true, you can configure JIRA webhooks to post message in Mattermost. To help combat phishing attacks, all posts are labelled by a BOT tag.')}
                    value={this.state.enabled}
                    onChange={(id, value) => this.handleEnabledChange(value)}
                />
                <Setting
                    label={Utils.localizeMessage('admin.plugins.jira.userLabel', 'User:')}
                    helpText={Utils.localizeMessage('admin.plugins.jira.userDescription', 'Select the username that this integration is attached to.')}
                    inputId='userName'
                >
                    <div
                        className='jirabots__dropdown'
                    >
                        <SuggestionBox
                            id='userName'
                            className='form-control'
                            placeholder={Utils.localizeMessage('search_bar.search', 'Search')}
                            value={this.state.userName}
                            onChange={(e) => this.handleChange('userName', e.target.value)}
                            onItemSelected={this.handleUserSelected}
                            listComponent={SuggestionList}
                            listStyle='bottom'
                            providers={this.userSuggestionProviders}
                            disabled={!this.state.enabled}
                            type='input'
                            requiredCharacters={0}
                            openOnFocus={true}
                        />
                    </div>
                </Setting>
                <GeneratedSetting
                    id='secret'
                    label={Utils.localizeMessage('admin.plugins.jira.secretLabel', 'Secret:')}
                    helpText={Utils.localizeMessage('admin.plugins.jira.secretDescription', 'This secret is used to authenticate to Mattermost.')}
                    regenerateHelpText={Utils.localizeMessage('admin.plugins.jira.secretRegenerateDescription', 'Regenerates the secret for the webhook URL endpoint. Regenerating the secret invalidates your existing JIRA integrations.')}
                    value={this.state.secret}
                    onChange={this.handleSecretChange}
                    disabled={!this.state.enabled}
                />
                <div className='banner banner--url'>
                    <div className='banner__content'>
                        <p>
                            <FormattedMessage
                                id='admin.plugins.jira.setupDescription'
                                defaultMessage='Use this webhook URL to set up the JIRA integration. See {webhookDocsLink} to learn more.'
                                values={{
                                    webhookDocsLink
                                }}
                            />
                        </p>
                        <div className='banner__url'>
                            <span
                                dangerouslySetInnerHTML={{
                                    __html: encodeURI(this.state.siteURL) +
                                        '/plugins/jira/webhook?secret=' +
                                        (this.state.secret ? encodeURIComponent(this.state.secret) : ('<b>' + Utils.localizeMessage('admin.plugins.jira.secretParamPlaceholder', 'secret') + '</b>')) +
                                        '&team=<b>' +
                                        Utils.localizeMessage('admin.plugins.jira.teamParamPlaceholder', 'teamname') +
                                        '</b>&channel=<b>' +
                                        Utils.localizeMessage('admin.plugins.jira.channelParamNamePlaceholder', 'channelname') +
                                        '</b>'
                                }}
                            />
                        </div>
                    </div>
                </div>
            </SettingsGroup>
        );
    }
}
