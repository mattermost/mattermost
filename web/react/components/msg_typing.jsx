// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.


var SocketStore = require('../stores/socket_store.jsx');
var UserStore = require('../stores/user_store.jsx');

module.exports = React.createClass({
    timer: null,
    lastTime: 0,
    componentDidMount: function() {
        SocketStore.addChangeListener(this._onChange);
    },
    componentWillReceiveProps: function(newProps) {
        if(this.props.channelId !== newProps.channelId) {
            this.setState({text:""});
        }
    },
    componentWillUnmount: function() {
        SocketStore.removeChangeListener(this._onChange);
    },
    _onChange: function(msg) {
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
        else if (msg.action == "posted" && msg.channel_id === this.props.channelId) {
            this.setState({text:""})
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
