// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import type {Channel} from '@mattermost/types/channels';
import type {Job} from '@mattermost/types/jobs';
import type {Team} from '@mattermost/types/teams';
import type {IDMappedObjects} from '@mattermost/types/utilities';

import * as ChannelActions from 'mattermost-redux/actions/channels';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getTeam} from 'mattermost-redux/selectors/entities/teams';

import AlertBanner from 'components/alert_banner';
import CodeBlock from 'components/code_block/code_block';

import type {GlobalState} from 'types/store';

import SearchableSyncJobChannelList from './searchable_sync_job_channel_list';
import type {SyncResults} from './searchable_sync_job_channel_list';

import UserListModal, {type ChannelMembersSyncResults} from '../user_sync/user_sync_modal';

import './job_details_modal.scss';

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

type Props = {
    job: Job ;
    onExited: () => void;
};

export default function JobDetailsModal({job, onExited}: Props): JSX.Element {
    const dispatch = useDispatch();
    const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
    const [selectedChannelName, setSelectedChannelName] = useState<string>('');
    const [selectedChannelResults, setSelectedChannelResults] = useState<ChannelMembersSyncResults | null>(null);
    const [channelLookup, setChannelLookup] = useState<IDMappedObjects<Channel>>({});
    const [teamLookup, setTeamLookup] = useState<IDMappedObjects<Team>>({});
    const [syncResults, setSyncResults] = useState<SyncResults | null>(null);
    const [teamSyncResults, setTeamSyncResults] = useState<Record<string, ChannelMembersSyncResults> | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [allChannelsForList, setAllChannelsForList] = useState<Channel[]>([]);

    const pageSize = 10;

    // Get state for lookups
    const state = useSelector((state: GlobalState) => state);

    // Parse sync results initially
    useEffect(() => {
        if (job?.data?.sync_results) {
            const parsedResults = JSON.parse(job.data.sync_results);
            setSyncResults(parsedResults);

            const channelIds: string[] = [];
            Object.entries(parsedResults).forEach((entry) => {
                channelIds.push(entry[0]);
            });

            if (channelIds.length > 0) {
                channelIds.forEach((id) => {
                    dispatch(ChannelActions.getChannel(id));
                });
            }
        }

        if (job?.data?.team_sync_results) {
            try {
                const parsedTeamResults = JSON.parse(job.data.team_sync_results);
                setTeamSyncResults(parsedTeamResults);
            } catch {
                setTeamSyncResults(null);
            }
        }
    }, [job?.data?.sync_results, job?.data?.team_sync_results, dispatch]);

    // Build channel lookup from state and prepare allChannelsForList
    useEffect(() => {
        if (syncResults) {
            const channels: IDMappedObjects<Channel> = {};
            const teams: IDMappedObjects<Team> = {};
            const channelsForList: Channel[] = [];

            Object.keys(syncResults).forEach((channelId) => {
                const channel = getChannel(state, channelId);
                if (channel) {
                    channels[channelId] = channel;
                    channelsForList.push(channel);
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
            setAllChannelsForList(channelsForList);
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

    // Filter and search channels for SearchableSyncJobChannelList
    const getFilteredChannels = () => {
        let channels = allChannelsForList;

        if (searchTerm) {
            channels = channels.filter((channel) =>
                channel.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                channel.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (channelLookup[channel.id] && teamLookup[channelLookup[channel.id].team_id]?.name.toLowerCase().includes(searchTerm.toLowerCase())),
            );
        }

        // Add filtering by type (Public, Private, Archived) if needed based on currentFilter
        // For now, it shows all channels from syncResults
        return channels;
    };

    const filteredChannels = getFilteredChannels();

    const noResultsText = (
        <span className='no-results-message'>
            <FormattedMessage
                id='admin.jobTable.syncResults.noResultsSearchable'
                defaultMessage='No channels match your search or filter.'
            />
        </span>
    );

    return (
        <GenericModal
            id='job-details-modal'
            onExited={onExited}
            compassDesign={true}
            modalHeaderText={
                <div className='modal-header-with-status'>
                    <FormattedMessage
                        id='admin.jobTable.details.title'
                        defaultMessage='Job Details'
                    />
                    <StatusIndicator status={job.status}/>
                </div>
            }
            modalSubheaderText={
                <div className='modal-subheader-text'>
                    {job.status === 'canceled' && job.type.includes('access_control_sync') ? (
                        <FormattedMessage
                            id='admin.access_control.jobTable.details.subheader.canceled'
                            defaultMessage='Canceled at {canceledAt}'
                            values={{
                                canceledAt: new Date(job.last_activity_at).toLocaleString(),
                            }}
                        />
                    ) : (
                        <FormattedMessage
                            id='admin.access_control.jobTable.details.subheader'
                            defaultMessage='Finished at {finishedAt}'
                            values={{
                                finishedAt: new Date(job.last_activity_at).toLocaleString(),
                            }}
                        />
                    )}
                </div>
            }
            show={true}
            bodyPadding={false}
        >
            {job.status === 'error' && (
                <div className='error-status-content'>
                    <div className='error-status-content__title'>
                        <FormattedMessage
                            id='admin.jobTable.syncResults.error'
                            defaultMessage='An error occurred while syncing the channels.'
                        />
                    </div>
                    <CodeBlock
                        code={JSON.stringify(job.data, null, 2)}
                        language='json'
                    />
                </div>
            )}
            {job.status === 'canceled' && job.type.includes('access_control_sync') && (
                <div className='canceled-status-content'>
                    <AlertBanner
                        mode='warning'
                        variant='app'
                        title={
                            <FormattedMessage
                                id='admin.access_control.jobTable.syncResults.canceled.title'
                                defaultMessage='Job Canceled'
                            />
                        }
                        message={
                            <FormattedMessage
                                id='admin.access_control.jobTable.syncResults.canceled.message'
                                defaultMessage='This sync job was canceled, likely because a newer sync job was started for the same channel. Channel members were not updated.'
                            />
                        }
                    />
                </div>
            )}
            {job.status !== 'error' && !(job.status === 'canceled' && job.type.includes('access_control_sync')) && job.type.includes('access_control_sync') && teamSyncResults && Object.keys(teamSyncResults).length > 0 && (
                <div style={{padding: '16px 24px', borderBottom: '1px solid rgba(var(--center-channel-color-rgb), 0.08)'}}>
                    <h4 style={{margin: '0 0 12px', fontSize: 14, fontWeight: 600}}>
                        <FormattedMessage
                            id='admin.jobTable.syncResults.teamSection'
                            defaultMessage='Team Sync Results'
                        />
                    </h4>
                    {Object.entries(teamSyncResults).map(([teamId, results]) => {
                        const team = getTeam(state, teamId);
                        const teamName = team?.display_name || teamId;
                        const added = (results as ChannelMembersSyncResults).MembersAdded?.length || 0;
                        const removed = (results as ChannelMembersSyncResults).MembersRemoved?.length || 0;
                        return (
                            <div
                                key={teamId}
                                style={{display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(var(--center-channel-color-rgb), 0.04)'}}
                            >
                                <span style={{fontWeight: 500}}>{teamName}</span>
                                <span style={{color: 'rgba(var(--center-channel-color-rgb), 0.64)', fontSize: 13}}>
                                    {added > 0 && `+${added} added`}
                                    {added > 0 && removed > 0 && ', '}
                                    {removed > 0 && `-${removed} removed`}
                                    {added === 0 && removed === 0 && 'No changes'}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}

            {job.status !== 'error' && !(job.status === 'canceled' && job.type.includes('access_control_sync')) && job.type.includes('access_control_sync') && syncResults && (
                <SearchableSyncJobChannelList
                    channels={filteredChannels}
                    teams={teamLookup}
                    channelsPerPage={pageSize}
                    nextPage={() => {}}
                    isSearch={Boolean(searchTerm)}
                    search={setSearchTerm}
                    onViewDetails={handleViewDetails}
                    noResultsText={noResultsText}
                    syncResults={syncResults}
                />
            )}

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
