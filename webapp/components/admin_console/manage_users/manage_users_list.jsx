// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import SearchableUserList from 'components/searchable_user_list/searchable_user_list.jsx';
import SearchableUserListContainer from 'components/searchable_user_list/searchable_user_list_container.jsx';

export default class ManageUsersList extends React.Component {
    static propTypes = {
        ...SearchableUserListContainer.propTypes,

        teamId: React.PropTypes.string.isRequired,
        term: React.PropTypes.string.isRequired,
        onTermChange: React.PropTypes.func.isRequired
    };

    constructor(props) {
        super(props);

        this.nextPage = this.nextPage.bind(this);
        this.previousPage = this.previousPage.bind(this);
        this.search = this.search.bind(this);

        this.state = {
            page: 0
        };
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.teamId !== this.props.teamId) {
            this.setState({page: 0});
        }
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
                term={this.props.term}
                onTermChange={this.props.onTermChange}
            />
        );
    }
}
