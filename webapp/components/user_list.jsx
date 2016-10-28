// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import UserListRow from './user_list_row.jsx';
import LoadingScreen from 'components/loading_screen.jsx';

import React from 'react';
import {FormattedMessage} from 'react-intl';
import Infinite from 'react-infinite';

export default class UserList extends React.Component {
    render() {
        const users = this.props.users;

        let content;
        if (users == null) {
            return <LoadingScreen/>;
        } else if (users.length > 0) {
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
        if (this.props.infinite && (this.props.listHeight > 0)) {
            content = (
                <Infinite
                    elementHeight={60}
                    containerHeight={this.props.listHeight - 64}
                    infiniteLoadBeginEdgeOffset={500}
                    onInfiniteLoad={this.props.nextPage}
                    preloadBatchSize={1500}
                >
                    {content}
                </Infinite>
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
    actionProps: {},
    infinite: false,
    listHeight: 0
};

UserList.propTypes = {
    users: React.PropTypes.arrayOf(React.PropTypes.object),
    teamMembers: React.PropTypes.arrayOf(React.PropTypes.object),
    actions: React.PropTypes.arrayOf(React.PropTypes.func),
    actionProps: React.PropTypes.object,
    nextPage: React.PropTypes.func,
    infinite: React.PropTypes.boolean,
    listHeight: React.PropTypes.number
};
