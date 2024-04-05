// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedDate, FormattedMessage, defineMessages} from 'react-intl';

import {BellRingOutlineIcon, GlobeIcon, PencilOutlineIcon, StarOutlineIcon, LockOutlineIcon, StarIcon} from '@mattermost/compass-icons/components';
import type {Channel, ChannelMembership} from '@mattermost/types/channels';
import type {UserProfile as UserProfileType} from '@mattermost/types/users';

import {Permissions} from 'mattermost-redux/constants';
import {NotificationLevel} from 'mattermost-redux/constants/channels';
import {isChannelMuted} from 'mattermost-redux/utils/channel_utils';

import AddGroupsToTeamModal from 'components/add_groups_to_team_modal';
import ChannelNotificationsModal from 'components/channel_notifications_modal';
import ChannelIntroPrivateSvg from 'components/common/svg_images_components/channel_intro_private_svg';
import ChannelIntroPublicSvg from 'components/common/svg_images_components/channel_intro_public_svg';
import ChannelIntroTownSquareSvg from 'components/common/svg_images_components/channel_intro_town_square_svg';
import EditChannelHeaderModal from 'components/edit_channel_header_modal';
import FormattedMarkdownMessage from 'components/formatted_markdown_message';
import ChannelPermissionGate from 'components/permissions_gates/channel_permission_gate';
import TeamPermissionGate from 'components/permissions_gates/team_permission_gate';
import ProfilePicture from 'components/profile_picture';
import ToggleModalButton from 'components/toggle_modal_button';
import UserProfile from 'components/user_profile';

import {Constants, ModalIdentifiers} from 'utils/constants';
import {getMonthLong} from 'utils/i18n';
import * as Utils from 'utils/utils';

import AddMembersButton from './add_members_button';
import PluggableIntroButtons from './pluggable_intro_buttons';

type Props = {
    currentUserId: string;
    channel: Channel;
    fullWidth: boolean;
    locale: string;
    channelProfiles: UserProfileType[];
    enableUserCreation?: boolean;
    isReadOnly?: boolean;
    isFavorite: boolean;
    teamIsGroupConstrained?: boolean;
    creatorName: string;
    teammate?: UserProfileType;
    teammateName?: string;
    currentUser: UserProfileType;
    stats: any;
    usersLimit: number;
    channelMember?: ChannelMembership;
    isMobileView: boolean;
    actions: {
        getTotalUsersStats: () => any;
        favoriteChannel: (channelId: string) => any;
        unfavoriteChannel: (channelId: string) => any;
    };
}

export default class ChannelIntroMessage extends React.PureComponent<Props> {
    toggleFavorite = () => {
        if (this.props.isFavorite) {
            this.props.actions.unfavoriteChannel(this.props.channel.id);
        } else {
            this.props.actions.favoriteChannel(this.props.channel.id);
        }
    };

    componentDidMount() {
        if (!this.props.stats?.total_users_count) {
            this.props.actions.getTotalUsersStats();
        }
    }

    render() {
        const {
            currentUserId,
            channel,
            fullWidth,
            locale,
            channelProfiles,
            enableUserCreation,
            isReadOnly,
            isFavorite,
            teamIsGroupConstrained,
            creatorName,
            teammate,
            teammateName,
            currentUser,
            stats,
            usersLimit,
            channelMember,
            isMobileView,
        } = this.props;

        let centeredIntro = '';
        if (!fullWidth) {
            centeredIntro = 'channel-intro--centered';
        }

        if (channel.type === Constants.DM_CHANNEL) {
            return createDMIntroMessage(channel, centeredIntro, currentUser, isFavorite, isMobileView, this.toggleFavorite, teammate, teammateName);
        } else if (channel.type === Constants.GM_CHANNEL) {
            return createGMIntroMessage(channel, centeredIntro, isFavorite, isMobileView, this.toggleFavorite, channelProfiles, currentUserId, currentUser, channelMember);
        } else if (channel.name === Constants.DEFAULT_CHANNEL) {
            return createDefaultIntroMessage(channel, centeredIntro, currentUser, isFavorite, isMobileView, this.toggleFavorite, stats, usersLimit, enableUserCreation, isReadOnly, teamIsGroupConstrained);
        } else if (channel.name === Constants.OFFTOPIC_CHANNEL) {
            return createOffTopicIntroMessage(channel, centeredIntro, isFavorite, isMobileView, currentUser, this.toggleFavorite, stats, usersLimit);
        } else if (channel.type === Constants.OPEN_CHANNEL || channel.type === Constants.PRIVATE_CHANNEL) {
            return createStandardIntroMessage(channel, centeredIntro, currentUser, isFavorite, isMobileView, this.toggleFavorite, stats, usersLimit, locale, creatorName);
        }
        return null;
    }
}

const gmIntroMessages = defineMessages({
    muted: {id: 'intro_messages.GM.muted', defaultMessage: 'This group message is currently <b>muted</b>, so you will not be notified.'},
    [NotificationLevel.ALL]: {id: 'intro_messages.GM.all', defaultMessage: 'You\'ll be notified <b>for all activity</b> in this group message.'},
    [NotificationLevel.DEFAULT]: {id: 'intro_messages.GM.all', defaultMessage: 'You\'ll be notified <b>for all activity</b> in this group message.'},
    [NotificationLevel.MENTION]: {id: 'intro_messages.GM.mention', defaultMessage: 'You have selected to be notified <b>only when mentioned</b> in this group message.'},
    [NotificationLevel.NONE]: {id: 'intro_messages.GM.none', defaultMessage: 'You have selected to <b>never</b> be notified in this group message.'},
});

const getGMIntroMessageSpecificPart = (userProfile: UserProfileType | undefined, membership: ChannelMembership | undefined) => {
    const isMuted = isChannelMuted(membership);
    if (isMuted) {
        return (
            <FormattedMessage
                {...gmIntroMessages.muted}
                values={{
                    b: (chunks) => <b>{chunks}</b>,
                }}
            />
        );
    }
    const channelNotifyProp = membership?.notify_props?.desktop || NotificationLevel.DEFAULT;
    const userNotifyProp = userProfile?.notify_props?.desktop || NotificationLevel.MENTION;
    let notifyLevelToUse = channelNotifyProp;
    if (notifyLevelToUse === NotificationLevel.DEFAULT) {
        notifyLevelToUse = userNotifyProp;
    }
    if (channelNotifyProp === NotificationLevel.DEFAULT && userNotifyProp === NotificationLevel.MENTION) {
        notifyLevelToUse = NotificationLevel.ALL;
    }

    return (
        <FormattedMessage
            {...gmIntroMessages[notifyLevelToUse]}
            values={{
                b: (chunks) => <b>{chunks}</b>,
            }}
        />
    );
};

function createGMIntroMessage(
    channel: Channel,
    centeredIntro: string,
    isFavorite: boolean,
    isMobileView: boolean,
    toggleFavorite: () => void,
    profiles: UserProfileType[],
    currentUserId: string,
    currentUser: UserProfileType,
    channelMembership?: ChannelMembership,
) {
    const channelIntroId = 'channelIntro';

    if (profiles.length > 0) {
        const currentUserProfile = profiles.find((v) => v.id === currentUserId);

        const pictures = profiles.
            filter((profile) => profile.id !== currentUserId).
            map((profile) => (
                <ProfilePicture
                    key={'introprofilepicture' + profile.id}
                    src={Utils.imageURLForUser(profile.id, profile.last_picture_update)}
                    size='xl-custom-GM'
                    userId={profile.id}
                    username={profile.username}
                />
            ));

        const actionButtons = (
            <div className='channel-intro__actions'>
                {createFavoriteButton(isFavorite, toggleFavorite)}
                {createSetHeaderButton(channel)}
                {!isMobileView && createNotificationPreferencesButton(channel, currentUser)}
                <PluggableIntroButtons channel={channel}/>
            </div>
        );

        return (
            <div
                id={channelIntroId}
                className={'channel-intro ' + centeredIntro}
            >
                <div className='post-profile-img__container channel-intro-img channel-intro-img__group'>
                    {pictures}
                </div>
                <h2 className='channel-intro__title'>
                    {channel.display_name}
                </h2>
                <p className='channel-intro__text'>
                    <FormattedMessage
                        id='intro_messages.group_message'
                        defaultMessage={'This is the start of your group message history with these teammates. '}
                    />
                    {getGMIntroMessageSpecificPart(currentUserProfile, channelMembership)}
                </p>
                {actionButtons}
            </div>
        );
    }

    return (
        <div
            id={channelIntroId}
            className={'channel-intro ' + centeredIntro}
        >
            <p className='channel-intro__text'>
                <FormattedMessage
                    id='intro_messages.group_message'
                    defaultMessage='This is the start of your group message history with these teammates. Messages and files shared here are not shown to people outside this area.'
                />
            </p>
        </div>
    );
}

function createDMIntroMessage(
    channel: Channel,
    centeredIntro: string,
    currentUser: UserProfileType,
    isFavorite: boolean,
    isMobileView: boolean,
    toggleFavorite: () => void,
    teammate?: UserProfileType,
    teammateName?: string,
) {
    const channelIntroId = 'channelIntro';
    if (teammate) {
        const src = teammate ? Utils.imageURLForUser(teammate.id, teammate.last_picture_update) : '';

        let pluggableButton = null;
        let setHeaderButton = null;
        if (!teammate?.is_bot) {
            pluggableButton = <PluggableIntroButtons channel={channel}/>;
            setHeaderButton = createSetHeaderButton(channel);
        }

        const actionButtons = (
            <div className='channel-intro__actions'>
                {createFavoriteButton(isFavorite, toggleFavorite)}
                {setHeaderButton}
                {pluggableButton}
            </div>
        );

        return (
            <div
                id={channelIntroId}
                className={'channel-intro ' + centeredIntro}
            >
                <div className='post-profile-img__container channel-intro-img'>
                    <ProfilePicture
                        src={src}
                        size='xl-custom-DM'
                        status={teammate.is_bot ? '' : channel.status}
                        userId={teammate?.id}
                        username={teammate?.username}
                        hasMention={true}
                    />
                </div>
                <h2 className='channel-intro__title'>
                    <UserProfile
                        userId={teammate?.id}
                        disablePopover={false}
                    />
                </h2>
                <p className='channel-intro__text'>
                    <FormattedMarkdownMessage
                        id='intro_messages.DM'
                        defaultMessage='This is the start of your direct message history with {teammate}. Messages and files shared here are not shown to anyone else.'
                        values={{
                            teammate: teammateName,
                        }}
                    />
                </p>
                {actionButtons}
            </div>
        );
    }

    return (
        <div
            id={channelIntroId}
            className={'channel-intro ' + centeredIntro}
        >
            <p className='channel-intro__text'>
                <FormattedMessage
                    id='intro_messages.teammate'
                    defaultMessage='This is the start of your direct message history with this teammate. Messages and files shared here are not shown to anyone else.'
                />
            </p>
        </div>
    );
}

function createOffTopicIntroMessage(
    channel: Channel,
    centeredIntro: string,
    isFavorite: boolean,
    isMobileView: boolean,
    currentUser: UserProfileType,
    toggleFavorite: () => void,
    stats: any,
    usersLimit: number,
) {
    const isPrivate = channel.type === Constants.PRIVATE_CHANNEL;
    const children = createSetHeaderButton(channel);
    const totalUsers = stats.total_users_count;
    const inviteUsers = totalUsers < usersLimit;

    let setHeaderButton = null;
    let actionButtons = null;

    if (children) {
        setHeaderButton = (
            <ChannelPermissionGate
                teamId={channel.team_id}
                channelId={channel.id}
                permissions={[isPrivate ? Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES : Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES]}
            >
                {children}
            </ChannelPermissionGate>
        );
    }

    const channelInviteButton = (
        <AddMembersButton
            totalUsers={totalUsers}
            usersLimit={usersLimit}
            channel={channel}
            pluginButtons={<PluggableIntroButtons channel={channel}/>}
        />
    );

    if (inviteUsers) {
        actionButtons = (
            <div className='channel-intro__actions'>
                {actionButtons = channelInviteButton}
            </div>
        );
    } else {
        actionButtons = (
            <div className='channel-intro__actions'>
                {createFavoriteButton(isFavorite, toggleFavorite)}
                {setHeaderButton}
                {createNotificationPreferencesButton(channel, currentUser)}
            </div>
        );
    }

    return (
        <div
            id='channelIntro'
            className={'channel-intro ' + centeredIntro}
        >
            <ChannelIntroPublicSvg/>
            <h2 className='channel-intro__title'>
                {channel.display_name}
            </h2>
            <p className='channel-intro__text'>
                <FormattedMessage
                    id='intro_messages.offTopic'
                    defaultMessage='This is the start of {display_name}, a channel for non-work-related conversations.'
                    values={{
                        display_name: channel.display_name,
                    }}
                />
            </p>
            {actionButtons}
        </div>
    );
}

function createDefaultIntroMessage(
    channel: Channel,
    centeredIntro: string,
    currentUser: UserProfileType,
    isFavorite: boolean,
    isMobileView: boolean,
    toggleFavorite: () => void,
    stats: any,
    usersLimit: number,
    enableUserCreation?: boolean,
    isReadOnly?: boolean,
    teamIsGroupConstrained?: boolean,
) {
    let teamInviteLink = null;
    const totalUsers = stats.total_users_count;
    const isPrivate = channel.type === Constants.PRIVATE_CHANNEL;
    const inviteUsers = totalUsers < usersLimit;

    let setHeaderButton = null;
    let pluginButtons = null;
    let actionButtons = null;

    if (!isReadOnly) {
        pluginButtons = <PluggableIntroButtons channel={channel}/>;
        const children = createSetHeaderButton(channel);
        if (children) {
            setHeaderButton = (
                <ChannelPermissionGate
                    teamId={channel.team_id}
                    channelId={channel.id}
                    permissions={[isPrivate ? Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES : Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES]}
                >
                    {children}
                </ChannelPermissionGate>
            );
        }
    }

    if (!isReadOnly && enableUserCreation) {
        teamInviteLink = (
            <TeamPermissionGate
                teamId={channel.team_id}
                permissions={[Permissions.INVITE_USER]}
            >
                <TeamPermissionGate
                    teamId={channel.team_id}
                    permissions={[Permissions.ADD_USER_TO_TEAM]}
                >
                    {!teamIsGroupConstrained &&
                        <AddMembersButton
                            totalUsers={totalUsers}
                            usersLimit={usersLimit}
                            channel={channel}
                            pluginButtons={pluginButtons}
                        />
                    }
                    {teamIsGroupConstrained &&
                    <ToggleModalButton
                        className='intro-links color--link'
                        modalId={ModalIdentifiers.ADD_GROUPS_TO_TEAM}
                        dialogType={AddGroupsToTeamModal}
                        dialogProps={{channel}}
                    >
                        <i
                            className='fa fa-user-plus'
                        />
                        <FormattedMessage
                            id='intro_messages.addGroupsToTeam'
                            defaultMessage='Add other groups to this team'
                        />
                    </ToggleModalButton>
                    }
                </TeamPermissionGate>
            </TeamPermissionGate>
        );
    }

    if (inviteUsers) {
        actionButtons = (
            <div className='channel-intro__actions'>
                {actionButtons = teamInviteLink}
            </div>
        );
    } else {
        actionButtons = (
            <div className='channel-intro__actions'>
                {createFavoriteButton(isFavorite, toggleFavorite)}
                {setHeaderButton}
                {createNotificationPreferencesButton(channel, currentUser)}
                {teamIsGroupConstrained && pluginButtons}
            </div>
        );
    }

    return (
        <div
            id='channelIntro'
            className={'channel-intro ' + centeredIntro}
        >
            <ChannelIntroTownSquareSvg/>
            <h2 className='channel-intro__title'>
                {channel.display_name}
            </h2>
            <p className='channel-intro__text'>
                {!isReadOnly &&
                    <FormattedMessage
                        id='intro_messages.default'
                        defaultMessage='Welcome to {display_name}. Post messages here that you want everyone to see. Everyone automatically becomes a member of this channel when they join the team.'
                        values={{
                            display_name: channel.display_name,
                        }}
                    />
                }
                {isReadOnly &&
                    <FormattedMessage
                        id='intro_messages.readonly.default'
                        defaultMessage='Welcome to {display_name}. Messages can only be posted by admins. Everyone automatically becomes a permanent member of this channel when they join the team.'
                        values={{
                            display_name: channel.display_name,
                        }}
                    />
                }
            </p>
            {actionButtons}
        </div>
    );
}

function createStandardIntroMessage(
    channel: Channel,
    centeredIntro: string,
    currentUser: UserProfileType,
    isFavorite: boolean,
    isMobileView: boolean,
    toggleFavorite: () => void,
    stats: any,
    usersLimit: number,
    locale: string,
    creatorName: string,
) {
    const uiName = channel.display_name;
    let memberMessage;
    let teamInviteLink = null;
    const channelIsArchived = channel.delete_at !== 0;
    const totalUsers = stats.total_users_count;
    const inviteUsers = totalUsers < usersLimit;

    if (channelIsArchived) {
        memberMessage = '';
    } else if (channel.type === Constants.PRIVATE_CHANNEL) {
        memberMessage = (
            <FormattedMessage
                id='intro_messages.onlyInvited'
                defaultMessage='This is the start of {display_name}. Only invited members can see this private channel.'
                values={{
                    display_name: channel.display_name,
                }}
            />
        );
    } else {
        memberMessage = (
            <FormattedMessage
                id='intro_messages.anyMember'
                defaultMessage='This is the start of {display_name}. Any team member can join and read this channel.'
                values={{
                    display_name: channel.display_name,
                }}
            />
        );
    }

    const date = (
        <FormattedDate
            value={channel.create_at}
            month={getMonthLong(locale)}
            day='2-digit'
            year='numeric'
        />
    );

    let createMessage;
    if (creatorName === '') {
        if (channel.type === Constants.PRIVATE_CHANNEL) {
            createMessage = (
                <FormattedMessage
                    id='intro_messages.noCreatorPrivate'
                    defaultMessage='Private channel created on {date}.'
                    values={{name: (uiName), date}}
                />
            );
        } else if (channel.type === Constants.OPEN_CHANNEL) {
            createMessage = (
                <FormattedMessage
                    id='intro_messages.noCreator'
                    defaultMessage='Public channel created on {date}.'
                    values={{name: (uiName), date}}
                />
            );
        }
    } else if (channel.type === Constants.PRIVATE_CHANNEL) {
        createMessage = (
            <span>
                <FormattedMessage
                    id='intro_messages.creatorPrivate'
                    defaultMessage='Private channel created by {creator} on {date}.'
                    values={{
                        name: (uiName),
                        creator: (creatorName),
                        date,
                    }}
                />
            </span>
        );
    } else if (channel.type === Constants.OPEN_CHANNEL) {
        createMessage = (
            <span>
                <FormattedMessage
                    id='intro_messages.creator'
                    defaultMessage='Public channel created by {creator} on {date}.'
                    values={{
                        name: (uiName),
                        creator: (creatorName),
                        date,
                    }}
                />
            </span>
        );
    }

    let purposeMessage;
    if (channel.purpose && channel.purpose !== '') {
        purposeMessage = (
            <span>
                <FormattedMessage
                    id='intro_messages.purpose'
                    defaultMessage=" This channel's purpose is: {purpose}"
                    values={{purpose: channel.purpose}}
                />
            </span>
        );
    }

    const isPrivate = channel.type === Constants.PRIVATE_CHANNEL;
    let setHeaderButton = null;
    let actionButtons = null;
    const children = createSetHeaderButton(channel);
    if (children) {
        setHeaderButton = (
            <ChannelPermissionGate
                teamId={channel.team_id}
                channelId={channel.id}
                permissions={[isPrivate ? Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES : Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES]}
            >
                {children}
            </ChannelPermissionGate>
        );
    }

    teamInviteLink = (
        <AddMembersButton
            totalUsers={totalUsers}
            usersLimit={usersLimit}
            channel={channel}
            pluginButtons={<PluggableIntroButtons channel={channel}/>}
        />
    );

    if (inviteUsers) {
        actionButtons = (
            <div className='channel-intro__actions'>
                {actionButtons = teamInviteLink}
            </div>
        );
    } else {
        actionButtons = (
            <div className='channel-intro__actions'>
                {createFavoriteButton(isFavorite, toggleFavorite)}
                {teamInviteLink}
                {setHeaderButton}
                {!isMobileView && createNotificationPreferencesButton(channel, currentUser)}
                <PluggableIntroButtons channel={channel}/>
            </div>
        );
    }

    return (
        <div
            id='channelIntro'
            className={'channel-intro ' + centeredIntro}
        >
            {isPrivate ? <ChannelIntroPrivateSvg/> : <ChannelIntroPublicSvg/>}
            <h2 className='channel-intro__title'>
                {channel.display_name}
            </h2>
            <div className='channel-intro__created'>
                {isPrivate ? <LockOutlineIcon size={14}/> : <GlobeIcon size={14}/>}
                {createMessage}
            </div>
            <p className='channel-intro__text'>
                {memberMessage}
                {purposeMessage}
            </p>
            {actionButtons}
        </div>
    );
}

function createSetHeaderButton(channel: Channel) {
    const channelIsArchived = channel.delete_at !== 0;
    if (channelIsArchived) {
        return null;
    }

    return (
        <ToggleModalButton
            modalId={ModalIdentifiers.EDIT_CHANNEL_HEADER}
            ariaLabel={Utils.localizeMessage('intro_messages.setHeader', 'Set header')}
            className={'action-button'}
            dialogType={EditChannelHeaderModal}
            dialogProps={{channel}}
        >
            <PencilOutlineIcon
                size={24}
            />
            <FormattedMessage
                id='intro_messages.setHeader'
                defaultMessage='Set header'
            />
        </ToggleModalButton>
    );
}

function createFavoriteButton(isFavorite: boolean, toggleFavorite: () => void, classes?: string) {
    let favoriteText;
    if (isFavorite) {
        favoriteText = (
            <FormattedMessage
                id='channel_info_rhs.top_buttons.favorited'
                defaultMessage='Favorited'
            />);
    } else {
        favoriteText = (
            <FormattedMessage
                id='channel_info_rhs.top_buttons.favorite'
                defaultMessage='Favorite'
            />);
    }
    return (
        <button
            id='toggleFavoriteIntroButton'
            className={`action-button ${isFavorite ? 'active' : ''}  ${classes}`}
            onClick={toggleFavorite}
            aria-label={'Favorite'}
        >
            {isFavorite ? <StarIcon size={24}/> : <StarOutlineIcon size={24}/>}
            {favoriteText}
        </button>
    );
}

function createNotificationPreferencesButton(channel: Channel, currentUser: UserProfileType) {
    return (
        <ToggleModalButton
            modalId={ModalIdentifiers.CHANNEL_NOTIFICATIONS}
            ariaLabel={Utils.localizeMessage('intro_messages.notificationPreferences', 'Notification Preferences')}
            className={'action-button'}
            dialogType={ChannelNotificationsModal}
            dialogProps={{channel, currentUser}}
        >
            <BellRingOutlineIcon size={24}/>
            <FormattedMessage
                id='intro_messages.notificationPreferences'
                defaultMessage='Notifications'
            />
        </ToggleModalButton>
    );
}
