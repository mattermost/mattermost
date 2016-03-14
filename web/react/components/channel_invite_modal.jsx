// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import FilteredUserList from './filtered_user_list.jsx';
import LoadingScreen from './loading_screen.jsx';

import ChannelStore from '../stores/channel_store.jsx';
import UserStore from '../stores/user_store.jsx';

import * as Utils from '../utils/utils.jsx';
import * as Client from '../utils/client.jsx';
import * as AsyncClient from '../utils/async_client.jsx';

import {FormattedMessage} from 'mm-intl';

const Modal = ReactBootstrap.Modal;

export default class ChannelInviteModal extends React.Component {
    constructor(props) {
        super(props);

        this.onListenerChange = this.onListenerChange.bind(this);
        this.handleInvite = this.handleInvite.bind(this);
        this.getStateFromStores = this.getStateFromStores.bind(this);
        this.createInviteButton = this.createInviteButton.bind(this);

        this.state = this.getStateFromStores();
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
        const users = UserStore.getActiveOnlyProfiles();

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
            ChannelStore.addExtraInfoChangeListener(this.onListenerChange);
            ChannelStore.addChangeListener(this.onListenerChange);
            UserStore.addChangeListener(this.onListenerChange);
            this.onListenerChange();
        } else if (this.props.show && !nextProps.show) {
            ChannelStore.removeExtraInfoChangeListener(this.onListenerChange);
            ChannelStore.removeChangeListener(this.onListenerChange);
            UserStore.removeChangeListener(this.onListenerChange);
        }
    }
    componentWillUnmount() {
        ChannelStore.removeExtraInfoChangeListener(this.onListenerChange);
        ChannelStore.removeChangeListener(this.onListenerChange);
        UserStore.removeChangeListener(this.onListenerChange);
    }
    onListenerChange() {
        var newState = this.getStateFromStores();
        if (!Utils.areObjectsEqual(this.state, newState)) {
            this.setState(newState);
        }
    }
    handleInvite(user) {
        const data = {
            user_id: user.id
        };

        Client.addChannelMember(
            this.props.channel.id,
            data,
            () => {
                this.setState({inviteError: null});
                AsyncClient.getChannelExtraInfo();
            },
            (err) => {
                this.setState({inviteError: err.message});
            }
        );
    }
    createInviteButton({user}) {
        return (
            <a
                onClick={this.handleInvite.bind(this, user)}
                className='btn btn-sm btn-primary'
            >
                <i className='glyphicon glyphicon-envelope'/>
                <FormattedMessage
                    id='channel_invite.add'
                    defaultMessage=' Add'
                />
            </a>
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
                <FilteredUserList
                    style={{maxHeight}}
                    users={this.state.nonmembers}
                    actions={[this.createInviteButton]}
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
