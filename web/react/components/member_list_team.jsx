// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import FilteredUserList from './filtered_user_list.jsx';
import TeamMembersDropdown from './team_members_dropdown.jsx';

import UserStore from '../stores/user_store.jsx';

import * as AsyncClient from '../utils/async_client.jsx';
import Constants from '../utils/constants.jsx';

export default class MemberListTeam extends React.Component {
    constructor(props) {
        super(props);

        this.getUsers = this.getUsers.bind(this);
        this.onChange = this.onChange.bind(this);

        this.state = {
            users: this.getUsers()
        };
    }

    componentDidMount() {
        AsyncClient.getProfiles(0, Constants.USER_CHUNK_SIZE);
        UserStore.addChangeListener(this.onChange);
    }

    componentWillUnmount() {
        UserStore.removeChangeListener(this.onChange);
    }

    getUsers() {
        const profiles = UserStore.getProfiles();
        const users = [];

        for (const id of Object.keys(profiles)) {
            users.push(profiles[id]);
        }

        users.sort((a, b) => a.username.localeCompare(b.username));

        return users;
    }

    onChange() {
        this.setState({
            users: this.getUsers()
        });
    }

    render() {
        return (
            <FilteredUserList
                style={this.props.style}
                users={this.state.users}
                actions={[TeamMembersDropdown]}
                search={(term) => {
                    AsyncClient.searchProfiles(term);
                }}
            />
        );
    }
}

MemberListTeam.propTypes = {
    style: React.PropTypes.object
};
