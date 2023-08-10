// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {injectIntl} from 'react-intl';

import {Client4} from 'mattermost-redux/client';

import {trackEvent} from 'actions/telemetry_actions';

import ProfilePicture from 'components/profile_picture';

import {getHistory} from 'utils/browser_history';
import {Constants} from 'utils/constants';

import SidebarChannelLink from '../sidebar_channel_link';

import type {Channel} from '@mattermost/types/channels';
import type {PreferenceType} from '@mattermost/types/preferences';
import type {UserProfile} from '@mattermost/types/users';
import type {IntlShape} from 'react-intl';

type Props = {
    intl: IntlShape;
    channel: Channel;
    teammate?: UserProfile;
    currentTeamName: string;
    currentUserId: string;
    redirectChannel: string;
    active: boolean;
    actions: {
        savePreferences: (userId: string, preferences: PreferenceType[]) => Promise<{data: boolean}>;
        leaveDirectChannel: (channelId: string) => Promise<{data: boolean}>;
    };
};

class SidebarDirectChannel extends React.PureComponent<Props> {
    handleLeaveChannel = (callback: () => void) => {
        const id = this.props.channel.teammate_id;
        const category = Constants.Preferences.CATEGORY_DIRECT_CHANNEL_SHOW;

        const currentUserId = this.props.currentUserId;
        this.props.actions.savePreferences(currentUserId, [{user_id: currentUserId, category, name: id!, value: 'false'}]).then(callback);
        this.props.actions.leaveDirectChannel(this.props.channel.name);

        trackEvent('ui', 'ui_direct_channel_x_button_clicked');

        if (this.props.active) {
            getHistory().push(`/${this.props.currentTeamName}/channels/${this.props.redirectChannel}`);
        }
    };

    getIcon = () => {
        const {channel, teammate} = this.props;

        if (!teammate) {
            return null;
        }

        if (teammate.id && teammate.delete_at) {
            return (
                <i className='icon icon-archive-outline'/>
            );
        }

        let className = '';
        if (channel.status === 'online') {
            className = 'status-online';
        } else if (channel.status === 'away') {
            className = 'status-away';
        } else if (channel.status === 'dnd') {
            className = 'status-dnd';
        }

        return (
            <ProfilePicture
                src={Client4.getProfilePictureUrl(teammate.id, teammate.last_picture_update)}
                size={'xs'}
                status={teammate.is_bot ? '' : channel.status}
                wrapperClass='DirectChannel__profile-picture'
                newStatusIcon={true}
                statusClass={`DirectChannel__status-icon ${className}`}
            />
        );
    };

    render() {
        const {channel, teammate, currentTeamName} = this.props;

        if (!teammate) {
            return null;
        }

        let displayName = channel.display_name;
        if (this.props.currentUserId === teammate.id) {
            displayName = this.props.intl.formatMessage({
                id: 'sidebar.directchannel.you',
                defaultMessage: '{displayname} (you)',
            }, {
                displayname: channel.display_name,
            });
        }

        return (
            <SidebarChannelLink
                teammateId={teammate.id}
                channel={channel}
                link={`/${currentTeamName}/messages/@${teammate.username}`}
                label={displayName}
                channelLeaveHandler={this.handleLeaveChannel}
                icon={this.getIcon()}
            />
        );
    }
}

export default injectIntl(SidebarDirectChannel);
