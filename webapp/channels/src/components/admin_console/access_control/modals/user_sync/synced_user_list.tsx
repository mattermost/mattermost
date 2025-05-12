// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect, useCallback} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import type {UserProfile} from '@mattermost/types/users';

import type {ActionResult} from 'mattermost-redux/types/actions';

import {UserGroupsSVG} from 'components/common/svg_images_components/user_groups_svg';
import SearchableUserList from 'components/searchable_user_list/searchable_user_list_container';

import type {ActionFuncAsync} from 'types/store';

type SyncedUserListProps = {
    userIds: string[];
    noResultsMessageId: string;
    noResultsDefaultMessage: string;
    actions: {
        getProfilesByIds: (userIds: string[]) => ActionFuncAsync<UserProfile[]>;
    };
};

const USERS_PER_PAGE = 10;

// TODO: this component should be improved:
// - make pagination work
// - improve search

export const SyncedUserList = ({userIds, noResultsMessageId, noResultsDefaultMessage, actions}: SyncedUserListProps): JSX.Element => {
    const dispatch = useDispatch<any>();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [currentPage, setCurrentPage] = useState(0);

    const totalUsers = userIds.length;

    const fetchUsers = useCallback(async (page: number) => {
        const startIndex = page * USERS_PER_PAGE;
        const endIndex = startIndex + USERS_PER_PAGE;
        const idsToFetch = userIds.slice(startIndex, endIndex);

        await dispatch(actions.getProfilesByIds(idsToFetch)).then((result: ActionResult<UserProfile[]>) => {
            if (result?.data) {
                setUsers([...result.data]);
            } else {
                setUsers([]);
            }
        });
    }, [userIds]);

    useEffect(() => {
        fetchUsers(currentPage);
    }, [currentPage]);

    const handleSearch = (searchTerm: string) => {
        if (searchTerm === '') {
            fetchUsers(0);
        } else {
            setUsers(users.filter((user) => {
                return user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    user.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    user.nickname.toLowerCase().includes(searchTerm.toLowerCase());
            }));
        }
    };

    if (userIds.length === 0) {
        return (
            <div
                className='no-user-message'
                aria-label='No users found'
            >

                <UserGroupsSVG className='empty-state-svg'/>
                <h3 className='primary-message'>
                    <FormattedMessage
                        id={noResultsMessageId}
                        tagName='strong'
                        defaultMessage={noResultsDefaultMessage}
                    />
                </h3>
            </div>
        );
    }

    return (
        <SearchableUserList
            users={users}
            usersPerPage={USERS_PER_PAGE}
            total={totalUsers}
            nextPage={() => {
                setCurrentPage(currentPage + 1);
            }}
            previousPage={() => {
                setCurrentPage(currentPage - 1);
            }}
            search={handleSearch}
            actionUserProps={{}}
        />
    );
};

export default SyncedUserList;
