// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {ActionResult} from 'mattermost-redux/types/actions';
import {UserProfile} from '@mattermost/types/users';
import {TeamMembership} from '@mattermost/types/teams';
import {ChannelMembership} from '@mattermost/types/channels';
import {RelationOneToOne} from '@mattermost/types/utilities';
import GeneralConstants from 'mattermost-redux/constants/general';

import UserGridName from 'components/admin_console/user_grid/user_grid_name';
import DataGrid, {Row, Column} from 'components/admin_console/data_grid/data_grid';
import {FilterOptions} from 'components/admin_console/filter/filter';

import GroupUsersRole from './users_to_remove_role';
import UsersToRemoveGroups from './users_to_remove_groups';

import './users_to_remove.scss';

const GROUP_MEMBERS_PAGE_SIZE = 10;

export type Filters = {
    roles?: string[];
    channel_roles?: string[];
    team_roles?: string[];
}

export type Memberships = RelationOneToOne<UserProfile, TeamMembership> | RelationOneToOne<UserProfile, ChannelMembership>;

interface Props {
    members: UserProfile[];
    memberships: Memberships;
    total: number;
    searchTerm: string;
    scope: 'team' | 'channel';
    scopeId: string;
    enableGuestAccounts: boolean;
    filters: Filters;
    actions: {
        loadTeamMembersForProfilesList: (profiles: UserProfile[], teamId: string) => Promise<{
            data: boolean;
        }>;
        loadChannelMembersForProfilesList: (profiles: UserProfile[], channelId: string) => Promise<{
            data: boolean;
        }>;
        setModalSearchTerm: (term: string) => ActionResult;
        setModalFilters: (filters: Filters) => ActionResult;
    };
}

interface State {
    page: number;
    loading: boolean;
}

export default class UsersToRemove extends React.PureComponent<Props, State> {
    public constructor(props: Props) {
        super(props);

        this.state = {
            page: 0,
            loading: true,
        };
    }

    async componentDidMount() {
        const {members, total} = this.props;
        const MEMBERSHIPS_TO_LOAD_COUNT = 100;
        const promises = [];
        let membershipsLoaded = 0;

        // Pre-load all memberships since users are also already loaded into the state
        while (membershipsLoaded < total) {
            promises.push(this.loadMembersForProfilesList(members.slice(membershipsLoaded, membershipsLoaded + MEMBERSHIPS_TO_LOAD_COUNT)));
            membershipsLoaded += MEMBERSHIPS_TO_LOAD_COUNT;
        }
        await Promise.all(promises);
        this.setStateLoading(false);
    }

    setStateLoading = (loading: boolean) => {
        this.setState({loading});
    }

    componentWillUnmount() {
        this.props.actions.setModalSearchTerm('');
        this.props.actions.setModalFilters({});
    }

    loadMembersForProfilesList = async (profiles: UserProfile[]) => {
        const {loadChannelMembersForProfilesList, loadTeamMembersForProfilesList} = this.props.actions;
        const {scope, scopeId} = this.props;
        if (scope === 'channel') {
            await loadChannelMembersForProfilesList(profiles, scopeId);
        } else if (scope === 'team') {
            await loadTeamMembersForProfilesList(profiles, scopeId);
        }
    }

    previousPage = async () => {
        const page = this.state.page < 1 ? 0 : this.state.page - 1;
        this.setState({page});
    }

    nextPage = async () => {
        const {total} = this.props;
        const page = (this.state.page + 1) * GROUP_MEMBERS_PAGE_SIZE >= total ? this.state.page : this.state.page + 1;
        this.setState({page});
    }

    onSearch = (term: string) => {
        this.props.actions.setModalSearchTerm(term);
        this.setState({page: 0});
    }

    private onFilter = async (filterOptions: FilterOptions) => {
        const roles = filterOptions.role.values;
        const systemRoles: string[] = [];
        const teamRoles: string[] = [];
        const channelRoles: string[] = [];
        let filters = {};
        Object.keys(roles).forEach((filterKey: string) => {
            if (roles[filterKey].value) {
                if (filterKey.includes('team')) {
                    teamRoles.push(filterKey);
                } else if (filterKey.includes('channel')) {
                    channelRoles.push(filterKey);
                } else {
                    systemRoles.push(filterKey);
                }
            }
        });

        if (systemRoles.length > 0 || teamRoles.length > 0 || channelRoles.length > 0) {
            if (systemRoles.length > 0) {
                filters = {roles: systemRoles};
            }
            if (teamRoles.length > 0) {
                filters = {...filters, team_roles: teamRoles};
            }
            if (channelRoles.length > 0) {
                filters = {...filters, channel_roles: channelRoles};
            }
        }
        this.props.actions.setModalFilters(filters);
        this.setState({page: 0});
    }

    private getPaginationProps = () => {
        const {page} = this.state;
        const startCount = (page * GROUP_MEMBERS_PAGE_SIZE) + 1;
        let endCount = (page * GROUP_MEMBERS_PAGE_SIZE) + GROUP_MEMBERS_PAGE_SIZE;
        const total = this.props.total;
        if (endCount > total) {
            endCount = total;
        }
        const lastPage = endCount === total;
        const firstPage = page === 0;

        return {startCount, endCount, page, lastPage, firstPage, total};
    }

    private getRows = (): Row[] => {
        const {members, memberships, scope} = this.props;
        const {startCount, endCount} = this.getPaginationProps();

        let usersToDisplay = members;
        usersToDisplay = usersToDisplay.slice(startCount - 1, endCount);

        if (this.state.loading) {
            return [];
        }

        return usersToDisplay.map((user) => {
            return {
                cells: {
                    id: user.id,
                    name: (
                        <UserGridName
                            key={user.id}
                            user={user}
                        />
                    ),
                    role: (
                        <GroupUsersRole
                            key={user.id}
                            user={user}
                            membership={memberships[user.id]}
                            scope={scope}
                        />
                    ),
                    groups: (
                        <UsersToRemoveGroups
                            key={user.id}
                            user={user}
                        />
                    ),
                },
            };
        });
    }

    private getColumns = (): Column[] => {
        return [
            {
                name: (
                    <FormattedMessage
                        id='admin.team_channel_settings.user_list.nameHeader'
                        defaultMessage='Name'
                    />
                ),
                field: 'name',
                width: 5,
            },
            {
                name: (
                    <FormattedMessage
                        id='admin.team_channel_settings.user_list.roleHeader'
                        defaultMessage='Role'
                    />
                ),
                field: 'role',
                width: 2,
            },
            {
                name: (
                    <FormattedMessage
                        id='admin.team_channel_settings.user_list.groupsHeader'
                        defaultMessage='Groups'
                    />
                ),
                field: 'groups',
                width: 3,
            },
        ];
    }

    private getFilterOptions = (): FilterOptions => {
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
                keys: [GeneralConstants.SYSTEM_GUEST_ROLE, GeneralConstants.SYSTEM_ADMIN_ROLE],
            },
        };

        if (this.props.scope === 'channel') {
            filterOptions.role.values = {
                ...filterOptions.role.values,
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
            };
            filterOptions.role.keys = [GeneralConstants.SYSTEM_GUEST_ROLE, GeneralConstants.CHANNEL_USER_ROLE, GeneralConstants.CHANNEL_ADMIN_ROLE, GeneralConstants.SYSTEM_ADMIN_ROLE];
        } else if (this.props.scope === 'team') {
            filterOptions.role.values = {
                ...filterOptions.role.values,
                [GeneralConstants.TEAM_USER_ROLE]: {
                    name: (
                        <FormattedMessage
                            id='admin.user_item.member'
                            defaultMessage='Member'
                        />
                    ),
                    value: false,
                },
                [GeneralConstants.TEAM_ADMIN_ROLE]: {
                    name: (
                        <FormattedMessage
                            id='admin.user_grid.team_admin'
                            defaultMessage='Team Admin'
                        />
                    ),
                    value: false,
                },
            };
            filterOptions.role.keys = [GeneralConstants.SYSTEM_GUEST_ROLE, GeneralConstants.TEAM_USER_ROLE, GeneralConstants.TEAM_ADMIN_ROLE, GeneralConstants.SYSTEM_ADMIN_ROLE];
        }

        if (!this.props.enableGuestAccounts) {
            delete filterOptions.role.values[GeneralConstants.SYSTEM_GUEST_ROLE];
            filterOptions.role.keys.splice(0, 1);
        }

        return filterOptions;
    }

    public render = (): JSX.Element => {
        const rows: Row[] = this.getRows();
        const columns: Column[] = this.getColumns();
        const {startCount, endCount, total} = this.getPaginationProps();
        const options = this.getFilterOptions();
        const keys = ['role'];

        const placeholderEmpty: JSX.Element = (
            <FormattedMessage
                id='admin.member_list_group.notFound'
                defaultMessage='No users found'
            />
        );

        return (
            <div className='UsersToRemove'>
                <DataGrid
                    columns={columns}
                    rows={rows}
                    loading={this.state.loading}
                    page={this.state.page}
                    nextPage={this.nextPage}
                    previousPage={this.previousPage}
                    startCount={startCount}
                    endCount={endCount}
                    total={total}
                    onSearch={this.onSearch}
                    filterProps={{options, keys, onFilter: this.onFilter}}
                    term={this.props.searchTerm || ''}
                    placeholderEmpty={placeholderEmpty}
                />
            </div>
        );
    }
}
