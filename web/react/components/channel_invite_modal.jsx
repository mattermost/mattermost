// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import MemberList from './member_list.jsx';
import LoadingScreen from './loading_screen.jsx';

import UserStore from '../stores/user_store.jsx';
import ChannelStore from '../stores/channel_store.jsx';

import * as Utils from '../utils/utils.jsx';
import * as Client from '../utils/client.jsx';
import * as AsyncClient from '../utils/async_client.jsx';

const Modal = ReactBootstrap.Modal;

export default class ChannelInviteModal extends React.Component {
    constructor() {
        super();

        this.onListenerChange = this.onListenerChange.bind(this);
        this.handleInvite = this.handleInvite.bind(this);

        this.state = this.getStateFromStores();
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
        function getId(user) {
            return user.id;
        }
        var users = UserStore.getActiveOnlyProfiles();
        var memberIds = ChannelStore.getCurrentExtraInfo().members.map(getId);

        var loading = $.isEmptyObject(users);

        var nonmembers = [];
        for (var id in users) {
            if (memberIds.indexOf(id) === -1) {
                nonmembers.push(users[id]);
            }
        }

        nonmembers.sort((a, b) => {
            return a.username.localeCompare(b.username);
        });

        var channelName = '';
        if (ChannelStore.getCurrent()) {
            channelName = ChannelStore.getCurrent().display_name;
        }

        return {
            nonmembers,
            memberIds,
            channelName,
            loading
        };
    }
    onShow() {
        if ($(window).width() > 768) {
            $(ReactDOM.findDOMNode(this.refs.modalBody)).perfectScrollbar();
        }
    }
    componentDidUpdate(prevProps) {
        if (this.props.show && !prevProps.show) {
            this.onShow();
        }
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
    onListenerChange() {
        var newState = this.getStateFromStores();
        if (!Utils.areObjectsEqual(this.state, newState)) {
            this.setState(newState);
        }
    }
    handleInvite(userId) {
        // Make sure the user isn't already a member of the channel
        if (this.state.memberIds.indexOf(userId) > -1) {
            return;
        }

        var data = {};
        data.user_id = userId;

        Client.addChannelMember(ChannelStore.getCurrentId(), data,
            () => {
                var nonmembers = this.state.nonmembers;
                var memberIds = this.state.memberIds;

                for (var i = 0; i < nonmembers.length; i++) {
                    if (userId === nonmembers[i].id) {
                        nonmembers[i].invited = true;
                        memberIds.push(userId);
                        break;
                    }
                }

                this.setState({inviteError: null, memberIds, nonmembers});
                AsyncClient.getChannelExtraInfo();
            },
            (err) => {
                this.setState({inviteError: err.message});
            }
        );
    }
    render() {
        var maxHeight = 1000;
        if (Utils.windowHeight() <= 1200) {
            maxHeight = Utils.windowHeight() - 300;
        }

        var inviteError = null;
        if (this.state.inviteError) {
            inviteError = (<label className='has-error control-label'>{this.state.inviteError}</label>);
        }

        var currentMember = ChannelStore.getCurrentMember();
        var isAdmin = false;
        if (currentMember) {
            isAdmin = Utils.isAdmin(currentMember.roles) || Utils.isAdmin(UserStore.getCurrentUser().roles);
        }

        var content;
        if (this.state.loading) {
            content = (<LoadingScreen />);
        } else {
            content = (
                <MemberList
                    memberList={this.state.nonmembers}
                    isAdmin={isAdmin}
                    handleInvite={this.handleInvite}
                />
            );
        }

        return (
            <Modal
                dialogClassName='more-modal'
                show={this.props.show}
                onHide={this.props.onModalDismissed}
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title>{'Add New Members to '}<span className='name'>{this.state.channelName}</span></Modal.Title>
                </Modal.Header>
                <Modal.Body
                    ref='modalBody'
                    style={{maxHeight}}
                >
                    {inviteError}
                    {content}
                </Modal.Body>
                <Modal.Footer>
                    <button
                        type='button'
                        className='btn btn-default'
                        onClick={this.props.onModalDismissed}
                    >
                        {'Close'}
                    </button>
                </Modal.Footer>
            </Modal>
        );
    }
}

ChannelInviteModal.propTypes = {
    show: React.PropTypes.bool.isRequired,
    onModalDismissed: React.PropTypes.func.isRequired
};
