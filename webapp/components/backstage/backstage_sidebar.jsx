// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import BackstageCategory from './backstage_category.jsx';
import BackstageSection from './backstage_section.jsx';
import {FormattedMessage} from 'react-intl';

export default class BackstageSidebar extends React.Component {
    render() {
        return (
            <div className='backstage__sidebar'>
                <ul>
                    <BackstageCategory
                        name='integrations'
                        parentLink={'/settings'}
                        icon='fa-link'
                        title={
                            <FormattedMessage
                                id='backstage_sidebar.integrations'
                                defaultMessage='Integrations'
                            />
                        }
                    >
                        <BackstageSection
                            name='installed'
                            title={(
                                <FormattedMessage
                                    id='backstage_sidebar.integrations.installed'
                                    defaultMessage='Installed Integrations'
                                />
                            )}
                        />
                        <BackstageSection
                            name='add'
                            title={(
                                <FormattedMessage
                                    id='backstage_sidebar.integrations.add'
                                    defaultMessage='Add Integration'
                                />
                            )}
                        >
                            <BackstageSection
                                name='incoming_webhook'
                                title={(
                                    <FormattedMessage
                                        id='backstage_sidebar.integrations.add.incomingWebhook'
                                        defaultMessage='Incoming Webhook'
                                    />
                                )}
                            />
                            <BackstageSection
                                name='outgoing_webhook'
                                title={(
                                    <FormattedMessage
                                        id='backstage_sidebar.integrations.add.outgoingWebhook'
                                        defaultMessage='Outgoing Webhook'
                                    />
                                )}
                            />
                        </BackstageSection>
                    </BackstageCategory>
                </ul>
            </div>
        );
    }
}
