// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as utils from 'utils/utils.jsx';
import ChannelStore from 'stores/channel_store.jsx';
import TeamStore from 'stores/team_store.jsx';

function getCountsStateFromStores() {
    let count = 0;
    const teamMembers = TeamStore.getMyTeamMembers();
    const channels = ChannelStore.getAll();
    const members = ChannelStore.getMyMembers();

    teamMembers.forEach((member) => {
        if (member.team_id !== TeamStore.getCurrentId()) {
            count += (member.mention_count || 0);
        }
    });

    channels.forEach((channel) => {
        const channelMember = members[channel.id];
        if (channelMember == null) {
            return;
        }

        if (channel.type === 'D') {
            count += channel.total_msg_count - channelMember.msg_count;
        } else if (channelMember.mention_count > 0) {
            count += channelMember.mention_count;
        }
    });

    return {count};
}

import React from 'react';

export default class NotifyCounts extends React.Component {
    constructor(props) {
        super(props);

        this.onListenerChange = this.onListenerChange.bind(this);

        this.state = getCountsStateFromStores();
        this.mounted = false;
    }
    componentDidMount() {
        this.mounted = true;
        ChannelStore.addChangeListener(this.onListenerChange);
        TeamStore.addChangeListener(this.onListenerChange);
    }
    componentWillUnmount() {
        this.mounted = false;
        ChannelStore.removeChangeListener(this.onListenerChange);
        TeamStore.removeChangeListener(this.onListenerChange);
    }
    onListenerChange() {
        if (this.mounted) {
            var newState = getCountsStateFromStores();
            if (!utils.areObjectsEqual(newState, this.state)) {
                this.setState(newState);
            }
        }
    }
    render() {
        if (this.state.count) {
            return <span className='badge badge-notify'>{this.state.count}</span>;
        }
        return null;
    }
}
