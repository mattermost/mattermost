// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import ChannelMembersDropdown from 'components/channel_members_dropdown';
import SearchableUserList from 'components/searchable_user_list/searchable_user_list_container.jsx';

import ChannelStore from 'stores/channel_store.jsx';
import UserStore from 'stores/user_store.jsx';
import TeamStore from 'stores/team_store.jsx';

import {searchUsers, loadProfilesAndTeamMembersAndChannelMembers, loadTeamMembersAndChannelMembersForProfilesList} from 'actions/user_actions.jsx';

import Constants from 'utils/constants.jsx';

import * as UserAgent from 'utils/user_agent.jsx';

import PropTypes from 'prop-types';

import React from 'react';

import store from 'stores/redux_store.jsx';
import {searchProfilesInCurrentChannel} from 'mattermost-redux/selectors/entities/users';

const USERS_PER_PAGE = 50;

export default class MemberListChannel extends React.Component {
    static propTypes = {
        channel: PropTypes.object.isRequired,
        actions: PropTypes.shape({
            getChannelStats: PropTypes.func.isRequired
        }).isRequired
    }

    constructor(props) {
        super(props);

        this.onChange = this.onChange.bind(this);
        this.onStatsChange = this.onStatsChange.bind(this);
        this.search = this.search.bind(this);
        this.loadComplete = this.loadComplete.bind(this);

        this.searchTimeoutId = 0;
        this.term = '';

        const stats = ChannelStore.getCurrentStats();

        this.state = {
            users: UserStore.getProfileListInChannel(ChannelStore.getCurrentId(), false, true),
            teamMembers: Object.assign({}, TeamStore.getMembersInTeam()),
            channelMembers: Object.assign({}, ChannelStore.getMembersInChannel()),
            total: stats.member_count,
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
        this.props.actions.getChannelStats(ChannelStore.getCurrentId());
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

    onChange() {
        let users;
        if (this.term) {
            users = searchProfilesInCurrentChannel(store.getState(), this.term);
        } else {
            users = UserStore.getProfileListInChannel(ChannelStore.getCurrentId(), false, true);
        }

        this.setState({
            users,
            teamMembers: Object.assign({}, TeamStore.getMembersInTeam()),
            channelMembers: Object.assign({}, ChannelStore.getMembersInChannel())
        });
    }

    onStatsChange() {
        const stats = ChannelStore.getCurrentStats();
        this.setState({total: stats.member_count});
    }

    nextPage(page) {
        loadProfilesAndTeamMembersAndChannelMembers(page + 1, USERS_PER_PAGE);
    }

    search(term) {
        clearTimeout(this.searchTimeoutId);
        this.term = term;

        if (term === '') {
            this.setState({loading: false});
            this.searchTimeoutId = '';
            this.onChange();
            return;
        }

        const searchTimeoutId = setTimeout(
            () => {
                searchUsers(term, '', {in_channel_id: ChannelStore.getCurrentId()},
                    (users) => {
                        if (searchTimeoutId !== this.searchTimeoutId) {
                            return;
                        }

                        this.setState({loading: true});

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

                if (teamMembers[user.id] && channelMembers[user.id] && user.delete_at === 0) {
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
