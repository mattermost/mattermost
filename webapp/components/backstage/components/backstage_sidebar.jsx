// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import TeamStore from 'stores/team_store.jsx';
import * as Utils from 'utils/utils.jsx';

import BackstageCategory from './backstage_category.jsx';
import BackstageSection from './backstage_section.jsx';
import {FormattedMessage} from 'react-intl';

export default class BackstageSidebar extends React.Component {
    static get propTypes() {
        return {
            team: React.PropTypes.object.isRequired,
            user: React.PropTypes.object.isRequired
        };
    }

    renderCustomEmoji() {
        if (window.mm_config.EnableCustomEmoji !== 'true' || !Utils.canCreateCustomEmoji(this.props.user)) {
            return null;
        }

        return (
            <BackstageCategory
                name='emoji'
                parentLink={'/' + this.props.team.name}
                icon='fa-smile-o'
                title={
                    <FormattedMessage
                        id='backstage_sidebar.emoji'
                        defaultMessage='Custom Emoji'
                    />
                }
            />
        );
    }

    renderIntegrations() {
        const config = window.mm_config;
        if (config.EnableIncomingWebhooks !== 'true' &&
            config.EnableOutgoingWebhooks !== 'true' &&
            config.EnableCommands !== 'true' &&
            config.EnableOAuthServiceProvider !== 'true') {
            return null;
        }

        if (config.EnableOnlyAdminIntegrations !== 'false' &&
            !Utils.isSystemAdmin(this.props.user.roles) &&
            !TeamStore.isTeamAdmin(this.props.user.id, this.props.team.id)) {
            return null;
        }

        let incomingWebhooks = null;
        if (config.EnableIncomingWebhooks === 'true') {
            incomingWebhooks = (
                <BackstageSection
                    name='incoming_webhooks'
                    title={(
                        <FormattedMessage
                            id='backstage_sidebar.integrations.incoming_webhooks'
                            defaultMessage='Incoming Webhooks'
                        />
                    )}
                />
            );
        }

        let outgoingWebhooks = null;
        if (config.EnableOutgoingWebhooks === 'true') {
            outgoingWebhooks = (
                <BackstageSection
                    name='outgoing_webhooks'
                    title={(
                        <FormattedMessage
                            id='backstage_sidebar.integrations.outgoing_webhooks'
                            defaultMessage='Outgoing Webhooks'
                        />
                    )}
                />
            );
        }

        let commands = null;
        if (config.EnableCommands === 'true') {
            commands = (
                <BackstageSection
                    name='commands'
                    title={(
                        <FormattedMessage
                            id='backstage_sidebar.integrations.commands'
                            defaultMessage='Slash Commands'
                        />
                    )}
                />
            );
        }

        let oauthApps = null;
        if (config.EnableOAuthServiceProvider === 'true') {
            oauthApps = (
                <BackstageSection
                    name='oauth2-apps'
                    title={
                        <FormattedMessage
                            id='backstage_sidebar.integrations.oauthApps'
                            defaultMessage='OAuth2 Apps'
                        />
                    }
                />
            );
        }

        return (
            <BackstageCategory
                name='integrations'
                parentLink={'/' + this.props.team.name}
                icon='fa-link'
                title={
                    <FormattedMessage
                        id='backstage_sidebar.integrations'
                        defaultMessage='Integrations'
                    />
                }
            >
                {incomingWebhooks}
                {outgoingWebhooks}
                {commands}
                {oauthApps}
            </BackstageCategory>
        );
    }

    render() {
        return (
            <div className='backstage-sidebar'>
                <ul>
                    {this.renderCustomEmoji()}
                    {this.renderIntegrations()}
                </ul>
            </div>
        );
    }
}
