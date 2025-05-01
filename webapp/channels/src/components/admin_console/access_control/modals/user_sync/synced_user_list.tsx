// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect, useCallback} from 'react';
import {FormattedMessage} from 'react-intl';

import type {UserProfile} from '@mattermost/types/users';

import UserList from 'components/user_list';
import { Client4 } from 'mattermost-redux/client';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';
import PreviousIcon from 'components/widgets/icons/fa_previous_icon';
import NextIcon from 'components/widgets/icons/fa_next_icon';

import './synced_user_list.scss';

type SyncedUserListProps = {
    userIds: string[];
    type: 'added' | 'removed';
    noResultsMessageId: string;
    noResultsDefaultMessage: string;
};

const USERS_PER_PAGE = 5;

export const SyncedUserList = ({userIds, type, noResultsMessageId, noResultsDefaultMessage}: SyncedUserListProps): JSX.Element => {
    const [currentPage, setCurrentPage] = useState(1);
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);

    const totalUsers = userIds.length;
    const totalPages = Math.ceil(totalUsers / USERS_PER_PAGE);

    // Calculate the range of users being shown
    const firstUserIndex = (currentPage - 1) * USERS_PER_PAGE + 1;
    const lastUserIndex = Math.min(currentPage * USERS_PER_PAGE, totalUsers);

    const fetchUsers = useCallback(async (page: number) => {
        setLoading(true);
        const startIndex = (page - 1) * USERS_PER_PAGE;
        const endIndex = startIndex + USERS_PER_PAGE;
        const idsToFetch = userIds.slice(startIndex, endIndex);

        if (idsToFetch.length === 0) {
            setUsers([]);
            setLoading(false);
            return;
        }

        try {
            const fetchedUsers = await Client4.getProfilesByIds(idsToFetch);
            setUsers(fetchedUsers || []);
        } catch (error) {
            console.error(`Failed to fetch ${type} users:`, error);
            setUsers([]); // Clear users on error
        } finally {
            setLoading(false);
        }
    }, [userIds, type]);

    useEffect(() => {
        fetchUsers(currentPage);
    }, [fetchUsers, currentPage]);

     // Reset to page 1 if userIds change
     useEffect(() => {
        setCurrentPage(1);
    }, [userIds]);

    const handlePreviousPage = () => {
        setCurrentPage((prev) => Math.max(prev - 1, 1));
    };

    const handleNextPage = () => {
        setCurrentPage((prev) => Math.min(prev + 1, totalPages));
    };

    if (userIds.length === 0) {
        return (
            <div className='no-results'>
                <FormattedMessage
                    id={noResultsMessageId}
                    defaultMessage={noResultsDefaultMessage}
                />
            </div>
        );
    }

    return (
        <div className='SyncedUserList'>
            {loading ? (
                 <div className='loading-spinner'>
                    <LoadingSpinner/>
                </div>
            ) : (
                <UserList
                    users={users}
                />
            )}
              <div className='list-footer'>
                <span className='member-count-text'>
                    {totalUsers > 0 && ( // Only show count if there are users
                         <FormattedMessage
                            id='admin.jobTable.syncResults.memberCount'
                            defaultMessage='{firstUser} - {lastUser} members of {totalUsers} total'
                            values={{ firstUser: firstUserIndex, lastUser: lastUserIndex, totalUsers }}
                        />
                    )}
                     {totalUsers === 0 && ( // Placeholder or message when no users
                         <span>&nbsp;</span> // Keep space consistent
                    )}
                </span>
                 {totalPages > 1 && ( // Only show pagination if more than one page
                     <div className='pagination-controls'>
                        <button
                            onClick={handlePreviousPage}
                            disabled={currentPage === 1 || loading}
                            className='arrow'
                        >
                            <PreviousIcon/>
                        </button>
                        <span>
                            <FormattedMessage
                                id='admin.jobTable.syncResults.pagination'
                                defaultMessage='Page {currentPage} of {totalPages}'
                                values={{ currentPage, totalPages }}
                            />
                        </span>
                        <button
                            onClick={handleNextPage}
                            disabled={currentPage === totalPages || loading}
                            className='arrow'
                        >
                            <NextIcon/>
                        </button>
                    </div>
                 )}
            </div>
        </div>
    );
};

export default SyncedUserList; 