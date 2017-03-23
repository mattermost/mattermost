// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import SearchableUserList from './searchable_user_list.jsx';

export default class SearchableUserListContainer extends React.Component {
    static propTypes = {
        users: React.PropTypes.arrayOf(React.PropTypes.object),
        usersPerPage: React.PropTypes.number,
        total: React.PropTypes.number,
        extraInfo: React.PropTypes.object,
        nextPage: React.PropTypes.func.isRequired,
        search: React.PropTypes.func.isRequired,
        actions: React.PropTypes.arrayOf(React.PropTypes.func),
        actionProps: React.PropTypes.object,
        actionUserProps: React.PropTypes.object,
        focusOnMount: React.PropTypes.bool
    };

    constructor(props) {
        super(props);

        this.handleTermChanged = this.handleTermChanged.bind(this);

        this.nextPage = this.nextPage.bind(this);
        this.previousPage = this.previousPage.bind(this);
        this.search = this.search.bind(this);

        this.state = {
            term: '',
            page: 0
        };
    }

    handleTermChanged(term) {
        this.setState({term});
    }

    nextPage() {
        this.setState({page: this.state.page + 1});

        this.props.nextPage(this.state.page + 1);
    }

    previousPage() {
        this.setState({page: this.state.page - 1});
    }

    search(term) {
        this.props.search(term);

        if (term !== '') {
            this.setState({page: 0});
        }
    }

    render() {
        return (
            <SearchableUserList
                {...this.props}
                nextPage={this.nextPage}
                previousPage={this.previousPage}
                search={this.search}
                page={this.state.page}
                term={this.state.term}
                onTermChanged={this.handleTermChanged}
            />
        );
    }
}
