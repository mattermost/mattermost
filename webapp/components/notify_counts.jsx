// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as utils from 'utils/utils.jsx';
import ChannelStore from 'stores/channel_store.jsx';
import TeamStore from 'stores/team_store.jsx';

function getCountsStateFromStores() {
    let mentionCount = 0;
    let messageCount = 0;
    const teamMembers = TeamStore.getMyTeamMembers();
    const channels = ChannelStore.getAll();
    const members = ChannelStore.getMyMembers();

    teamMembers.forEach((member) => {
        if (member.team_id !== TeamStore.getCurrentId()) {
            mentionCount += (member.mention_count || 0);
            messageCount += (member.msg_count || 0);
        }
    });

    channels.forEach((channel) => {
        const channelMember = members[channel.id];
        if (channelMember == null) {
            return;
        }

        if (channel.type === 'D') {
            mentionCount += channel.total_msg_count - channelMember.msg_count;
        } else if (channelMember.mention_count > 0) {
            mentionCount += channelMember.mention_count;
        }
        if (channelMember.notify_props.mark_unread !== 'mention' && channel.total_msg_count - channelMember.msg_count > 0) {
            messageCount += 1;
        }
    });

    return {mentionCount, messageCount};
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
        if (this.state.mentionCount) {
            return <span className='badge badge-notify'>{this.state.mentionCount}</span>;
        } else if (this.state.messageCount) {
            return <span className='badge badge-notify'>{'•'}</span>;
        }
        return null;
    }
}
