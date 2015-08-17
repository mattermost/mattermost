// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var utils = require('../utils/utils.jsx');
var ChannelStore = require('../stores/channel_store.jsx');

function getCountsStateFromStores() {
    var count = 0;
    var channels = ChannelStore.getAll();
    var members = ChannelStore.getAllMembers();

    channels.forEach(function setChannelInfo(channel) {
        var channelMember = members[channel.id];
        if (channel.type === 'D') {
            count += channel.total_msg_count - channelMember.msg_count;
        } else if (channelMember.mention_count > 0) {
            count += channelMember.mention_count;
        } else if (channelMember.notify_level !== 'quiet' && channel.total_msg_count - channelMember.msg_count > 0) {
            count += 1;
        }
    });

    return {count: count};
}

module.exports = React.createClass({
    displayName: 'NotifyCounts',
    componentDidMount: function() {
        ChannelStore.addChangeListener(this.onListenerChange);
    },
    componentWillUnmount: function() {
        ChannelStore.removeChangeListener(this.onListenerChange);
    },
    onListenerChange: function() {
        var newState = getCountsStateFromStores();
        if (!utils.areStatesEqual(newState, this.state)) {
            this.setState(newState);
        }
    },
    getInitialState: function() {
        return getCountsStateFromStores();
    },
    render: function() {
        if (this.state.count) {
            return <span className='badge badge-notify'>{this.state.count}</span>;
        }
        return null;
    }
});
