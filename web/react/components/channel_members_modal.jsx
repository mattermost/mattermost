// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages} from 'react-intl';
import MemberList from './member_list.jsx';
import ChannelInviteModal from './channel_invite_modal.jsx';

import UserStore from '../stores/user_store.jsx';
import ChannelStore from '../stores/channel_store.jsx';

import * as AsyncClient from '../utils/async_client.jsx';
import * as Client from '../utils/client.jsx';
import * as Utils from '../utils/utils.jsx';

const Modal = ReactBootstrap.Modal;

const messages = defineMessages({
    members: {
        id: 'channel_memebers_modal.members',
        defaultMessage: ' Members'
    },
    addNew: {
        id: 'channel_members_modal.addNew',
        defaultMessage: ' Add New Memebers'
    },
    close: {
        id: 'channel_members_modal.close',
        defaultMessage: 'Close'
    }
});

class ChannelMembersModal extends React.Component {
    constructor(props) {
        super(props);

        this.getStateFromStores = this.getStateFromStores.bind(this);
        this.onChange = this.onChange.bind(this);
        this.handleRemove = this.handleRemove.bind(this);

        const state = this.getStateFromStores();
        state.showInviteModal = false;
        this.state = state;
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
        const users = UserStore.getActiveOnlyProfiles();
        const memberList = ChannelStore.getCurrentExtraInfo().members;

        const nonmemberList = [];
        for (const id in users) {
            if (users.hasOwnProperty(id)) {
                let found = false;
                for (let i = 0; i < memberList.length; i++) {
                    if (memberList[i].id === id) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    nonmemberList.push(users[id]);
                }
            }
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
        nonmemberList.sort(compareByUsername);

        return {
            nonmemberList,
            memberList
        };
    }
    onShow() {
        if ($(window).width() > 768) {
            $(ReactDOM.findDOMNode(this.refs.modalBody)).perfectScrollbar();
        }
        this.onChange();
    }
    componentDidUpdate(prevProps) {
        if (this.props.show && !prevProps.show) {
            this.onShow();
        }
    }
    componentWillReceiveProps(nextProps) {
        if (!this.props.show && nextProps.show) {
            ChannelStore.addExtraInfoChangeListener(this.onChange);
            ChannelStore.addChangeListener(this.onChange);
        } else if (this.props.show && !nextProps.show) {
            ChannelStore.removeExtraInfoChangeListener(this.onChange);
            ChannelStore.removeChangeListener(this.onChange);
        }
    }
    onChange() {
        const newState = this.getStateFromStores();
        if (!Utils.areObjectsEqual(this.state, newState)) {
            this.setState(newState);
        }
    }
    handleRemove(userId) {
        // Make sure the user is a member of the channel
        const memberList = this.state.memberList;
        let found = false;
        for (let i = 0; i < memberList.length; i++) {
            if (memberList[i].id === userId) {
                found = true;
                break;
            }
        }

        if (!found) {
            return;
        }

        const data = {};
        data.user_id = userId;

        Client.removeChannelMember(ChannelStore.getCurrentId(), data,
            () => {
                let oldMember;
                for (let i = 0; i < memberList.length; i++) {
                    if (userId === memberList[i].id) {
                        oldMember = memberList[i];
                        memberList.splice(i, 1);
                        break;
                    }
                }

                const nonmemberList = this.state.nonmemberList;
                if (oldMember) {
                    nonmemberList.push(oldMember);
                }

                this.setState({memberList, nonmemberList});
                AsyncClient.getChannelExtraInfo();
            },
            (err) => {
                this.setState({inviteError: err.message});
            }
         );
    }
    render() {
        const {formatMessage} = this.props.intl;

        var maxHeight = 1000;
        if (Utils.windowHeight() <= 1200) {
            maxHeight = Utils.windowHeight() - 300;
        }

        const currentMember = ChannelStore.getCurrentMember();
        let isAdmin = false;
        if (currentMember) {
            isAdmin = Utils.isAdmin(currentMember.roles) || Utils.isAdmin(UserStore.getCurrentUser().roles);
        }

        return (
            <div>
                <Modal
                    dialogClassName='more-modal'
                    show={this.props.show}
                    onHide={this.props.onModalDismissed}
                >
                    <Modal.Header closeButton={true}>
                        <Modal.Title><span className='name'>{this.props.channel.display_name}</span>{formatMessage(messages.members)}</Modal.Title>
                        <a
                            className='btn btn-md btn-primary'
                            href='#'
                            onClick={() => {
                                this.setState({showInviteModal: true});
                                this.props.onModalDismissed();
                            }}
                        >
                            <i className='glyphicon glyphicon-envelope'/>{formatMessage(messages.addNew)}
                        </a>
                    </Modal.Header>
                    <Modal.Body
                        ref='modalBody'
                        style={{maxHeight}}
                    >
                        <div className='team-member-list'>
                            <MemberList
                                memberList={this.state.memberList}
                                isAdmin={isAdmin}
                                handleRemove={this.handleRemove}
                            />
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <button
                            type='button'
                            className='btn btn-default'
                            onClick={this.props.onModalDismissed}
                        >
                            {formatMessage(messages.close)}
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
    intl: intlShape.isRequired
};

export default injectIntl(ChannelMembersModal);