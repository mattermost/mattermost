// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import UserTypingStore from 'stores/user_typing_store.jsx';

import {FormattedMessage} from 'react-intl';

import PropTypes from 'prop-types';

import React from 'react';

class MsgTyping extends React.Component {
    constructor(props) {
        super(props);

        this.onTypingChange = this.onTypingChange.bind(this);
        this.updateTypingText = this.updateTypingText.bind(this);
        this.componentWillReceiveProps = this.componentWillReceiveProps.bind(this);

        this.state = {
            text: ''
        };
    }

    componentWillMount() {
        UserTypingStore.addChangeListener(this.onTypingChange);
        this.onTypingChange();
    }

    componentWillUnmount() {
        UserTypingStore.removeChangeListener(this.onTypingChange);
    }

    componentWillReceiveProps(nextProps) {
        if (this.props.channelId !== nextProps.channelId) {
            this.updateTypingText(UserTypingStore.getUsersTyping(nextProps.channelId, nextProps.parentId));
        }
    }

    onTypingChange() {
        this.updateTypingText(UserTypingStore.getUsersTyping(this.props.channelId, this.props.parentId));
    }

    updateTypingText(typingUsers) {
        let text = '';
        let users = {};
        let numUsers = 0;
        if (typingUsers) {
            users = Object.keys(typingUsers);
            numUsers = users.length;
        }

        switch (numUsers) {
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
                    values={{
                        users: (users.join(', ')),
                        last
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
    channelId: PropTypes.string,
    parentId: PropTypes.string
};

export default MsgTyping;
