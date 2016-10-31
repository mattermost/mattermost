// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import SearchableUserList from './searchable_user_list.jsx';
import LoadingScreen from './loading_screen.jsx';
import ChannelInviteModal from './channel_invite_modal.jsx';

import UserStore from 'stores/user_store.jsx';
import ChannelStore from 'stores/channel_store.jsx';
import TeamStore from 'stores/team_store.jsx';

import {searchUsers} from 'actions/user_actions.jsx';
import {removeUserFromChannel} from 'actions/channel_actions.jsx';

import * as AsyncClient from 'utils/async_client.jsx';
import * as UserAgent from 'utils/user_agent.jsx';
import * as Utils from 'utils/utils.jsx';

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

const USERS_PER_PAGE = 50;

export default class ChannelMembersModal extends React.Component {
    constructor(props) {
        super(props);

        this.onChange = this.onChange.bind(this);
        this.handleRemove = this.handleRemove.bind(this);
        this.createRemoveMemberButton = this.createRemoveMemberButton.bind(this);
        this.search = this.search.bind(this);
        this.nextPage = this.nextPage.bind(this);

        this.term = '';

        const stats = ChannelStore.getStats(props.channel.id);

        this.state = {
            users: [],
            total: stats.member_count,
            showInviteModal: false,
            search: false
        };
    }

    componentWillReceiveProps(nextProps) {
        if (!this.props.show && nextProps.show) {
            ChannelStore.addStatsChangeListener(this.onChange);
            UserStore.addInChannelChangeListener(this.onChange);

            this.onChange();
            AsyncClient.getProfilesInChannel(this.props.channel.id, 0);
        } else if (this.props.show && !nextProps.show) {
            ChannelStore.removeStatsChangeListener(this.onChange);
            UserStore.removeInChannelChangeListener(this.onChange);
        }
    }

    onChange() {
        if (this.state.search) {
            this.search(this.term);
            return;
        }

        const stats = ChannelStore.getStats(this.props.channel.id);
        this.setState({
            users: UserStore.getProfileListInChannel(this.props.channel.id),
            total: stats.member_count
        });
    }

    handleRemove(user) {
        const userId = user.id;

        removeUserFromChannel(
            this.props.channel.id,
            userId,
            null,
            (err) => {
                this.setState({inviteError: err.message});
            }
         );
    }

    createRemoveMemberButton({user}) {
        if (user.id === UserStore.getCurrentId()) {
            return null;
        }

        return (
            <button
                type='button'
                className='btn btn-primary btn-message'
                onClick={this.handleRemove.bind(this, user)}
            >
                <FormattedMessage
                    id='channel_members_modal.remove'
                    defaultMessage='Remove'
                />
            </button>
        );
    }

    nextPage(page) {
        AsyncClient.getProfilesInChannel(this.props.channel.id, (page + 1) * USERS_PER_PAGE, USERS_PER_PAGE);
    }

    search(term) {
        this.term = term;

        if (term === '') {
            this.setState({users: UserStore.getProfileListInChannel(this.props.channel.id), search: false});
            return;
        }

        searchUsers(
            term,
            TeamStore.getCurrentId(),
            {in_channel: this.props.channel.id},
            (users) => {
                this.setState({search: true, users});
            }
        );
    }

    render() {
        let content;
        if (this.state.loading) {
            content = (<LoadingScreen/>);
        } else {
            let maxHeight = 1000;
            if (Utils.windowHeight() <= 1200) {
                maxHeight = Utils.windowHeight() - 300;
            }

            let removeButton = null;
            if (this.props.isAdmin) {
                removeButton = [this.createRemoveMemberButton];
            }

            content = (
                <SearchableUserList
                    style={{maxHeight}}
                    users={this.state.users}
                    usersPerPage={USERS_PER_PAGE}
                    total={this.state.total}
                    nextPage={this.nextPage}
                    search={this.search}
                    actions={removeButton}
                    focusOnMount={!UserAgent.isMobile()}
                />
            );
        }

        return (
            <div>
                <Modal
                    dialogClassName='more-modal'
                    show={this.props.show}
                    onHide={this.props.onModalDismissed}
                >
                    <Modal.Header closeButton={true}>
                        <Modal.Title>
                            <span className='name'>{this.props.channel.display_name}</span>
                            <FormattedMessage
                                id='channel_memebers_modal.members'
                                defaultMessage=' Members'
                            />
                        </Modal.Title>
                        <a
                            className='btn btn-md btn-primary'
                            href='#'
                            onClick={() => {
                                this.setState({showInviteModal: true});
                                this.props.onModalDismissed();
                            }}
                        >
                            <FormattedMessage
                                id='channel_members_modal.addNew'
                                defaultMessage=' Add New Members'
                            />
                        </a>
                    </Modal.Header>
                    <Modal.Body
                        ref='modalBody'
                    >
                        {content}
                    </Modal.Body>
                    <Modal.Footer>
                        <button
                            type='button'
                            className='btn btn-default'
                            onClick={this.props.onModalDismissed}
                        >
                            <FormattedMessage
                                id='channel_members_modal.close'
                                defaultMessage='Close'
                            />
                        </button>
                    </Modal.Footer>
                </Modal>
                <ChannelInviteModal
                    show={this.state.showInviteModal}
                    onHide={() => this.setState({showInviteModal: false})}
                    channel={this.props.channel}
                />
            </div>
        );
    }
}

ChannelMembersModal.defaultProps = {
    show: false
};

ChannelMembersModal.propTypes = {
    show: React.PropTypes.bool.isRequired,
    onModalDismissed: React.PropTypes.func.isRequired,
    channel: React.PropTypes.object.isRequired,
    isAdmin: React.PropTypes.bool.isRequired
};
