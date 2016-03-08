// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import FilteredUserList from './filtered_user_list.jsx';
import LoadingScreen from './loading_screen.jsx';
import ChannelInviteModal from './channel_invite_modal.jsx';

import UserStore from '../stores/user_store.jsx';
import ChannelStore from '../stores/channel_store.jsx';

import * as AsyncClient from '../utils/async_client.jsx';
import * as Client from '../utils/client.jsx';
import * as Utils from '../utils/utils.jsx';

import {FormattedMessage} from 'mm-intl';

const Modal = ReactBootstrap.Modal;

export default class ChannelMembersModal extends React.Component {
    constructor(props) {
        super(props);

        this.getStateFromStores = this.getStateFromStores.bind(this);
        this.onChange = this.onChange.bind(this);
        this.handleRemove = this.handleRemove.bind(this);

        this.createRemoveMemberButton = this.createRemoveMemberButton.bind(this);

        // the rest of the state gets populated when the modal is shown
        this.state = {
            showInviteModal: false
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
        const profiles = UserStore.getActiveOnlyProfiles();

        if (extraInfo.member_count !== extraInfo.members.length) {
            AsyncClient.getChannelExtraInfo(this.props.channel.id, -1);

            return {
                loading: true
            };
        }

        const memberList = extraInfo.members.map((member) => {
            return profiles[member.id];
        });

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
            loading: false
        };
    }
    componentWillReceiveProps(nextProps) {
        if (!this.props.show && nextProps.show) {
            ChannelStore.addExtraInfoChangeListener(this.onChange);
            ChannelStore.addChangeListener(this.onChange);

            this.onChange();
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
    handleRemove(user) {
        const userId = user.id;

        const data = {};
        data.user_id = userId;

        Client.removeChannelMember(
            ChannelStore.getCurrentId(),
            data,
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
    render() {
        let content;
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
                    users={this.state.memberList}
                    actions={[this.createRemoveMemberButton]}
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
    channel: React.PropTypes.object.isRequired
};
