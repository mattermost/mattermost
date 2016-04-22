// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {FormattedMessage} from 'react-intl';
import UserListRow from './user_list_row.jsx';

import React from 'react';

export default class UserList extends React.Component {
    render() {
        const users = this.props.users;

        let content;
        if (users.length > 0) {
            content = users.map((user) => {
                var teamMember;
                for (var index in this.props.teamMembers) {
                    if (this.props.teamMembers[index].user_id === user.id) {
                        teamMember = this.props.teamMembers[index];
                    }
                }

                return (
                    <UserListRow
                        key={user.id}
                        user={user}
                        teamMember={teamMember}
                        actions={this.props.actions}
                        actionProps={this.props.actionProps}
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
            <div>
                {content}
            </div>
        );
    }
}

UserList.defaultProps = {
    users: [],
    teamMembers: [],
    actions: [],
    actionProps: {}
};

UserList.propTypes = {
    users: React.PropTypes.arrayOf(React.PropTypes.object),
    teamMembers: React.PropTypes.arrayOf(React.PropTypes.object),
    actions: React.PropTypes.arrayOf(React.PropTypes.func),
    actionProps: React.PropTypes.object
};
