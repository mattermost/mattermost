// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as Utils from 'utils/utils.jsx';
import BackstageCategory from './backstage_category.jsx';
import BackstageSection from './backstage_section.jsx';
import {FormattedMessage} from 'react-intl';

export default class BackstageSidebar extends React.Component {
    render() {
        let incomingWebhooks = null;
        if (window.mm_config.EnableIncomingWebhooks === 'true') {
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
        if (window.mm_config.EnableOutgoingWebhooks === 'true') {
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
        if (window.mm_config.EnableCommands === 'true') {
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
        if (window.mm_config.EnableOAuthServiceProvider === 'true') {
            oauthApps = (
                <BackstageSection
                    name='oauth-apps'
                    title={
                        <FormattedMessage
                            id='backstage_sidebar.integrations.oauthApps'
                            defaultMessage='OAuth Apps'
                        />
                    }
                />
            );
        }

        return (
            <div className='backstage-sidebar'>
                <ul>
                    <BackstageCategory
                        name='integrations'
                        parentLink={'/' + Utils.getTeamNameFromUrl() + '/settings'}
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
                </ul>
            </div>
        );
    }
}
