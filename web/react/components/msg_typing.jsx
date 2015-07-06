// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var ChannelStore = require('../stores/channel_store.jsx');
var SocketStore = require('../stores/socket_store.jsx');
var UserStore = require('../stores/user_store.jsx');

module.exports = React.createClass({
    timer: null,
    lastTime: 0,
    componentDidMount: function() {
        ChannelStore.addDiffChannelChangeListener(this._onChange);
        SocketStore.addChangeListener(this._onSocketChange);
    },
    componentWillUnmount: function() {
        ChannelStore.removeDiffCHannelChangeListener(this._onChange);
        SocketStore.removeChangeListener(this._onSocketChange);
    },
    _onChange: function() {
        this.setState({text:""})
    },
    _onSocketChange: function(msg) {
        if (msg.action == "typing" && 
            this.props.channelId == msg.channel_id &&
            this.props.parentId == msg.props.parent_id) {

            this.lastTime = new Date().getTime();

            var username = "Someone";
            if (UserStore.hasProfile(msg.user_id)) {
                username = UserStore.getProfile(msg.user_id).username;
            }

            this.setState({ text: username + " is typing..." });

            if (!this.timer) {
                var outer = this;
                outer.timer = setInterval(function() {
                    if ((new Date().getTime() - outer.lastTime) > 8000) {
                        outer.setState({ text: "" });
                    } 
                }, 3000);
            }
        }
    },
    getInitialState: function() {
        return { text: "" };
    },
    render: function() {
        return (
        	<span className="msg-typing">{ this.state.text }</span>
        );
    }
});
