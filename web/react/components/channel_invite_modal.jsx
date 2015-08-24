// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var UserStore = require('../stores/user_store.jsx');
var ChannelStore = require('../stores/channel_store.jsx');
var MemberList = require('./member_list.jsx');
var LoadingScreen = require('./loading_screen.jsx');
var utils = require('../utils/utils.jsx');
var client = require('../utils/client.jsx');
var AsyncClient = require('../utils/async_client.jsx');


export default class ChannelInviteModal extends React.Component {
    constructor() {
        super();

        this.componentDidMount = this.componentDidMount.bind(this);
        this.componentWillUnmount = this.componentWillUnmount.bind(this);
        this.onShow = this.onShow.bind(this);
        this.onHide = this.onHide.bind(this);
        this.onListenerChange = this.onListenerChange.bind(this);
        this.handleInvite = this.handleInvite.bind(this);

        this.isShown = false;
        this.state = this.getStateFromStores();
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

        nonmembers.sort(function sortByUsername(a, b) {
            return a.username.localeCompare(b.username);
        });

        var channelName = '';
        if (ChannelStore.getCurrent()) {
            channelName = ChannelStore.getCurrent().display_name;
        }

        return {
            nonmembers: nonmembers,
            memberIds: memberIds,
            channelName: channelName,
            loading: loading
        };
    }
    componentDidMount() {
        $(React.findDOMNode(this)).on('hidden.bs.modal', this.onHide);
        $(React.findDOMNode(this)).on('show.bs.modal', this.onShow);

        ChannelStore.addExtraInfoChangeListener(this.onListenerChange);
        ChannelStore.addChangeListener(this.onListenerChange);
        UserStore.addChangeListener(this.onListenerChange);
    }
    componentWillUnmount() {
        ChannelStore.removeExtraInfoChangeListener(this.onListenerChange);
        ChannelStore.removeChangeListener(this.onListenerChange);
        UserStore.removeChangeListener(this.onListenerChange);
    }
    onShow() {
        this.isShown = true;
        this.onListenerChange();
    }
    onHide() {
        this.isShown = false;
    }
    onListenerChange() {
        var newState = this.getStateFromStores();
        if (!utils.areStatesEqual(this.state, newState) && this.isShown) {
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

        client.addChannelMember(ChannelStore.getCurrentId(), data,
            function sucess() {
                var nonmembers = this.state.nonmembers;
                var memberIds = this.state.memberIds;

                for (var i = 0; i < nonmembers.length; i++) {
                    if (userId === nonmembers[i].id) {
                        nonmembers[i].invited = true;
                        memberIds.push(userId);
                        break;
                    }
                }

                this.setState({inviteError: null, memberIds: memberIds, nonmembers: nonmembers});
                AsyncClient.getChannelExtraInfo(true);
            }.bind(this),

            function error(err) {
                this.setState({inviteError: err.message});
            }.bind(this)
        );
    }
    render() {
        var inviteError = null;
        if (this.state.inviteError) {
            inviteError = (<label className='has-error control-label'>{this.state.inviteError}</label>);
        }

        var currentMember = ChannelStore.getCurrentMember();
        var isAdmin = false;
        if (currentMember) {
            isAdmin = currentMember.roles.indexOf('admin') > -1 || UserStore.getCurrentUser().roles.indexOf('admin') > -1;
        }

        var content;
        if (this.state.loading) {
            content = (<LoadingScreen />);
        } else {
            content = (<MemberList memberList={this.state.nonmembers} isAdmin={isAdmin} handleInvite={this.handleInvite} />);
        }

        return (
            <div className='modal fade' id='channel_invite' tabIndex='-1' role='dialog' aria-hidden='true'>
              <div className='modal-dialog' role='document'>
                <div className='modal-content'>
                  <div className='modal-header'>
                    <button type='button' className='close' data-dismiss='modal' aria-label='Close'><span aria-hidden='true'>&times;</span></button>
                    <h4 className='modal-title'>Add New Members to <span className='name'>{this.state.channelName}</span></h4>
                  </div>
                  <div className='modal-body'>
                    {inviteError}
                    {content}
                  </div>
                  <div className='modal-footer'>
                    <button type='button' className='btn btn-default' data-dismiss='modal'>Close</button>
                  </div>
                </div>
              </div>
            </div>
        );
    }
}
ChannelInviteModal.displayName = 'ChannelInviteModal';
