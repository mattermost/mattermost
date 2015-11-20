// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import SocketStore from '../stores/socket_store.jsx';
import UserStore from '../stores/user_store.jsx';

import Constants from '../utils/constants.jsx';
const SocketEvents = Constants.SocketEvents;

export default class MsgTyping extends React.Component {
    constructor(props) {
        super(props);

        this.onChange = this.onChange.bind(this);
        this.updateTypingText = this.updateTypingText.bind(this);
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
            this.updateTypingText();
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
                this.updateTypingText();
            }.bind(this, username), Constants.UPDATE_TYPING_MS);

            this.updateTypingText();
        } else if (msg.action === SocketEvents.POSTED && msg.channel_id === this.props.channelId) {
            if (UserStore.hasProfile(msg.user_id)) {
                username = UserStore.getProfile(msg.user_id).username;
            }
            clearTimeout(this.typingUsers[username]);
            delete this.typingUsers[username];
            this.updateTypingText();
        }
    }

    updateTypingText() {
        const users = Object.keys(this.typingUsers);
        let text = '';
        switch (users.length) {
        case 0:
            text = '';
            break;
        case 1:
            text = users[0] + ' is typing...';
            break;
        default: {
            const last = users.pop();
            text = users.join(', ') + ' and ' + last + ' are typing...';
            break;
        }
        }

        this.setState({text});
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
