// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {FormattedMessage} from 'react-intl';

import {GenericModal} from '@mattermost/components';

import {SyncedUserList} from './synced_user_list';

import './user_sync_modal.scss';

// Types for sync results
export type ChannelMembersSyncResults = {
    MembersAdded: string[];
    MembersRemoved: string[];
};

// Modal for showing detailed user lists
type UserListModalProps = {
    channelId: string;
    channelName: string;
    syncResults: ChannelMembersSyncResults;
    onClose: () => void;
};

export const UserListModal = ({channelId, channelName, syncResults, onClose}: UserListModalProps): JSX.Element => {
    const [activeTab, setActiveTab] = useState<'added' | 'removed'>('added');

    const handleTabChange = (tab: 'added' | 'removed') => {
        setActiveTab(tab);
    };

    const displayName = channelName || channelId;

    return (
        <GenericModal
            onExited={onClose}
            modalHeaderText={
                <div className='modal-header-custom'>
                    <FormattedMessage
                    id='admin.jobTable.syncResults.userListTitle'
                    defaultMessage='Channel Members Changes - {channelName}'
                    values={{
                        channelName: displayName,
                    }}
                />
                <div className='close-icon-container'>
                    <i 
                        className='icon icon-close' 
                        onClick={onClose}
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
            <div className='UserListModalBody'>
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
                        <SyncedUserList
                            userIds={syncResults.MembersAdded}
                            type='added'
                            noResultsMessageId='admin.jobTable.syncResults.noUsersAdded'
                            noResultsDefaultMessage='No users were added'
                        />
                    )}
                    {activeTab === 'removed' && (
                        <SyncedUserList
                            userIds={syncResults.MembersRemoved}
                            type='removed'
                            noResultsMessageId='admin.jobTable.syncResults.noUsersRemoved'
                            noResultsDefaultMessage='No users were removed'
                        />
                    )}
                </div>
            </div>
        </GenericModal>
    );
};

export default UserListModal;
