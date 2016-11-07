// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import IntegrationStore from 'stores/integration_store.jsx';
import TeamStore from 'stores/team_store.jsx';
import UserStore from 'stores/user_store.jsx';

import {loadTeamCommands} from 'actions/integration_actions.jsx';

import React from 'react';

export default class CommandsContainer extends React.Component {
    static get propTypes() {
        return {
            team: React.propTypes.object.isRequired,
            children: React.propTypes.node.isRequired
        };
    }

    constructor(props) {
        super(props);

        this.handleIntegrationChange = this.handleIntegrationChange.bind(this);
        this.handleUserChange = this.handleUserChange.bind(this);

        const teamId = TeamStore.getCurrentId();

        this.state = {
            commands: IntegrationStore.getCommands(teamId),
            loading: !IntegrationStore.hasReceivedCommands(teamId),
            users: UserStore.getProfiles()
        };
    }

    componentDidMount() {
        IntegrationStore.addChangeListener(this.handleIntegrationChange);
        UserStore.addChangeListener(this.handleUserChange);

        if (window.mm_config.EnableCommands === 'true') {
            loadTeamCommands();
        }
    }

    componentWillUnmount() {
        IntegrationStore.removeChangeListener(this.handleIntegrationChange);
        UserStore.removeChangeListener(this.handleUserChange);
    }

    handleIntegrationChange() {
        const teamId = TeamStore.getCurrentId();

        this.setState({
            commands: IntegrationStore.getCommands(teamId),
            loading: !IntegrationStore.hasReceivedCommands(teamId)
        });
    }

    handleUserChange() {
        this.setState({users: UserStore.getProfiles()});
    }

    render() {
        return (
            <div>
                {React.cloneElement(this.props.children, {
                    commands: this.state.commands,
                    users: this.state.users,
                    loading: this.state.loading,
                    team: this.props.team
                })}
            </div>
        );
    }
}
