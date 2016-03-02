// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import FilteredUserList from './filtered_user_list.jsx';
import TeamMembersDropdown from './team_members_dropdown.jsx';
import UserStore from '../stores/user_store.jsx';

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
            />
        );
    }
}

MemberListTeam.propTypes = {
    style: React.PropTypes.object
};
