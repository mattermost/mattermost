// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

const SocketStore = require('../stores/socket_store.jsx');
const UserStore = require('../stores/user_store.jsx');

const Constants = require('../utils/constants.jsx');
const SocketEvents = Constants.SocketEvents;

export default class MsgTyping extends React.Component {
    constructor(props) {
        super(props);

        this.onChange = this.onChange.bind(this);
        this.getTypingText = this.getTypingText.bind(this);
        this.componentWillReceiveProps = this.componentWillReceiveProps.bind(this);

        this.typingUsers = {};
        this.state = {
            text: ''
        };
    }

    componentDidMount() {
        SocketStore.addChangeListener(this.onChange);
    }

    componentWillReceiveProps(newProps) {
        if (this.props.channelId !== newProps.channelId) {
            this.setState({text: this.getTypingText()});
        }
    }

    componentWillUnmount() {
        SocketStore.removeChangeListener(this.onChange);
    }

    onChange(msg) {
        let username = 'Someone';
        if (msg.action === SocketEvents.TYPING &&
                this.props.channelId === msg.channel_id &&
                this.props.parentId === msg.props.parent_id) {
            if (UserStore.hasProfile(msg.user_id)) {
                username = UserStore.getProfile(msg.user_id).username;
            }

            if (this.typingUsers[username]) {
                clearTimeout(this.typingUsers[username]);
            }

            this.typingUsers[username] = setTimeout(function myTimer(user) {
                delete this.typingUsers[user];
                this.setState({text: this.getTypingText()});
            }.bind(this, username), Constants.UPDATE_TYPING_MS);

            this.setState({text: this.getTypingText()});
        } else if (msg.action === SocketEvents.POSTED && msg.channel_id === this.props.channelId) {
            if (UserStore.hasProfile(msg.user_id)) {
                username = UserStore.getProfile(msg.user_id).username;
            }
            clearTimeout(this.typingUsers[username]);
            delete this.typingUsers[username];
            this.setState({text: this.getTypingText()});
        }
    }

    getTypingText() {
        let users = Object.keys(this.typingUsers);
        switch (users.length) {
        case 0:
            return '';
        case 1:
            return users[0] + ' is typing...';
        default:
            const last = users.pop();
            return users.join(', ') + ' and ' + last + ' are typing...';
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
