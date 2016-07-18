// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import FilteredUserList from './filtered_user_list.jsx';
import TeamMembersDropdown from './team_members_dropdown.jsx';
import UserStore from 'stores/user_store.jsx';
import TeamStore from 'stores/team_store.jsx';
import * as AsyncClient from 'utils/async_client.jsx';

import React from 'react';

export default class MemberListTeam extends React.Component {
    constructor(props) {
        super(props);

        this.getUsers = this.getUsers.bind(this);
        this.onChange = this.onChange.bind(this);
        this.onTeamChange = this.onTeamChange.bind(this);

        this.state = {
            users: this.getUsers(),
            teamMembers: TeamStore.getMembersForTeam()
        };
    }

    componentDidMount() {
        UserStore.addChangeListener(this.onChange);
        TeamStore.addChangeListener(this.onTeamChange);
        AsyncClient.getTeamMembers(TeamStore.getCurrentId());
    }

    componentWillUnmount() {
        UserStore.removeChangeListener(this.onChange);
        TeamStore.removeChangeListener(this.onTeamChange);
    }

    getUsers() {
        const profiles = UserStore.getProfiles();
        const users = [];

        for (const id of Object.keys(profiles)) {
            users.push(profiles[id]);
        }

        users.sort((a, b) => a.username.localeCompare(b.username));

        return users;
    }

    onChange() {
        this.setState({
            users: this.getUsers()
        });
    }

    onTeamChange() {
        this.setState({
            teamMembers: TeamStore.getMembersForTeam()
        });
    }

    render() {
        let teamMembersDropdown = null;
        if (this.props.isAdmin) {
            teamMembersDropdown = [TeamMembersDropdown];
        }

        return (
            <FilteredUserList
                style={this.props.style}
                users={this.state.users}
                teamMembers={this.state.teamMembers}
                actions={teamMembersDropdown}
            />
        );
    }
}

MemberListTeam.propTypes = {
    style: React.PropTypes.object,
    isAdmin: React.PropTypes.bool
};
