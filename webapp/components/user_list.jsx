// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import UserListRow from './user_list_row.jsx';
import LoadingScreen from 'components/loading_screen.jsx';

import React from 'react';
import {FormattedMessage} from 'react-intl';

export default class UserList extends React.Component {
    constructor(props) {
        super(props);

        this.scrollToTop = this.scrollToTop.bind(this);
    }

    scrollToTop() {
        if (this.refs.container) {
            this.refs.container.scrollTop = 0;
        }
    }

    render() {
        const users = this.props.users;

        let content;
        if (users == null) {
            return <LoadingScreen/>;
        } else if (users.length > 0) {
            content = users.map((user) => {
                return (
                    <UserListRow
                        key={user.id}
                        user={user}
                        extraInfo={this.props.extraInfo[user.id]}
                        actions={this.props.actions}
                        actionProps={this.props.actionProps}
                        actionUserProps={this.props.actionUserProps[user.id]}
                    />
                );
            });
        } else {
            content = (
                <div
                    key='no-users-found'
                    className='no-channel-message'
                >
                    <p className='primary-message'>
                        <FormattedMessage
                            id='user_list.notFound'
                            defaultMessage='No users found :('
                        />
                    </p>
                </div>
            );
        }

        return (
            <div ref='container'>
                {content}
            </div>
        );
    }
}

UserList.defaultProps = {
    users: [],
    extraInfo: {},
    actions: [],
    actionProps: {}
};

UserList.propTypes = {
    users: React.PropTypes.arrayOf(React.PropTypes.object),
    extraInfo: React.PropTypes.object,
    actions: React.PropTypes.arrayOf(React.PropTypes.func),
    actionProps: React.PropTypes.object,
    actionUserProps: React.PropTypes.object
};
