// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import TeamStore from 'stores/team_store.jsx';
import InviteMembersIndexView from 'components/invite_members/invite_members_index_view.jsx';

export default class InviteMembersIndexContainer extends React.Component {
    static get propTypes() {
        return {
            params: React.PropTypes.object.isRequired
        };
    }

    constructor(props) {
        super(props);

        this.onTeamChange = this.onTeamChange.bind(this);

        this.state = {
            teamName: TeamStore.getCurrent().display_name
        };
    }

    componentDidMount() {
        TeamStore.addChangeListener(this.onTeamChange);
    }

    componentWillUnmount() {
        TeamStore.removeChangeListener(this.onTeamChange);
    }

    onTeamChange() {
        const currentTeam = TeamStore.getCurrent();
        this.setState({
            teamDisplayName: currentTeam.display_name,
            teamName: currentTeam.name
        });
    }

    render() {
        return (
            <InviteMembersIndexView
                teamDisplayName={this.state.teamDisplayName}
                teamName={this.state.teamName}
            />
        );
    }
}
