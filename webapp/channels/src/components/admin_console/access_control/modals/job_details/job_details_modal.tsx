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
import {getTeam as fetchTeam} from 'mattermost-redux/actions/teams';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getTeam} from 'mattermost-redux/selectors/entities/teams';

import AlertBanner from 'components/alert_banner';
import CodeBlock from 'components/code_block/code_block';

import type {GlobalState} from 'types/store';

import SearchableSyncJobChannelList from './searchable_sync_job_channel_list';
import type {SyncResults} from './searchable_sync_job_channel_list';
import SearchableSyncJobTeamList from './searchable_sync_job_team_list';
import type {TeamSyncResults} from './searchable_sync_job_team_list';

import UserListModal, {type ChannelMembersSyncResults, type TeamMembersSyncResults} from '../user_sync/user_sync_modal';

import './job_details_modal.scss';

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
    job: Job;
    onExited: () => void;
};

export default function JobDetailsModal({job, onExited}: Props): JSX.Element {
    const dispatch = useDispatch();

    // Channel sync state
    const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
    const [selectedChannelName, setSelectedChannelName] = useState<string>('');
    const [selectedChannelResults, setSelectedChannelResults] = useState<ChannelMembersSyncResults | null>(null);
    const [channelLookup, setChannelLookup] = useState<IDMappedObjects<Channel>>({});
    const [teamLookup, setTeamLookup] = useState<IDMappedObjects<Team>>({});
    const [syncResults, setSyncResults] = useState<SyncResults | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [allChannelsForList, setAllChannelsForList] = useState<Channel[]>([]);

    // Team sync state
    const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
    const [selectedTeamName, setSelectedTeamName] = useState<string>('');
    const [selectedTeamResults, setSelectedTeamResults] = useState<TeamMembersSyncResults | null>(null);
    const [teamSyncResults, setTeamSyncResults] = useState<TeamSyncResults | null>(null);
    const [teamSearchTerm, setTeamSearchTerm] = useState('');
    const [allTeamsForList, setAllTeamsForList] = useState<Team[]>([]);
    const [teamEntityLookup, setTeamEntityLookup] = useState<IDMappedObjects<Team>>({});

    const pageSize = 10;

    const state = useSelector((state: GlobalState) => state);

    const isChannelSyncJob = job.type === 'access_control_sync';
    const isTeamSyncJob = job.type === 'access_control_team_sync';

    // Parse channel sync results
    useEffect(() => {
        if (!isChannelSyncJob || !job?.data?.sync_results) {
            return;
        }
        const parsedResults = JSON.parse(job.data.sync_results);
        setSyncResults(parsedResults);

        const channelIds: string[] = Object.keys(parsedResults);
        channelIds.forEach((id) => {
            dispatch(ChannelActions.getChannel(id));
        });
    }, [job?.data?.sync_results, isChannelSyncJob, dispatch]);

    // Parse team sync results
    useEffect(() => {
        if (!isTeamSyncJob || !job?.data?.sync_results) {
            return;
        }
        const parsedResults: TeamSyncResults = JSON.parse(job.data.sync_results);
        setTeamSyncResults(parsedResults);

        const teamIds: string[] = Object.keys(parsedResults);
        teamIds.forEach((id) => {
            dispatch(fetchTeam(id) as any);
        });
    }, [job?.data?.sync_results, isTeamSyncJob, dispatch]);

    // Build channel lookup
    useEffect(() => {
        if (!syncResults) {
            return;
        }
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
    }, [syncResults, state]);

    // Build team lookup
    useEffect(() => {
        if (!teamSyncResults) {
            return;
        }
        const teams: IDMappedObjects<Team> = {};
        const teamsForList: Team[] = [];

        Object.keys(teamSyncResults).forEach((teamId) => {
            const team = getTeam(state, teamId);
            if (team) {
                teams[teamId] = team;
                teamsForList.push(team);
            }
        });

        setTeamEntityLookup(teams);
        setAllTeamsForList(teamsForList);
    }, [teamSyncResults, state]);

    const handleViewChannelDetails = (channelId: string, channelName: string, results: ChannelMembersSyncResults) => {
        setSelectedChannel(channelId);
        setSelectedChannelName(channelName);
        setSelectedChannelResults(results);
    };

    const handleCloseChannelUserListModal = () => {
        setSelectedChannel(null);
        setSelectedChannelName('');
        setSelectedChannelResults(null);
    };

    const handleViewTeamDetails = (teamId: string, teamName: string, results: TeamMembersSyncResults) => {
        setSelectedTeam(teamId);
        setSelectedTeamName(teamName);
        setSelectedTeamResults(results);
    };

    const handleCloseTeamUserListModal = () => {
        setSelectedTeam(null);
        setSelectedTeamName('');
        setSelectedTeamResults(null);
    };

    const getFilteredChannels = () => {
        let channels = allChannelsForList;
        if (searchTerm) {
            channels = channels.filter((channel) =>
                channel.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                channel.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (channelLookup[channel.id] && teamLookup[channelLookup[channel.id].team_id]?.name.toLowerCase().includes(searchTerm.toLowerCase())),
            );
        }
        return channels;
    };

    const getFilteredTeams = () => {
        let teams = allTeamsForList;
        if (teamSearchTerm) {
            teams = teams.filter((team) =>
                team.display_name.toLowerCase().includes(teamSearchTerm.toLowerCase()) ||
                team.name.toLowerCase().includes(teamSearchTerm.toLowerCase()),
            );
        }
        return teams;
    };

    const filteredChannels = getFilteredChannels();
    const filteredTeams = getFilteredTeams();

    const noChannelResultsText = (
        <span className='no-results-message'>
            <FormattedMessage
                id='admin.jobTable.syncResults.noResultsSearchable'
                defaultMessage='No channels match your search or filter.'
            />
        </span>
    );

    const noTeamResultsText = (
        <span className='no-results-message'>
            <FormattedMessage
                id='admin.jobTable.syncResults.teams.noResultsSearchable'
                defaultMessage='No teams match your search or filter.'
            />
        </span>
    );

    const isCanceled = job.status === 'canceled';
    const isChannelCanceled = isCanceled && isChannelSyncJob;
    const isTeamCanceled = isCanceled && isTeamSyncJob;

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
                    {isCanceled && (isChannelSyncJob || isTeamSyncJob) ? (
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
            {isChannelCanceled && (
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
            {isTeamCanceled && (
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
                                id='admin.access_control.jobTable.syncResults.teams.canceled.message'
                                defaultMessage='This sync job was canceled, likely because a newer sync job was started for the same team. Team members were not updated.'
                            />
                        }
                    />
                </div>
            )}
            {job.status !== 'error' && !isChannelCanceled && isChannelSyncJob && syncResults && (
                <SearchableSyncJobChannelList
                    channels={filteredChannels}
                    teams={teamLookup}
                    channelsPerPage={pageSize}
                    nextPage={() => {}}
                    isSearch={Boolean(searchTerm)}
                    search={setSearchTerm}
                    onViewDetails={handleViewChannelDetails}
                    noResultsText={noChannelResultsText}
                    syncResults={syncResults}
                />
            )}
            {job.status !== 'error' && !isTeamCanceled && isTeamSyncJob && teamSyncResults && (
                <SearchableSyncJobTeamList
                    teams={filteredTeams}
                    teamsPerPage={pageSize}
                    nextPage={() => {}}
                    isSearch={Boolean(teamSearchTerm)}
                    search={setTeamSearchTerm}
                    onViewDetails={handleViewTeamDetails}
                    noResultsText={noTeamResultsText}
                    syncResults={teamSyncResults}
                />
            )}
            {selectedChannel && selectedChannelResults && (
                <UserListModal
                    channelId={selectedChannel}
                    channelName={selectedChannelName}
                    syncResults={selectedChannelResults}
                    resourceType='channel'
                    onClose={handleCloseChannelUserListModal}
                />
            )}
            {selectedTeam && selectedTeamResults && (
                <UserListModal
                    channelId={selectedTeam}
                    channelName={selectedTeamName}
                    syncResults={selectedTeamResults}
                    resourceType='team'
                    onClose={handleCloseTeamUserListModal}
                />
            )}
        </GenericModal>
    );
}
