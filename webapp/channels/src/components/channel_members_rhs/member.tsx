// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import styled from 'styled-components';

import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';
import {isGuest} from 'mattermost-redux/utils/user_utils';

import ChannelMembersDropdown from 'components/channel_members_dropdown';
import CustomStatusEmoji from 'components/custom_status/custom_status_emoji';
import ProfilePicture from 'components/profile_picture';
import ProfilePopover from 'components/profile_popover';
import SharedChannelIndicator from 'components/shared_channel_indicator';
import GuestTag from 'components/widgets/tag/guest_tag';
import WithTooltip from 'components/with_tooltip';

import type {ChannelMember} from './channel_members_rhs';

const Avatar = styled.div`
    flex-basis: fit-content;
    flex-shrink: 0;
`;

const DisplayName = styled.span`
    display: inline;
    overflow: hidden;
    margin-left: 8px;
    color: var(--center-channel-color);
    font-size: 14px;
    gap: 8px;
    line-height: 20px;
    text-overflow: ellipsis;
`;

const Username = styled.span`
    margin-left: 4px;
    color: rgba(var(--center-channel-color-rgb), 0.75);
    font-size: 12px;
    line-height: 18px;
`;

const SendMessage = styled.button`
    display: none;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 0;
    margin-left: 8px;
    background-color: transparent;
    border-radius: 4px;

    &:hover {
        background-color: rgba(var(--center-channel-color-rgb), 0.12);
    }

    .icon {
        color: rgba(var(--center-channel-color-rgb), 0.64);
        font-size: 14.4px;
    };
`;

const RoleChooser = styled.div`
    display: none;
    flex-basis: fit-content;
    flex-shrink: 0;

    &.editing {
        display: block;
    }

    .MenuWrapper {
        padding: 6px 10px;
        border-radius: 4px;
        &.MenuWrapper--open {
            background: rgba(var(--button-bg-rgb), 0.16);
        }
        &:not(.MenuWrapper--open):hover {
            background: rgba(var(--center-channel-color-rgb), 0.08);
        }
    }
`;

const SharedIcon = styled.span`
    margin: 0 0 0 4px;
    font-size: 16px;
    line-height: 20px;
`;

interface Props {
    className?: string;
    channel: Channel;
    member: ChannelMember;
    index: number;
    totalUsers: number;
    editing: boolean;
    actions: {
        openDirectMessage: (user: UserProfile) => void;
    };
}

const Member = ({className, channel, member, index, totalUsers, editing, actions}: Props) => {
    const {formatMessage} = useIntl();

    const userProfileSrc = Client4.getProfilePictureUrl(member.user.id, member.user.last_picture_update);

    return (
        <div
            className={className}
            style={{height: '48px'}}
            data-testid={`memberline-${member.user.id}`}
        >
            <span className='ProfileSpan'>
                <Avatar>
                    <ProfilePicture
                        size='sm'
                        status={member.status}
                        isBot={member.user.is_bot}
                        userId={member.user.id}
                        username={member.displayName}
                        src={userProfileSrc}
                    />
                </Avatar>
                <ProfilePopover
                    triggerComponentClass='profileSpan_userInfo'
                    userId={member.user.id}
                    src={userProfileSrc}
                    hideStatus={member.user.is_bot}
                >
                    <DisplayName>
                        {member.displayName}
                        {isGuest(member.user.roles) && <GuestTag/>}
                        {member.user.remote_id &&
                        (
                            <SharedIcon>
                                <SharedChannelIndicator
                                    withTooltip={true}
                                />
                            </SharedIcon>
                        )}
                    </DisplayName>
                    {
                        member.displayName === member.user.username ? null : <Username>{'@'}{member.user.username}</Username>
                    }
                    <CustomStatusEmoji
                        userID={member.user.id}
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

            <RoleChooser
                className={classNames({editing}, 'member-role-chooser')}
                data-testid='rolechooser'
            >
                {member.membership && (
                    <ChannelMembersDropdown
                        channel={channel}
                        user={member.user}
                        channelMember={member.membership}
                        index={index}
                        totalUsers={totalUsers}
                        channelAdminLabel={
                            <FormattedMessage
                                id='channel_members_rhs.member.select_role_channel_admin'
                                defaultMessage='Admin'
                            />
                        }
                        channelMemberLabel={
                            <FormattedMessage
                                id='channel_members_rhs.member.select_role_channel_member'
                                defaultMessage='Member'
                            />
                        }
                        guestLabel={
                            <FormattedMessage
                                id='channel_members_rhs.member.select_role_guest'
                                defaultMessage='Guest'
                            />
                        }
                    />
                )}
            </RoleChooser>
            {!editing && (
                <WithTooltip
                    title={formatMessage({
                        id: 'channel_members_rhs.member.send_message',
                        defaultMessage: 'Send message',
                    })}
                >
                    <SendMessage onClick={() => actions.openDirectMessage(member.user)}>
                        <i className='icon icon-send'/>
                    </SendMessage>
                </WithTooltip>
            )}
        </div>
    );
};

export default styled(Member)`
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 8px 16px;
    border-radius: 4px;

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        color: rgba(var(--center-channel-color-rgb), 0.75);

        ${SendMessage} {
            display: block;
            flex: 0 0 auto;
        }
    }

    .ProfileSpan {
        width: 100%;
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: 4px 0; // This padding is to make sure the status icon doesn't get clipped off because of the overflow

        .profileSpan_userInfo {
            display: flex;
            flex-grow: 1;
            cursor: pointer;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
    }

    .MenuWrapper {
        font-size: 11px;
        font-weight: 600;
    }
`;
