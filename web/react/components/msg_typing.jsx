// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import SocketStore from '../stores/socket_store.jsx';
import UserStore from '../stores/user_store.jsx';

import Constants from '../utils/constants.jsx';

import {intlShape, injectIntl, defineMessages, FormattedMessage} from 'mm-intl';

const SocketEvents = Constants.SocketEvents;

const holders = defineMessages({
    someone: {
        id: 'msg_typing.someone',
        defaultMessage: 'Someone'
    }
});

class MsgTyping extends React.Component {
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

    componentWillReceiveProps(nextProps) {
        if (this.props.channelId !== nextProps.channelId) {
            for (const u in this.typingUsers) {
                if (!this.typingUsers.hasOwnProperty(u)) {
                    continue;
                }

                clearTimeout(this.typingUsers[u]);
            }
            this.typingUsers = {};
            this.setState({text: ''});
        }
    }

    componentWillUnmount() {
        SocketStore.removeChangeListener(this.onChange);
    }

    onChange(msg) {
        let username = this.props.intl.formatMessage(holders.someone);
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
            text = (
                <FormattedMessage
                    id='msg_typing.isTyping'
                    defaultMessage='{user} is typing...'
                    values={{
                        user: users[0]
                    }}
                />
            );
            break;
        default: {
            const last = users.pop();
            text = (
                <FormattedMessage
                    id='msg_typing.areTyping'
                    defaultMessage='{users} and {last} are typing...'
                    vaues={{
                        users: users.join(', '),
                        last: last
                    }}
                />
            );
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
    intl: intlShape.isRequired,
    channelId: React.PropTypes.string,
    parentId: React.PropTypes.string
};

export default injectIntl(MsgTyping);