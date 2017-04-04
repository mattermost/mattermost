// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import ChannelMembersDropdown from 'components/channel_members_dropdown.jsx';
import SearchableUserList from 'components/searchable_user_list/searchable_user_list_container.jsx';

import ChannelStore from 'stores/channel_store.jsx';
import UserStore from 'stores/user_store.jsx';
import TeamStore from 'stores/team_store.jsx';

import {searchUsers, loadProfilesAndTeamMembersAndChannelMembers, loadTeamMembersAndChannelMembersForProfilesList} from 'actions/user_actions.jsx';
import {getChannelStats} from 'utils/async_client.jsx';

import Constants from 'utils/constants.jsx';

import * as UserAgent from 'utils/user_agent.jsx';

import React from 'react';

const USERS_PER_PAGE = 50;

export default class MemberListChannel extends React.Component {
    constructor(props) {
        super(props);

        this.onChange = this.onChange.bind(this);
        this.onStatsChange = this.onStatsChange.bind(this);
        this.search = this.search.bind(this);
        this.loadComplete = this.loadComplete.bind(this);

        this.searchTimeoutId = 0;

        const stats = ChannelStore.getCurrentStats();

        this.state = {
            users: UserStore.getProfileListInChannel(),
            teamMembers: Object.assign({}, TeamStore.getMembersInTeam()),
            channelMembers: Object.assign({}, ChannelStore.getMembersInChannel()),
            total: stats.member_count,
            search: false,
            term: '',
            loading: true
        };
    }

    componentDidMount() {
        UserStore.addInTeamChangeListener(this.onChange);
        UserStore.addStatusesChangeListener(this.onChange);
        TeamStore.addChangeListener(this.onChange);
        ChannelStore.addChangeListener(this.onChange);
        ChannelStore.addStatsChangeListener(this.onStatsChange);

        loadProfilesAndTeamMembersAndChannelMembers(0, Constants.PROFILE_CHUNK_SIZE, TeamStore.getCurrentId(), ChannelStore.getCurrentId(), this.loadComplete);
        getChannelStats(ChannelStore.getCurrentId());
    }

    componentWillUnmount() {
        UserStore.removeInTeamChangeListener(this.onChange);
        UserStore.removeStatusesChangeListener(this.onChange);
        TeamStore.removeChangeListener(this.onChange);
        ChannelStore.removeChangeListener(this.onChange);
        ChannelStore.removeStatsChangeListener(this.onStatsChange);
    }

    loadComplete() {
        this.setState({loading: false});
    }

    onChange(force) {
        if (this.state.search && !force) {
            return;
        } else if (this.state.search) {
            this.search(this.state.term);
            return;
        }

        this.setState({
            users: UserStore.getProfileListInChannel(),
            teamMembers: Object.assign({}, TeamStore.getMembersInTeam()),
            channelMembers: Object.assign({}, ChannelStore.getMembersInChannel())
        });
    }

    onStatsChange() {
        const stats = ChannelStore.getCurrentStats();
        this.setState({total: stats.member_count});
    }

    nextPage(page) {
        loadProfilesAndTeamMembersAndChannelMembers((page + 1) * USERS_PER_PAGE, USERS_PER_PAGE);
    }

    search(term) {
        clearTimeout(this.searchTimeoutId);

        if (term === '') {
            this.setState({
                search: false,
                term,
                users: UserStore.getProfileListInChannel(),
                teamMembers: Object.assign([], TeamStore.getMembersInTeam()),
                channelMembers: Object.assign([], ChannelStore.getMembersInChannel())
            });
            this.searchTimeoutId = '';
            return;
        }

        const searchTimeoutId = setTimeout(
            () => {
                searchUsers(
                    term,
                    TeamStore.getCurrentId(),
                    {},
                    (users) => {
                        if (searchTimeoutId !== this.searchTimeoutId) {
                            return;
                        }

                        this.setState({
                            loading: true,
                            search: true,
                            users,
                            term,
                            teamMembers: Object.assign([], TeamStore.getMembersInTeam()),
                            channelMembers: Object.assign([], ChannelStore.getMembersInChannel())
                        });
                        loadTeamMembersAndChannelMembersForProfilesList(users, TeamStore.getCurrentId(), ChannelStore.getCurrentId(), this.loadComplete);
                    }
                );
            },
            Constants.SEARCH_TIMEOUT_MILLISECONDS
        );

        this.searchTimeoutId = searchTimeoutId;
    }

    render() {
        const teamMembers = this.state.teamMembers;
        const channelMembers = this.state.channelMembers;
        const users = this.state.users;
        const actionUserProps = {};

        let usersToDisplay;
        if (this.state.loading) {
            usersToDisplay = null;
        } else {
            usersToDisplay = [];

            for (let i = 0; i < users.length; i++) {
                const user = users[i];

                if (teamMembers[user.id] && channelMembers[user.id]) {
                    usersToDisplay.push(user);
                    actionUserProps[user.id] = {
                        channel: this.props.channel,
                        teamMember: teamMembers[user.id],
                        channelMember: channelMembers[user.id]
                    };
                }
            }
        }

        return (
            <SearchableUserList
                users={usersToDisplay}
                usersPerPage={USERS_PER_PAGE}
                total={this.state.total}
                nextPage={this.nextPage}
                search={this.search}
                actions={[ChannelMembersDropdown]}
                actionUserProps={actionUserProps}
                focusOnMount={!UserAgent.isMobile()}
            />
        );
    }
}

MemberListChannel.propTypes = {
    channel: React.PropTypes.object.isRequired
};
