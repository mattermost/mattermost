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
import {getJob} from 'mattermost-redux/actions/jobs';
import {getTeam as fetchTeam} from 'mattermost-redux/actions/teams';
import {getAllJobs} from 'mattermost-redux/selectors/entities/jobs';

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

    const [activeTab, setActiveTab] = useState<'channels' | 'teams'>('channels');

    const pageSize = 10;

    const channelsMap = useSelector((state: GlobalState) => state.entities.channels.channels);
    const teamsMap = useSelector((state: GlobalState) => state.entities.teams.teams);
    const allJobs = useSelector(getAllJobs);

    const isChannelSyncJob = job.type === 'access_control_sync';
    const isTeamSyncJob = job.type === 'access_control_team_sync';

    // A channel sync chained from a team sync carries a back-reference to that
    // team job. The team membership changes live on the team job, so the team
    // tab is sourced from there — directly when viewing a team job, or from the
    // linked parent when viewing the channel job it spawned.
    const parentTeamJobId = job.data?.parent_team_job_id;
    const linkedTeamJob = parentTeamJobId ? allJobs[parentTeamJobId] : undefined;
    const teamResultsJob = isTeamSyncJob ? job : linkedTeamJob;

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

    // Load the linked parent team job so its results are available to parse below.
    useEffect(() => {
        if (parentTeamJobId) {
            dispatch(getJob(parentTeamJobId) as any);
        }
    }, [parentTeamJobId, dispatch]);

    // Parse team sync results from whichever job carries them.
    useEffect(() => {
        if (!teamResultsJob?.data?.sync_results) {
            return;
        }
        const parsedResults: TeamSyncResults = JSON.parse(teamResultsJob.data.sync_results);
        setTeamSyncResults(parsedResults);

        Object.keys(parsedResults).forEach((id) => {
            dispatch(fetchTeam(id) as any);
        });
    }, [teamResultsJob?.data?.sync_results, dispatch]);

    // Build channel lookup
    useEffect(() => {
        if (!syncResults) {
            return;
        }
        const channels: IDMappedObjects<Channel> = {};
        const teams: IDMappedObjects<Team> = {};
        const channelsForList: Channel[] = [];

        Object.keys(syncResults).forEach((channelId) => {
            const channel = channelsMap[channelId];
            if (channel) {
                channels[channelId] = channel;
                channelsForList.push(channel);
                if (!teams[channel.team_id]) {
                    const team = teamsMap[channel.team_id];
                    if (team) {
                        teams[team.id] = team;
                    }
                }
            }
        });

        setTeamLookup(teams);
        setChannelLookup(channels);
        setAllChannelsForList(channelsForList);
    }, [syncResults, channelsMap, teamsMap]);

    // Build team lookup
    useEffect(() => {
        if (!teamSyncResults) {
            return;
        }
        const teams: IDMappedObjects<Team> = {};
        const teamsForList: Team[] = [];

        Object.keys(teamSyncResults).forEach((teamId) => {
            const team = teamsMap[teamId];
            if (team) {
                teams[teamId] = team;
                teamsForList.push(team);
            }
        });

        setAllTeamsForList(teamsForList);
    }, [teamSyncResults, teamsMap]);

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

    const isCanceled = job.status === 'canceled';
    const isChannelCanceled = isCanceled && isChannelSyncJob;
    const isTeamCanceled = isCanceled && isTeamSyncJob;

    // Channel results may still be loading; the Channels view is relevant for
    // any channel sync job, so don't gate it on results having arrived (the tab
    // would otherwise flicker out and hide the tab strip mid-load).
    const showChannelList = job.status !== 'error' && !isChannelCanceled && isChannelSyncJob;
    const showTeamList = job.status !== 'error' && !isTeamCanceled && Boolean(teamSyncResults);
    const showTabs = showChannelList && showTeamList;

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
            {showTabs && (
                <div className='tabs'>
                    <button
                        className={`tab-button ${activeTab === 'channels' ? 'active' : ''}`}
                        onClick={() => setActiveTab('channels')}
                    >
                        <FormattedMessage
                            id='admin.jobTable.syncResults.channelsTab'
                            defaultMessage='Channels'
                        />
                    </button>
                    <button
                        className={`tab-button ${activeTab === 'teams' ? 'active' : ''}`}
                        onClick={() => setActiveTab('teams')}
                    >
                        <FormattedMessage
                            id='admin.jobTable.syncResults.teamsTab'
                            defaultMessage='Teams'
                        />
                    </button>
                </div>
            )}
            {showChannelList && (!showTabs || activeTab === 'channels') && (
                <SearchableSyncJobChannelList
                    channels={filteredChannels}
                    teams={teamLookup}
                    channelsPerPage={pageSize}
                    nextPage={() => {}}
                    isSearch={Boolean(searchTerm)}
                    search={setSearchTerm}
                    onViewDetails={handleViewChannelDetails}
                    noResultsText={noChannelResultsText}
                    syncResults={syncResults ?? {}}
                />
            )}
            {showTeamList && (!showTabs || activeTab === 'teams') && (
                <SearchableSyncJobTeamList
                    teams={filteredTeams}
                    teamsPerPage={pageSize}
                    nextPage={() => {}}
                    isSearch={Boolean(teamSearchTerm)}
                    search={setTeamSearchTerm}
                    onViewDetails={handleViewTeamDetails}
                    noResultsText={noTeamResultsText}
                    syncResults={teamSyncResults!}
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
