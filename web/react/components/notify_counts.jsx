// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
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
        } else if (channelMember.notify_props.mark_unread !== 'mention' && channel.total_msg_count - channelMember.msg_count > 0) {
            count += 1;
        }
    });

    return {count: count};
}

export default class NotifyCounts extends React.Component {
    constructor(props) {
        super(props);

        this.onListenerChange = this.onListenerChange.bind(this);

        this.state = getCountsStateFromStores();
    }
    componentDidMount() {
        ChannelStore.addChangeListener(this.onListenerChange);
    }
    componentWillUnmount() {
        ChannelStore.removeChangeListener(this.onListenerChange);
    }
    onListenerChange() {
        var newState = getCountsStateFromStores();
        if (!utils.areStatesEqual(newState, this.state)) {
            this.setState(newState);
        }
    }
    render() {
        if (this.state.count) {
            return <span className='badge badge-notify'>{this.state.count}</span>;
        }
        return null;
    }
}
