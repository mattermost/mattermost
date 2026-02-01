// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import {useHistory} from 'react-router-dom';
import styled from 'styled-components';

import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {getUserStatuses} from 'mattermost-redux/selectors/entities/users';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import LoadingScreen from 'components/loading_screen';
import WithTooltip from 'components/with_tooltip';

import MemberList, {ListItemType} from 'components/channel_members_rhs/member_list';
import type {ChannelMember, ListItem} from 'components/channel_members_rhs/member_list';

import Constants, {ModalIdentifiers} from 'utils/constants';
import {isKeyPressed} from 'utils/keyboard';

import type {ModalData} from 'types/actions';
import type {GlobalState} from 'types/store';

import ThreadInviteModal from './thread_invite_modal';

import 'components/channel_members_rhs/channel_members_rhs.scss';

const HeaderTitle = styled.span`
    line-height: 2.4rem;
`;

const ActionBarContainer = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 16px 20px;
`;

const Title = styled.div`
    flex: 1;
    font-family: 'Open Sans', sans-serif;
    font-weight: 600;
    font-size: 14px;
    line-height: 20px;
`;

const Actions = styled.div`
    button + button {
        margin-left: 8px;
    }
`;

const Button = styled.button`
    border: none;
    background: transparent;
    width: fit-content;
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    line-height: 16px;
    &.add-members, &.manage-members-done {
        background-color: var(--button-bg);
        color: var(--button-color);
        &:hover, &:active, &:focus {
            background: linear-gradient(0deg, rgba(var(--center-channel-color-rgb), 0.16), rgba(var(--center-channel-color-rgb), 0.16)), var(--button-bg);
            color: var(--button-color);
        }
    }
    &.manage-members {
        background: rgba(var(--button-bg-rgb), 0.08);
        color: var(--button-bg);
        &:hover, &:focus {
            background: rgba(var(--button-bg-rgb), 0.12);
        }
        &:active {
            background: rgba(var(--button-bg-rgb), 0.16);
        }
    }
`;

const ButtonIcon = styled.i`
    font-size: 14.4px;
`;

export interface Props {
    threadId: string;
    channelId: string;
    threadName: string;
    canGoBack: boolean;
    teamUrl: string;

    actions: {
        openModal: <P>(modalData: ModalData<P>) => void;
        openDirectChannelToUserId: (userId: string) => Promise<unknown>;
        closeRightHandSide: () => void;
        goBack: () => void;
        fetchRemoteClusterInfo: (remoteId: string, forceRefresh?: boolean) => void;
    };
}

export default function ThreadFollowersRHS({
    threadId,
    channelId,
    threadName,
    canGoBack,
    teamUrl,
    actions,
}: Props) {
    const history = useHistory();
    const {formatMessage} = useIntl();

    const [followers, setFollowers] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editing, setEditing] = useState(false);

    // Get channel for MemberList (needed for its props)
    const channel = useSelector((state: GlobalState) => getChannel(state, channelId)) as Channel;
    const teammateNameDisplaySetting = useSelector(getTeammateNameDisplaySetting);
    const userStatuses = useSelector(getUserStatuses);

    // Fetch thread followers
    const fetchFollowers = useCallback(() => {
        if (threadId) {
            setIsLoading(true);
            Client4.getThreadFollowers(threadId).then((users) => {
                setFollowers(users);
                setIsLoading(false);
            }).catch(() => {
                setFollowers([]);
                setIsLoading(false);
            });
        }
    }, [threadId]);

    useEffect(() => {
        fetchFollowers();
    }, [fetchFollowers]);

    // Handle escape key to exit editing mode
    useEffect(() => {
        const handleShortcut = (e: KeyboardEvent) => {
            if (isKeyPressed(e, Constants.KeyCodes.ESCAPE) && editing) {
                setEditing(false);
            }
        };
        document.addEventListener('keydown', handleShortcut);
        return () => {
            document.removeEventListener('keydown', handleShortcut);
        };
    }, [editing]);

    // Transform followers to ChannelMember format for MemberList
    const memberList: ListItem[] = [];
    if (followers.length > 0) {
        // Add header separator
        memberList.push({
            type: ListItemType.FirstSeparator,
            data: (
                <div className='channel-members-rhs__member-list-separator channel-members-rhs__member-list-separator--first'>
                    <FormattedMessage
                        id='thread_followers_rhs.list.followers_title'
                        defaultMessage='FOLLOWERS'
                    />
                </div>
            ),
        });

        // Sort followers alphabetically by display name
        const sortedFollowers = [...followers].sort((a, b) => {
            const nameA = displayUsername(a, teammateNameDisplaySetting).toLowerCase();
            const nameB = displayUsername(b, teammateNameDisplaySetting).toLowerCase();
            return nameA.localeCompare(nameB);
        });

        // Add each follower
        sortedFollowers.forEach((user) => {
            const member: ChannelMember = {
                user,
                status: userStatuses[user.id],
                displayName: displayUsername(user, teammateNameDisplaySetting),
                // No membership - this means role dropdown won't show
            };
            memberList.push({type: ListItemType.Member, data: member});
        });
    }

    const openDirectMessage = useCallback(async (user: UserProfile) => {
        // Prepare the DM channel
        await actions.openDirectChannelToUserId(user.id);

        // Redirect to it
        history.push(teamUrl + '/messages/@' + user.username);

        await actions.closeRightHandSide();
    }, [actions.openDirectChannelToUserId, history, teamUrl, actions.closeRightHandSide]);

    // Handler for removing a follower
    const handleRemoveFollower = useCallback(async (userId: string) => {
        try {
            await Client4.removeThreadFollower(threadId, userId);
            // Refresh the list
            fetchFollowers();
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Failed to remove thread follower:', error);
        }
    }, [threadId, fetchFollowers]);

    // Handler for adding followers
    const handleAddFollowers = useCallback(async (userIds: string[]) => {
        try {
            await Client4.addThreadFollowers(threadId, userIds);
            // Refresh the list
            fetchFollowers();
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Failed to add thread followers:', error);
        }
    }, [threadId, fetchFollowers]);

    const inviteFollowers = useCallback(() => {
        actions.openModal({
            modalId: ModalIdentifiers.THREAD_INVITE,
            dialogType: ThreadInviteModal,
            dialogProps: {
                threadId,
                channelId,
                existingFollowerIds: followers.map((f) => f.id),
                onAddFollowers: handleAddFollowers,
            },
        });
    }, [actions.openModal, threadId, channelId, followers, handleAddFollowers]);

    // No-op for pagination (we load all followers at once)
    const loadMore = useCallback(() => {}, []);

    return (
        <div
            id='rhsContainer'
            className='sidebar-right__body channel-members-rhs'
        >
            <div className='sidebar--right__header'>
                <span className='sidebar--right__title'>
                    {canGoBack && (
                        <button
                            className='sidebar--right__back btn btn-icon btn-sm'
                            onClick={actions.goBack}
                            aria-label={formatMessage({id: 'rhs_header.back.icon', defaultMessage: 'Back Icon'})}
                        >
                            <i className='icon icon-arrow-back-ios'/>
                        </button>
                    )}
                    <h2>
                        <HeaderTitle id='rhsPanelTitle'>
                            <FormattedMessage
                                id='thread_followers_rhs.header.title'
                                defaultMessage='Thread Followers'
                            />
                        </HeaderTitle>
                        {threadName && (
                            <span className='style--none sidebar--right__title__subtitle'>
                                {threadName}
                            </span>
                        )}
                    </h2>
                </span>

                <WithTooltip
                    title={
                        <FormattedMessage
                            id='rhs_header.closeSidebarTooltip'
                            defaultMessage='Close'
                        />
                    }
                >
                    <button
                        id='rhsCloseButton'
                        type='button'
                        className='sidebar--right__close btn btn-icon btn-sm'
                        aria-label={formatMessage({id: 'rhs_header.closeTooltip.icon', defaultMessage: 'Close Sidebar Icon'})}
                        onClick={actions.closeRightHandSide}
                    >
                        <i className='icon icon-close'/>
                    </button>
                </WithTooltip>
            </div>

            <ActionBarContainer>
                <Title>
                    {editing ? (
                        <FormattedMessage
                            id='thread_followers_rhs.action_bar.managing_title'
                            defaultMessage='Managing Followers'
                        />
                    ) : (
                        <FormattedMessage
                            id='thread_followers_rhs.action_bar.followers_count_title'
                            defaultMessage='{count, plural, one {# follower} other {# followers}}'
                            values={{count: followers.length}}
                        />
                    )}
                </Title>
                <Actions>
                    {editing ? (
                        <Button
                            onClick={() => setEditing(false)}
                            className='manage-members-done'
                        >
                            <FormattedMessage
                                id='thread_followers_rhs.action_bar.done_button'
                                defaultMessage='Done'
                            />
                        </Button>
                    ) : (
                        <>
                            {followers.length > 0 && (
                                <Button
                                    className='manage-members'
                                    onClick={() => setEditing(true)}
                                >
                                    <FormattedMessage
                                        id='thread_followers_rhs.action_bar.manage_button'
                                        defaultMessage='Manage'
                                    />
                                </Button>
                            )}
                            <Button
                                onClick={inviteFollowers}
                                className='add-members'
                            >
                                <ButtonIcon
                                    className='icon-account-plus-outline'
                                    title='Add Icon'
                                />
                                <FormattedMessage
                                    id='thread_followers_rhs.action_bar.add_button'
                                    defaultMessage='Add'
                                />
                            </Button>
                        </>
                    )}
                </Actions>
            </ActionBarContainer>

            <div className='channel-members-rhs__members-container'>
                {isLoading ? (
                    <LoadingScreen/>
                ) : followers.length > 0 && channel ? (
                    <MemberList
                        searchTerms=''
                        members={memberList}
                        editing={editing}
                        channel={channel}
                        openDirectMessage={openDirectMessage}
                        fetchRemoteClusterInfo={actions.fetchRemoteClusterInfo}
                        loadMore={loadMore}
                        hasNextPage={false}
                        isNextPageLoading={false}
                        onRemoveMember={handleRemoveFollower}
                    />
                ) : (
                    <div className='channel-members-rhs__empty'>
                        <FormattedMessage
                            id='thread_followers_rhs.empty'
                            defaultMessage='No one is following this thread yet.'
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
