// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {FormattedMessage} from 'react-intl';

import {GenericModal} from '@mattermost/components';

import {getProfilesByIds} from 'mattermost-redux/actions/users';

import {SyncedUserList} from './synced_user_list';

import './user_sync_modal.scss';

export type ChannelMembersSyncResults = {
    MembersAdded: string[];
    MembersRemoved: string[];
};

export type TeamMembersSyncResults = {
    MembersAdded: string[];
    MembersRemoved: string[];
    MassRemovalWarning: boolean;
};

type UserListModalProps = {
    channelId: string;
    channelName: string;
    syncResults: ChannelMembersSyncResults | TeamMembersSyncResults;
    resourceType?: 'channel' | 'team';
    onClose: () => void;
};

export const UserListModal = ({channelId, channelName, syncResults, resourceType = 'channel', onClose}: UserListModalProps): JSX.Element => {
    const [activeTab, setActiveTab] = useState<'added' | 'removed'>('added');

    const handleTabChange = (tab: 'added' | 'removed') => {
        setActiveTab(tab);
    };

    const displayName = channelName || channelId;

    const title = resourceType === 'team' ? (
        <FormattedMessage
            id='admin.jobTable.syncResults.teamUserListTitle'
            defaultMessage='Team Membership Changes'
        />
    ) : (
        <FormattedMessage
            id='admin.jobTable.syncResults.userListTitle'
            defaultMessage='Channel Membership Changes'
        />
    );

    return (
        <GenericModal
            className='a11y__modal more-modal'
            id='user-list-modal-dialog'
            onExited={onClose}
            show={true}
            onHide={onClose}
            compassDesign={true}
            bodyPadding={false}
            modalHeaderText={title}
            modalSubheaderText={`${displayName} - (${channelId})`}
        >
            <div className='tabs'>
                <button
                    className={`tab-button ${activeTab === 'added' ? 'active' : ''}`}
                    onClick={() => handleTabChange('added')}
                >
                    <FormattedMessage
                        id='admin.jobTable.syncResults.added'
                        defaultMessage='Added ({count, number})'
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
                        defaultMessage='Removed ({count, number})'
                        values={{
                            count: syncResults.MembersRemoved.length,
                        }}
                    />
                </button>
            </div>
            <div className='tab-content'>
                {activeTab === 'added' && (
                    <SyncedUserList
                        userIds={syncResults.MembersAdded}
                        noResultsMessageId='admin.jobTable.syncResults.noUsersAdded'
                        noResultsDefaultMessage='No users were added'
                        actions={{
                            getProfilesByIds,
                        }}
                    />
                )}
                {activeTab === 'removed' && (
                    <SyncedUserList
                        userIds={syncResults.MembersRemoved}
                        noResultsMessageId='admin.jobTable.syncResults.noUsersRemoved'
                        noResultsDefaultMessage='No users were removed'
                        actions={{
                            getProfilesByIds,
                        }}
                    />
                )}
            </div>
        </GenericModal>
    );
};

export default UserListModal;
