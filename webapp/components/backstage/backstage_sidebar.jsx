// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import TeamStore from 'stores/team_store.jsx';

import BackstageCategory from './backstage_category.jsx';
import BackstageSection from './backstage_section.jsx';
import {FormattedMessage} from 'react-intl';

export default class BackstageSidebar extends React.Component {
    constructor(props) {
        super(props);

        this.handleChange = this.handleChange.bind(this);

        this.state = {
            team: TeamStore.getCurrent()
        };
    }

    componentDidMount() {
        TeamStore.addChangeListener(this.handleChange);
    }

    componentWillUnmount() {
        TeamStore.removeChangeListener(this.handleChange);
    }

    handleChange() {
        this.setState({
            team: TeamStore.getCurrent()
        });
    }

    render() {
        const team = TeamStore.getCurrent();

        if (!team) {
            return null;
        }

        return (
            <div className='backstage__sidebar'>
                <ul>
                    <BackstageCategory
                        name='integrations'
                        parentLink={`/${team.name}`}
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
                            collapsible={true}
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

