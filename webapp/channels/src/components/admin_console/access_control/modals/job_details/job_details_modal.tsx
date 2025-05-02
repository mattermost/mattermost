// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';
import {Table} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import type {Channel} from '@mattermost/types/channels';
import type {Job} from '@mattermost/types/jobs';

import * as ChannelActions from 'mattermost-redux/actions/channels';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';

import NextIcon from 'components/widgets/icons/fa_next_icon';
import PreviousIcon from 'components/widgets/icons/fa_previous_icon';

import type {GlobalState} from 'types/store';

import UserListModal, {type ChannelMembersSyncResults} from '../user_sync/user_sync_modal';

import './job_details_modal.scss';

// Types for sync results
type SyncResults = {
    [channelId: string]: ChannelMembersSyncResults;
};

// Lookup structures for channel and user names
type ChannelLookup = {
    [channelId: string]: Channel;
};

// Component to display job status
type StatusIndicatorProps = {
    status: string;
};

const StatusIndicator = ({status}: StatusIndicatorProps): JSX.Element => {
    let statusClass = 'status-indicator';

    if (status === 'success') {
        statusClass += ' status-success';
    } else if (status === 'error' || status === 'canceled') {
        statusClass += ' status-error';
    } else if (status === 'in_progress') {
        statusClass += ' status-in-progress';
    } else {
        statusClass += ' status-pending';
    }

    return (
        <div className='status-wrapper'>
            <div
                className={statusClass}
                title={status}
            />
        </div>
    );
};

// Component to display sync results
type SyncResultsProps = {
    syncResults: SyncResults;
    channelLookup: ChannelLookup;
    onViewDetails: (channelId: string, channelName: string, results: ChannelMembersSyncResults) => void;
    currentPage: number;
    pageSize: number;
    onPageChange: (page: number) => void;
};

const SyncResultsTable = ({syncResults, channelLookup, onViewDetails, currentPage, pageSize, onPageChange}: SyncResultsProps): JSX.Element => {
    if (!syncResults || Object.keys(syncResults).length === 0) {
        return (
            <div className='no-results-message'>
                <FormattedMessage
                    id='admin.jobTable.syncResults.noResults'
                    defaultMessage='No results available'
                />
            </div>
        );
    }

    const totalEntries = Object.entries(syncResults);
    const totalPages = Math.ceil(totalEntries.length / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalEntries.length);
    const currentEntries = totalEntries.slice(startIndex, endIndex);

    return (
        <>
            <Table className='sync-results-table'>
                <thead>
                    <tr>
                        <th>
                            <FormattedMessage
                                id='admin.jobTable.syncResults.channel'
                                defaultMessage='Channel'
                            />
                        </th>
                        <th className='changes-column'>
                            <FormattedMessage
                                id='admin.jobTable.syncResults.changes'
                                defaultMessage='Changes'
                            />
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {currentEntries.map(([channelId, results]) => {
                        const channel = channelLookup[channelId];
                        const displayName = channel ? channel.display_name : channelId;

                        return (
                            <tr
                                key={channelId}
                                onClick={() => onViewDetails(channelId, displayName, results)}
                                className='clickable-row'
                            >
                                <td>
                                    <div className='channel-name'>
                                        {displayName}
                                        {channel && <div className='channel-id'>{'('}{channelId}{')'}</div>}
                                    </div>
                                </td>
                                <td>
                                    <span className='changes-summary'>
                                        <span className='added'>
                                            {'+'}{results.MembersAdded.length}
                                        </span>
                                        {' / '}
                                        <span className='removed'>
                                            {'-'}{results.MembersRemoved.length}
                                        </span>
                                    </span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </Table>
            {totalPages > 1 && (
                <div className='pagination-controls'>
                    <span className='member-count-text'>
                        <FormattedMessage
                            id='admin.jobTable.syncResults.memberCountRange'
                            defaultMessage='{firstUser} - {lastUser} of {totalUsers} total'
                            values={{firstUser: startIndex + 1, lastUser: endIndex, totalUsers: totalEntries.length}}
                        />
                    </span>
                    <div className='pagination-controls-buttons'>
                        <button
                            onClick={() => onPageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            className='arrow'
                            aria-label='Previous Page'
                        >
                            <PreviousIcon/>
                        </button>
                        <span>
                            <FormattedMessage
                                id='admin.jobTable.syncResults.pagination'
                                defaultMessage='Page {currentPage} of {totalPages}'
                                values={{currentPage, totalPages}}
                            />
                        </span>
                        <button
                            onClick={() => onPageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className='arrow'
                            aria-label='Next Page'
                        >
                            <NextIcon/>
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

type Props = {
    job: Job ;
    onExited: () => void;
};

export default function JobDetailsModal({job, onExited}: Props): JSX.Element {
    const dispatch = useDispatch();
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
    const [selectedChannelName, setSelectedChannelName] = useState<string>('');
    const [selectedChannelResults, setSelectedChannelResults] = useState<ChannelMembersSyncResults | null>(null);
    const [channelLookup, setChannelLookup] = useState<ChannelLookup>({});
    const [syncResults, setSyncResults] = useState<SyncResults | null>(null);

    const pageSize = 5;

    // Get state for lookups
    const state = useSelector((state: GlobalState) => state);

    // Parse sync results initially
    useEffect(() => {
        if (job?.data?.sync_results) {
            const parsedResults = JSON.parse(job.data.sync_results);
            setSyncResults(parsedResults);

            // Collect all channel IDs and user IDs for lookup
            const channelIds: string[] = [];
            const userIds: string[] = [];

            // Use a safer type cast for Object.entries
            Object.entries(parsedResults).forEach((entry) => {
                const channelId = entry[0];
                const results = entry[1] as ChannelMembersSyncResults;

                channelIds.push(channelId);

                // Collect all user IDs from added and removed lists
                if (results.MembersAdded) {
                    userIds.push(...results.MembersAdded);
                }
                if (results.MembersRemoved) {
                    userIds.push(...results.MembersRemoved);
                }
            });

            // Fetch channel and user data if we have IDs
            if (channelIds.length > 0) {
                // Fetch each channel individually
                channelIds.forEach((id) => {
                    dispatch(ChannelActions.getChannel(id));
                });
            }
        }
    }, [job?.data?.sync_results, dispatch]);

    // Build channel lookup from state
    useEffect(() => {
        if (syncResults) {
            const channels: ChannelLookup = {};

            Object.keys(syncResults).forEach((channelId) => {
                const channel = getChannel(state, channelId);
                if (channel) {
                    channels[channelId] = channel;
                }
            });

            setChannelLookup(channels);
        }
    }, [syncResults, state]);

    const handleViewDetails = (channelId: string, channelName: string, results: ChannelMembersSyncResults) => {
        setSelectedChannel(channelId);
        setSelectedChannelName(channelName);
        setSelectedChannelResults(results);
    };

    const handleCloseUserListModal = () => {
        setSelectedChannel(null);
        setSelectedChannelName('');
        setSelectedChannelResults(null);
    };

    const handlePageChange = (newPage: number) => {
        setCurrentPage(newPage);
    };

    return (
        <GenericModal
            className='job-details-modal'
            onExited={onExited}
            modalHeaderText={
                <div className='modal-header-custom'>
                    <div className='modal-header-with-status'>
                        <FormattedMessage
                            id='admin.jobTable.details.title'
                            defaultMessage='Job Details'
                        />
                        <StatusIndicator status={job.status}/>
                    </div>
                    <div className='close-icon-container'>
                        <i
                            className='icon icon-close'
                            onClick={onExited}
                            aria-label='Close'
                            role='button'
                            tabIndex={0}
                        />
                    </div>
                </div>
            }
            show={true}
            showHeader={false}
        >
            <div className='job-details-modal-body'>
                {job.type.includes('access_control_sync') && (
                    <SyncResultsTable
                        syncResults={syncResults || {}}
                        channelLookup={channelLookup}
                        onViewDetails={handleViewDetails}
                        currentPage={currentPage}
                        pageSize={pageSize}
                        onPageChange={handlePageChange}
                    />
                )}
            </div>
            {selectedChannel && selectedChannelResults && (
                <UserListModal
                    channelId={selectedChannel}
                    channelName={selectedChannelName}
                    syncResults={selectedChannelResults}
                    onClose={handleCloseUserListModal}
                />
            )}
        </GenericModal>
    );
}
