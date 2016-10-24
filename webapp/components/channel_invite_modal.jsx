// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import ChannelInviteButton from './channel_invite_button.jsx';
import SearchableUserList from './searchable_user_list.jsx';
import LoadingScreen from './loading_screen.jsx';

import ChannelStore from 'stores/channel_store.jsx';
import UserStore from 'stores/user_store.jsx';
import TeamStore from 'stores/team_store.jsx';

import {searchUsers} from 'actions/user_actions.jsx';

import * as Utils from 'utils/utils.jsx';
import * as AsyncClient from 'utils/async_client.jsx';

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

const USERS_PER_PAGE = 50;

export default class ChannelInviteModal extends React.Component {
    constructor(props) {
        super(props);

        this.onChange = this.onChange.bind(this);
        this.handleInviteError = this.handleInviteError.bind(this);
        this.nextPage = this.nextPage.bind(this);
        this.search = this.search.bind(this);

        this.term = '';

        const channelStats = ChannelStore.getStats(props.channel.id);
        const teamStats = TeamStore.getCurrentStats();

        this.state = {
            users: [],
            total: teamStats.member_count - channelStats.member_count,
            search: false
        };
    }

    componentWillReceiveProps(nextProps) {
        if (!this.props.show && nextProps.show) {
            TeamStore.addStatsChangeListener(this.onChange);
            ChannelStore.addStatsChangeListener(this.onChange);
            UserStore.addNotInChannelChangeListener(this.onChange);

            this.onChange();
            AsyncClient.getProfilesNotInChannel(this.props.channel.id, 0);
            AsyncClient.getTeamStats(TeamStore.getCurrentId());
        } else if (this.props.show && !nextProps.show) {
            TeamStore.removeStatsChangeListener(this.onChange);
            ChannelStore.removeStatsChangeListener(this.onChange);
            UserStore.removeNotInChannelChangeListener(this.onChange);
        }
    }

    componentWillUnmount() {
        ChannelStore.removeStatsChangeListener(this.onChange);
        ChannelStore.removeChangeListener(this.onChange);
        UserStore.removeNotInChannelChangeListener(this.onChange);
    }

    onChange() {
        if (this.state.search) {
            this.search(this.term);
            return;
        }

        const channelStats = ChannelStore.getStats(this.props.channel.id);
        const teamStats = TeamStore.getCurrentStats();

        this.setState({
            users: UserStore.getProfileListNotInChannel(this.props.channel.id),
            total: teamStats.member_count - channelStats.member_count
        });
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
        AsyncClient.getProfilesNotInChannel(this.props.channel.id, (page + 1) * USERS_PER_PAGE, USERS_PER_PAGE);
    }

    search(term) {
        this.term = term;

        if (term === '') {
            this.setState({users: UserStore.getProfileListNotInChannel(), search: false});
            return;
        }

        searchUsers(
            term,
            TeamStore.getCurrentId(),
            {not_in_channel: this.props.channel.id},
            (users) => {
                this.setState({search: true, users});
            }
        );
    }

    render() {
        var inviteError = null;
        if (this.state.inviteError) {
            inviteError = (<label className='has-error control-label'>{this.state.inviteError}</label>);
        }

        var content;
        if (this.state.loading) {
            content = (<LoadingScreen/>);
        } else {
            let maxHeight = 1000;
            if (Utils.windowHeight() <= 1200) {
                maxHeight = Utils.windowHeight() - 300;
            }
            content = (
                <SearchableUserList
                    style={{maxHeight}}
                    users={this.state.users}
                    usersPerPage={USERS_PER_PAGE}
                    total={this.state.total}
                    nextPage={this.nextPage}
                    search={this.search}
                    actions={[ChannelInviteButton]}
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
                show={this.props.show}
                onHide={this.props.onHide}
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
                <Modal.Footer>
                    <button
                        type='button'
                        className='btn btn-default'
                        onClick={this.props.onHide}
                    >
                        <FormattedMessage
                            id='channel_invite.close'
                            defaultMessage='Close'
                        />
                    </button>
                </Modal.Footer>
            </Modal>
        );
    }
}

ChannelInviteModal.propTypes = {
    show: React.PropTypes.bool.isRequired,
    onHide: React.PropTypes.func.isRequired,
    channel: React.PropTypes.object.isRequired
};
