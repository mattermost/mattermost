// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import UserList from './user_list.jsx';

import * as UserAgent from 'utils/user_agent.jsx';
import * as Utils from 'utils/utils.jsx';

import $ from 'jquery';
import React from 'react';
import ReactDOM from 'react-dom';

//import {FormattedMessage} from 'react-intl';

export default class SearchableUserList extends React.Component {
    constructor(props) {
        super(props);

        this.nextPage = this.nextPage.bind(this);
        this.previousPage = this.previousPage.bind(this);

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

    componentDidUpdate(prevProps, prevState) {
        if (this.state.page !== prevState.page) {
            $(ReactDOM.findDOMNode(this.refs.userList)).scrollTop(0);
        }
    }

    nextPage(e) {
        e.preventDefault();
        this.props.nextPage(this.state.page + 1);
        this.setState({page: this.state.page + 1});
    }

    previousPage(e) {
        e.preventDefault();
        this.setState({page: this.state.page - 1});
    }

    render() {
        const pageStart = this.state.page * this.props.usersPerPage;
        const pageEnd = pageStart + this.props.usersPerPage;
        const users = this.props.users.slice(pageStart, pageEnd);
        console.log(this.props.users.length);

        let nextButton;
        if (users.length >= this.props.usersPerPage) {
            nextButton = (
                <a
                    className='pull-right'
                    href='#'
                    onClick={this.nextPage}
                >
                    {'Next'}
                </a>
            );
        }

        let previousButton;
        if (this.state.page > 0) {
            previousButton = (
                <a
                    href='#'
                    onClick={this.previousPage}
                >
                    {'Previous'}
                </a>
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
                            placeholder={Utils.localizeMessage('filtered_user_list.search', 'Search members')}
                            onInput={this.handleFilterChange}
                        />
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
                <div className='col-sm-12'>
                    {previousButton}
                    {nextButton}
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
    nextPage: React.PropTypes.func.isRequired,
    actions: React.PropTypes.arrayOf(React.PropTypes.func),
    actionProps: React.PropTypes.object,
    actionUserProps: React.PropTypes.object,
    style: React.PropTypes.object
};
