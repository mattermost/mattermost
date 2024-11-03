// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router-dom';

import type {UserProfile} from '@mattermost/types/users';

import type {ActionResult} from 'mattermost-redux/types/actions';

import GroupUsersRow from 'components/admin_console/group_settings/group_details/group_users_row';
import NextIcon from 'components/widgets/icons/fa_next_icon';
import PreviousIcon from 'components/widgets/icons/fa_previous_icon';

const GROUP_MEMBERS_PAGE_SIZE = 20;

type Props = {
    groupID: string;
    members: UserProfile[];
    total: number;
    getMembers: (
        id: string,
        page?: number,
        perPage?: number
    ) => Promise<ActionResult>;
};

type State = {
    loading: boolean;
    page: number;
};

export default class GroupUsers extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            loading: true,
            page: 0,
        };
    }

    componentDidMount() {
        this.props.
            getMembers(this.props.groupID, 0, GROUP_MEMBERS_PAGE_SIZE).
            then(() => {
                this.setState({loading: false});
            });
    }

    previousPage = () => {
        const page = this.state.page < 1 ? 0 : this.state.page - 1;
        this.setState({page});
    };

    nextPage = async () => {
        const {total, members, groupID, getMembers} = this.props;
        const page =
            (this.state.page + 1) * GROUP_MEMBERS_PAGE_SIZE >= total ? this.state.page : this.state.page + 1;
        if (page === this.state.page) {
            return;
        }

        const numberOfMembersToLoad =
            (page + 1) * GROUP_MEMBERS_PAGE_SIZE >= total ? total : (page + 1) * GROUP_MEMBERS_PAGE_SIZE;
        if (members.length >= numberOfMembersToLoad) {
            this.setState({page});
            return;
        }

        this.setState({page, loading: true});
        await getMembers(groupID, page, GROUP_MEMBERS_PAGE_SIZE);
        this.setState({loading: false});
    };

    renderRows = () => {
        if (this.props.members.length === 0) {
            return (
                <div className='group-users-empty'>
                    <FormattedMessage
                        id='admin.group_settings.group_details.group_users.no-users-found'
                        defaultMessage='No users found'
                    />
                </div>
            );
        }

        const usersToDisplay = this.props.members.slice(
            this.state.page * GROUP_MEMBERS_PAGE_SIZE,
            (this.state.page + 1) * GROUP_MEMBERS_PAGE_SIZE,
        );
        return usersToDisplay.map((member) => {
            return (
                <GroupUsersRow
                    key={member.id}
                    username={member.username}
                    displayName={member.first_name + ' ' + member.last_name}
                    email={member.email}
                    userId={member.id}
                    lastPictureUpdate={member.last_picture_update}
                />
            );
        });
    };

    renderPagination = () => {
        if (this.props.members.length === 0) {
            return <div className='group-users--footer empty'/>;
        }

        const startCount = (this.state.page * GROUP_MEMBERS_PAGE_SIZE) + 1;
        let endCount = (this.state.page * GROUP_MEMBERS_PAGE_SIZE) + GROUP_MEMBERS_PAGE_SIZE;
        const total = this.props.total;
        if (endCount > total) {
            endCount = total;
        }
        const lastPage = endCount === total;
        const firstPage = this.state.page === 0;

        return (
            <div className='group-users--footer'>
                <div className='counter'>
                    <FormattedMessage
                        id='admin.group_settings.groups_list.paginatorCount'
                        defaultMessage='{startCount, number} - {endCount, number} of {total, number}'
                        values={{
                            startCount,
                            endCount,
                            total,
                        }}
                    />
                </div>
                <button
                    type='button'
                    className={
                        'btn btn-tertiary prev ' + (firstPage ? 'disabled' : '')
                    }
                    onClick={this.previousPage}
                    disabled={firstPage}
                >
                    <PreviousIcon/>
                </button>
                <button
                    type='button'
                    className={
                        'btn btn-tertiary next ' + (lastPage ? 'disabled' : '')
                    }
                    onClick={this.nextPage}
                    disabled={lastPage}
                >
                    <NextIcon/>
                </button>
            </div>
        );
    };

    render = () => {
        return (
            <div className='group-users'>
                <div className='group-users--header'>
                    <FormattedMessage
                        id='admin.group_settings.group_profile.group_users.ldapConnectorText'
                        defaultMessage={
                            'AD/LDAP Connector is configured to sync and manage this group and its users. <a>Click here to view</a>'
                        }
                        values={{
                            a: (chunks: string) => (
                                <Link to='/admin_console/authentication/ldap'>
                                    {chunks}
                                </Link>
                            ),
                        }}
                    />
                </div>
                <div className='group-users--body'>
                    <div
                        className={
                            'group-users-loading ' +
                            (this.state.loading ? 'active' : '')
                        }
                    >
                        <i className='fa fa-spinner fa-pulse fa-2x'/>
                    </div>
                    {this.renderRows()}
                </div>
                {this.renderPagination()}
            </div>
        );
    };
}
