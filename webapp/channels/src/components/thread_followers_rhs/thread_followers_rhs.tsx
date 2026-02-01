// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useHistory} from 'react-router-dom';
import styled from 'styled-components';

import type {UserProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';

import CustomStatusEmoji from 'components/custom_status/custom_status_emoji';
import LoadingScreen from 'components/loading_screen';
import ProfilePicture from 'components/profile_picture';
import ProfilePopover from 'components/profile_popover';
import WithTooltip from 'components/with_tooltip';

import type {ModalData} from 'types/actions';

import './thread_followers_rhs.scss';

const HeaderTitle = styled.span`
    line-height: 2.4rem;
`;

export interface Props {
    threadId: string;
    threadName: string;
    canGoBack: boolean;
    teamUrl: string;

    actions: {
        openModal: <P>(modalData: ModalData<P>) => void;
        openDirectChannelToUserId: (userId: string) => Promise<unknown>;
        closeRightHandSide: () => void;
        goBack: () => void;
    };
}

interface FollowerWithStatus extends UserProfile {
    status?: string;
}

export default function ThreadFollowersRHS({
    threadId,
    threadName,
    canGoBack,
    teamUrl,
    actions,
}: Props) {
    const history = useHistory();
    const {formatMessage} = useIntl();

    const [followers, setFollowers] = useState<FollowerWithStatus[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch thread followers
    useEffect(() => {
        if (threadId) {
            setIsLoading(true);
            Client4.getThreadFollowers(threadId).then((users) => {
                setFollowers(users as FollowerWithStatus[]);
                setIsLoading(false);
            }).catch(() => {
                setFollowers([]);
                setIsLoading(false);
            });
        }
    }, [threadId]);

    const openDirectMessage = useCallback(async (user: UserProfile) => {
        // Prepare the DM channel
        await actions.openDirectChannelToUserId(user.id);

        // Redirect to it
        history.push(teamUrl + '/messages/@' + user.username);

        await actions.closeRightHandSide();
    }, [actions.openDirectChannelToUserId, history, teamUrl, actions.closeRightHandSide]);

    return (
        <div
            id='rhsContainer'
            className='sidebar-right__body thread-followers-rhs'
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

            <div className='thread-followers-rhs__count'>
                <FormattedMessage
                    id='thread_followers_rhs.count'
                    defaultMessage='{count, plural, one {# follower} other {# followers}}'
                    values={{count: followers.length}}
                />
            </div>

            <div className='thread-followers-rhs__members-container'>
                {isLoading ? (
                    <LoadingScreen/>
                ) : (
                    <div className='thread-followers-rhs__member-list'>
                        {followers.map((user) => (
                            <FollowerItem
                                key={user.id}
                                user={user}
                                openDirectMessage={openDirectMessage}
                            />
                        ))}
                        {followers.length === 0 && (
                            <div className='thread-followers-rhs__empty'>
                                <FormattedMessage
                                    id='thread_followers_rhs.empty'
                                    defaultMessage='No one is following this thread yet.'
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

interface FollowerItemProps {
    user: FollowerWithStatus;
    openDirectMessage: (user: UserProfile) => void;
}

function FollowerItem({user, openDirectMessage}: FollowerItemProps) {
    const {formatMessage} = useIntl();
    const userProfileSrc = Client4.getProfilePictureUrl(user.id, user.last_picture_update);

    const displayName = user.nickname || `${user.first_name} ${user.last_name}`.trim() || user.username;

    return (
        <div
            className='thread-followers-rhs__member'
            data-testid={`follower-${user.id}`}
        >
            <span className='ProfileSpan'>
                <div className='thread-followers-rhs__avatar'>
                    <ProfilePicture
                        size='sm'
                        status={user.status}
                        isBot={user.is_bot}
                        userId={user.id}
                        username={displayName}
                        src={userProfileSrc}
                    />
                </div>
                <ProfilePopover
                    triggerComponentClass='profileSpan_userInfo'
                    userId={user.id}
                    src={userProfileSrc}
                    hideStatus={user.is_bot}
                >
                    <span className='thread-followers-rhs__display-name'>
                        {displayName}
                    </span>
                    {displayName !== user.username && (
                        <span className='thread-followers-rhs__username'>
                            {'@'}{user.username}
                        </span>
                    )}
                    <CustomStatusEmoji
                        userID={user.id}
                        showTooltip={true}
                        emojiSize={16}
                        spanStyle={{
                            display: 'flex',
                            flex: '0 0 auto',
                            alignItems: 'center',
                        }}
                        emojiStyle={{
                            marginLeft: '8px',
                            alignItems: 'center',
                        }}
                    />
                </ProfilePopover>
            </span>

            <WithTooltip
                title={formatMessage({
                    id: 'thread_followers_rhs.member.send_message',
                    defaultMessage: 'Send message',
                })}
            >
                <button
                    className='thread-followers-rhs__send-message'
                    onClick={() => openDirectMessage(user)}
                >
                    <i className='icon icon-send'/>
                </button>
            </WithTooltip>
        </div>
    );
}
