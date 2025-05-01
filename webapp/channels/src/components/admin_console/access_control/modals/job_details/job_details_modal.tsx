// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';
import {FormattedDate, FormattedMessage, FormattedTime} from 'react-intl';
import {Table} from 'react-bootstrap';
import {useDispatch, useSelector} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import type {Job} from '@mattermost/types/jobs';
import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';
import {ChevronDownIcon, ChevronRightIcon} from '@mattermost/compass-icons/components';

import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getUser} from 'mattermost-redux/selectors/entities/users';
import * as ChannelActions from 'mattermost-redux/actions/channels';
import {getProfilesByIds} from 'mattermost-redux/actions/users';

import type {GlobalState} from 'types/store';

import './job_details_modal.scss';

// Types for sync results
type ChannelMembersSyncResults = {
    MembersAdded: string[];
    MembersRemoved: string[];
};

type SyncResults = {
    [channelId: string]: ChannelMembersSyncResults;
};

// Lookup structures for channel and user names
type ChannelLookup = {
    [channelId: string]: Channel;
};

type UserLookup = {
    [userId: string]: UserProfile;
};

// Modal for showing detailed user lists
type UserListModalProps = {
    channelId: string;
    channelName: string;
    syncResults: ChannelMembersSyncResults;
    userLookup: UserLookup;
    onClose: () => void;
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
            <div className={statusClass} title={status} />
        </div>
    );
};

// Format user display name
const formatUserName = (user?: UserProfile): string => {
    if (!user) {
        return 'Unknown User';
    }
    
    if (user.first_name && user.last_name) {
        return `${user.first_name} ${user.last_name} (@${user.username})`;
    }
    
    return `@${user.username}`;
};

const UserListModal = ({channelId, channelName, syncResults, userLookup, onClose}: UserListModalProps): JSX.Element => {
    const [activeTab, setActiveTab] = useState<'added' | 'removed'>('added');
    
    const handleTabChange = (tab: 'added' | 'removed') => {
        setActiveTab(tab);
    };

    const displayName = channelName || channelId;

    return (
        <GenericModal
            onExited={onClose}
            modalHeaderText={
                <FormattedMessage
                    id='admin.jobTable.syncResults.userListTitle'
                    defaultMessage='Channel Members Changes - {channelName}'
                    values={{
                        channelName: displayName,
                    }}
                />
            }
            show={true}
        >
            <div className='UserListModal'>
                <div className='tabs'>
                    <button
                        className={`tab-button ${activeTab === 'added' ? 'active' : ''}`}
                        onClick={() => handleTabChange('added')}
                    >
                        <FormattedMessage
                            id='admin.jobTable.syncResults.added'
                            defaultMessage='Added ({count})'
                            values={{
                                count: syncResults.MembersAdded.length,
                            }}
                        />
                    </button>
                    <button 
                        className={`tab-button ${activeTab === 'removed' ? 'active' : ''}`}
                        onClick={() => handleTabChange('removed')}
                    >
                        <FormattedMessage
                            id='admin.jobTable.syncResults.removed'
                            defaultMessage='Removed ({count})'
                            values={{
                                count: syncResults.MembersRemoved.length,
                            }}
                        />
                    </button>
                </div>
                <div className='tab-content'>
                    {activeTab === 'added' && (
                        <div className='user-list'>
                            {syncResults.MembersAdded.length === 0 ? (
                                <div className='no-results'>
                                    <FormattedMessage
                                        id='admin.jobTable.syncResults.noUsersAdded'
                                        defaultMessage='No users were added'
                                    />
                                </div>
                            ) : (
                                <ul>
                                    {syncResults.MembersAdded.map((userId) => (
                                        <li key={userId}>
                                            {formatUserName(userLookup[userId])}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                    {activeTab === 'removed' && (
                        <div className='user-list'>
                            {syncResults.MembersRemoved.length === 0 ? (
                                <div className='no-results'>
                                    <FormattedMessage
                                        id='admin.jobTable.syncResults.noUsersRemoved'
                                        defaultMessage='No users were removed'
                                    />
                                </div>
                            ) : (
                                <ul>
                                    {syncResults.MembersRemoved.map((userId) => (
                                        <li key={userId}>
                                            {formatUserName(userLookup[userId])}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </GenericModal>
    );
};

// Component to display sync results
type SyncResultsProps = {
    syncResults: SyncResults;
    channelLookup: ChannelLookup;
    onViewDetails: (channelId: string, channelName: string, results: ChannelMembersSyncResults) => void;
};

const SyncResultsTable = ({syncResults, channelLookup, onViewDetails}: SyncResultsProps): JSX.Element => {
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

    return (
        <Table className='sync-results-table'>
            <thead>
                <tr>
                    <th>
                        <FormattedMessage
                            id='admin.jobTable.syncResults.channel'
                            defaultMessage='Channel'
                        />
                    </th>
                    <th>
                        <FormattedMessage
                            id='admin.jobTable.syncResults.changes'
                            defaultMessage='Changes'
                        />
                    </th>
                </tr>
            </thead>
            <tbody>
                {Object.entries(syncResults).map(([channelId, results]) => {
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
                                    {channel && <div className='channel-id'>({channelId})</div>}
                                </div>
                            </td>
                            <td>
                                <span className='changes-summary'>
                                    <span className='added'>
                                        +{results.MembersAdded.length}
                                    </span>
                                    {' / '}
                                    <span className='removed'>
                                        -{results.MembersRemoved.length}
                                    </span>
                                </span>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </Table>
    );
};

type CollapsibleSectionProps = {
    title: React.ReactNode;
    children: React.ReactNode;
    defaultExpanded?: boolean;
};

const CollapsibleSection = ({title, children, defaultExpanded = false}: CollapsibleSectionProps) => {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    return (
        <div className='collapsible-section'>
            <div className='collapsible-header' onClick={() => setIsExpanded(!isExpanded)}>
                {isExpanded ? <ChevronDownIcon size={16}/> : <ChevronRightIcon size={16}/>}
                <span className='collapsible-title'>{title}</span>
            </div>
            {isExpanded && (
                <div className='collapsible-content'>
                    {children}
                </div>
            )}
        </div>
    );
};

type Props = {
    job: Job | null;
    onExited: () => void;
};

export default function JobDetailsModal({job, onExited}: Props): JSX.Element {
    const dispatch = useDispatch();
    const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
    const [selectedChannelName, setSelectedChannelName] = useState<string>('');
    const [selectedChannelResults, setSelectedChannelResults] = useState<ChannelMembersSyncResults | null>(null);
    const [channelLookup, setChannelLookup] = useState<ChannelLookup>({});
    const [userLookup, setUserLookup] = useState<UserLookup>({});
    const [syncResults, setSyncResults] = useState<SyncResults | null>(null);
    
    // Get state for lookups
    const state = useSelector((state: GlobalState) => state);
    
    // Parse sync results initially
    useEffect(() => {
        if (job?.data?.sync_results) {
            try {
                console.log('Sync results raw data:', job.data.sync_results);
                const parsedResults = JSON.parse(job.data.sync_results);
                console.log('Parsed sync results:', parsedResults);
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
                
                if (userIds.length > 0) {
                    dispatch(getProfilesByIds(userIds));
                }
            } catch (e) {
                console.error('Error parsing sync_results:', e);
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
    
    // Build user lookup from state
    useEffect(() => {
        if (syncResults) {
            const users: UserLookup = {};
            
            Object.values(syncResults).forEach((results) => {
                // Add users from both added and removed lists
                [...results.MembersAdded, ...results.MembersRemoved].forEach((userId) => {
                    const user = getUser(state, userId);
                    if (user) {
                        users[userId] = user;
                    }
                });
            });
            
            setUserLookup(users);
        }
    }, [syncResults, state]);
    
    if (!job) {
        return (
            <GenericModal
                onExited={onExited}
                modalHeaderText='Job Details'
                show={true}
            >
                <div className='JobDetailsModal'>
                    <p>
                        <FormattedMessage
                            id='admin.jobTable.details.noJobSelected'
                            defaultMessage='No job selected'
                        />
                    </p>
                </div>
            </GenericModal>
        );
    }

    const createDate = new Date(job.create_at);
    const startDate = job.start_at ? new Date(job.start_at) : null;
    const lastActivityDate = job.last_activity_at ? new Date(job.last_activity_at) : null;

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

    return (
        <>
            <GenericModal
                onExited={onExited}
                modalHeaderText={
                    <div className='modal-header-with-status'>
                        <FormattedMessage
                            id='admin.jobTable.details.title'
                            defaultMessage='Job Details'
                        />
                        <StatusIndicator status={job.status} />
                    </div>
                }
                show={true}
            >
                <div className='JobDetailsModal'>
                    {/* Detailed job information - in collapsible section */}
                    <CollapsibleSection 
                        title={
                            <FormattedMessage
                                id='admin.jobTable.details.additionalDetails'
                                defaultMessage='Additional Details'
                            />
                        }
                    >
                        <div className='details-row'>
                            <div className='details-label'>
                                <FormattedMessage
                                    id='admin.jobTable.details.jobId'
                                    defaultMessage='Job ID:'
                                />
                            </div>
                            <div className='details-value'>{job.id}</div>
                        </div>
                        <div className='details-row'>
                            <div className='details-label'>
                                <FormattedMessage
                                    id='admin.jobTable.details.createAt'
                                    defaultMessage='Created:'
                                />
                            </div>
                            <div className='details-value'>
                                <FormattedDate value={createDate}/> <FormattedTime value={createDate}/>
                            </div>
                        </div>
                        {startDate && (
                            <div className='details-row'>
                                <div className='details-label'>
                                    <FormattedMessage
                                        id='admin.jobTable.details.startAt'
                                        defaultMessage='Started:'
                                    />
                                </div>
                                <div className='details-value'>
                                    <FormattedDate value={startDate}/> <FormattedTime value={startDate}/>
                                </div>
                            </div>
                        )}
                        {lastActivityDate && (
                            <div className='details-row'>
                                <div className='details-label'>
                                    <FormattedMessage
                                        id='admin.jobTable.details.lastActivityAt'
                                        defaultMessage='Last Activity:'
                                    />
                                </div>
                                <div className='details-value'>
                                    <FormattedDate value={lastActivityDate}/> <FormattedTime value={lastActivityDate}/>
                                </div>
                            </div>
                        )}
                        <div className='details-row'>
                            <div className='details-label'>
                                <FormattedMessage
                                    id='admin.jobTable.details.progress'
                                    defaultMessage='Progress:'
                                />
                            </div>
                            <div className='details-value'>{job.progress}</div>
                        </div>
                        <div className='details-row'>
                            <div className='details-label'>
                                <FormattedMessage
                                    id='admin.jobTable.details.status'
                                    defaultMessage='Status:'
                                />
                            </div>
                            <div className='details-value'>{job.status}</div>
                        </div>
                    </CollapsibleSection>

                    {/* Job data - in collapsible section */}
                    {job.data && Object.keys(job.data).length > 0 && 
                     !job.type.includes('access_control_sync') && (
                        <CollapsibleSection 
                            title={
                                <FormattedMessage
                                    id='admin.jobTable.details.data'
                                    defaultMessage='Data:'
                                />
                            }
                        >
                            <div className='details-value'>
                                <pre>{JSON.stringify(job.data, null, 2)}</pre>
                            </div>
                        </CollapsibleSection>
                    )}
                    
                    {/* Sync Results Section */}
                    {(job.type.includes('access_control_sync')) && (
                        <CollapsibleSection 
                            title={
                                <FormattedMessage
                                    id='admin.jobTable.details.syncResults'
                                    defaultMessage='Sync Results:'
                                />
                            }
                            defaultExpanded={true}
                        >
                            <div className='details-value'>
                                <SyncResultsTable 
                                    syncResults={syncResults || {}} 
                                    channelLookup={channelLookup}
                                    onViewDetails={handleViewDetails}
                                />
                            </div>
                        </CollapsibleSection>
                    )}
                </div>
            </GenericModal>
            
            {selectedChannel && selectedChannelResults && (
                <UserListModal
                    channelId={selectedChannel}
                    channelName={selectedChannelName}
                    syncResults={selectedChannelResults}
                    userLookup={userLookup}
                    onClose={handleCloseUserListModal}
                />
            )}
        </>
    );
}
