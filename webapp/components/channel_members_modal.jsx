// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import SearchableUserList from './searchable_user_list.jsx';
import LoadingScreen from './loading_screen.jsx';
import ChannelInviteModal from './channel_invite_modal.jsx';

import UserStore from 'stores/user_store.jsx';
import ChannelStore from 'stores/channel_store.jsx';
import TeamStore from 'stores/team_store.jsx';

import {searchUsers} from 'actions/user_actions.jsx';

import * as AsyncClient from 'utils/async_client.jsx';
import Client from 'client/web_client.jsx';
import * as Utils from 'utils/utils.jsx';

import {FormattedMessage} from 'react-intl';

import {Modal} from 'react-bootstrap';

import React from 'react';

const USERS_PER_PAGE = 50;

export default class ChannelMembersModal extends React.Component {
    constructor(props) {
        super(props);

        this.getStateFromStores = this.getStateFromStores.bind(this);
        this.onChange = this.onChange.bind(this);
        this.handleRemove = this.handleRemove.bind(this);
        this.createRemoveMemberButton = this.createRemoveMemberButton.bind(this);
        this.search = this.search.bind(this);

        this.term = '';
        this.page = 0;

        // the rest of the state gets populated when the modal is shown
        this.state = {
            showInviteModal: false,
            search: false
        };
    }

    shouldComponentUpdate(nextProps, nextState) {
        if (!Utils.areObjectsEqual(this.props, nextProps)) {
            return true;
        }

        if (!Utils.areObjectsEqual(this.state, nextState)) {
            return true;
        }

        return false;
    }

    getStateFromStores() {
        const extraInfo = ChannelStore.getCurrentExtraInfo();
        const profiles = UserStore.getActiveOnlyProfilesForTeam();

        if (extraInfo.member_count !== extraInfo.members.length) {
            AsyncClient.getChannelExtraInfo(this.props.channel.id, -1);

            return {
                loading: true
            };
        }

        const members = extraInfo.members;
        const memberList = [];
        for (let i = 0; i < members.length; i++) {
            const profile = profiles[members[i].id];
            if (profile) {
                memberList.push(profile);
            }
        }

        if (memberList.length < (this.page + 2) * USERS_PER_PAGE && memberList.length < extraInfo.member_count) {
            AsyncClient.getProfiles();
            return {
                loading: true
            };
        }

        function compareByUsername(a, b) {
            if (a.username < b.username) {
                return -1;
            } else if (a.username > b.username) {
                return 1;
            }

            return 0;
        }

        memberList.sort(compareByUsername);

        return {
            memberList,
            total: extraInfo.member_count,
            loading: false
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

    onChange() {
        if (this.state.search) {
            this.search(this.term);
            return;
        }

        const newState = this.getStateFromStores();
        if (!Utils.areObjectsEqual(this.state, newState)) {
            this.setState(newState);
        }
    }

    handleRemove(user) {
        const userId = user.id;

        Client.removeChannelMember(
            ChannelStore.getCurrentId(),
            userId,
            () => {
                const memberList = this.state.memberList.slice();
                for (let i = 0; i < memberList.length; i++) {
                    if (userId === memberList[i].id) {
                        memberList.splice(i, 1);
                        break;
                    }
                }

                this.setState({memberList});
                AsyncClient.getChannelExtraInfo();
            },
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
        AsyncClient.getProfiles((page + 1) * USERS_PER_PAGE, USERS_PER_PAGE);
        this.page = page;
    }

    search(term) {
        this.term = term;

        if (term === '') {
            this.setState(this.getStateFromStores);
            this.setState({search: false});
            this.page = 0;
            return;
        }

        searchUsers(
            TeamStore.getCurrentId(),
            term,
            (users) => {
                const extraInfo = ChannelStore.getCurrentExtraInfo();
                const members = extraInfo.members;

                const memberMap = [];
                for (let i = 0; i < members.length; i++) {
                    memberMap[members[i].id] = members[i];
                }

                const memberList = [];
                for (let i = 0; i < users.length; i++) {
                    if (memberMap[users[i].id]) {
                        memberList.push(users[i]);
                    }
                }

                this.setState({search: true, memberList});
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
                    users={this.state.memberList}
                    usersPerPage={USERS_PER_PAGE}
                    total={this.state.total}
                    nextPage={this.nextPage}
                    search={this.search}
                    actions={removeButton}
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
