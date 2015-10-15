// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

const UserStore = require('../stores/user_store.jsx');
const ChannelStore = require('../stores/channel_store.jsx');
const AsyncClient = require('../utils/async_client.jsx');
const MemberList = require('./member_list.jsx');
const Client = require('../utils/client.jsx');
const Utils = require('../utils/utils.jsx');

export default class ChannelMembers extends React.Component {
    constructor(props) {
        super(props);

        this.getStateFromStores = this.getStateFromStores.bind(this);
        this.onChange = this.onChange.bind(this);
        this.handleRemove = this.handleRemove.bind(this);
        this.onHide = this.onHide.bind(this);
        this.onShow = this.onShow.bind(this);

        this.state = this.getStateFromStores();
    }
    getStateFromStores() {
        const users = UserStore.getActiveOnlyProfiles();
        let memberList = ChannelStore.getCurrentExtraInfo().members;

        let nonmemberList = [];
        for (let id in users) {
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

        const channel = ChannelStore.getCurrent();
        let channelName = '';
        if (channel) {
            channelName = channel.display_name;
        }

        return {
            nonmemberList: nonmemberList,
            memberList: memberList,
            channelName: channelName
        };
    }
    onHide() {
        this.setState({renderMembers: false});
    }
    onShow() {
        this.setState({renderMembers: true});
    }
    componentDidMount() {
        ChannelStore.addExtraInfoChangeListener(this.onChange);
        ChannelStore.addChangeListener(this.onChange);
        $(ReactDOM.findDOMNode(this.refs.modal)).on('hidden.bs.modal', this.onHide);

        $(ReactDOM.findDOMNode(this.refs.modal)).on('show.bs.modal', this.onShow);
    }
    componentWillUnmount() {
        ChannelStore.removeExtraInfoChangeListener(this.onChange);
        ChannelStore.removeChangeListener(this.onChange);
    }
    onChange() {
        const newState = this.getStateFromStores();
        if (!Utils.areStatesEqual(this.state, newState)) {
            this.setState(newState);
        }
    }
    handleRemove(userId) {
        // Make sure the user is a member of the channel
        let memberList = this.state.memberList;
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

        let data = {};
        data.user_id = userId;

        Client.removeChannelMember(ChannelStore.getCurrentId(), data,
            function handleRemoveSuccess() {
                let oldMember;
                for (let i = 0; i < memberList.length; i++) {
                    if (userId === memberList[i].id) {
                        oldMember = memberList[i];
                        memberList.splice(i, 1);
                        break;
                    }
                }

                let nonmemberList = this.state.nonmemberList;
                if (oldMember) {
                    nonmemberList.push(oldMember);
                }

                this.setState({memberList: memberList, nonmemberList: nonmemberList});
                AsyncClient.getChannelExtraInfo(true);
            }.bind(this),
            function handleRemoveError(err) {
                this.setState({inviteError: err.message});
            }.bind(this)
         );
    }
    render() {
        const currentMember = ChannelStore.getCurrentMember();
        let isAdmin = false;
        if (currentMember) {
            isAdmin = Utils.isAdmin(currentMember.roles) || Utils.isAdmin(UserStore.getCurrentUser().roles);
        }

        var memberList = null;
        if (this.state.renderMembers) {
            memberList = (
                <MemberList
                    memberList={this.state.memberList}
                    isAdmin={isAdmin}
                    handleRemove={this.handleRemove}
                />
            );
        }

        return (
            <div
                className='modal fade'
                ref='modal'
                id='channel_members'
                tabIndex='-1'
                role='dialog'
                aria-hidden='true'
            >
                <div className='modal-dialog'>
                    <div className='modal-content'>
                        <div className='modal-header'>
                            <button
                                type='button'
                                className='close'
                                data-dismiss='modal'
                                aria-label='Close'
                            >
                                <span aria-hidden='true'>×</span>
                            </button>
                            <h4 className='modal-title'><span className='name'>{this.state.channelName}</span> Members</h4>
                            <a
                                className='btn btn-md btn-primary'
                                data-toggle='modal'
                                data-target='#channel_invite'
                            >
                                <i className='glyphicon glyphicon-envelope'/> Add New Members
                            </a>
                        </div>
                        <div
                            ref='modalBody'
                            className='modal-body'
                        >
                            <div className='col-sm-12'>
                                <div className='team-member-list'>
                                    {memberList}
                                </div>
                            </div>
                        </div>
                        <div className='modal-footer'>
                            <button
                                type='button'
                                className='btn btn-default'
                                data-dismiss='modal'
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}
