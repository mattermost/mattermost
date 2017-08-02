// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import PropTypes from 'prop-types';
import {FormattedMessage} from 'react-intl';

import {
    loadProfiles,
    loadProfilesAndTeamMembers,
    loadProfilesWithoutTeam,
    searchUsers
} from 'actions/user_actions.jsx';

import AnalyticsStore from 'stores/analytics_store.jsx';
import TeamStore from 'stores/team_store.jsx';
import UserStore from 'stores/user_store.jsx';

import {reloadIfServerVersionChanged} from 'actions/global_actions.jsx';
import {getStandardAnalytics} from 'actions/admin_actions.jsx';
import {Constants, StatTypes, UserSearchOptions} from 'utils/constants.jsx';
import * as Utils from 'utils/utils.jsx';

import SystemUsersList from './system_users_list.jsx';

import store from 'stores/redux_store.jsx';
import {searchProfiles, searchProfilesInTeam} from 'mattermost-redux/selectors/entities/users';

const ALL_USERS = '';
const NO_TEAM = 'no_team';

const USER_ID_LENGTH = 26;
const USERS_PER_PAGE = 50;

export default class SystemUsers extends React.Component {
    static propTypes = {

        /*
         * Array of team objects
         */
        teams: PropTypes.arrayOf(PropTypes.object).isRequired,

        actions: PropTypes.shape({

            /*
             * Function to get teams
             */
            getTeams: PropTypes.func.isRequired,

            /*
             * Function to get statistics for a team
             */
            getTeamStats: PropTypes.func.isRequired,

            /*
             * Function to get a user
             */
            getUser: PropTypes.func.isRequired,

            /*
             * Function to get a user access token
             */
            getUserAccessToken: PropTypes.func.isRequired
        }).isRequired
    }

    constructor(props) {
        super(props);

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
            totalUsers: AnalyticsStore.getAllSystem()[StatTypes.TOTAL_USERS],
            users: UserStore.getProfileList(),

            teamId: ALL_USERS,
            term: '',
            loading: true,
            searching: false
        };
    }

    componentDidMount() {
        AnalyticsStore.addChangeListener(this.updateTotalUsersFromStore);
        TeamStore.addStatsChangeListener(this.updateTotalUsersFromStore);

        UserStore.addChangeListener(this.updateUsersFromStore);
        UserStore.addInTeamChangeListener(this.updateUsersFromStore);
        UserStore.addWithoutTeamChangeListener(this.updateUsersFromStore);

        this.loadDataForTeam(this.state.teamId);
        this.props.actions.getTeams(0, 1000).then(reloadIfServerVersionChanged);
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
        AnalyticsStore.removeChangeListener(this.updateTotalUsersFromStore);
        TeamStore.removeStatsChangeListener(this.updateTotalUsersFromStore);

        UserStore.removeChangeListener(this.updateUsersFromStore);
        UserStore.removeInTeamChangeListener(this.updateUsersFromStore);
        UserStore.removeWithoutTeamChangeListener(this.updateUsersFromStore);
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
            let users;
            if (teamId) {
                users = searchProfilesInTeam(store.getState(), teamId, term);
            } else {
                users = searchProfiles(store.getState(), term);
            }

            if (users.length === 0 && UserStore.hasProfile(term)) {
                users = [UserStore.getProfile(term)];
            }

            this.setState({users});
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
        if (this.state.term) {
            this.search(this.state.term, teamId);
            return;
        }

        if (teamId === ALL_USERS) {
            loadProfiles(0, Constants.PROFILE_CHUNK_SIZE, this.loadComplete);
            getStandardAnalytics();
        } else if (teamId === NO_TEAM) {
            loadProfilesWithoutTeam(0, Constants.PROFILE_CHUNK_SIZE, this.loadComplete);
        } else {
            loadProfilesAndTeamMembers(0, Constants.PROFILE_CHUNK_SIZE, teamId, this.loadComplete);
            this.props.actions.getTeamStats(teamId);
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
            loadProfiles(page, USERS_PER_PAGE, this.loadComplete);
        } else if (this.state.teamId === NO_TEAM) {
            loadProfilesWithoutTeam(page + 1, USERS_PER_PAGE, this.loadComplete);
        } else {
            loadProfilesAndTeamMembers(page + 1, USERS_PER_PAGE, this.state.teamId, this.loadComplete);
        }
    }

    search(term, teamId = this.state.teamId) {
        if (term === '') {
            this.updateUsersFromStore(teamId, term);

            this.setState({
                loading: false
            });

            this.searchTimeoutId = '';
            return;
        }

        this.doSearch(teamId, term);
    }

    doSearch(teamId, term, now = false) {
        clearTimeout(this.searchTimeoutId);
        this.term = term;

        this.setState({loading: true});

        const options = {
            [UserSearchOptions.ALLOW_INACTIVE]: true
        };
        if (teamId === NO_TEAM) {
            options[UserSearchOptions.WITHOUT_TEAM] = true;
        }

        this.searchTimeoutId = setTimeout(
            () => {
                searchUsers(
                    term,
                    teamId,
                    options,
                    (users) => {
                        if (users.length === 0 && term.length === USER_ID_LENGTH) {
                            // This term didn't match any users name, but it does look like it might be a user's ID
                            this.getUserByTokenOrId(term);
                        } else {
                            this.setState({loading: false});
                        }
                    },
                    () => {
                        this.setState({loading: false});
                    }
                );
            },
            now ? 0 : Constants.SEARCH_TIMEOUT_MILLISECONDS
        );
    }

    getUserById(id) {
        if (UserStore.hasProfile(id)) {
            this.setState({loading: false});
            return;
        }

        this.props.actions.getUser(id).then(
            () => {
                this.setState({
                    loading: false
                });
            }
        );
    }

    getUserByTokenOrId = async (id) => {
        if (global.window.mm_config.EnableUserAccessTokens === 'true') {
            const {data} = await this.props.actions.getUserAccessToken(id);

            if (data) {
                this.term = data.user_id;
                this.setState({term: data.user_id});
                this.updateUsersFromStore(this.state.teamId, data.user_id);
                this.getUserById(data.user_id);
                return;
            }
        }

        this.getUserById(id);
    }

    renderFilterRow(doSearch) {
        const teams = this.props.teams.map((team) => {
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
            <div className='system-users__filter-row'>
                <div className='system-users__filter'>
                    <input
                        id='searchUsers'
                        ref='filter'
                        className='form-control filter-textbox'
                        placeholder={Utils.localizeMessage('filtered_user_list.search', 'Search users')}
                        onInput={doSearch}
                    />
                </div>
                <label>
                    <span className='system-users__team-filter-label'>
                        <FormattedMessage
                            id='filtered_user_list.show'
                            defaultMessage='Filter:'
                        />
                    </span>
                    <select
                        className='form-control system-users__team-filter'
                        onChange={this.handleTeamChange}
                        value={this.state.teamId}
                    >
                        <option value={ALL_USERS}>{Utils.localizeMessage('admin.system_users.allUsers', 'All Users')}</option>
                        <option value={NO_TEAM}>{Utils.localizeMessage('admin.system_users.noTeams', 'No Teams')}</option>
                        {teams}
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
                <h3 className='admin-console-header'>
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
                        teams={this.props.teams}
                        teamId={this.state.teamId}
                        term={this.state.term}
                        onTermChange={this.handleTermChange}
                    />
                </div>
            </div>
        );
    }
}
