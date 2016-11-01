// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import UserList from 'components/user_list.jsx';

import * as Utils from 'utils/utils.jsx';
import Constants from 'utils/constants.jsx';
const KeyCodes = Constants.KeyCodes;

import $ from 'jquery';
import React from 'react';
import ReactDOM from 'react-dom';
import {FormattedMessage} from 'react-intl';

const NEXT_BUTTON_TIMEOUT = 500;

export default class SearchableUserList extends React.Component {
    constructor(props) {
        super(props);

        this.nextPage = this.nextPage.bind(this);
        this.previousPage = this.previousPage.bind(this);
        this.doSearch = this.doSearch.bind(this);
        this.onSearchBoxKeyPress = this.onSearchBoxKeyPress.bind(this);
        this.onSearchBoxChange = this.onSearchBoxChange.bind(this);

        this.nextTimeoutId = 0;

        this.state = {
            page: 0,
            currentUsersTotal: 0,
            search: false,
            nextDisabled: false
        };
    }

    componentDidMount() {
        if (this.props.focusOnMount) {
            this.refs.filter.focus();
        }
    }

    componentDidUpdate(prevProps, prevState) {
        if (this.state.page !== prevState.page) {
            $(ReactDOM.findDOMNode(this.refs.userList)).scrollTop(0);
        }
    }

    componentWillUnmount() {
        clearTimeout(this.nextTimeoutId);
    }

    nextPage(e) {
        if (e && e.preventDefault) {
            e.preventDefault();
        }
        if (this.readyForMoreUsers()) {
            this.setState({page: this.state.page + 1, nextDisabled: true});
            this.nextTimeoutId = setTimeout(() => this.setState({nextDisabled: false}), NEXT_BUTTON_TIMEOUT);
            this.setState({currentUsersTotal: this.props.users.length});
            this.props.nextPage(this.state.page + 1);
        }
    }

    previousPage(e) {
        e.preventDefault();
        this.setState({page: this.state.page - 1});
    }

    doSearch() {
        const term = this.refs.filter.value;
        this.props.search(term);
        if (term === '') {
            this.setState({page: 0, search: false});
        } else {
            this.setState({search: true});
        }
    }

    onSearchBoxKeyPress(e) {
        if (e.charCode === KeyCodes.ENTER) {
            e.preventDefault();
            this.doSearch();
        }
    }

    onSearchBoxChange(e) {
        if (e.target.value === '') {
            this.props.search(''); // clear search
            this.setState({page: 0, search: false});
        }
    }

    readyForMoreUsers() {
        if (this.props.infinite) {
            return this.state.currentUsersTotal < this.props.users.length;
        }
        return true;
    }

    render() {
        let nextButton;
        let previousButton;
        let usersToDisplay;
        let count;
        let pageNavLinks;

        usersToDisplay = this.props.users;
        if (this.state.search || this.props.users == null) {
            if (this.props.total) {
                count = (
                    <FormattedMessage
                        id='filtered_user_list.countTotal'
                        defaultMessage='{count} {count, plural, =0 {0 members} one {member} other {members}} of {total} total'
                        values={{
                            count: usersToDisplay.length || 0,
                            total: this.props.total
                        }}
                    />
                );
            }
        } else {
            const pageStart = this.state.page * this.props.usersPerPage;
            const pageEnd = pageStart + this.props.usersPerPage;
            if (!this.props.infinite) {
                usersToDisplay = usersToDisplay.slice(pageStart, pageEnd);
            }

            if (usersToDisplay.length >= this.props.usersPerPage) {
                nextButton = (
                    <button
                        className='btn btn-default filter-control filter-control__next'
                        onClick={this.nextPage}
                        disabled={this.state.nextDisabled}
                    >
                        {'Next'}
                    </button>
                );
            }

            if (this.state.page > 0) {
                previousButton = (
                    <button
                        className='btn btn-default filter-control filter-control__prev'
                        onClick={this.previousPage}
                    >
                        {'Previous'}
                    </button>
                );
            }

            if (this.props.total) {
                const startCount = this.state.page * this.props.usersPerPage;
                const endCount = startCount + usersToDisplay.length;

                count = (
                    <FormattedMessage
                        id='filtered_user_list.countTotalPage'
                        defaultMessage='{startCount, number} - {endCount, number} {count, plural, =0 {0 members} one {member} other {members}} of {total} total'
                        values={{
                            count: usersToDisplay.length,
                            startCount: startCount + 1,
                            endCount,
                            total: this.props.total
                        }}
                    />
                );
            }

            if (this.props.infinite) {
                if (this.state.nextDisabled) {
                    pageNavLinks = (
                        <div className='more-modal__loading-bar'>
                            {'Loading...'}
                        </div>
                    );
                }
            } else {
                pageNavLinks = (
                    <div className='filter-controls'>
                        {previousButton}
                        {nextButton}
                    </div>
                );
            }
        }

        const height = $(window).height() - ($(window).width() <= 768 ? 95 : 198);

        return (
            <div
                className='filtered-user-list'
                style={{...this.props.style, 'max-height': `${height}px`}}
            >
                <div className='filter-row'>
                    <div className='col-xs-9 col-sm-5 filter-text'>
                        <input
                            ref='filter'
                            className='form-control filter-textbox'
                            placeholder={Utils.localizeMessage('filtered_user_list.search', 'Press enter to search')}
                            onKeyPress={this.onSearchBoxKeyPress}
                            onChange={this.onSearchBoxChange}
                        />
                    </div>
                    <div className='col-xs-3 col-sm-2 filter-button'>
                        <button
                            type='button'
                            className='btn btn-primary'
                            onClick={this.doSearch}
                            disabled={this.props.users == null}
                        >
                            <FormattedMessage
                                id='filtered_user_list.searchButton'
                                defaultMessage='Search'
                            />
                        </button>
                    </div>
                    <div className='col-xs-12 col-sm-12'>
                        <span className='member-count pull-left'>{count}</span>
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
                        nextPage={this.nextPage}
                        infinite={this.props.infinite}
                        listHeight={height}
                    />
                </div>
                {pageNavLinks}
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
    showTeamToggle: false,
    infinite: false,
    focusOnMount: false
};

SearchableUserList.propTypes = {
    users: React.PropTypes.arrayOf(React.PropTypes.object),
    usersPerPage: React.PropTypes.number,
    total: React.PropTypes.number,
    extraInfo: React.PropTypes.object,
    nextPage: React.PropTypes.func.isRequired,
    search: React.PropTypes.func.isRequired,
    actions: React.PropTypes.arrayOf(React.PropTypes.func),
    actionProps: React.PropTypes.object,
    actionUserProps: React.PropTypes.object,
    style: React.PropTypes.object,
    infinite: React.PropTypes.boolean,
    focusOnMount: React.PropTypes.bool.isRequired
};
