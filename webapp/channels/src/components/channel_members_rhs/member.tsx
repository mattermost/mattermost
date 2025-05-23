// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

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

import type {ChannelMember as ChannelMemberType} from './member_list';

interface Props {
    channel: Channel;
    member: ChannelMemberType;
    index: number;
    totalUsers: number;
    editing: boolean;
    actions: {
        openDirectMessage: (user: UserProfile) => void;
    };
}

const Member = ({channel, member, index, totalUsers, editing, actions}: Props) => {
    const {formatMessage} = useIntl();

    const userProfileSrc = Client4.getProfilePictureUrl(member.user.id, member.user.last_picture_update);

    return (
        <div
            className='channel-members-rhs__member'
            style={{height: '48px'}}
            data-testid={`memberline-${member.user.id}`}
        >
            <span className='ProfileSpan'>
                <div className='channel-members-rhs__avatar'>
                    <ProfilePicture
                        size='sm'
                        status={member.status}
                        isBot={member.user.is_bot}
                        userId={member.user.id}
                        username={member.displayName}
                        src={userProfileSrc}
                    />
                </div>
                <ProfilePopover
                    triggerComponentClass='profileSpan_userInfo'
                    userId={member.user.id}
                    src={userProfileSrc}
                    hideStatus={member.user.is_bot}
                >
                    <span className='channel-members-rhs__display-name'>
                        {member.displayName}
                        {isGuest(member.user.roles) && <GuestTag/>}
                        {member.user.remote_id &&
                        (
                            <span className='channel-members-rhs__shared-icon'>
                                <SharedChannelIndicator
                                    withTooltip={true}
                                />
                            </span>
                        )}
                    </span>
                    {
                        member.displayName === member.user.username ? null : <span className='channel-members-rhs__username'>{'@'}{member.user.username}</span>
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

            <div
                className={classNames('channel-members-rhs__role-chooser', {editing})}
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
            </div>
            {!editing && (
                <WithTooltip
                    title={formatMessage({
                        id: 'channel_members_rhs.member.send_message',
                        defaultMessage: 'Send message',
                    })}
                >
                    <button
                        className='channel-members-rhs__send-message'
                        onClick={() => actions.openDirectMessage(member.user)}
                    >
                        <i className='icon icon-send'/>
                    </button>
                </WithTooltip>
            )}
        </div>
    );
};

export default Member;
