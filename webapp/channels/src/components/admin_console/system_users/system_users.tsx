// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ChangeEvent} from 'react';
import {FormattedMessage} from 'react-intl';

import {debounce} from 'mattermost-redux/actions/helpers';
import {Permissions} from 'mattermost-redux/constants';

import {ActionFunc} from 'mattermost-redux/types/actions';
import {ServerError} from '@mattermost/types/errors';
import {Team} from '@mattermost/types/teams';

import {GetFilteredUsersStatsOpts, UserProfile, UsersStats} from '@mattermost/types/users';

import {Constants, UserSearchOptions, SearchUserTeamFilter, UserFilters} from 'utils/constants';
import * as Utils from 'utils/utils';
import {t} from 'utils/i18n';
import {getUserOptionsFromFilter, searchUserOptionsFromFilter} from 'utils/filter_users';

import LocalizedInput from 'components/localized_input/localized_input';
import FormattedAdminHeader from 'components/widgets/admin_console/formatted_admin_header';
import FormattedMarkdownMessage from 'components/formatted_markdown_message';
import SystemPermissionGate from 'components/permissions_gates/system_permission_gate';
import ConfirmModal from 'components/confirm_modal';
import {emitUserLoggedOutEvent} from 'actions/global_actions';

import SystemUsersList from './list';

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
    isDisabled?: boolean;

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
         * Function to revoke all sessions in the system
         */
        revokeSessionsForAllUsers: () => any;

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
    showRevokeAllSessionsModal: boolean;
    term?: string;
};

export default class SystemUsers extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            loading: true,
            searching: false,
            showRevokeAllSessionsModal: false,
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
    }

    handleTeamChange = (e: ChangeEvent<HTMLSelectElement>) => {
        const teamId = e.target.value;
        this.loadDataForTeam(teamId, this.props.filter);
        this.props.actions.setSystemUsersSearch(this.props.searchTerm, teamId, this.props.filter);
    }

    handleFilterChange = (e: ChangeEvent<HTMLSelectElement>) => {
        const filter = e.target.value;
        this.loadDataForTeam(this.props.teamId, filter);
        this.props.actions.setSystemUsersSearch(this.props.searchTerm, this.props.teamId, filter);
    }

    handleTermChange = (term: string) => {
        this.props.actions.setSystemUsersSearch(term, this.props.teamId, this.props.filter);
    }
    handleRevokeAllSessions = async () => {
        const {data} = await this.props.actions.revokeSessionsForAllUsers();
        if (data) {
            emitUserLoggedOutEvent();
        } else {
            this.props.actions.logError({type: 'critical', message: 'Can\'t revoke all sessions'});
        }
    }
    handleRevokeAllSessionsCancel = () => {
        this.setState({showRevokeAllSessionsModal: false});
    }
    handleShowRevokeAllSessionsModal = () => {
        this.setState({showRevokeAllSessionsModal: true});
    }

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
    }

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
    }

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
    }

    renderRevokeAllUsersModal = () => {
        const title = (
            <FormattedMessage
                id='admin.system_users.revoke_all_sessions_modal_title'
                defaultMessage='Revoke all sessions in the system'
            />
        );

        const message = (
            <div>
                <FormattedMarkdownMessage
                    id='admin.system_users.revoke_all_sessions_modal_message'
                    defaultMessage='This action revokes all sessions in the system. All users will be logged out from all devices. Are you sure you want to revoke all sessions?'
                />
            </div>
        );

        const confirmButtonClass = 'btn btn-danger';
        const revokeAllButton = (
            <FormattedMessage
                id='admin.system_users.revoke_all_sessions_button'
                defaultMessage='Revoke All Sessions'
            />
        );

        return (
            <ConfirmModal
                show={this.state.showRevokeAllSessionsModal}
                title={title}
                message={message}
                confirmButtonClass={confirmButtonClass}
                confirmButtonText={revokeAllButton}
                onConfirm={this.handleRevokeAllSessions}
                onCancel={this.handleRevokeAllSessionsCancel}
            />
        );
    }

    renderFilterRow = (doSearch: ((event: React.FormEvent<HTMLInputElement>) => void) | undefined) => {
        const teams = this.props.teams.map((team) => (
            <option
                key={team.id}
                value={team.id}
            >
                {team.display_name}
            </option>
        ));

        return (
            <div className='system-users__filter-row'>
                <div className='system-users__filter'>
                    <LocalizedInput
                        id='searchUsers'
                        className='form-control filter-textbox'
                        placeholder={{id: t('filtered_user_list.search'), defaultMessage: 'Search users'}}
                        onInput={doSearch}
                    />
                </div>
                <label>
                    <span className='system-users__team-filter-label'>
                        <FormattedMessage
                            id='filtered_user_list.team'
                            defaultMessage='Team:'
                        />
                    </span>
                    <select
                        className='form-control system-users__team-filter'
                        onChange={this.handleTeamChange}
                        value={this.props.teamId}
                    >
                        <option value={SearchUserTeamFilter.ALL_USERS}>{Utils.localizeMessage('admin.system_users.allUsers', 'All Users')}</option>
                        <option value={SearchUserTeamFilter.NO_TEAM}>{Utils.localizeMessage('admin.system_users.noTeams', 'No Teams')}</option>
                        {teams}
                    </select>
                </label>
                <label>
                    <span className='system-users__filter-label'>
                        <FormattedMessage
                            id='filtered_user_list.userStatus'
                            defaultMessage='User Status:'
                        />
                    </span>
                    <select
                        id='selectUserStatus'
                        className='form-control system-users__filter'
                        value={this.props.filter}
                        onChange={this.handleFilterChange}
                    >
                        <option value=''>{Utils.localizeMessage('admin.system_users.allUsers', 'All Users')}</option>
                        <option value={UserFilters.SYSTEM_ADMIN}>{Utils.localizeMessage('admin.system_users.system_admin', 'System Admin')}</option>
                        <option value={UserFilters.SYSTEM_GUEST}>{Utils.localizeMessage('admin.system_users.guest', 'Guest')}</option>
                        <option value={UserFilters.ACTIVE}>{Utils.localizeMessage('admin.system_users.active', 'Active')}</option>
                        <option value={UserFilters.INACTIVE}>{Utils.localizeMessage('admin.system_users.inactive', 'Inactive')}</option>
                    </select>
                </label>
            </div>
        );
    }

    render() {
        const revokeAllUsersModal = this.renderRevokeAllUsersModal();

        return (
            <div className='wrapper--fixed'>
                <FormattedAdminHeader
                    id='admin.system_users.title'
                    defaultMessage='{siteName} Users'
                    values={{
                        siteName: this.props.siteName,
                    }}
                />

                <div className='admin-console__wrapper'>
                    <div className='admin-console__content'>
                        <div className='more-modal__list member-list-holder'>
                            <SystemUsersList
                                loading={this.state.loading}
                                renderFilterRow={this.renderFilterRow}
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
                                isDisabled={this.props.isDisabled}
                            />
                        </div>
                        <SystemPermissionGate permissions={[Permissions.REVOKE_USER_ACCESS_TOKEN]}>
                            {revokeAllUsersModal}
                            <div className='pt-3 pb-3'>
                                <button
                                    id='revoke-all-users'
                                    type='button'
                                    className='btn btn-default'
                                    onClick={() => this.handleShowRevokeAllSessionsModal()}
                                    disabled={this.props.isDisabled}
                                >
                                    <FormattedMessage
                                        id='admin.system_users.revokeAllSessions'
                                        defaultMessage='Revoke All Sessions'
                                    />
                                </button>
                            </div>
                        </SystemPermissionGate>
                    </div>
                </div>
            </div>
        );
    }
}
