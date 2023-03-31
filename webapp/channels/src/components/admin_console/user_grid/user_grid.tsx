// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import Tag from 'components/widgets/tag/tag';

import {FilterOptions} from 'components/admin_console/filter/filter';
import DataGrid, {Row, Column} from 'components/admin_console/data_grid/data_grid';

import {UserProfile} from '@mattermost/types/users';
import {TeamMembership} from '@mattermost/types/teams';
import {ChannelMembership} from '@mattermost/types/channels';

import UserGridName from './user_grid_name';
import UserGridRemove from './user_grid_remove';
import UserGridRoleDropdown, {BaseMembership} from './user_grid_role_dropdown';

import './user_grid.scss';

type Props = {
    users: UserProfile[];
    scope: 'team' | 'channel';
    memberships: { [userId: string]: BaseMembership | TeamMembership | ChannelMembership };

    excludeUsers: { [userId: string]: UserProfile };
    includeUsers: { [userId: string]: UserProfile };

    loadPage: (page: number) => void;
    onSearch: (term: string) => void;
    removeUser: (user: UserProfile) => void;
    updateMembership: (membership: BaseMembership) => void;

    totalCount: number;
    loading: boolean;
    term: string;
    readOnly?: boolean;

    filterProps: {
        options: FilterOptions;
        keys: string[];
        onFilter: (options: FilterOptions) => void;
    };
};

type State = {
    loading: boolean;
    page: number;
    membershipsToUpdate: { [userId: string]: BaseMembership | TeamMembership | ChannelMembership };
};

const USERS_PER_PAGE = 10;
const ROW_HEIGHT = 80;

export default class UserGrid extends React.PureComponent<Props, State> {
    private pageLoaded = 0;

    public constructor(props: Props) {
        super(props);

        this.state = {
            loading: false,
            page: 0,
            membershipsToUpdate: {},
        };
    }

    private loadPage = (page: number) => {
        this.setState({loading: true});
        this.props.loadPage(page);
        this.setState({page, loading: false});
    }

    private nextPage = () => {
        this.loadPage(this.state.page + 1);
    }

    private previousPage = () => {
        this.loadPage(this.state.page - 1);
    }

    private onSearch = async (term: string) => {
        this.props.onSearch(term);
        this.setState({page: 0});
    }

    private onFilter = async (filters: FilterOptions) => {
        this.props.filterProps?.onFilter(filters);
        this.setState({page: 0});
    }

    private getVisibleTotalCount = (): number => {
        const {includeUsers, excludeUsers, totalCount} = this.props;
        const includeUsersCount = Object.keys(includeUsers).length;
        const excludeUsersCount = Object.keys(excludeUsers).length;
        return totalCount + (includeUsersCount - excludeUsersCount);
    }

    public getPaginationProps = (): {startCount: number; endCount: number; total: number} => {
        const {includeUsers, excludeUsers, term} = this.props;
        const {page} = this.state;

        let total: number;
        let endCount = 0;
        const startCount = (page * USERS_PER_PAGE) + 1;

        if (term === '') {
            total = this.getVisibleTotalCount();
        } else {
            total = this.props.users.length + Object.keys(includeUsers).length;
            this.props.users.forEach((u) => {
                if (excludeUsers[u.id]) {
                    total -= 1;
                }
            });
        }

        endCount = (page + 1) * USERS_PER_PAGE;
        endCount = endCount > total ? total : endCount;

        return {startCount, endCount, total};
    }

    private removeUser = (user: UserProfile) => {
        const {excludeUsers} = this.props;
        if (excludeUsers[user.id] === user) {
            return;
        }

        let {page} = this.state;
        const {endCount} = this.getPaginationProps();

        this.props.removeUser(user);
        if (endCount > this.getVisibleTotalCount() && (endCount % USERS_PER_PAGE) === 1 && page > 0) {
            page--;
        }

        this.setState({page});
    }

    private updateMembership = (membership: BaseMembership) => {
        const {membershipsToUpdate} = this.state;
        const {memberships} = this.props;
        const userId = membership.user_id;
        membershipsToUpdate[userId] = {
            ...memberships[userId],
            ...membership,
        };

        this.props.updateMembership(membership);
        this.setState({membershipsToUpdate}, this.forceUpdate);
    }

    private newMembership = (user: UserProfile): BaseMembership => {
        return {
            user_id: user.id,
            scheme_admin: false,
            scheme_user: !user.roles.includes('guest'),
        };
    }

    private getRows = (): Row[] => {
        const {page, membershipsToUpdate} = this.state;
        const {memberships, users, excludeUsers, includeUsers, totalCount, term, scope, readOnly} = this.props;
        const {startCount, endCount} = this.getPaginationProps();

        let usersToDisplay = users;
        const includeUsersList = Object.values(includeUsers);

        // Remove users to remove and add users to add
        usersToDisplay = usersToDisplay.filter((user) => !excludeUsers[user.id]);
        usersToDisplay = [...includeUsersList, ...usersToDisplay];
        usersToDisplay = usersToDisplay.slice(startCount - 1, endCount);

        // Dont load more elements if searching
        if (term === '' && usersToDisplay.length < USERS_PER_PAGE && users.length < totalCount) {
            const numberOfUsersRemoved = Object.keys(excludeUsers).length;
            const pagesOfUsersRemoved = Math.floor(numberOfUsersRemoved / USERS_PER_PAGE);
            const pageToLoad = page + pagesOfUsersRemoved + 1;

            // Directly call action to load more users from parent component to load more users into the state
            if (pageToLoad > this.pageLoaded) {
                this.props.loadPage(pageToLoad);
                this.pageLoaded = pageToLoad;
            }
        }

        return usersToDisplay.map((user) => {
            const membership = membershipsToUpdate[user.id] || memberships[user.id] || this.newMembership(user);
            return {
                cells: {
                    id: user.id,
                    name: (
                        <UserGridName
                            user={user}
                        />
                    ),
                    new: includeUsers[user.id] ? (
                        <Tag
                            className='NewUserBadge'
                            text={(
                                <FormattedMessage
                                    id='admin.user_grid.new'
                                    defaultMessage='New'
                                />
                            )}
                        />
                    ) : null,
                    role: (
                        <UserGridRoleDropdown
                            user={user}
                            membership={membership}
                            handleUpdateMembership={this.updateMembership}
                            scope={scope}
                            isDisabled={readOnly}
                        />
                    ),
                    remove: (
                        <UserGridRemove
                            user={user}
                            removeUser={this.removeUser}
                            isDisabled={readOnly}
                        />
                    ),
                },
            };
        });
    }

    private getColumns = (): Column[] => {
        const name: JSX.Element = (
            <FormattedMessage
                id='admin.user_grid.name'
                defaultMessage='Name'
            />
        );
        const role: JSX.Element = (
            <FormattedMessage
                id='admin.user_grid.role'
                defaultMessage='Role'
            />
        );

        return [
            {
                name,
                field: 'name',
                width: 3,
                fixed: true,
            },
            {
                name: '',
                field: 'new',
                fixed: true,
            },
            {
                name: role,
                field: 'role',

                // Requires overflow visible in order to render dropdown
                overflow: 'visible',
            },
            {
                name: '',
                field: 'remove',
                textAlign: 'right',
                fixed: true,
            },
        ];
    }

    public render = (): JSX.Element => {
        const rows: Row[] = this.getRows();
        const columns: Column[] = this.getColumns();
        const {startCount, endCount, total} = this.getPaginationProps();

        const placeholderEmpty: JSX.Element = (
            <FormattedMessage
                id='admin.user_grid.notFound'
                defaultMessage='No users found'
            />
        );

        const rowsContainerStyles = {
            minHeight: `${rows.length * ROW_HEIGHT}px`,
        };

        return (
            <DataGrid
                columns={columns}
                rows={rows}
                loading={this.state.loading || this.props.loading}
                page={this.state.page}
                nextPage={this.nextPage}
                previousPage={this.previousPage}
                startCount={startCount}
                endCount={endCount}
                total={total}
                onSearch={this.onSearch}
                term={this.props.term || ''}
                placeholderEmpty={placeholderEmpty}
                rowsContainerStyles={rowsContainerStyles}
                filterProps={{...this.props.filterProps, onFilter: this.onFilter}}
            />
        );
    }
}
