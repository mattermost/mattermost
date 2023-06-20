// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import classNames from 'classnames';
import {FormattedMessage} from 'react-intl';

import GuestTag from 'components/widgets/tag/guest_tag';
import ProfilePopover from 'components/profile_popover';

import ProfilePicture from 'components/profile_picture';
import {Client4} from 'mattermost-redux/client';
import ChannelMembersDropdown from 'components/channel_members_dropdown';

import OverlayTrigger, {BaseOverlayTrigger} from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';

import Constants from 'utils/constants';

import {isGuest} from 'mattermost-redux/utils/user_utils';

import {Channel} from '@mattermost/types/channels';
import {UserProfile} from '@mattermost/types/users';

import CustomStatusEmoji from 'components/custom_status/custom_status_emoji';

import {ChannelMember} from './channel_members_rhs';

const Avatar = styled.div`
    flex-basis: fit-content;
    flex-shrink: 0;
`;

const UserInfo = styled.div`
    display: flex;
    flex: 1;
    cursor: pointer;
    overflow-x: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
    color: rgba(var(--center-channel-color-rgb), 0.56);
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
        color: rgba(var(--center-channel-color-rgb), 0.56);
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

interface MMOverlayTrigger extends BaseOverlayTrigger {
    hide: () => void;
}

const Member = ({className, channel, member, index, totalUsers, editing, actions}: Props) => {
    const overlay = React.createRef<MMOverlayTrigger>();
    const profileSrc = Client4.getProfilePictureUrl(member.user.id, member.user.last_picture_update);

    const hideProfilePopover = () => {
        if (overlay.current) {
            overlay.current.hide();
        }
    };

    return (
        <div
            className={className}
            style={{height: '48px'}}
            data-testid={`memberline-${member.user.id}`}
        >

            <OverlayTrigger
                ref={overlay}
                trigger={['click']}
                placement={'left'}
                rootClose={true}
                overlay={
                    <ProfilePopover
                        className='user-profile-popover'
                        userId={member.user.id}
                        src={profileSrc}
                        hide={hideProfilePopover}
                        isRHS={true}
                        hideStatus={member.user.is_bot}
                    />
                }
            >
                <span className='ProfileSpan'>
                    <Avatar>
                        <ProfilePicture
                            isRHS={true}
                            popoverPlacement='left'
                            size='sm'
                            status={member.status}
                            isBot={member.user.is_bot}
                            userId={member.user.id}
                            username={member.displayName}
                            src={Client4.getProfilePictureUrl(member.user.id, member.user.last_picture_update)}
                        />
                    </Avatar>
                    <UserInfo>
                        <DisplayName>
                            {member.displayName}
                            {isGuest(member.user.roles) && <GuestTag/>}
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
                    </UserInfo>
                </span>
            </OverlayTrigger>

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
                <SendMessage onClick={() => actions.openDirectMessage(member.user)}>
                    <OverlayTrigger
                        delayShow={Constants.OVERLAY_TIME_DELAY}
                        placement='left'
                        overlay={
                            <Tooltip>
                                <FormattedMessage
                                    id='channel_members_rhs.member.send_message'
                                    defaultMessage='Send message'
                                />
                            </Tooltip>
                        }
                    >
                        <i className='icon icon-send'/>
                    </OverlayTrigger>
                </SendMessage>
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
        color: rgba(var(--center-channel-color-rgb), 0.56);

        ${SendMessage} {
            display: block;
            flex: 0 0 auto;
        }
    }

    .ProfileSpan {
        display: flex;
        overflow: hidden;
        width: 100%;
        flex-direction: row;
        align-items: center;
        // This padding is to make sure the status icon doesnt get clipped off because of the overflow
        padding: 4px 0;
        margin-right: auto;
    }

    .MenuWrapper {
        font-size: 11px;
        font-weight: 600;
    }
`;
