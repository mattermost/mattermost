// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from './utils.jsx';
import ChannelInviteModal from '../components/channel_invite_modal.jsx';
import EditChannelHeaderModal from '../components/edit_channel_header_modal.jsx';
import ToggleModalButton from '../components/toggle_modal_button.jsx';
import UserProfile from '../components/user_profile.jsx';
import ChannelStore from '../stores/channel_store.jsx';
import Constants from '../utils/constants.jsx';
import TeamStore from '../stores/team_store.jsx';
import * as EventHelpers from '../dispatcher/event_helpers.jsx';

export function createChannelIntroMessage(channel, messages) {
    if (channel.type === 'D') {
        return createDMIntroMessage(channel, messages);
    } else if (ChannelStore.isDefault(channel)) {
        return createDefaultIntroMessage(channel, messages);
    } else if (channel.name === Constants.OFFTOPIC_CHANNEL) {
        return createOffTopicIntroMessage(channel, messages);
    } else if (channel.type === 'O' || channel.type === 'P') {
        return createStandardIntroMessage(channel, messages);
    }
}

export function createDMIntroMessage(channel, messages) {
    var teammate = Utils.getDirectTeammate(channel.id);

    if (teammate) {
        var teammateName = teammate.username;
        if (teammate.nickname.length > 0) {
            teammateName = teammate.nickname;
        }

        return (
            <div className='channel-intro'>
                <div className='post-profile-img__container channel-intro-img'>
                    <img
                        className='post-profile-img'
                        src={'/api/v1/users/' + teammate.id + '/image?time=' + teammate.update_at + '&' + Utils.getSessionIndex()}
                        height='50'
                        width='50'
                    />
                </div>
                <div className='channel-intro-profile'>
                    <strong>
                        <UserProfile userId={teammate.id} />
                    </strong>
                </div>
                <p className='channel-intro-text'>
                    {messages.DMIntro1 + teammateName + '.'}<br/>
                    {messages.DMIntro2}
                </p>
                {createSetHeaderButton(channel, messages)}
            </div>
        );
    }

    return (
        <div className='channel-intro'>
            <p className='channel-intro-text'>{messages.DMIntro3}</p>
        </div>
    );
}

export function createOffTopicIntroMessage(channel, messages) {
    return (
        <div className='channel-intro'>
            <h4 className='channel-intro__title'>{messages.beginning + channel.display_name}</h4>
            <p className='channel-intro__content'>
                {messages.start1 + channel.display_name + messages.offTopic}
                <br/>
            </p>
            {createSetHeaderButton(channel, messages)}
            {createInviteChannelMemberButton(channel, 'channel', messages)}
        </div>
    );
}

export function createDefaultIntroMessage(channel, messages) {
    const team = TeamStore.getCurrent();
    let inviteModalLink;
    if (team.type === Constants.INVITE_TEAM) {
        inviteModalLink = (
            <a
                className='intro-links'
                href='#'
                onClick={EventHelpers.showInviteMemberModal}
            >
                <i className='fa fa-user-plus'></i>{messages.inviteOthers}
            </a>
        );
    } else {
        inviteModalLink = (
            <a
                className='intro-links'
                href='#'
                onClick={EventHelpers.showGetTeamInviteLinkModal}
            >
                <i className='fa fa-user-plus'></i>{messages.inviteOthers}
            </a>
        );
    }

    return (
        <div className='channel-intro'>
            <h4 className='channel-intro__title'>{messages.beginning + channel.display_name}</h4>
            <p className='channel-intro__content'>
                <strong>{messages.welcome + channel.display_name + '!'}</strong>
                <br/><br/>
                {messages.defaultIntro}
            </p>
            {inviteModalLink}
            {createSetHeaderButton(channel, messages)}
            <br/>
        </div>
    );
}

export function createStandardIntroMessage(channel, messages) {
    var uiName = channel.display_name;
    var creatorName = '';

    var uiType;
    var memberMessage;
    if (channel.type === 'P') {
        uiType = messages.pg;
        memberMessage = messages.memberMsg1;
    } else {
        uiType = messages.channel;
        memberMessage = messages.memberMsg2;
    }

    var createMessage;
    if (creatorName === '') {
        createMessage = messages.created + '.';
    } else if (locale === 'en') {
        createMessage = messages.createdBy;
    }

    return (
        <div className='channel-intro'>
            <h4 className='channel-intro__title'>{messages.beginning + uiName}</h4>
            <p className='channel-intro__content'>
                {createMessage}
                {memberMessage}
                <br/>
            </p>
            {createSetHeaderButton(channel, messages)}
            {createInviteChannelMemberButton(channel, uiType, messages)}
        </div>
    );
}

function createInviteChannelMemberButton(channel, uiType, messages) {
    return (
        <ToggleModalButton
            className='intro-links'
            dialogType={ChannelInviteModal}
            dialogProps={{channel}}
        >
            <i className='fa fa-user-plus'></i>{messages.inviteType + uiType}
        </ToggleModalButton>
    );
}

function createSetHeaderButton(channel, messages) {
    return (
        <ToggleModalButton
            className='intro-links'
            dialogType={EditChannelHeaderModal}
            dialogProps={{channel}}
        >
            <i className='fa fa-pencil'></i>{messages.header}
        </ToggleModalButton>
    );
}
