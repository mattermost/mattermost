// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import SearchableUserList from 'components/searchable_user_list/searchable_user_list_container.jsx';
import TeamMembersDropdown from 'components/team_members_dropdown.jsx';

import UserStore from 'stores/user_store.jsx';
import TeamStore from 'stores/team_store.jsx';

import {searchUsers, loadProfilesAndTeamMembers, loadTeamMembersForProfilesList} from 'actions/user_actions.jsx';
import {getTeamStats} from 'utils/async_client.jsx';

import Constants from 'utils/constants.jsx';

import * as UserAgent from 'utils/user_agent.jsx';

import React from 'react';

const USERS_PER_PAGE = 50;

export default class MemberListTeam extends React.Component {
    constructor(props) {
        super(props);

        this.onChange = this.onChange.bind(this);
        this.onTeamChange = this.onTeamChange.bind(this);
        this.onStatsChange = this.onStatsChange.bind(this);
        this.search = this.search.bind(this);
        this.loadComplete = this.loadComplete.bind(this);

        this.searchTimeoutId = 0;

        const stats = TeamStore.getCurrentStats();

        this.state = {
            users: UserStore.getProfileListInTeam(),
            teamMembers: Object.assign([], TeamStore.getMembersInTeam()),
            total: stats.total_member_count,
            search: false,
            term: '',
            loading: true
        };
    }

    componentDidMount() {
        UserStore.addInTeamChangeListener(this.onTeamChange);
        UserStore.addStatusesChangeListener(this.onChange);
        TeamStore.addChangeListener(this.onTeamChange);
        TeamStore.addStatsChangeListener(this.onStatsChange);

        loadProfilesAndTeamMembers(0, Constants.PROFILE_CHUNK_SIZE, TeamStore.getCurrentId(), this.loadComplete);
        getTeamStats(TeamStore.getCurrentId());
    }

    componentWillUnmount() {
        UserStore.removeInTeamChangeListener(this.onTeamChange);
        UserStore.removeStatusesChangeListener(this.onChange);
        TeamStore.removeChangeListener(this.onTeamChange);
        TeamStore.removeStatsChangeListener(this.onStatsChange);
    }

    loadComplete() {
        this.setState({loading: false});
    }

    onTeamChange() {
        this.onChange(true);
    }

    onChange(force) {
        if (this.state.search && !force) {
            return;
        } else if (this.state.search) {
            this.search(this.state.term);
            return;
        }

        this.setState({users: UserStore.getProfileListInTeam(), teamMembers: Object.assign([], TeamStore.getMembersInTeam())});
    }

    onStatsChange() {
        const stats = TeamStore.getCurrentStats();
        this.setState({total: stats.total_member_count});
    }

    nextPage(page) {
        loadProfilesAndTeamMembers((page + 1) * USERS_PER_PAGE, USERS_PER_PAGE);
    }

    search(term) {
        clearTimeout(this.searchTimeoutId);

        if (term === '') {
            this.setState({search: false, term, users: UserStore.getProfileListInTeam(), teamMembers: Object.assign([], TeamStore.getMembersInTeam())});
            this.searchTimeoutId = '';
            return;
        }

        const searchTimeoutId = setTimeout(
            () => {
                searchUsers(
                    term,
                    TeamStore.getCurrentId(),
                    {},
                    (users) => {
                        if (searchTimeoutId !== this.searchTimeoutId) {
                            return;
                        }
                        this.setState({loading: true, search: true, users, term, teamMembers: Object.assign([], TeamStore.getMembersInTeam())});
                        loadTeamMembersForProfilesList(users, TeamStore.getCurrentId(), this.loadComplete);
                    }
                );
            },
            Constants.SEARCH_TIMEOUT_MILLISECONDS
        );

        this.searchTimeoutId = searchTimeoutId;
    }

    render() {
        let teamMembersDropdown = null;
        if (this.props.isAdmin) {
            teamMembersDropdown = [TeamMembersDropdown];
        }

        const teamMembers = this.state.teamMembers;
        const users = this.state.users;
        const actionUserProps = {};

        let usersToDisplay;
        if (this.state.loading) {
            usersToDisplay = null;
        } else {
            usersToDisplay = [];

            for (let i = 0; i < users.length; i++) {
                const user = users[i];

                if (teamMembers[user.id]) {
                    usersToDisplay.push(user);
                    actionUserProps[user.id] = {
                        teamMember: teamMembers[user.id]
                    };
                }
            }
        }

        return (
            <SearchableUserList
                users={usersToDisplay}
                usersPerPage={USERS_PER_PAGE}
                total={this.state.total}
                nextPage={this.nextPage}
                search={this.search}
                actions={teamMembersDropdown}
                actionUserProps={actionUserProps}
                focusOnMount={!UserAgent.isMobile()}
            />
        );
    }
}

MemberListTeam.propTypes = {
    isAdmin: React.PropTypes.bool
};
