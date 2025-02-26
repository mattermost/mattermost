// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, defineMessage} from 'react-intl';

import type {Channel, ChannelMembership} from '@mattermost/types/channels';
import type {UserProfile, GetFilteredUsersStatsOpts} from '@mattermost/types/users';

import GeneralConstants from 'mattermost-redux/constants/general';
import type {ActionResult} from 'mattermost-redux/types/actions';

import {trackEvent} from 'actions/telemetry_actions.jsx';

import type {FilterOptions} from 'components/admin_console/filter/filter';
import UserGrid from 'components/admin_console/user_grid/user_grid';
import type {BaseMembership} from 'components/admin_console/user_grid/user_grid_role_dropdown';
import ChannelInviteModal from 'components/channel_invite_modal';
import ToggleModalButton from 'components/toggle_modal_button';
import AdminPanel from 'components/widgets/admin_console/admin_panel';

import Constants, {ModalIdentifiers} from 'utils/constants';

type Props = {
    channelId: string;
    channel?: Channel;
    filters: GetFilteredUsersStatsOpts;

    users: UserProfile[];
    usersToRemove: Record<string, UserProfile>;
    usersToAdd: Record<string, UserProfile>;
    channelMembers: Record<string, ChannelMembership>;

    totalCount: number;
    searchTerm: string;
    loading?: boolean;
    enableGuestAccounts: boolean;

    onAddCallback: (users: UserProfile[]) => void;
    onRemoveCallback: (user: UserProfile) => void;
    updateRole: (userId: string, schemeUser: boolean, schemeAdmin: boolean) => void;

    isDisabled?: boolean;

    actions: {
        getChannelStats: (channelId: string) => Promise<ActionResult>;
        loadProfilesAndReloadChannelMembers: (page: number, perPage: number, channelId?: string, sort?: string, options?: {[key: string]: any}) => Promise<ActionResult>;
        searchProfilesAndChannelMembers: (term: string, options?: {[key: string]: any}) => Promise<ActionResult>;
        getFilteredUsersStats: (filters: GetFilteredUsersStatsOpts) => Promise<ActionResult>;
        setUserGridSearch: (term: string) => void;
        setUserGridFilters: (filters: GetFilteredUsersStatsOpts) => void;
    };
}

type State = {
    loading: boolean;
}

const PROFILE_CHUNK_SIZE = 10;

export default class ChannelMembers extends React.PureComponent<Props, State> {
    private searchTimeoutId: number;

    constructor(props: Props) {
        super(props);

        this.searchTimeoutId = 0;

        this.state = {
            loading: true,
        };
    }

    public componentDidMount() {
        const {channelId} = this.props;
        const {loadProfilesAndReloadChannelMembers, getChannelStats, setUserGridSearch, setUserGridFilters} = this.props.actions;
        Promise.all([
            setUserGridSearch(''),
            setUserGridFilters({}),
            getChannelStats(channelId),
            loadProfilesAndReloadChannelMembers(0, PROFILE_CHUNK_SIZE * 2, channelId, '', {active: true}),
        ]).then(() => this.setStateLoading(false));
    }

    public async componentDidUpdate(prevProps: Props) {
        const filtersModified = JSON.stringify(prevProps.filters) !== JSON.stringify(this.props.filters);
        const searchTermModified = prevProps.searchTerm !== this.props.searchTerm;
        if (filtersModified || searchTermModified) {
            this.setStateLoading(true);
            clearTimeout(this.searchTimeoutId);
            const {searchTerm, filters} = this.props;

            if (searchTerm === '') {
                this.searchTimeoutId = 0;
                if (filtersModified) {
                    await prevProps.actions.loadProfilesAndReloadChannelMembers(0, PROFILE_CHUNK_SIZE * 2, prevProps.channelId, '', {active: true, ...filters});
                }
                this.setStateLoading(false);
                return;
            }

            const searchTimeoutId = window.setTimeout(
                async () => {
                    await prevProps.actions.searchProfilesAndChannelMembers(searchTerm, {...filters, in_channel_id: this.props.channelId, allow_inactive: false});

                    if (searchTimeoutId !== this.searchTimeoutId) {
                        return;
                    }
                    this.setStateLoading(false);
                },
                Constants.SEARCH_TIMEOUT_MILLISECONDS,
            );

            this.searchTimeoutId = searchTimeoutId;
        }
    }

    private setStateLoading = (loading: boolean) => {
        this.setState({loading});
    };

    private loadPage = async (page: number) => {
        const {loadProfilesAndReloadChannelMembers} = this.props.actions;
        const {channelId, filters} = this.props;
        await loadProfilesAndReloadChannelMembers(page + 1, PROFILE_CHUNK_SIZE, channelId, '', {active: true, ...filters});
    };

    private removeUser = (user: UserProfile) => {
        this.props.onRemoveCallback(user);
    };

    private onAddCallback = (users: UserProfile[]) => {
        this.props.onAddCallback(users);
    };

    private onSearch = async (term: string) => {
        this.props.actions.setUserGridSearch(term);
    };

    private updateMembership = (membership: BaseMembership) => {
        this.props.updateRole(membership.user_id, membership.scheme_user, membership.scheme_admin);
    };

    private onFilter = async (filterOptions: FilterOptions) => {
        const roles = filterOptions.role.values;
        const systemRoles: string[] = [];
        const channelRoles: string[] = [];
        let filters = {};
        Object.keys(roles).forEach((filterKey: string) => {
            if (roles[filterKey].value) {
                if (filterKey.includes('channel')) {
                    channelRoles.push(filterKey);
                } else {
                    systemRoles.push(filterKey);
                }
            }
        });

        if (systemRoles.length > 0 || channelRoles.length > 0) {
            if (systemRoles.length > 0) {
                filters = {roles: systemRoles};
            }
            if (channelRoles.length > 0) {
                filters = {...filters, channel_roles: channelRoles};
            }
            [...systemRoles, ...channelRoles].forEach((role) => {
                trackEvent('admin_channel_config_page', `${role}_filter_applied_to_members_block`, {channel_id: this.props.channelId});
            });

            this.props.actions.setUserGridFilters(filters);
            this.props.actions.getFilteredUsersStats({in_channel: this.props.channelId, include_bots: true, ...filters});
        } else {
            this.props.actions.setUserGridFilters(filters);
        }
    };

    render = () => {
        const {users, channel, channelId, usersToAdd, usersToRemove, channelMembers, totalCount, searchTerm, isDisabled} = this.props;
        const filterOptions: FilterOptions = {
            role: {
                name: (
                    <FormattedMessage
                        id='admin.user_grid.role'
                        defaultMessage='Role'
                    />
                ),
                values: {
                    [GeneralConstants.SYSTEM_GUEST_ROLE]: {
                        name: (
                            <FormattedMessage
                                id='admin.user_grid.guest'
                                defaultMessage='Guest'
                            />
                        ),
                        value: false,
                    },
                    [GeneralConstants.CHANNEL_USER_ROLE]: {
                        name: (
                            <FormattedMessage
                                id='admin.user_item.member'
                                defaultMessage='Member'
                            />
                        ),
                        value: false,
                    },
                    [GeneralConstants.CHANNEL_ADMIN_ROLE]: {
                        name: (
                            <FormattedMessage
                                id='admin.user_grid.channel_admin'
                                defaultMessage='Channel Admin'
                            />
                        ),
                        value: false,
                    },
                    [GeneralConstants.SYSTEM_ADMIN_ROLE]: {
                        name: (
                            <FormattedMessage
                                id='admin.user_grid.system_admin'
                                defaultMessage='System Admin'
                            />
                        ),
                        value: false,
                    },
                },
                keys: [GeneralConstants.SYSTEM_GUEST_ROLE, GeneralConstants.CHANNEL_USER_ROLE, GeneralConstants.CHANNEL_ADMIN_ROLE, GeneralConstants.SYSTEM_ADMIN_ROLE],
            },
        };

        if (!this.props.enableGuestAccounts) {
            delete filterOptions.role.values[GeneralConstants.SYSTEM_GUEST_ROLE];
            filterOptions.role.keys = [GeneralConstants.CHANNEL_USER_ROLE, GeneralConstants.CHANNEL_ADMIN_ROLE, GeneralConstants.SYSTEM_ADMIN_ROLE];
        }
        const filterProps = {
            options: filterOptions,
            keys: ['role'],
            onFilter: this.onFilter,
        };

        return (
            <AdminPanel
                id='channelMembers'
                title={defineMessage({id: 'admin.channel_settings.channel_detail.membersTitle', defaultMessage: 'Members'})}
                subtitle={defineMessage({id: 'admin.channel_settings.channel_detail.membersDescription', defaultMessage: 'A list of users who are currently in the channel right now'})}
                button={
                    <ToggleModalButton
                        id='addChannelMembers'
                        className='btn btn-primary'
                        modalId={ModalIdentifiers.CHANNEL_INVITE}
                        dialogType={ChannelInviteModal}
                        disabled={isDisabled}
                        dialogProps={{
                            channel,
                            channelId,
                            teamId: channel?.team_id,
                            onAddCallback: this.onAddCallback,
                            skipCommit: true,
                            excludeUsers: usersToAdd,
                            includeUsers: usersToRemove,
                        }}
                    >
                        <FormattedMessage
                            id='admin.team_settings.team_details.add_members'
                            defaultMessage='Add Members'
                        />
                    </ToggleModalButton>
                }
            >
                <UserGrid
                    loading={this.state.loading || Boolean(this.props.loading)}
                    users={users}
                    loadPage={this.loadPage}
                    removeUser={this.removeUser}
                    totalCount={totalCount}
                    memberships={channelMembers}
                    updateMembership={this.updateMembership}
                    onSearch={this.onSearch}
                    includeUsers={usersToAdd}
                    excludeUsers={usersToRemove}
                    term={searchTerm}
                    scope={'channel'}
                    readOnly={isDisabled}
                    filterProps={filterProps}
                />
            </AdminPanel>
        );
    };
}
