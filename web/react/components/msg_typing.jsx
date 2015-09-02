// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var SocketStore = require('../stores/socket_store.jsx');
var UserStore = require('../stores/user_store.jsx');

export default class MsgTyping extends React.Component {
    constructor(props) {
        super(props);

        this.timer = null;
        this.lastTime = 0;

        this.onChange = this.onChange.bind(this);

        this.state = {
            text: ''
        };
    }

    componentDidMount() {
        SocketStore.addChangeListener(this.onChange);
    }

    componentWillReceiveProps(newProps) {
        if (this.props.channelId !== newProps.channelId) {
            this.setState({text: ''});
        }
    }

    componentWillUnmount() {
        SocketStore.removeChangeListener(this.onChange);
    }

    onChange(msg) {
        if (msg.action === 'typing' &&
            this.props.channelId === msg.channel_id &&
            this.props.parentId === msg.props.parent_id) {
            this.lastTime = new Date().getTime();

            var username = 'Someone';
            if (UserStore.hasProfile(msg.user_id)) {
                username = UserStore.getProfile(msg.user_id).username;
            }

            this.setState({text: username + ' is typing...'});

            if (!this.timer) {
                this.timer = setInterval(function myTimer() {
                    if ((new Date().getTime() - this.lastTime) > 8000) {
                        this.setState({text: ''});
                    }
                }.bind(this), 3000);
            }
        } else if (msg.action === 'posted' && msg.channel_id === this.props.channelId) {
            this.setState({text: ''});
        }
    }

    render() {
        return (
            <span className='msg-typing'>{this.state.text}</span>
        );
    }
}

MsgTyping.propTypes = {
    channelId: React.PropTypes.string,
    parentId: React.PropTypes.string
};
