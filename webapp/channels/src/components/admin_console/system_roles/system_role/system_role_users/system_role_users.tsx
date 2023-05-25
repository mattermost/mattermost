// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import Tag from 'components/widgets/tag/tag';

import {Role} from '@mattermost/types/roles';
import {ServerError} from '@mattermost/types/errors';
import {UserProfile, UsersStats, GetFilteredUsersStatsOpts} from '@mattermost/types/users';

import Constants, {ModalIdentifiers} from 'utils/constants';
import {t} from 'utils/i18n';

import AdminPanel from 'components/widgets/admin_console/admin_panel';
import ToggleModalButton from 'components/toggle_modal_button';
import DataGrid from 'components/admin_console/data_grid/data_grid';
import UserGridName from 'components/admin_console/user_grid/user_grid_name';
import UserGridRemove from 'components/admin_console/user_grid/user_grid_remove';
import AddUsersToRoleModal from '../add_users_to_role_modal';

export type Props = {
    users: UserProfile[];
    role: Role;
    totalCount: number;
    term: string;
    usersToRemove: Record<string, UserProfile>;
    usersToAdd: Record<string, UserProfile>;
    onAddCallback: (users: UserProfile[]) => void;
    onRemoveCallback: (user: UserProfile) => void;
    actions: {
        getFilteredUsersStats: (filters: GetFilteredUsersStatsOpts) => Promise<{
            data?: UsersStats;
            error?: ServerError;
        }>;
        getProfiles: (page?: number | undefined, perPage?: number | undefined, options?: any) => Promise<any>;
        searchProfiles: (term: string, options: any) => Promise<any>;
        setUserGridSearch: (term: string) => Promise<any>;
    };
    readOnly?: boolean;
}

type State = {
    loading: boolean;
    page: number;
    includeUsers: Record<string, UserProfile>;
    excludeUsers: Record<string, UserProfile>;
}

const USERS_PER_PAGE = 10;

export default class SystemRoleUsers extends React.PureComponent<Props, State> {
    searchTimeoutId: number;

    constructor(props: Props) {
        super(props);

        this.searchTimeoutId = 0;

        this.state = {
            loading: true,
            page: 0,
            includeUsers: {},
            excludeUsers: {},
        };
    }

    async componentDidMount() {
        const {getProfiles, getFilteredUsersStats, setUserGridSearch} = this.props.actions;
        await Promise.all([
            setUserGridSearch(''),
            getProfiles(0, USERS_PER_PAGE, {role: this.props.role.name}),
            getFilteredUsersStats({roles: [this.props.role.name]}),
        ]);
        this.setStateLoading(false);
    }

    async componentDidUpdate(prevProps: Props) {
        if (prevProps.term !== this.props.term) {
            this.setStateLoading(true);
            clearTimeout(this.searchTimeoutId);
            const {term} = this.props;

            if (term === '') {
                this.searchTimeoutId = 0;
                this.setStateLoading(false);
                return;
            }

            const searchTimeoutId = window.setTimeout(
                async () => {
                    await prevProps.actions.searchProfiles(term, {role: this.props.role.name});

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

    setStateLoading = (loading: boolean) => {
        this.setState({loading});
    };

    getVisibleTotalCount = (): number => {
        const {usersToRemove, usersToAdd, totalCount} = this.props;
        const usersToAddCount = Object.keys(usersToAdd).length;
        const usersToRemoveCount = Object.keys(usersToRemove).length;
        return totalCount + (usersToAddCount - usersToRemoveCount);
    };

    getPaginationProps = (): {startCount: number; endCount: number; total: number} => {
        const {term, usersToRemove, usersToAdd} = this.props;
        const {page} = this.state;

        let total: number;
        let endCount = 0;
        const startCount = (page * USERS_PER_PAGE) + 1;

        if (term === '') {
            total = this.getVisibleTotalCount();
        } else {
            total = this.props.users.length + Object.keys(usersToAdd).length;
            this.props.users.forEach((u) => {
                if (usersToRemove[u.id]) {
                    total -= 1;
                }
            });
        }

        endCount = (page + 1) * USERS_PER_PAGE;
        endCount = endCount > total ? total : endCount;

        return {startCount, endCount, total};
    };

    onSearch = async (term: string) => {
        this.props.actions.setUserGridSearch(term);
    };

    nextPage = async () => {
        if (this.state.loading) {
            return;
        }
        const page = this.state.page + 1;
        this.setState({loading: true});
        await this.props.actions.getProfiles(page, USERS_PER_PAGE, {role: this.props.role.name});
        this.setState({loading: false, page});
    };

    previousPage = async () => {
        if (this.state.loading || this.state.page === 0) {
            return;
        }
        this.setState({page: this.state.page - 1});
    };

    getRows = () => {
        const {users, readOnly, usersToAdd, usersToRemove} = this.props;
        const {startCount, endCount} = this.getPaginationProps();

        // Remove users to remove and add users to add
        let usersToDisplay = users;
        usersToDisplay = usersToDisplay.filter((user) => !usersToRemove[user.id]);
        usersToDisplay = [...Object.values(usersToAdd), ...usersToDisplay];
        usersToDisplay = usersToDisplay.slice(startCount - 1, endCount);

        return usersToDisplay.map((user) => {
            return {
                cells: {
                    id: user.id,
                    name: <UserGridName user={user}/>,
                    new: usersToAdd[user.id] ? (
                        <Tag
                            variant={'info'}
                            uppercase={true}
                            text={(
                                <FormattedMessage
                                    id='admin.user_grid.new'
                                    defaultMessage='New'
                                />
                            )}
                        />
                    ) : null,
                    remove: (
                        <UserGridRemove
                            user={user}
                            removeUser={this.onRemoveCallback}
                            isDisabled={readOnly}
                        />
                    ),
                },
            };
        });
    };

    getColumns = () => {
        const name: JSX.Element = (
            <FormattedMessage
                id='admin.user_grid.name'
                defaultMessage='Name'
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
                width: 1,
                fixed: true,
            },
            {
                name: '',
                field: 'remove',
                textAlign: 'right' as const,
                fixed: true,
            },
        ];
    };

    onAddCallback = (users: UserProfile[]) => {
        this.props.onAddCallback(users);
    };

    onRemoveCallback = (user: UserProfile) => {
        this.props.onRemoveCallback(user);
    };

    render() {
        const {page, loading} = this.state;
        const {term, role, usersToAdd, usersToRemove, readOnly} = this.props;
        const {startCount, endCount, total} = this.getPaginationProps();
        return (

            <AdminPanel
                id='SystemRoleUsers'
                titleId={t('admin.permissions.system_role_users.title')}
                titleDefault='Assigned People'
                subtitleId={t('admin.permissions.system_role_users.description')}
                subtitleDefault='List of people assigned to this system role.'
                button={
                    <ToggleModalButton
                        id='addRoleMembers'
                        className='btn btn-primary'
                        modalId={ModalIdentifiers.ADD_USER_TO_ROLE}
                        dialogType={AddUsersToRoleModal}
                        disabled={readOnly}
                        dialogProps={{
                            role,
                            onAddCallback: this.onAddCallback,
                            skipCommit: true,
                            excludeUsers: usersToAdd,
                            includeUsers: usersToRemove,
                        }}
                    >
                        <FormattedMessage
                            id='admin.permissions.system_role_users.add_people'
                            defaultMessage='Add People'
                        />
                    </ToggleModalButton>
                }
            >
                <DataGrid
                    rows={this.getRows()}
                    columns={this.getColumns()}
                    nextPage={this.nextPage}
                    previousPage={this.previousPage}
                    page={page}
                    startCount={startCount}
                    endCount={endCount}
                    loading={loading}
                    onSearch={this.onSearch}
                    term={term}
                    total={total}
                />
            </AdminPanel>
        );
    }
}

