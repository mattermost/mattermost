// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import type {Channel} from '@mattermost/types/channels';
import type {Job} from '@mattermost/types/jobs';
import type {Team} from '@mattermost/types/teams';
import type {IDMappedObjects} from '@mattermost/types/utilities';

import * as ChannelActions from 'mattermost-redux/actions/channels';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getTeam} from 'mattermost-redux/selectors/entities/teams';

import DataGrid, {type Column, type Row} from 'components/admin_console/data_grid/data_grid';

import type {GlobalState} from 'types/store';

import UserListModal, {type ChannelMembersSyncResults} from '../user_sync/user_sync_modal';

import './job_details_modal.scss';

// Types for sync results
type SyncResults = {
    [channelId: string]: ChannelMembersSyncResults;
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
    channelLookup: IDMappedObjects<Channel>;
    teamLookup: IDMappedObjects<Team>;
    onViewDetails: (channelId: string, channelName: string, results: ChannelMembersSyncResults) => void;
    currentPage: number;
    pageSize: number;
    onPageChange: (page: number) => void;
};

const SyncResultsTable = ({syncResults, channelLookup, teamLookup, onViewDetails, currentPage, pageSize, onPageChange}: SyncResultsProps): JSX.Element => {
    const intl = useIntl();

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
    const totalRows = totalEntries.length;

    // const totalPages = Math.ceil(totalRows / pageSize); // DataGrid handles its own display of pages
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalRows);
    const currentEntries = totalEntries.slice(startIndex, endIndex);

    const columns: Column[] = [
        {
            name: intl.formatMessage({id: 'admin.jobTable.syncResults.channel', defaultMessage: 'Channel'}),
            field: 'channel',
            width: 0.85,
        },
        {
            name: intl.formatMessage({id: 'admin.jobTable.syncResults.changes', defaultMessage: 'Changes'}),
            field: 'changes',
            width: 0.15,
        },
    ];

    const rows: Row[] = currentEntries.map(([channelId, results]) => {
        const channel = channelLookup[channelId];
        const team = teamLookup[channel?.team_id];
        const displayName = channel ? channel.display_name : channelId;
        return {

            // id: channelId, // DataGrid Row does not have an id property, click is handled by onClick on Row
            cells: {
                channel: (
                    <div className='channel-name-cell'>
                        {displayName}
                        {channel && team && <span className='team-name'>{`(${team.name})`}</span>}
                    </div>
                ),
                changes: (
                    <div className='changes-cell'>
                        <span className='changes-summary'>
                            <span className='added'>
                                {'+' + results.MembersAdded.length}
                            </span>
                            {' / '}
                            <span className='removed'>
                                {'-' + results.MembersRemoved.length}
                            </span>
                        </span>
                    </div>
                ),
            },
            onClick: () => onViewDetails(channelId, displayName, results),
        };
    });

    return (
        <DataGrid
            columns={columns}
            rows={rows}
            loading={false} // Assuming not loading once we have syncResults. This might need to be dynamic.
            page={currentPage}
            startCount={startIndex + 1}
            endCount={endIndex}
            total={totalRows}
            nextPage={() => onPageChange(currentPage + 1)}
            previousPage={() => onPageChange(currentPage - 1)}
            className='sync-results-datagrid'
        />
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
    const [channelLookup, setChannelLookup] = useState<IDMappedObjects<Channel>>({});
    const [teamLookup, setTeamLookup] = useState<IDMappedObjects<Team>>({});
    const [syncResults, setSyncResults] = useState<SyncResults | null>(null);

    const pageSize = 10;

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
            const channels: IDMappedObjects<Channel> = {};
            const teams: IDMappedObjects<Team> = {};

            Object.keys(syncResults).forEach((channelId) => {
                const channel = getChannel(state, channelId);
                if (channel) {
                    channels[channelId] = channel;
                    if (!teams[channel.team_id]) {
                        const team = getTeam(state, channel.team_id);
                        if (team) {
                            teams[team.id] = team;
                        }
                    }
                }
            });

            setTeamLookup(teams);

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
            className='JobDetailsModal'
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
                        teamLookup={teamLookup}
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
