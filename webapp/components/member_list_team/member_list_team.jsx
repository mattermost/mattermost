// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import SearchableUserList from 'components/searchable_user_list/searchable_user_list_container.jsx';
import TeamMembersDropdown from 'components/team_members_dropdown';

import UserStore from 'stores/user_store.jsx';
import TeamStore from 'stores/team_store.jsx';

import {searchUsers, loadProfilesAndTeamMembers, loadTeamMembersForProfilesList} from 'actions/user_actions.jsx';

import Constants from 'utils/constants.jsx';

import * as UserAgent from 'utils/user_agent.jsx';

import PropTypes from 'prop-types';

import React from 'react';

import store from 'stores/redux_store.jsx';
import {searchProfilesInCurrentTeam} from 'mattermost-redux/selectors/entities/users';

const USERS_PER_PAGE = 50;

export default class MemberListTeam extends React.Component {
    static propTypes = {
        isAdmin: PropTypes.bool,
        actions: PropTypes.shape({
            getTeamStats: PropTypes.func.isRequired
        }).isRequired
    }

    constructor(props) {
        super(props);

        this.onChange = this.onChange.bind(this);
        this.onStatsChange = this.onStatsChange.bind(this);
        this.search = this.search.bind(this);
        this.loadComplete = this.loadComplete.bind(this);

        this.searchTimeoutId = 0;
        this.term = '';

        const stats = TeamStore.getCurrentStats();

        this.state = {
            users: UserStore.getProfileListInTeam(),
            teamMembers: Object.assign([], TeamStore.getMembersInTeam()),
            total: stats.active_member_count,
            loading: true
        };
    }

    componentDidMount() {
        UserStore.addInTeamChangeListener(this.onChange);
        UserStore.addStatusesChangeListener(this.onChange);
        TeamStore.addChangeListener(this.onChange);
        TeamStore.addStatsChangeListener(this.onStatsChange);

        loadProfilesAndTeamMembers(0, Constants.PROFILE_CHUNK_SIZE, TeamStore.getCurrentId(), this.loadComplete);
        this.props.actions.getTeamStats(TeamStore.getCurrentId());
    }

    componentWillUnmount() {
        UserStore.removeInTeamChangeListener(this.onChange);
        UserStore.removeStatusesChangeListener(this.onChange);
        TeamStore.removeChangeListener(this.onChange);
        TeamStore.removeStatsChangeListener(this.onStatsChange);
    }

    loadComplete() {
        this.setState({loading: false});
    }

    onChange() {
        let users;
        if (this.term) {
            users = searchProfilesInCurrentTeam(store.getState(), this.term);
        } else {
            users = UserStore.getProfileListInTeam();
        }

        this.setState({users, teamMembers: Object.assign([], TeamStore.getMembersInTeam())});
    }

    onStatsChange() {
        const stats = TeamStore.getCurrentStats();
        this.setState({total: stats.active_member_count});
    }

    nextPage(page) {
        loadProfilesAndTeamMembers(page, USERS_PER_PAGE);
    }

    search(term) {
        clearTimeout(this.searchTimeoutId);
        this.term = term;

        if (term === '') {
            this.setState({loading: false});
            this.searchTimeoutId = '';
            this.onChange();
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
                        this.setState({loading: true});
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

                if (teamMembers[user.id] && user.delete_at === 0) {
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
