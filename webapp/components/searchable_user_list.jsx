// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import UserList from './user_list.jsx';

import * as Utils from 'utils/utils.jsx';
import Constants from 'utils/constants.jsx';
const KeyCodes = Constants.KeyCodes;

import $ from 'jquery';
import React from 'react';
import ReactDOM from 'react-dom';

export default class SearchableUserList extends React.Component {
    constructor(props) {
        super(props);

        this.nextPage = this.nextPage.bind(this);
        this.previousPage = this.previousPage.bind(this);
        this.doSearch = this.doSearch.bind(this);

        this.state = {
            page: 0
        };
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

    doSearch(e) {
        if (e.charCode === KeyCodes.ENTER) {
            e.preventDefault();
            this.props.search(e.target.value);
            if (e.target.value === '') {
                this.setState({page: 0});
            } else {
                // Probably a better a way to handle search but this is quickest for now
                this.setState({page: -1});
            }
        }
    }

    render() {
        let usersToDisplay;
        if (this.state.page >= 0) {
            const pageStart = this.state.page * this.props.usersPerPage;
            const pageEnd = pageStart + this.props.usersPerPage;
            usersToDisplay = this.props.users.slice(pageStart, pageEnd);
        } else {
            usersToDisplay = this.props.users;
        }

        let nextButton;
        if (usersToDisplay.length >= this.props.usersPerPage && this.state.page >= 0) {
            nextButton = (
                <a
                    className='filter-control filter-control__next'
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
                    className='filter-control filter-control__prev'
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
                            placeholder={Utils.localizeMessage('filtered_user_list.search', 'Press enter to search')}
                            onKeyPress={this.doSearch}
                        />
                    </div>
                </div>
                <div
                    ref='userList'
                    className='more-modal__list'
                >
                    <UserList
                        users={usersToDisplay}
                        extraInfo={this.props.extraInfo}
                        actions={this.props.actions}
                        actionProps={this.props.actionProps}
                        actionUserProps={this.props.actionUserProps}
                    />
                </div>
                <div className='filter-controls'>
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
    extraInfo: {},
    actions: [],
    actionProps: {},
    actionUserProps: {},
    showTeamToggle: false
};

SearchableUserList.propTypes = {
    users: React.PropTypes.arrayOf(React.PropTypes.object),
    usersPerPage: React.PropTypes.number,
    extraInfo: React.PropTypes.object,
    nextPage: React.PropTypes.func.isRequired,
    search: React.PropTypes.func.isRequired,
    actions: React.PropTypes.arrayOf(React.PropTypes.func),
    actionProps: React.PropTypes.object,
    actionUserProps: React.PropTypes.object,
    style: React.PropTypes.object
};
