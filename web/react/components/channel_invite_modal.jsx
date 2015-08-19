// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var UserStore = require('../stores/user_store.jsx');
var ChannelStore = require('../stores/channel_store.jsx');
var MemberList = require('./member_list.jsx');
var LoadingScreen = require('./loading_screen.jsx');
var utils = require('../utils/utils.jsx');
var client = require('../utils/client.jsx');
var AsyncClient = require('../utils/async_client.jsx');

function getStateFromStores() {
    var users = UserStore.getActiveOnlyProfiles();
    var memberIds = ChannelStore.getCurrentExtraInfo().members.map(function(user) { return user.id; });

    var loading = $.isEmptyObject(users);

    var nonmembers = [];
    for (var id in users) {
        if (memberIds.indexOf(id) == -1) {
           nonmembers.push(users[id]);
        }
    }

    nonmembers.sort(function(a,b) {
        return a.username.localeCompare(b.username);
    });

    var channel_name = ChannelStore.getCurrent() ? ChannelStore.getCurrent().display_name : "";

    return {
        nonmembers: nonmembers,
        memberIds: memberIds,
        channel_name: channel_name,
        loading: loading
    };
}

module.exports = React.createClass({
    displayName: "ChannelInviteModal",

    isShown: false,
    getInitialState: function() {
        return getStateFromStores()
    },

    componentDidMount: function() {
        $(React.findDOMNode(this)).on('hidden.bs.modal', this.onHide);
        $(React.findDOMNode(this)).on('show.bs.modal', this.onShow);

        ChannelStore.addExtraInfoChangeListener(this.onListenerChange);
        ChannelStore.addChangeListener(this.onListenerChange);
        UserStore.addChangeListener(this.onListenerChange);
    },
    componentWillUnmount: function() {
        ChannelStore.removeExtraInfoChangeListener(this.onListenerChange);
        ChannelStore.removeChangeListener(this.onListenerChange);
        UserStore.removeChangeListener(this.onListenerChange);
    },

    onShow: function() {
        this.isShown = true;
    },

    onHide: function() {
        this.isShown = false;
    },

    onListenerChange: function() {
        var newState = getStateFromStores()
        if (!utils.areStatesEqual(this.state, newState)) {
            this.setState(newState);
        }
    },

    handleInvite: function(user_id) {
        // Make sure the user isn't already a member of the channel
        if (this.state.memberIds.indexOf(user_id) > -1) {
            return;
        }

        var data = {};
        data.user_id = user_id;

        client.addChannelMember(ChannelStore.getCurrentId(), data,
            function() {
                var nonmembers = this.state.nonmembers;
                var memberIds = this.state.memberIds;

                for (var i = 0; i < nonmembers.length; i++) {
                    if (user_id === nonmembers[i].id) {
                        nonmembers[i].invited = true;
                        memberIds.push(user_id);
                        break;
                    }
                }

                this.setState({ invite_error: null, memberIds: memberIds, nonmembers: nonmembers });
                AsyncClient.getChannelExtraInfo(true);
            }.bind(this),

            function(err) {
                this.setState({ invite_error: err.message });
            }.bind(this)
        );
    },

    shouldComponentUpdate: function() {
        return this.isShown;
    },

    render: function() {
        var invite_error = this.state.invite_error ? <label className='has-error control-label'>{this.state.invite_error}</label> : null;

        var currentMember = ChannelStore.getCurrentMember();
        var isAdmin = false;
        if (currentMember) {
            isAdmin = currentMember.roles.indexOf("admin") > -1 || UserStore.getCurrentUser().roles.indexOf("admin") > -1;
        }

        var content;
        if (this.state.loading) {
            content = (<LoadingScreen />);
        } else {
            content = (<MemberList memberList={this.state.nonmembers} isAdmin={isAdmin} handleInvite={this.handleInvite} />);
        }

        return (
            <div className="modal fade" id="channel_invite" tabIndex="-1" role="dialog" aria-hidden="true">
              <div className="modal-dialog" role="document">
                <div className="modal-content">
                  <div className="modal-header">
                    <button type="button" className="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
                    <h4 className="modal-title">Add New Members to {this.state.channel_name}</h4>
                  </div>
                  <div className="modal-body">
                    { invite_error }
                    {content}
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-default" data-dismiss="modal">Close</button>
                  </div>
                </div>
              </div>
            </div>
        );
    }
});
