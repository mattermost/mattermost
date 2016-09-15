// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import UserList from './user_list.jsx';

import * as UserAgent from 'utils/user_agent.jsx';
import * as Utils from 'utils/utils.jsx';

import React from 'react';
import ReactDOM from 'react-dom';

//import {FormattedMessage} from 'react-intl';

export default class SearchableUserList extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            page: 0
        };
    }

    componentDidMount() {
        // only focus the search box on desktop so that we don't cause the keyboard to open on mobile
        if (!UserAgent.isMobileApp()) {
            ReactDOM.findDOMNode(this.refs.filter).focus();
        }
    }

    render() {
        let users = this.props.users;

        /*let count;
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
        }*/

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
                            placeholder={Utils.localizeMessage('filtered_user_list.search', 'Search members')}
                            onInput={this.handleFilterChange}
                        />
                    </div>
                    <div className='col-sm-6'>
                    </div>
                    <div className='col-sm-12'>
                    </div>
                </div>
                <div
                    ref='userList'
                    className='more-modal__list'
                >
                    <UserList
                        users={users}
                        actions={this.props.actions}
                        actionProps={this.props.actionProps}
                        actionUserProps={this.props.actionUserProps}
                    />
                </div>
            </div>
        );
    }
}

SearchableUserList.defaultProps = {
    users: [],
    usersPerPage: 50, //eslint-disable-line no-magic-numbers
    actions: [],
    actionProps: {},
    actionUserProps: {},
    showTeamToggle: false
};

SearchableUserList.propTypes = {
    users: React.PropTypes.arrayOf(React.PropTypes.object),
    usersPerPage: React.PropTypes.number,
    actions: React.PropTypes.arrayOf(React.PropTypes.func),
    actionProps: React.PropTypes.object,
    actionUserProps: React.PropTypes.object,
    style: React.PropTypes.object
};
