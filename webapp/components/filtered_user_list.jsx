// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import ReactDOM from 'react-dom';
import UserList from './user_list.jsx';

import {intlShape, injectIntl, defineMessages, FormattedMessage} from 'react-intl';

const holders = defineMessages({
    member: {
        id: 'filtered_user_list.member',
        defaultMessage: 'Member'
    },
    search: {
        id: 'filtered_user_list.search',
        defaultMessage: 'Search members'
    },
    anyTeam: {
        id: 'filtered_user_list.any_team',
        defaultMessage: 'All Users'
    },
    teamOnly: {
        id: 'filtered_user_list.team_only',
        defaultMessage: 'Members of this Team'
    }
});

import React from 'react';

class FilteredUserList extends React.Component {
    constructor(props) {
        super(props);

        this.handleFilterChange = this.handleFilterChange.bind(this);
        this.handleListChange = this.handleListChange.bind(this);
        this.filterUsers = this.filterUsers.bind(this);

        this.state = {
            filter: '',
            users: this.filterUsers(props.teamMembers, props.users),
            selected: 'team',
            teamMembers: props.teamMembers
        };
    }

    componentWillReceiveProps(nextProps) {
        // assume the user list is immutable
        if (this.props.users !== nextProps.users) {
            this.setState({
                users: this.filterUsers(nextProps.teamMembers, nextProps.users)
            });
        }

        if (this.props.teamMembers !== nextProps.teamMembers) {
            this.setState({
                users: this.filterUsers(nextProps.teamMembers, nextProps.users)
            });
        }
    }

    componentDidMount() {
        ReactDOM.findDOMNode(this.refs.filter).focus();
    }

    componentDidUpdate(prevProps, prevState) {
        if (prevState.filter !== this.state.filter) {
            $(ReactDOM.findDOMNode(this.refs.userList)).scrollTop(0);
        }
    }

    filterUsers(teamMembers, users) {
        if (!teamMembers || teamMembers.length === 0) {
            return users;
        }

        var filteredUsers = users.filter((user) => {
            for (const index in teamMembers) {
                if (teamMembers.hasOwnProperty(index) && teamMembers[index].user_id === user.id) {
                    if (teamMembers[index].delete_at > 0) {
                        return false;
                    }

                    return true;
                }
            }

            return false;
        });

        return filteredUsers;
    }

    handleFilterChange(e) {
        this.setState({
            filter: e.target.value
        });
    }

    handleListChange(e) {
        var users = this.props.users;

        if (e.target.value === 'team') {
            users = this.filterUsers(this.props.teamMembers, this.props.users);
        }

        this.setState({
            selected: e.target.value,
            users
        });
    }

    render() {
        const {formatMessage} = this.props.intl;

        let users = this.state.users;

        if (this.state.filter && this.state.filter.length > 0) {
            const filter = this.state.filter.toLowerCase();

            users = users.filter((user) => {
                return user.username.toLowerCase().indexOf(filter) !== -1 ||
                    (user.first_name && user.first_name.toLowerCase().indexOf(filter) !== -1) ||
                    (user.last_name && user.last_name.toLowerCase().indexOf(filter) !== -1) ||
                    (user.email && user.email.toLowerCase().indexOf(filter) !== -1) ||
                    (user.nickname && user.nickname.toLowerCase().indexOf(filter) !== -1);
            });
        }

        let count;
        if (users.length === this.state.users.length) {
            count = (
                <FormattedMessage
                    id='filtered_user_list.count'
                    defaultMessage='{count} {count, plural, =0 {0 members} one {member} other {members}}'
                    values={{
                        count: users.length
                    }}
                />
            );
        } else {
            count = (
                <FormattedMessage
                    id='filtered_user_list.countTotal'
                    defaultMessage='{count} {count, plural, =0 {0 members} one {member} other {members}} of {total} Total'
                    values={{
                        count: users.length,
                        total: this.state.users.length
                    }}
                />
            );
        }

        let teamToggle;

        let teamMembers = this.props.teamMembers;
        if (this.props.showTeamToggle) {
            teamMembers = [];

            teamToggle = (
                <div className='member-select__container'>
                    <select
                        className='form-control'
                        id='restrictList'
                        ref='restrictList'
                        defaultValue='team'
                        onChange={this.handleListChange}
                    >
                        <option value='any'>{formatMessage(holders.anyTeam)}</option>
                        <option value='team'>{formatMessage(holders.teamOnly)}</option>
                    </select>
                    <span
                        className='member-show'
                    >
                        <FormattedMessage
                            id='filtered_user_list.show'
                            defaultMessage='Filter:'
                        />
                    </span>
                </div>
            );
        }

        return (
            <div
                className='filtered-user-list'
                style={this.props.style}
            >
                <div className='filter-row'>
                    <div className='col-sm-6'>
                        <input
                            ref='filter'
                            className='form-control filter-textbox'
                            placeholder={formatMessage(holders.search)}
                            onInput={this.handleFilterChange}
                        />
                    </div>
                    <div className='col-sm-6'>
                        {teamToggle}
                    </div>
                    <div className='col-sm-12'>
                        <span className='member-count pull-left'>{count}</span>
                    </div>
                </div>
                <div
                    ref='userList'
                    className='more-modal__list'
                >
                    <UserList
                        users={users}
                        teamMembers={teamMembers}
                        actions={this.props.actions}
                        actionProps={this.props.actionProps}
                    />
                </div>
            </div>
        );
    }
}

FilteredUserList.defaultProps = {
    users: [],
    teamMembers: [],
    actions: [],
    actionProps: {},
    showTeamToggle: false
};

FilteredUserList.propTypes = {
    intl: intlShape.isRequired,
    users: React.PropTypes.arrayOf(React.PropTypes.object),
    teamMembers: React.PropTypes.arrayOf(React.PropTypes.object),
    actions: React.PropTypes.arrayOf(React.PropTypes.func),
    actionProps: React.PropTypes.object,
    showTeamToggle: React.PropTypes.bool,
    style: React.PropTypes.object
};

export default injectIntl(FilteredUserList);
