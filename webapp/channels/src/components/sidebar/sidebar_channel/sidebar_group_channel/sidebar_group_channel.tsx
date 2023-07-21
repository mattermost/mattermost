// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Channel} from '@mattermost/types/channels';
import {PreferenceType} from '@mattermost/types/preferences';
import React from 'react';

import {trackEvent} from 'actions/telemetry_actions';

import SidebarChannelLink from 'components/sidebar/sidebar_channel/sidebar_channel_link';

import {getHistory} from 'utils/browser_history';
import Constants from 'utils/constants';

type Props = {
    channel: Channel;
    currentTeamName: string;
    currentUserId: string;
    redirectChannel: string;
    active: boolean;
    membersCount: number;
    actions: {
        savePreferences: (userId: string, preferences: PreferenceType[]) => Promise<{data: boolean}>;
    };
};

type State = Record<string, never>;

export default class SidebarGroupChannel extends React.PureComponent<Props, State> {
    handleLeaveChannel = (callback: () => void) => {
        const id = this.props.channel.id;
        const category = Constants.Preferences.CATEGORY_GROUP_CHANNEL_SHOW;

        const currentUserId = this.props.currentUserId;
        this.props.actions.savePreferences(currentUserId, [{user_id: currentUserId, category, name: id, value: 'false'}]).then(callback);

        trackEvent('ui', 'ui_direct_channel_x_button_clicked');

        if (this.props.active) {
            getHistory().push(`/${this.props.currentTeamName}/channels/${this.props.redirectChannel}`);
        }
    };

    getIcon = () => {
        return (
            <div className='status status--group'>{this.props.membersCount}</div>
        );
    };

    render() {
        const {channel, currentTeamName} = this.props;

        return (
            <SidebarChannelLink
                channel={channel}
                link={`/${currentTeamName}/messages/${channel.name}`}
                label={channel.display_name}
                channelLeaveHandler={this.handleLeaveChannel}
                icon={this.getIcon()}
            />
        );
    }
}
