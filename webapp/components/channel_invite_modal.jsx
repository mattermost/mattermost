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

import $ from 'jquery';
import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

const USERS_PER_PAGE = 50;

export default class ChannelInviteModal extends React.Component {
    constructor(props) {
        super(props);

        this.onChange = this.onChange.bind(this);
        this.getStateFromStores = this.getStateFromStores.bind(this);
        this.handleInviteError = this.handleInviteError.bind(this);
        this.search = this.search.bind(this);

        this.page = 0;
        this.term = '';

        this.state = {search: false};
    }

    shouldComponentUpdate(nextProps, nextState) {
        if (!this.props.show && !nextProps.show) {
            return false;
        }

        if (!Utils.areObjectsEqual(this.props, nextProps)) {
            return true;
        }

        if (!Utils.areObjectsEqual(this.state, nextState)) {
            return true;
        }

        return false;
    }

    getStateFromStores() {
        const users = UserStore.getActiveOnlyProfilesForTeam(true);

        if ($.isEmptyObject(users)) {
            return {
                loading: true
            };
        }

        // make sure we have all members of this channel before rendering
        const extraInfo = ChannelStore.getCurrentExtraInfo();
        if (extraInfo.member_count !== extraInfo.members.length) {
            AsyncClient.getChannelExtraInfo(this.props.channel.id, -1);

            return {
                loading: true
            };
        }

        const currentUser = UserStore.getCurrentUser();
        if (!currentUser) {
            return {
                loading: true
            };
        }

        const currentMember = ChannelStore.getCurrentMember();
        if (!currentMember) {
            return {
                loading: true
            };
        }

        const memberIds = extraInfo.members.map((user) => user.id);

        var nonmembers = [];
        for (var id in users) {
            if (memberIds.indexOf(id) === -1) {
                nonmembers.push(users[id]);
            }
        }

        // if we don't have enough members to display and there are other non channel members we don't have,
        // then fetch more
        if (nonmembers.length < (this.page + 1) * USERS_PER_PAGE && (nonmembers.length + 1) < TeamStore.getMembersForTeam().length - extraInfo.member_count) {
            AsyncClient.getProfiles();
            return {
                loading: true
            };
        }

        nonmembers.sort((a, b) => {
            return a.username.localeCompare(b.username);
        });

        return {
            nonmembers,
            loading: false,
            currentUser,
            currentMember
        };
    }

    componentWillReceiveProps(nextProps) {
        if (!this.props.show && nextProps.show) {
            ChannelStore.addExtraInfoChangeListener(this.onChange);
            ChannelStore.addChangeListener(this.onChange);
            UserStore.addChangeListener(this.onChange);
            this.onChange();
        } else if (this.props.show && !nextProps.show) {
            ChannelStore.removeExtraInfoChangeListener(this.onChange);
            ChannelStore.removeChangeListener(this.onChange);
            UserStore.removeChangeListener(this.onChange);
        }
    }

    componentWillUnmount() {
        ChannelStore.removeExtraInfoChangeListener(this.onChange);
        ChannelStore.removeChangeListener(this.onChange);
        UserStore.removeChangeListener(this.onChange);
    }

    onChange() {
        if (this.state.search) {
            this.search(this.term);
            return;
        }

        var newState = this.getStateFromStores();
        if (!Utils.areObjectsEqual(this.state, newState)) {
            this.setState(newState);
        }
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
        AsyncClient.getProfiles((page + 1) * USERS_PER_PAGE, USERS_PER_PAGE);
        this.page = page;
    }

    search(term) {
        this.term = term;

        if (term === '') {
            this.setState(this.getStateFromStores());
            this.setState({search: false});
            return;
        }

        searchUsers(
            TeamStore.getCurrentId(),
            term,
            (users) => {
                const extraInfo = ChannelStore.getCurrentExtraInfo();
                const memberIds = extraInfo.members.map((user) => user.id);

                var nonmembers = [];
                for (let i = 0; i < users.length; i++) {
                    if (memberIds.indexOf(users[i].id) === -1) {
                        nonmembers.push(users[i]);
                    }
                }

                this.setState({search: true, nonmembers});
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
                    users={this.state.nonmembers}
                    usersPerPage={USERS_PER_PAGE}
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
