// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var UserStore = require('../stores/user_store.jsx');
var ChannelStore = require('../stores/channel_store.jsx');
var MemberList = require('./member_list.jsx');
var utils = require('../utils/utils.jsx');
var client = require('../utils/client.jsx');
var AsyncClient = require('../utils/async_client.jsx');

function getStateFromStores() {
    var users = UserStore.getActiveOnlyProfiles();
    var memberIds = ChannelStore.getCurrentExtraInfo().members.map(function(user) { return user.id; });

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
        channel_name: channel_name
    };
}

module.exports = React.createClass({
    displayName: "ChannelInviteModal",

    isShown: false,
    getInitialState: function() {
        return {};
    },

    componentDidMount: function() {
        $(React.findDOMNode(this))
            .on('hidden.bs.modal', this._onHide)
            .on('show.bs.modal', this._onShow);
    },

    _onShow: function() {
        ChannelStore.addExtraInfoChangeListener(this._onChange);
        ChannelStore.addChangeListener(this._onChange);
        this.isShown = true;
        this._onChange();
    },

    _onHide: function() {
        ChannelStore.removeExtraInfoChangeListener(this._onChange);
        ChannelStore.removeChangeListener(this._onChange);
        this.isShown = false;
    },

    _onChange: function() {
        this.setState(getStateFromStores());
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

    shouldComponentUpdate: function(nextProps, nextState) {
        return this.isShown && !utils.areStatesEqual(this.state, nextState);
    },

    render: function() {
        var invite_error = this.state.invite_error ? <label className='has-error control-label'>{this.state.invite_error}</label> : null;

        var currentMember = ChannelStore.getCurrentMember();
        var isAdmin = false;
        if (currentMember) {
            isAdmin = currentMember.roles.indexOf("admin") > -1 || UserStore.getCurrentUser().roles.indexOf("admin") > -1;
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
                    <MemberList
                      memberList={this.state.nonmembers}
                      isAdmin={isAdmin}
                      handleInvite={this.handleInvite} />
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
