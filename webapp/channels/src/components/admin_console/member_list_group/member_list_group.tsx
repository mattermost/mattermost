// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {GroupStats} from '@mattermost/types/groups';
import type {UserProfile} from '@mattermost/types/users';

import type {ActionResult} from 'mattermost-redux/types/actions';

import DataGrid from 'components/admin_console/data_grid/data_grid';
import type {Row, Column} from 'components/admin_console/data_grid/data_grid';
import UserGridName from 'components/admin_console/user_grid/user_grid_name';

import Constants from 'utils/constants';

const USERS_PER_PAGE = 10;

import './member_list_group.scss';

export type Props = {
    searchTerm: string;
    users: UserProfile[];
    groupID: string;
    total: number;
    actions: {
        getProfilesInGroup: (groupID: string, page: number, perPage: number) => Promise<ActionResult<UserProfile[]>>;
        getGroupStats: (groupID: string) => Promise<ActionResult<GroupStats>>;
        searchProfiles: (term: string, options?: Record<string, unknown>) => Promise<ActionResult<UserProfile[]>>;
        setModalSearchTerm: (term: string) => void;
    };
}

type State = {
    loading: boolean;
    page: number;
}

export default class MemberListGroup extends React.PureComponent<Props, State> {
    private searchTimeoutId: number;

    constructor(props: Props) {
        super(props);

        this.searchTimeoutId = 0;

        this.state = {
            loading: true,
            page: 0,
        };
    }

    async componentDidMount() {
        const {actions, groupID} = this.props;
        await Promise.all([
            actions.getProfilesInGroup(groupID, 0, USERS_PER_PAGE * 2),
            actions.getGroupStats(groupID),
        ]);
        this.loadComplete();
    }

    componentWillUnmount() {
        this.props.actions.setModalSearchTerm('');
    }

    componentDidUpdate(prevProps: Props) {
        if (prevProps.searchTerm !== this.props.searchTerm) {
            clearTimeout(this.searchTimeoutId);

            const searchTerm = this.props.searchTerm;
            if (searchTerm === '') {
                this.loadComplete();
                this.searchTimeoutId = 0;
                return;
            }

            const searchTimeoutId = window.setTimeout(
                async () => {
                    const {
                        searchProfiles,
                    } = this.props.actions;

                    this.setState({loading: true});

                    await searchProfiles(searchTerm, {in_group_id: this.props.groupID});

                    if (searchTimeoutId !== this.searchTimeoutId) {
                        return;
                    }

                    this.loadComplete();
                },
                Constants.SEARCH_TIMEOUT_MILLISECONDS,
            );

            this.searchTimeoutId = searchTimeoutId;
        }
    }

    loadComplete = () => {
        this.setState({loading: false});
    };

    private nextPage = async () => {
        const {actions, groupID} = this.props;
        const page = this.state.page + 1;
        this.setState({loading: true, page});
        await actions.getProfilesInGroup(groupID, page, USERS_PER_PAGE * 2);
        this.setState({loading: false});
    };

    private previousPage = () => {
        this.setState({page: this.state.page - 1});
    };

    private getRows = (): Row[] => {
        const {users} = this.props;
        const {startCount, endCount} = this.getPaginationProps();

        let usersToDisplay = users;
        usersToDisplay = usersToDisplay.slice(startCount - 1, endCount);

        return usersToDisplay.map((user) => {
            return {
                cells: {
                    id: user.id,
                    name: (
                        <UserGridName
                            user={user}
                        />
                    ),
                },
            };
        });
    };

    private getColumns = (): Column[] => {
        return [
            {
                name: (
                    <FormattedMessage
                        id='admin.member_list_group.name'
                        defaultMessage='Name'
                    />
                ),
                field: 'name',
            },
        ];
    };

    private getPaginationProps = () => {
        let {total} = this.props;
        const {page} = this.state;
        const startCount = (this.state.page * USERS_PER_PAGE) + 1;
        let endCount = (page + 1) * USERS_PER_PAGE;

        if (this.props.searchTerm !== '') {
            total = this.props.users.length;
        }
        if (endCount > total) {
            endCount = total;
        }
        return {startCount, endCount, total};
    };

    public render = (): JSX.Element => {
        const rows: Row[] = this.getRows();
        const columns: Column[] = this.getColumns();
        const {startCount, endCount, total} = this.getPaginationProps();

        const placeholderEmpty: JSX.Element = (
            <FormattedMessage
                id='admin.member_list_group.notFound'
                defaultMessage='No users found'
            />
        );

        return (
            <div className='MemberListGroup'>
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
                    onSearch={this.props.actions.setModalSearchTerm}
                    term={this.props.searchTerm || ''}
                    placeholderEmpty={placeholderEmpty}
                />
            </div>
        );
    };
}
