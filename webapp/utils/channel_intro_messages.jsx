// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from './utils.jsx';
import ChannelInviteModal from 'components/channel_invite_modal';
import EditChannelHeaderModal from 'components/edit_channel_header_modal.jsx';
import ToggleModalButton from 'components/toggle_modal_button.jsx';
import UserProfile from 'components/user_profile.jsx';
import ChannelStore from 'stores/channel_store.jsx';
import UserStore from 'stores/user_store.jsx';
import TeamStore from 'stores/team_store.jsx';
import Constants from 'utils/constants.jsx';
import * as GlobalActions from 'actions/global_actions.jsx';
import ProfilePicture from 'components/profile_picture.jsx';

import {showManagementOptions} from './channel_utils.jsx';

import React from 'react';
import {FormattedMessage, FormattedHTMLMessage, FormattedDate} from 'react-intl';

export function createChannelIntroMessage(channel, fullWidthIntro) {
    let centeredIntro = '';
    if (!fullWidthIntro) {
        centeredIntro = 'channel-intro--centered';
    }

    if (channel.type === Constants.DM_CHANNEL) {
        return createDMIntroMessage(channel, centeredIntro);
    } else if (channel.type === Constants.GM_CHANNEL) {
        return createGMIntroMessage(channel, centeredIntro);
    } else if (ChannelStore.isDefault(channel)) {
        return createDefaultIntroMessage(channel, centeredIntro);
    } else if (channel.name === Constants.OFFTOPIC_CHANNEL) {
        return createOffTopicIntroMessage(channel, centeredIntro);
    } else if (channel.type === 'O' || channel.type === 'P') {
        return createStandardIntroMessage(channel, centeredIntro);
    }
    return null;
}

export function createGMIntroMessage(channel, centeredIntro) {
    const profiles = UserStore.getProfileListInChannel(channel.id, true);

    if (profiles.length > 0) {
        const pictures = [];
        let names = '';
        for (let i = 0; i < profiles.length; i++) {
            const profile = profiles[i];

            pictures.push(
                <ProfilePicture
                    key={'introprofilepicture' + profile.id}
                    src={Utils.imageURLForUser(profile)}
                    width='50'
                    height='50'
                    user={profile}
                />
            );

            if (i === profiles.length - 1) {
                names += Utils.displayUsernameForUser(profile);
            } else if (i === profiles.length - 2) {
                names += Utils.displayUsernameForUser(profile) + ' and ';
            } else {
                names += Utils.displayUsernameForUser(profile) + ', ';
            }
        }

        return (
            <div className={'channel-intro ' + centeredIntro}>
                <div className='post-profile-img__container channel-intro-img'>
                    {pictures}
                </div>
                <p className='channel-intro-text'>
                    <FormattedHTMLMessage
                        id='intro_messages.GM'
                        defaultMessage='This is the start of your group message history with {names}.<br />Messages and files shared here are not shown to people outside this area.'
                        values={{
                            names
                        }}
                    />
                </p>
                {createSetHeaderButton(channel)}
            </div>
        );
    }

    return (
        <div className={'channel-intro ' + centeredIntro}>
            <p className='channel-intro-text'>
                <FormattedMessage
                    id='intro_messages.group_message'
                    defaultMessage='This is the start of your group message history with these teammates. Messages and files shared here are not shown to people outside this area.'
                />
            </p>
        </div>
    );
}

export function createDMIntroMessage(channel, centeredIntro) {
    var teammate = Utils.getDirectTeammate(channel.id);

    if (teammate) {
        var teammateName = teammate.username;
        if (teammate.nickname.length > 0) {
            teammateName = teammate.nickname;
        }

        return (
            <div className={'channel-intro ' + centeredIntro}>
                <div className='post-profile-img__container channel-intro-img'>
                    <ProfilePicture
                        src={Utils.imageURLForUser(teammate)}
                        width='50'
                        height='50'
                        user={teammate}
                        hasMention={true}
                    />
                </div>
                <div className='channel-intro-profile'>
                    <strong>
                        <UserProfile
                            user={teammate}
                            disablePopover={false}
                            hasMention={true}
                        />
                    </strong>
                </div>
                <p className='channel-intro-text'>
                    <FormattedHTMLMessage
                        id='intro_messages.DM'
                        defaultMessage='This is the start of your direct message history with {teammate}.<br />Direct messages and files shared here are not shown to people outside this area.'
                        values={{
                            teammate: teammateName
                        }}
                    />
                </p>
                {createSetHeaderButton(channel)}
            </div>
        );
    }

    return (
        <div className={'channel-intro ' + centeredIntro}>
            <p className='channel-intro-text'>
                <FormattedMessage
                    id='intro_messages.teammate'
                    defaultMessage='This is the start of your direct message history with this teammate. Direct messages and files shared here are not shown to people outside this area.'
                />
            </p>
        </div>
    );
}

export function createOffTopicIntroMessage(channel, centeredIntro) {
    var uiType = (
        <FormattedMessage
            id='intro_messages.channel'
            defaultMessage='channel'
        />
    );

    const isChannelAdmin = ChannelStore.isChannelAdminForCurrentChannel();
    const isTeamAdmin = TeamStore.isTeamAdminForCurrentTeam();
    const isSystemAdmin = UserStore.isSystemAdminForCurrentUser();

    let setHeaderButton = createSetHeaderButton(channel);
    if (!showManagementOptions(channel, isChannelAdmin, isTeamAdmin, isSystemAdmin)) {
        setHeaderButton = null;
    }

    return (
        <div className={'channel-intro ' + centeredIntro}>
            <FormattedHTMLMessage
                id='intro_messages.offTopic'
                defaultMessage='<h4 class="channel-intro__title">Beginning of {display_name}</h4><p class="channel-intro__content">This is the start of {display_name}, a channel for non-work-related conversations.<br/></p>'
                values={{
                    display_name: channel.display_name
                }}
            />
            {createInviteChannelMemberButton(channel, uiType)}
            {setHeaderButton}
        </div>
    );
}

export function createDefaultIntroMessage(channel, centeredIntro) {
    let inviteModalLink = (
        <a
            className='intro-links'
            href='#'
            onClick={GlobalActions.showGetTeamInviteLinkModal}
        >
            <i className='fa fa-user-plus'/>
            <FormattedMessage
                id='intro_messages.inviteOthers'
                defaultMessage='Invite others to this team'
            />
        </a>
    );

    const isChannelAdmin = ChannelStore.isChannelAdminForCurrentChannel();
    const isTeamAdmin = TeamStore.isTeamAdminForCurrentTeam();
    const isSystemAdmin = UserStore.isSystemAdminForCurrentUser();

    if (global.window.mm_license.IsLicensed === 'true') {
        if (global.window.mm_config.RestrictTeamInvite === Constants.PERMISSIONS_SYSTEM_ADMIN && !isSystemAdmin) {
            inviteModalLink = null;
        } else if (global.window.mm_config.RestrictTeamInvite === Constants.PERMISSIONS_TEAM_ADMIN && !(isTeamAdmin || isSystemAdmin)) {
            inviteModalLink = null;
        }
    }

    let setHeaderButton = createSetHeaderButton(channel);
    if (!showManagementOptions(channel, isChannelAdmin, isTeamAdmin, isSystemAdmin)) {
        setHeaderButton = null;
    }

    return (
        <div className={'channel-intro ' + centeredIntro}>
            <FormattedHTMLMessage
                id='intro_messages.default'
                defaultMessage="<h4 class='channel-intro__title'>Beginning of {display_name}</h4><p class='channel-intro__content'><strong>Welcome to {display_name}!</strong><br/><br/>This is the first channel teammates see when they sign up - use it for posting updates everyone needs to know.</p>"
                values={{
                    display_name: channel.display_name
                }}
            />
            {inviteModalLink}
            {setHeaderButton}
            <br/>
        </div>
    );
}

export function createStandardIntroMessage(channel, centeredIntro) {
    var uiName = channel.display_name;
    var creatorName = Utils.displayUsername(channel.creator_id);
    var uiType;
    var memberMessage;

    if (channel.type === 'P') {
        uiType = (
            <FormattedMessage
                id='intro_messages.group'
                defaultMessage='private channel'
            />
        );
        memberMessage = (
            <FormattedMessage
                id='intro_messages.onlyInvited'
                defaultMessage=' Only invited members can see this private channel.'
            />
        );
    } else {
        uiType = (
            <FormattedMessage
                id='intro_messages.channel'
                defaultMessage='channel'
            />
        );
        memberMessage = (
            <FormattedMessage
                id='intro_messages.anyMember'
                defaultMessage=' Any member can join and read this channel.'
            />
        );
    }

    const date = (
        <FormattedDate
            value={channel.create_at}
            month='long'
            day='2-digit'
            year='numeric'
        />
    );

    var createMessage;
    if (creatorName === '') {
        createMessage = (
            <FormattedMessage
                id='intro_messages.noCreator'
                defaultMessage='This is the start of the {name} {type}, created on {date}.'
                values={{
                    name: (uiName),
                    type: (uiType),
                    date
                }}
            />
        );
    } else {
        createMessage = (
            <span>
                <FormattedMessage
                    id='intro_messages.creator'
                    defaultMessage='This is the start of the {name} {type}, created by {creator} on {date}.'
                    values={{
                        name: (uiName),
                        type: (uiType),
                        creator: (creatorName),
                        date
                    }}
                />
            </span>
        );
    }

    var purposeMessage = '';
    if (channel.purpose && channel.purpose !== '') {
        purposeMessage = (
            <span>
                <FormattedMessage
                    id='intro_messages.purpose'
                    defaultMessage=" This {type}'s purpose is: {purpose}"
                    values={{
                        purpose: channel.purpose,
                        type: (uiType)
                    }}
                />
            </span>
        );
    }

    const isChannelAdmin = ChannelStore.isChannelAdminForCurrentChannel();
    const isTeamAdmin = TeamStore.isTeamAdminForCurrentTeam();
    const isSystemAdmin = UserStore.isSystemAdminForCurrentUser();

    let setHeaderButton = createSetHeaderButton(channel);
    if (!showManagementOptions(channel, isChannelAdmin, isTeamAdmin, isSystemAdmin)) {
        setHeaderButton = null;
    }

    return (
        <div className={'channel-intro ' + centeredIntro}>
            <h4 className='channel-intro__title'>
                <FormattedMessage
                    id='intro_messages.beginning'
                    defaultMessage='Beginning of {name}'
                    values={{
                        name: (uiName)
                    }}
                />
            </h4>
            <p className='channel-intro__content'>
                {createMessage}
                {memberMessage}
                {purposeMessage}
                <br/>
            </p>
            {createInviteChannelMemberButton(channel, uiType)}
            {setHeaderButton}
        </div>
    );
}

function createInviteChannelMemberButton(channel, uiType) {
    return (
        <ToggleModalButton
            className='intro-links'
            dialogType={ChannelInviteModal}
            dialogProps={{channel}}
        >
            <i className='fa fa-user-plus'/>
            <FormattedMessage
                id='intro_messages.invite'
                defaultMessage='Invite others to this {type}'
                values={{
                    type: (uiType)
                }}
            />
        </ToggleModalButton>
    );
}

function createSetHeaderButton(channel) {
    return (
        <ToggleModalButton
            className='intro-links'
            dialogType={EditChannelHeaderModal}
            dialogProps={{channel}}
        >
            <i className='fa fa-pencil'/>
            <FormattedMessage
                id='intro_messages.setHeader'
                defaultMessage='Set a Header'
            />
        </ToggleModalButton>
    );
}
