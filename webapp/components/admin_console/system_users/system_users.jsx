// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {
    loadProfiles,
    loadProfilesAndTeamMembers,
    loadProfilesWithoutTeam,
    searchUsers
} from 'actions/user_actions.jsx';

import AdminStore from 'stores/admin_store.jsx';
import AnalyticsStore from 'stores/analytics_store.jsx';
import TeamStore from 'stores/team_store.jsx';
import UserStore from 'stores/user_store.jsx';

import {getStandardAnalytics, getTeamStats, getUser} from 'utils/async_client.jsx';
import {Constants, StatTypes, UserSearchOptions} from 'utils/constants.jsx';
import * as Utils from 'utils/utils.jsx';

import SystemUsersList from './system_users_list.jsx';

const ALL_USERS = '';
const NO_TEAM = 'no_team';

const USERS_PER_PAGE = 50;

/*
to do (without triggering eslint)
- dropdown
- manage teams
- move stats page
- add filter to stats page
- update sidebar
- remove anything only used by old pages
*/

export default class SystemUsers extends React.Component {
    constructor(props) {
        super(props);

        this.updateTeamsFromStore = this.updateTeamsFromStore.bind(this);
        this.updateTotalUsersFromStore = this.updateTotalUsersFromStore.bind(this);
        this.updateUsersFromStore = this.updateUsersFromStore.bind(this);

        this.loadDataForTeam = this.loadDataForTeam.bind(this);
        this.loadComplete = this.loadComplete.bind(this);

        this.handleTeamChange = this.handleTeamChange.bind(this);
        this.handleTermChange = this.handleTermChange.bind(this);
        this.nextPage = this.nextPage.bind(this);

        this.doSearch = this.doSearch.bind(this);
        this.search = this.search.bind(this);
        this.getUserById = this.getUserById.bind(this);

        this.renderFilterRow = this.renderFilterRow.bind(this);

        this.state = {
            teams: AdminStore.getAllTeams(),
            totalUsers: AnalyticsStore.getAllSystem()[StatTypes.TOTAL_USERS],
            users: UserStore.getProfileList(),

            teamId: ALL_USERS,
            term: '',
            loading: true,
            searching: false
        };
    }

    componentDidMount() {
        AdminStore.addAllTeamsChangeListener(this.updateTeamsFromStore);

        AnalyticsStore.addChangeListener(this.updateTotalUsersFromStore);
        TeamStore.addStatsChangeListener(this.updateTotalUsersFromStore);

        UserStore.addChangeListener(this.updateUsersFromStore);
        UserStore.addInTeamChangeListener(this.updateUsersFromStore);
        UserStore.addWithoutTeamChangeListener(this.updateUsersFromStore);

        this.loadDataForTeam(this.state.teamId);
    }

    componentWillUpdate(nextProps, nextState) {
        const nextTeamId = nextState.teamId;

        if (this.state.teamId !== nextTeamId) {
            this.updateTotalUsersFromStore(nextTeamId);
            this.updateUsersFromStore(nextTeamId, nextState.term);

            this.loadDataForTeam(nextTeamId);
        }
    }

    componentWillUnmount() {
        AdminStore.removeAllTeamsChangeListener(this.updateTeamsFromStore);

        AnalyticsStore.removeChangeListener(this.updateTotalUsersFromStore);
        TeamStore.removeStatsChangeListener(this.updateTotalUsersFromStore);

        UserStore.removeChangeListener(this.updateUsersFromStore);
        UserStore.removeInTeamChangeListener(this.updateUsersFromStore);
        UserStore.removeWithoutTeamChangeListener(this.updateUsersFromStore);
    }

    updateTeamsFromStore() {
        this.setState({teams: AdminStore.getAllTeams()});
    }

    updateTotalUsersFromStore(teamId = this.state.teamId) {
        if (teamId === ALL_USERS) {
            this.setState({
                totalUsers: AnalyticsStore.getAllSystem()[StatTypes.TOTAL_USERS]
            });
        } else if (teamId === NO_TEAM) {
            this.setState({
                totalUsers: 0
            });
        } else {
            this.setState({
                totalUsers: TeamStore.getStats(teamId).total_member_count
            });
        }
    }

    updateUsersFromStore(teamId = this.state.teamId, term = this.state.term) {
        if (term) {
            if (teamId !== this.state.teamId) {
                this.doSearch(teamId, term, true);
            }

            return;
        }

        if (teamId === ALL_USERS) {
            this.setState({users: UserStore.getProfileList(false, true)});
        } else if (teamId === NO_TEAM) {
            this.setState({users: UserStore.getProfileListWithoutTeam()});
        } else {
            this.setState({users: UserStore.getProfileListInTeam(this.state.teamId)});
        }
    }

    loadDataForTeam(teamId) {
        if (teamId === ALL_USERS) {
            loadProfiles(0, Constants.PROFILE_CHUNK_SIZE, this.loadComplete);
            getStandardAnalytics();
        } else if (teamId === NO_TEAM) {
            loadProfilesWithoutTeam(0, Constants.PROFILE_CHUNK_SIZE, this.loadComplete);
        } else {
            loadProfilesAndTeamMembers(0, Constants.PROFILE_CHUNK_SIZE, teamId, this.loadComplete);
            getTeamStats(teamId);
        }
    }

    loadComplete() {
        this.setState({loading: false});
    }

    handleTeamChange(e) {
        this.setState({teamId: e.target.value});
    }

    handleTermChange(term) {
        this.setState({term});
    }

    nextPage(page) {
        // Paging isn't supported while searching

        if (this.state.teamId === ALL_USERS) {
            loadProfiles((page + 1) * USERS_PER_PAGE, USERS_PER_PAGE, this.loadComplete);
        } else if (this.state.teamId === NO_TEAM) {
            loadProfilesWithoutTeam(page + 1, USERS_PER_PAGE, this.loadComplete);
        } else {
            loadProfilesAndTeamMembers((page + 1) * USERS_PER_PAGE, USERS_PER_PAGE, this.state.teamId, this.loadComplete);
        }
    }

    search(term) {
        if (term === '') {
            this.updateUsersFromStore(this.state.teamId, term);

            this.setState({
                loading: false
            });

            this.searchTimeoutId = '';
            return;
        }

        this.doSearch(this.state.teamId, term);
    }

    doSearch(teamId, term, now = false) {
        clearTimeout(this.searchTimeoutId);

        this.setState({
            loading: true,
            users: []
        });

        const options = {
            [UserSearchOptions.ALLOW_INACTIVE]: true
        };
        if (teamId === NO_TEAM) {
            options[UserSearchOptions.WITHOUT_TEAM] = true;
        }

        const searchTimeoutId = setTimeout(
            () => {
                searchUsers(
                    term,
                    teamId,
                    options,
                    (users) => {
                        if (searchTimeoutId !== this.searchTimeoutId) {
                            return;
                        }

                        if (users.length > 0) {
                            this.setState({
                                loading: false,
                                users
                            });
                        } else {
                            this.getUserById(term, searchTimeoutId);
                        }
                    }
                );
            },
            now ? 0 : Constants.SEARCH_TIMEOUT_MILLISECONDS
        );

        this.searchTimeoutId = searchTimeoutId;
    }

    getUserById(id, searchTimeoutId) {
        if (UserStore.hasProfile(id)) {
            this.setState({
                loading: false,
                users: [UserStore.getProfile(id)]
            });

            return;
        }

        getUser(
            id,
            (user) => {
                if (searchTimeoutId !== this.searchTimeoutId) {
                    return;
                }

                this.setState({
                    loading: false,
                    users: [user]
                });
            },
            () => {
                if (searchTimeoutId !== this.searchTimeoutId) {
                    return;
                }

                this.setState({
                    loading: false,
                    users: []
                });
            }
        );
    }

    renderFilterRow(doSearch) {
        let teams = [];

        Reflect.ownKeys(this.state.teams).forEach((key) => {
            teams.push(this.state.teams[key]);
        });

        teams = teams.sort(Utils.sortTeamsByDisplayName);

        const teamOptions = teams.map((team) => {
            return (
                <option
                    key={team.id}
                    value={team.id}
                >
                    {team.display_name}
                </option>
            );
        });

        return (
            <div className='system-users-filter'>
                <div className='col-md-8'>
                    <input
                        ref='filter'
                        className='form-control filter-textbox'
                        placeholder={Utils.localizeMessage('filtered_user_list.search', 'Search users')}
                        onInput={doSearch}
                    />
                </div>
                <label className='col-md-4'>
                    <span className='system-users-filter__label'>{'Filter:'}</span>
                    <select
                        className='form-control system-users-filter__dropdown'
                        onChange={this.handleTeamChange}
                    >
                        <option value={ALL_USERS}>{Utils.localizeMessage('admin.system_users.allUsers', 'All Users')}</option>
                        <option value={NO_TEAM}>{Utils.localizeMessage('admin.system_users.noTeams', 'No Teams')}</option>
                        {teamOptions}
                    </select>
                </label>
            </div>
        );
    }

    render() {
        let users = null;
        if (!this.state.loading) {
            users = this.state.users;
        }

        return (
            <div className='wrapper--fixed'>
                <h3>
                    <FormattedMessage
                        id='admin.system_users.title'
                        defaultMessage='{siteName} Users'
                        values={{
                            siteName: global.mm_config.SiteName
                        }}
                    />
                </h3>
                <div className='more-modal__list member-list-holder'>
                    <SystemUsersList
                        renderFilterRow={this.renderFilterRow}
                        search={this.search}
                        nextPage={this.nextPage}
                        users={users}
                        usersPerPage={USERS_PER_PAGE}
                        total={this.state.totalUsers}
                        teamId={this.state.teamId}
                        term={this.state.term}
                        onTermChange={this.handleTermChange}
                    />
                </div>
            </div>
        );
    }
}
