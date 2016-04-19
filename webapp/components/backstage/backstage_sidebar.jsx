// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as Utils from 'utils/utils.jsx';
import BackstageCategory from './backstage_category.jsx';
import BackstageSection from './backstage_section.jsx';
import {FormattedMessage} from 'react-intl';

export default class BackstageSidebar extends React.Component {
    render() {
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
                        <BackstageSection
                            name='incoming_webhooks'
                            title={(
                                <FormattedMessage
                                    id='backstage_sidebar.integrations.incoming_webhooks'
                                    defaultMessage='Incoming Webhooks'
                                />
                            )}
                        />
                        <BackstageSection
                            name='outgoing_webhooks'
                            title={(
                                <FormattedMessage
                                    id='backstage_sidebar.integrations.outgoing_webhooks'
                                    defaultMessage='Outgoing Webhooks'
                                />
                            )}
                        />
                        <BackstageSection
                            name='commands'
                            title={(
                                <FormattedMessage
                                    id='backstage_sidebar.integrations.commands'
                                    defaultMessage='Slash Commands'
                                />
                            )}
                        />
                    </BackstageCategory>
                </ul>
            </div>
        );
    }
}
