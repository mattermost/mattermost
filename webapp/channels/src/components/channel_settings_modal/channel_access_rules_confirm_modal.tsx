// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect, useCallback} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import type {UserProfile} from '@mattermost/types/users';

import {getProfilesByIds} from 'mattermost-redux/actions/users';
import type {ActionResult} from 'mattermost-redux/types/actions';

import SearchableUserList from 'components/searchable_user_list/searchable_user_list_container';

import './channel_access_rules_confirm_modal.scss';

type ChannelAccessRulesConfirmModalProps = {
    show: boolean;
    onHide: () => void;
    onConfirm: () => void;
    channelName: string;
    usersToAdd: string[];
    usersToRemove: string[];
    isProcessing?: boolean;
    autoSyncEnabled?: boolean;
    isStacked?: boolean;
    willShowActivityWarning?: boolean;
};

const USERS_PER_PAGE = 50;

function ChannelAccessRulesConfirmModal({
    show,
    onHide,
    onConfirm,
    channelName,
    usersToAdd,
    usersToRemove,
    isProcessing = false,
    autoSyncEnabled = false,
    isStacked = false,
    willShowActivityWarning = false,
}: ChannelAccessRulesConfirmModalProps) {
    const dispatch = useDispatch();

    const [showUserList, setShowUserList] = useState(false);
    const [activeTab, setActiveTab] = useState<'allowed' | 'restricted'>('allowed');
    const [allowedUsers, setAllowedUsers] = useState<UserProfile[]>([]);
    const [restrictedUsers, setRestrictedUsers] = useState<UserProfile[]>([]);
    const [filteredAllowedUsers, setFilteredAllowedUsers] = useState<UserProfile[]>([]);
    const [filteredRestrictedUsers, setFilteredRestrictedUsers] = useState<UserProfile[]>([]);

    // Load user profiles when modal opens or user list is shown
    useEffect(() => {
        if (show && showUserList) {
            loadUserProfiles();
        }
    }, [show, showUserList]);

    const loadUserProfiles = useCallback(async () => {
        // Load allowed users (users to add)
        if (usersToAdd.length > 0) {
            const result = await dispatch(getProfilesByIds(usersToAdd) as any) as ActionResult<UserProfile[]>;
            if (result?.data) {
                setAllowedUsers(result.data);
                setFilteredAllowedUsers(result.data);
            }
        }

        // Load restricted users (users to remove)
        if (usersToRemove.length > 0) {
            const result = await dispatch(getProfilesByIds(usersToRemove) as any) as ActionResult<UserProfile[]>;
            if (result?.data) {
                setRestrictedUsers(result.data);
                setFilteredRestrictedUsers(result.data);
            }
        }
    }, [usersToAdd, usersToRemove, dispatch]);

    const handleViewUsers = () => {
        setShowUserList(true);
    };

    const handleHideUsers = () => {
        setShowUserList(false);
    };

    const handleTabChange = (tab: 'allowed' | 'restricted') => {
        setActiveTab(tab);
    };

    const handleSearch = (searchTerm: string) => {
        if (searchTerm === '') {
            // Reset to original data when search is empty
            setFilteredAllowedUsers(allowedUsers);
            setFilteredRestrictedUsers(restrictedUsers);
        } else {
            // Filter allowed users
            const filteredAllowed = allowedUsers.filter((user) => {
                return user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    user.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    user.nickname?.toLowerCase().includes(searchTerm.toLowerCase());
            });
            setFilteredAllowedUsers(filteredAllowed);

            // Filter restricted users
            const filteredRestricted = restrictedUsers.filter((user) => {
                return user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    user.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    user.nickname?.toLowerCase().includes(searchTerm.toLowerCase());
            });
            setFilteredRestrictedUsers(filteredRestricted);
        }
    };

    const handleClose = () => {
        // Reset state when closing
        setShowUserList(false);
        setActiveTab('allowed');
        setAllowedUsers([]);
        setRestrictedUsers([]);
        setFilteredAllowedUsers([]);
        setFilteredRestrictedUsers([]);
        onHide();
    };

    const hasChanges = usersToAdd.length > 0 || usersToRemove.length > 0;

    // Don't show modal if there are no changes
    if (!hasChanges) {
        return null;
    }

    const modalTitle = (
        <FormattedMessage
            id={willShowActivityWarning ? 'channel_settings.access_rules.confirm_modal.title_with_warning' : 'channel_settings.access_rules.confirm_modal.title'}
            defaultMessage={willShowActivityWarning ? 'Review membership impact' : 'Save and apply rules'}
        />
    );

    const modalSubtitle = channelName;

    const currentUsers = activeTab === 'allowed' ? filteredAllowedUsers : filteredRestrictedUsers;
    const totalCount = activeTab === 'allowed' ? usersToAdd.length : usersToRemove.length;

    // Common buttons component
    const renderButtons = (leftButton: React.ReactNode) => (
        <div className='ChannelAccessRulesConfirmModal__buttons'>
            <div className='ChannelAccessRulesConfirmModal__buttons__left'>
                {leftButton}
            </div>
            <div className='ChannelAccessRulesConfirmModal__buttons__right'>
                <button
                    className='btn btn-tertiary'
                    onClick={handleClose}
                    disabled={isProcessing}
                >
                    <FormattedMessage
                        id='channel_settings.access_rules.confirm_modal.cancel'
                        defaultMessage='Cancel'
                    />
                </button>
                <button
                    className='btn btn-danger'
                    onClick={onConfirm}
                    disabled={isProcessing}
                >
                    {(() => {
                        if (isProcessing) {
                            return (
                                <>
                                    <span className='icon icon-loading icon-spin'/>
                                    <FormattedMessage
                                        id='channel_settings.access_rules.confirm_modal.saving'
                                        defaultMessage='Saving...'
                                    />
                                </>
                            );
                        }

                        if (willShowActivityWarning) {
                            return (
                                <FormattedMessage
                                    id='channel_settings.access_rules.confirm_modal.continue'
                                    defaultMessage='Continue'
                                />
                            );
                        }

                        return (
                            <FormattedMessage
                                id={autoSyncEnabled ? 'channel_settings.access_rules.confirm_modal.save_and_apply' : 'channel_settings.access_rules.confirm_modal.save'}
                                defaultMessage={autoSyncEnabled ? 'Save and apply' : 'Save'}
                            />
                        );
                    })()}
                </button>
            </div>
        </div>
    );

    return (
        <GenericModal
            className='ChannelAccessRulesConfirmModal a11y__modal'
            id='channel-access-rules-confirm-modal'
            show={show}
            onHide={handleClose}
            onExited={handleClose}
            compassDesign={true}
            modalHeaderText={modalTitle}
            modalSubheaderText={modalSubtitle}
            bodyPadding={false}
            isStacked={isStacked}
        >
            {showUserList ? (

                // Detailed user list view
                <div className='ChannelAccessRulesConfirmModal__details'>
                    <div className='ChannelAccessRulesConfirmModal__message'>
                        <FormattedMessage
                            id='channel_settings.access_rules.confirm_modal.message'
                            defaultMessage='Applying these access rules will add <strong>{addCount, number} {addCount, plural, one {user} other {users}}</strong> to the channel and remove <strong>{removeCount, number} current channel {removeCount, plural, one {member} other {members}}</strong>.'
                            values={{
                                addCount: usersToAdd.length,
                                removeCount: usersToRemove.length,
                                strong: (chunks: React.ReactNode) => <strong>{chunks}</strong>,
                            }}
                        />
                    </div>
                    <div className='ChannelAccessRulesConfirmModal__tabs'>
                        <button
                            className={`ChannelAccessRulesConfirmModal__tab ${activeTab === 'allowed' ? 'active' : ''}`}
                            onClick={() => handleTabChange('allowed')}
                        >
                            <FormattedMessage
                                id='channel_settings.access_rules.confirm_modal.allowed_tab'
                                defaultMessage='Allowed ({count})'
                                values={{count: usersToAdd.length}}
                            />
                        </button>
                        <button
                            className={`ChannelAccessRulesConfirmModal__tab ${activeTab === 'restricted' ? 'active' : ''}`}
                            onClick={() => handleTabChange('restricted')}
                        >
                            <FormattedMessage
                                id='channel_settings.access_rules.confirm_modal.restricted_tab'
                                defaultMessage='Restricted ({count})'
                                values={{count: usersToRemove.length}}
                            />
                        </button>
                    </div>

                    <div className='ChannelAccessRulesConfirmModal__userList'>
                        {currentUsers.length > 0 ? (
                            <SearchableUserList
                                users={currentUsers}
                                usersPerPage={USERS_PER_PAGE}
                                total={totalCount}
                                actionUserProps={{}}
                                focusOnMount={false}
                                nextPage={() => {}}
                                search={handleSearch}
                            />
                        ) : (
                            <div className='ChannelAccessRulesConfirmModal__noResults'>
                                <FormattedMessage
                                    id='channel_settings.access_rules.confirm_modal.no_users'
                                    defaultMessage='No users in this category'
                                />
                            </div>
                        )}
                    </div>

                    {renderButtons(
                        <button
                            className='btn btn-tertiary'
                            onClick={handleHideUsers}
                            disabled={isProcessing}
                        >
                            <FormattedMessage
                                id='channel_settings.access_rules.confirm_modal.hide_users'
                                defaultMessage='Hide users'
                            />
                        </button>,
                    )}
                </div>
            ) : (

                // Summary view
                <div className='ChannelAccessRulesConfirmModal__summary'>
                    <div className='ChannelAccessRulesConfirmModal__message'>
                        <FormattedMessage
                            id='channel_settings.access_rules.confirm_modal.message'
                            defaultMessage='Applying these access rules will add <strong>{addCount, number} {addCount, plural, one {user} other {users}}</strong> to the channel and remove <strong>{removeCount, number} current channel {removeCount, plural, one {member} other {members}}</strong>.'
                            values={{
                                addCount: usersToAdd.length,
                                removeCount: usersToRemove.length,
                                strong: (chunks: React.ReactNode) => <strong>{chunks}</strong>,
                            }}
                        />
                    </div>
                    <div className='ChannelAccessRulesConfirmModal__question'>
                        <FormattedMessage
                            id='channel_settings.access_rules.confirm_modal.question'
                            defaultMessage='Are you sure you want to save and apply the access rules?'
                        />
                    </div>
                    {renderButtons(
                        <button
                            className='btn btn-tertiary'
                            onClick={handleViewUsers}
                            disabled={isProcessing}
                        >
                            <FormattedMessage
                                id='channel_settings.access_rules.confirm_modal.view_users'
                                defaultMessage='View users'
                            />
                        </button>,
                    )}
                </div>
            )}
        </GenericModal>
    );
}

export default ChannelAccessRulesConfirmModal;
