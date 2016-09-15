// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import SearchableUserList from './searchable_user_list.jsx';
import TeamMembersDropdown from './team_members_dropdown.jsx';

import UserStore from 'stores/user_store.jsx';
import TeamStore from 'stores/team_store.jsx';

import * as AsyncClient from 'utils/async_client.jsx';

import React from 'react';

export default class MemberListTeam extends React.Component {
    constructor(props) {
        super(props);

        this.onChange = this.onChange.bind(this);

        this.state = {
            users: UserStore.getProfilesForTeam(),
            teamMembers: Object.assign([], TeamStore.getMembersForTeam())
        };
    }

    componentDidMount() {
        UserStore.addChangeListener(this.onChange);
        TeamStore.addChangeListener(this.onChange);
        AsyncClient.getTeamMembers(TeamStore.getCurrentId());
    }

    componentWillUnmount() {
        UserStore.removeChangeListener(this.onChange);
        TeamStore.removeChangeListener(this.onChange);
    }

    onChange() {
        this.setState({
            users: UserStore.getProfilesForTeam(),
            teamMembers: Object.assign([], TeamStore.getMembersForTeam())
        });
    }

    render() {
        let teamMembersDropdown = null;
        if (this.props.isAdmin) {
            teamMembersDropdown = [TeamMembersDropdown];
        }

        const teamMembers = this.state.teamMembers;

        const actionUserProps = {};
        for (let i = 0; i < teamMembers.length; i++) {
            actionUserProps[teamMembers[i].user_id] = {
                teamMember: teamMembers[i]
            };
        }

        return (
            <SearchableUserList
                style={this.props.style}
                users={this.state.users}
                actions={teamMembersDropdown}
                actionUserProps={actionUserProps}
            />
        );
    }
}

MemberListTeam.propTypes = {
    style: React.PropTypes.object,
    isAdmin: React.PropTypes.bool
};
