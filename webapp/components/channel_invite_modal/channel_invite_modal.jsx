// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import ChannelInviteButton from 'components/channel_invite_button.jsx';
import SearchableUserList from 'components/searchable_user_list/searchable_user_list_container.jsx';
import LoadingScreen from 'components/loading_screen.jsx';

import ChannelStore from 'stores/channel_store.jsx';
import UserStore from 'stores/user_store.jsx';
import TeamStore from 'stores/team_store.jsx';

import {searchUsers} from 'actions/user_actions.jsx';

import * as UserAgent from 'utils/user_agent.jsx';
import Constants from 'utils/constants.jsx';

import PropTypes from 'prop-types';

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import store from 'stores/redux_store.jsx';
import {searchProfilesNotInCurrentChannel} from 'mattermost-redux/selectors/entities/users';

const USERS_PER_PAGE = 50;

export default class ChannelInviteModal extends React.Component {
    static propTypes = {
        onHide: PropTypes.func.isRequired,
        channel: PropTypes.object.isRequired,
        actions: PropTypes.shape({
            getProfilesNotInChannel: PropTypes.func.isRequired,
            getTeamStats: PropTypes.func.isRequired
        }).isRequired
    }

    constructor(props) {
        super(props);

        this.onChange = this.onChange.bind(this);
        this.onStatusChange = this.onStatusChange.bind(this);
        this.onHide = this.onHide.bind(this);
        this.handleInviteError = this.handleInviteError.bind(this);
        this.nextPage = this.nextPage.bind(this);
        this.search = this.search.bind(this);

        this.term = '';
        this.searchTimeoutId = 0;

        const channelStats = ChannelStore.getStats(props.channel.id);
        const teamStats = TeamStore.getCurrentStats();

        this.state = {
            users: UserStore.getProfileListNotInChannel(props.channel.id, true),
            total: teamStats.active_member_count - channelStats.member_count,
            show: true,
            statusChange: false
        };
    }

    componentDidMount() {
        TeamStore.addStatsChangeListener(this.onChange);
        ChannelStore.addStatsChangeListener(this.onChange);
        UserStore.addNotInChannelChangeListener(this.onChange);
        UserStore.addStatusesChangeListener(this.onStatusChange);

        this.props.actions.getProfilesNotInChannel(TeamStore.getCurrentId(), this.props.channel.id, 0);
        this.props.actions.getTeamStats(TeamStore.getCurrentId());
    }

    componentWillUnmount() {
        TeamStore.removeStatsChangeListener(this.onChange);
        ChannelStore.removeStatsChangeListener(this.onChange);
        UserStore.removeNotInChannelChangeListener(this.onChange);
        UserStore.removeStatusesChangeListener(this.onStatusChange);
    }

    onChange() {
        let users;
        if (this.term) {
            users = searchProfilesNotInCurrentChannel(store.getState(), this.term, true);
        } else {
            users = UserStore.getProfileListNotInChannel(this.props.channel.id, true);
        }

        const channelStats = ChannelStore.getStats(this.props.channel.id);
        const teamStats = TeamStore.getCurrentStats();

        this.setState({
            users,
            total: teamStats.active_member_count - channelStats.member_count
        });
    }

    onStatusChange() {
        // Initiate a render to pick up on new statuses
        this.setState({
            statusChange: !this.state.statusChange
        });
    }

    onHide() {
        this.setState({show: false});
    }

    handleInviteError(err) {
        if (err) {
            this.setState({
                inviteError: err.message
            });
        } else {
            this.setState({
                inviteError: null
            });
        }
    }

    nextPage(page) {
        this.props.actions.getProfilesNotInChannel(TeamStore.getCurrentId(), this.props.channel.id, (page + 1) * USERS_PER_PAGE, USERS_PER_PAGE);
    }

    search(term) {
        clearTimeout(this.searchTimeoutId);
        this.term = term;

        if (term === '') {
            this.onChange();
            return;
        }

        this.searchTimeoutId = setTimeout(
            () => {
                searchUsers(term, TeamStore.getCurrentId(), {not_in_channel_id: this.props.channel.id});
            },
            Constants.SEARCH_TIMEOUT_MILLISECONDS
        );
    }

    render() {
        let inviteError = null;
        if (this.state.inviteError) {
            inviteError = (<label className='has-error control-label'>{this.state.inviteError}</label>);
        }

        let users = [];
        if (this.state.users) {
            users = this.state.users.filter((user) => user.delete_at === 0);
        }

        let content;
        if (this.state.loading) {
            content = (<LoadingScreen/>);
        } else {
            content = (
                <SearchableUserList
                    users={users}
                    usersPerPage={USERS_PER_PAGE}
                    total={this.state.total}
                    nextPage={this.nextPage}
                    search={this.search}
                    actions={[ChannelInviteButton]}
                    focusOnMount={!UserAgent.isMobile()}
                    actionProps={{
                        channel: this.props.channel,
                        onInviteError: this.handleInviteError
                    }}
                />
            );
        }

        return (
            <Modal
                dialogClassName='more-modal'
                show={this.state.show}
                onHide={this.onHide}
                onExited={this.props.onHide}
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title>
                        <FormattedMessage
                            id='channel_invite.addNewMembers'
                            defaultMessage='Add New Members to '
                        />
                        <span className='name'>{this.props.channel.display_name}</span>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {inviteError}
                    {content}
                </Modal.Body>
            </Modal>
        );
    }
}
