// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import UserList from 'components/user_list.jsx';

import * as Utils from 'utils/utils.jsx';

const NEXT_BUTTON_TIMEOUT = 500;

export default class SearchableUserList extends React.Component {
    static propTypes = {
        users: React.PropTypes.arrayOf(React.PropTypes.object),
        usersPerPage: React.PropTypes.number,
        total: React.PropTypes.number,
        extraInfo: React.PropTypes.object,
        nextPage: React.PropTypes.func.isRequired,
        previousPage: React.PropTypes.func.isRequired,
        search: React.PropTypes.func.isRequired,
        actions: React.PropTypes.arrayOf(React.PropTypes.func),
        actionProps: React.PropTypes.object,
        actionUserProps: React.PropTypes.object,
        focusOnMount: React.PropTypes.bool,
        renderFilterRow: React.PropTypes.func,

        page: React.PropTypes.number.isRequired,
        term: React.PropTypes.string.isRequired,
        onTermChange: React.PropTypes.func.isRequired
    };

    static defaultProps = {
        users: [],
        usersPerPage: 50, // eslint-disable-line no-magic-numbers
        extraInfo: {},
        actions: [],
        actionProps: {},
        actionUserProps: {},
        showTeamToggle: false,
        focusOnMount: false
    };

    constructor(props) {
        super(props);

        this.nextPage = this.nextPage.bind(this);
        this.previousPage = this.previousPage.bind(this);
        this.focusSearchBar = this.focusSearchBar.bind(this);

        this.handleInput = this.handleInput.bind(this);

        this.nextTimeoutId = 0;

        this.state = {
            nextDisabled: false
        };
    }

    componentDidMount() {
        this.focusSearchBar();
    }

    componentDidUpdate(prevProps) {
        if (this.props.page !== prevProps.page || this.props.term !== prevProps.term) {
            this.refs.userList.scrollToTop();
        }

        this.focusSearchBar();
    }

    componentWillUnmount() {
        clearTimeout(this.nextTimeoutId);
    }

    nextPage(e) {
        e.preventDefault();

        this.setState({nextDisabled: true});
        this.nextTimeoutId = setTimeout(() => this.setState({nextDisabled: false}), NEXT_BUTTON_TIMEOUT);

        this.props.nextPage();
    }

    previousPage(e) {
        e.preventDefault();

        this.props.previousPage();
    }

    focusSearchBar() {
        if (this.props.focusOnMount) {
            this.refs.filter.focus();
        }
    }

    handleInput(e) {
        this.props.onTermChange(e.target.value);
        this.props.search(e.target.value);
    }

    render() {
        let nextButton;
        let previousButton;
        let usersToDisplay;
        let count;

        if (this.props.users == null) {
            usersToDisplay = this.props.users;
        } else if (this.props.term || this.props.users == null) {
            usersToDisplay = this.props.users;

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
            const pageStart = this.props.page * this.props.usersPerPage;
            const pageEnd = pageStart + this.props.usersPerPage;
            usersToDisplay = this.props.users.slice(pageStart, pageEnd);

            if (usersToDisplay.length >= this.props.usersPerPage) {
                nextButton = (
                    <button
                        className='btn btn-default filter-control filter-control__next'
                        onClick={this.nextPage}
                        disabled={this.state.nextDisabled}
                    >
                        <FormattedMessage
                            id='filtered_user_list.next'
                            defaultMessage='Next'
                        />
                    </button>
                );
            }

            if (this.props.page > 0) {
                previousButton = (
                    <button
                        className='btn btn-default filter-control filter-control__prev'
                        onClick={this.previousPage}
                    >
                        <FormattedMessage
                            id='filtered_user_list.prev'
                            defaultMessage='Previous'
                        />
                    </button>
                );
            }

            const startCount = this.props.page * this.props.usersPerPage;
            const endCount = startCount + usersToDisplay.length;

            if (this.props.total) {
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
        }

        let filterRow;
        if (this.props.renderFilterRow) {
            filterRow = this.props.renderFilterRow(this.handleInput);
        } else {
            filterRow = (
                <div className='col-xs-12'>
                    <input
                        ref='filter'
                        className='form-control filter-textbox'
                        placeholder={Utils.localizeMessage('filtered_user_list.search', 'Search users')}
                        value={this.props.term}
                        onInput={this.handleInput}
                    />
                </div>
            );
        }

        return (
            <div className='filtered-user-list'>
                <div className='filter-row'>
                    {filterRow}
                    <div className='col-sm-12'>
                        <span className='member-count pull-left'>{count}</span>
                    </div>
                </div>
                <div
                    className='more-modal__list'
                >
                    <UserList
                        ref='userList'
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
