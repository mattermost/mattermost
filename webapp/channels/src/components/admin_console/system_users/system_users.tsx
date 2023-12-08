// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ChangeEvent} from 'react';
import {FormattedMessage} from 'react-intl';

import type {ServerError} from '@mattermost/types/errors';
import type {Team} from '@mattermost/types/teams';
import type {GetFilteredUsersStatsOpts, UserProfile, UsersStats} from '@mattermost/types/users';

import {debounce} from 'mattermost-redux/actions/helpers';
import type {ActionFunc} from 'mattermost-redux/types/actions';

import AdminHeader from 'components/widgets/admin_console/admin_header';

import {Constants, UserSearchOptions, SearchUserTeamFilter} from 'utils/constants';
import {getUserOptionsFromFilter, searchUserOptionsFromFilter} from 'utils/filter_users';

import RevokeSessionsButton from './revoke_sessions_button';
import SystemUsersFilterRole from './system_users_filter_role';
import SystemUsersFilterTeam from './system_users_filter_team';
import SystemUsersList from './system_users_list';
import SystemUsersSearch from './system_users_search';

const USER_ID_LENGTH = 26;
const USERS_PER_PAGE = 50;

type Props = {

    /**
     * Array of team objects
     */
    teams: Team[];

    /**
     * Title of the app or site.
     */
    siteName?: string;

    /**
     * Whether or not MFA is licensed and enabled.
     */
    mfaEnabled: boolean;

    /**
     * Whether or not user access tokens are enabled.
     */
    enableUserAccessTokens: boolean;

    /**
     * Whether or not the experimental authentication transfer is enabled.
     */
    experimentalEnableAuthenticationTransfer: boolean;
    totalUsers: number;
    searchTerm: string;
    teamId: string;
    filter: string;
    users: Record<string, UserProfile>;

    actions: {

        /**
         * Function to get teams
         */
        getTeams: (startInde: number, endIndex: number) => void;

        /**
         * Function to get statistics for a team
         */
        getTeamStats: (teamId: string) => ActionFunc;

        /**
         * Function to get a user
         */
        getUser: (id: string) => ActionFunc;

        /**
         * Function to get a user access token
         */
        getUserAccessToken: (tokenId: string) => Promise<any> | ActionFunc;
        loadProfilesAndTeamMembers: (page: number, maxItemsPerPage: number, teamId: string, options: Record<string, string | boolean>) => void;
        loadProfilesWithoutTeam: (page: number, maxItemsPerPage: number, options: Record<string, string | boolean>) => void;
        getProfiles: (page: number, maxItemsPerPage: number, options: Record<string, string | boolean>) => void;
        setSystemUsersSearch: (searchTerm: string, teamId: string, filter: string) => void;
        searchProfiles: (term: string, options?: any) => Promise<any> | ActionFunc;

        /**
         * Function to log errors
         */
        logError: (error: {type: string; message: string}) => void;
        getFilteredUsersStats: (filters: GetFilteredUsersStatsOpts) => Promise<{
            data?: UsersStats;
            error?: ServerError;
        }>;
    };
};

type State = {
    loading: boolean;
    searching: boolean;
    term?: string;
};

export class SystemUsers extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            loading: true,
            searching: false,
        };
    }

    componentDidMount() {
        this.loadDataForTeam(this.props.teamId, this.props.filter);
        this.props.actions.getTeams(0, 1000);
    }

    componentWillUnmount() {
        this.props.actions.setSystemUsersSearch('', '', '');
    }

    loadDataForTeam = async (teamId: string, filter: string | undefined) => {
        const {
            getProfiles,
            loadProfilesWithoutTeam,
            loadProfilesAndTeamMembers,
            getTeamStats,
            getFilteredUsersStats,
        } = this.props.actions;

        if (this.props.searchTerm) {
            this.doSearch(this.props.searchTerm, teamId, filter);
            return;
        }

        const options = getUserOptionsFromFilter(filter);

        if (teamId === SearchUserTeamFilter.ALL_USERS) {
            await Promise.all([
                getProfiles(0, Constants.PROFILE_CHUNK_SIZE, options),
                getFilteredUsersStats({include_bots: false, include_deleted: true}),
            ]);
        } else if (teamId === SearchUserTeamFilter.NO_TEAM) {
            await loadProfilesWithoutTeam(0, Constants.PROFILE_CHUNK_SIZE, options);
        } else {
            await Promise.all([
                loadProfilesAndTeamMembers(0, Constants.PROFILE_CHUNK_SIZE, teamId, options),
                getTeamStats(teamId),
            ]);
        }

        this.setState({loading: false});
    };

    handleTeamChange = (e: ChangeEvent<HTMLSelectElement>) => {
        const teamId = e.target.value;
        this.loadDataForTeam(teamId, this.props.filter);
        this.props.actions.setSystemUsersSearch(this.props.searchTerm, teamId, this.props.filter);
    };

    handleFilterChange = (e: ChangeEvent<HTMLSelectElement>) => {
        const filter = e.target.value;
        this.loadDataForTeam(this.props.teamId, filter);
        this.props.actions.setSystemUsersSearch(this.props.searchTerm, this.props.teamId, filter);
    };

    handleTermChange = (term: string) => {
        this.props.actions.setSystemUsersSearch(term, this.props.teamId, this.props.filter);
    };

    handleSearchFiltersChange = ({searchTerm, teamId, filter}: {searchTerm?: string; teamId?: string; filter?: string}) => {
        const changedSearchTerm = typeof searchTerm === 'undefined' ? this.props.searchTerm : searchTerm;
        const changedTeamId = typeof teamId === 'undefined' ? this.props.teamId : teamId;
        const changedFilter = typeof filter === 'undefined' ? this.props.filter : filter;

        this.props.actions.setSystemUsersSearch(changedSearchTerm, changedTeamId, changedFilter);
    };

    nextPage = async (page: number) => {
        const {teamId, filter} = this.props;

        // Paging isn't supported while searching
        const {
            getProfiles,
            loadProfilesWithoutTeam,
            loadProfilesAndTeamMembers,
        } = this.props.actions;

        const options = getUserOptionsFromFilter(filter);

        if (teamId === SearchUserTeamFilter.ALL_USERS) {
            await getProfiles(page + 1, USERS_PER_PAGE, options);
        } else if (teamId === SearchUserTeamFilter.NO_TEAM) {
            await loadProfilesWithoutTeam(page + 1, USERS_PER_PAGE, options);
        } else {
            await loadProfilesAndTeamMembers(page + 1, USERS_PER_PAGE, teamId, options);
        }
        this.setState({loading: false});
    };

    onSearch = async (term: string) => {
        this.setState({loading: true});

        const options = {
            ...searchUserOptionsFromFilter(this.props.filter),
            ...this.props.teamId && {team_id: this.props.teamId},
            ...this.props.teamId === SearchUserTeamFilter.NO_TEAM && {
                [UserSearchOptions.WITHOUT_TEAM]: true,
            },
            allow_inactive: true,
        };

        const {data: profiles} = await this.props.actions.searchProfiles(term, options);
        if (profiles.length === 0 && term.length === USER_ID_LENGTH) {
            await this.getUserByTokenOrId(term);
        }

        this.setState({loading: false});
    };

    onFilter = async ({teamId, filter}: {teamId?: string; filter?: string}) => {
        if (this.props.searchTerm) {
            this.onSearch(this.props.searchTerm);
            return;
        }

        this.setState({loading: true});

        const newTeamId = typeof teamId === 'undefined' ? this.props.teamId : teamId;
        const newFilter = typeof filter === 'undefined' ? this.props.filter : filter;

        const options = getUserOptionsFromFilter(newFilter);

        if (newTeamId === SearchUserTeamFilter.ALL_USERS) {
            await Promise.all([
                this.props.actions.getProfiles(0, Constants.PROFILE_CHUNK_SIZE, options),
                this.props.actions.getFilteredUsersStats({include_bots: false, include_deleted: true}),
            ]);
        } else if (newTeamId === SearchUserTeamFilter.NO_TEAM) {
            await this.props.actions.loadProfilesWithoutTeam(0, Constants.PROFILE_CHUNK_SIZE, options);
        } else {
            await Promise.all([
                this.props.actions.loadProfilesAndTeamMembers(0, Constants.PROFILE_CHUNK_SIZE, newTeamId, options),
                this.props.actions.getTeamStats(newTeamId),
            ]);
        }

        this.setState({loading: false});
    };

    doSearch = debounce(async (term, teamId = this.props.teamId, filter = this.props.filter) => {
        if (!term) {
            return;
        }

        this.setState({loading: true});

        const options = {
            ...searchUserOptionsFromFilter(filter),
            ...teamId && {team_id: teamId},
            ...teamId === SearchUserTeamFilter.NO_TEAM && {
                [UserSearchOptions.WITHOUT_TEAM]: true,
            },
            allow_inactive: true,
        };

        const {data: profiles} = await this.props.actions.searchProfiles(term, options);
        if (profiles.length === 0 && term.length === USER_ID_LENGTH) {
            await this.getUserByTokenOrId(term);
        }

        this.setState({loading: false});
    }, Constants.SEARCH_TIMEOUT_MILLISECONDS, false, () => {});

    getUserById = async (id: string) => {
        if (this.props.users[id]) {
            this.setState({loading: false});
            return;
        }

        await this.props.actions.getUser(id);
        this.setState({loading: false});
    };

    getUserByTokenOrId = async (id: string) => {
        if (this.props.enableUserAccessTokens) {
            const {data} = await this.props.actions.getUserAccessToken(id);

            if (data) {
                this.setState({term: data.user_id});
                this.getUserById(data.user_id);
                return;
            }
        }

        this.getUserById(id);
    };

    render() {
        return (
            <div className='wrapper--fixed'>
                <AdminHeader>
                    <FormattedMessage
                        id='admin.system_users.title'
                        defaultMessage='{siteName} Users'
                        values={{siteName: this.props.siteName}}
                    />
                    <RevokeSessionsButton/>
                </AdminHeader>
                <div className='admin-console__wrapper'>
                    <div className='admin-console__content'>
                        <div className='more-modal__list member-list-holder'>
                            <div className='system-users__filter-row'>
                                <SystemUsersSearch
                                    value={this.props.searchTerm}
                                    onChange={this.handleSearchFiltersChange}
                                    onSearch={this.onSearch}
                                />
                                <SystemUsersFilterTeam
                                    options={this.props.teams}
                                    value={this.props.teamId}
                                    onChange={this.handleSearchFiltersChange}
                                    onFilter={this.onFilter}
                                />
                                <SystemUsersFilterRole
                                    value={this.props.filter}
                                    onChange={this.handleSearchFiltersChange}
                                    onFilter={this.onFilter}
                                />
                            </div>
                            <SystemUsersList
                                loading={this.state.loading}
                                search={this.doSearch}
                                nextPage={this.nextPage}
                                usersPerPage={USERS_PER_PAGE}
                                total={this.props.totalUsers}
                                teams={this.props.teams}
                                teamId={this.props.teamId}
                                filter={this.props.filter}
                                term={this.props.searchTerm}
                                onTermChange={this.handleTermChange}
                                mfaEnabled={this.props.mfaEnabled}
                                enableUserAccessTokens={this.props.enableUserAccessTokens}
                                experimentalEnableAuthenticationTransfer={this.props.experimentalEnableAuthenticationTransfer}
                            />
                        </div>
                        <SystemUsersList
                            loading={this.state.loading}
                            search={this.doSearch}
                            nextPage={this.nextPage}
                            usersPerPage={USERS_PER_PAGE}
                            total={this.props.totalUsers}
                            teams={this.props.teams}
                            teamId={this.props.teamId}
                            filter={this.props.filter}
                            term={this.props.searchTerm}
                            onTermChange={this.handleTermChange}
                            mfaEnabled={this.props.mfaEnabled}
                            enableUserAccessTokens={this.props.enableUserAccessTokens}
                            experimentalEnableAuthenticationTransfer={this.props.experimentalEnableAuthenticationTransfer}
                        />
                    </div>
                </div>
            </div>
        );
    }
}

export default SystemUsers;
