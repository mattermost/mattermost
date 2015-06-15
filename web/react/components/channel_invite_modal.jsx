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
    var member_list = ChannelStore.getCurrentExtraInfo().members;

    var nonmember_list = [];
    for (var id in users) {
        var found = false;
        for (var i = 0; i < member_list.length; i++) {
            if (member_list[i].id === id) {
                found = true;
                break;
            }
        }
        if (!found) {
            nonmember_list.push(users[id]);
        }
    }

    member_list.sort(function(a,b) {
        if (a.username < b.username) return -1;
        if (a.username > b.username) return 1;
        return 0;
    });

    nonmember_list.sort(function(a,b) {
        if (a.username < b.username) return -1;
        if (a.username > b.username) return 1;
        return 0;
    });

    var channel_name = ChannelStore.getCurrent() ? ChannelStore.getCurrent().display_name : "";

    return {
        nonmember_list: nonmember_list,
        member_list: member_list,
        channel_name: channel_name
    };
}

module.exports = React.createClass({
    componentDidMount: function() {
        ChannelStore.addExtraInfoChangeListener(this._onChange);
        ChannelStore.addChangeListener(this._onChange);

        var self = this;
        $(this.refs.modal.getDOMNode()).on('hidden.bs.modal', function(e) {
            self.setState({ render_members: false });
        });

        $(this.refs.modal.getDOMNode()).on('show.bs.modal', function(e) {
            self.setState({ render_members: true });
        });
    },
    componentWillUnmount: function() {
        ChannelStore.removeExtraInfoChangeListener(this._onChange);
        ChannelStore.removeChangeListener(this._onChange);
    },
    _onChange: function() {
        var new_state = getStateFromStores();
        if (!utils.areStatesEqual(this.state, new_state)) {
            this.setState(new_state);
        }
    },
    handleInvite: function(user_id) {
        // Make sure the user isn't already a member of the channel
        var member_list = this.state.member_list;
        for (var i = 0; i < member_list; i++) {
            if (member_list[i].id === user_id) {
                return;
            }
        }

        var data = {};
        data['user_id'] = user_id;

        client.addChannelMember(ChannelStore.getCurrentId(), data,
            function(data) {
                var nonmember_list = this.state.nonmember_list;
                var new_member;
                for (var i = 0; i < nonmember_list.length; i++) {
                    if (user_id === nonmember_list[i].id) {
                        nonmember_list[i].invited = true;
                        new_member = nonmember_list[i];
                        break;
                    }
                }

                if (new_member) {
                    member_list.push(new_member);
                    member_list.sort(function(a,b) {
                        if (a.username < b.username) return -1;
                        if (a.username > b.username) return 1;
                        return 0;
                    });
                }

                this.setState({ invite_error: null, member_list: member_list, nonmember_list: nonmember_list });
                AsyncClient.getChannelExtraInfo(true);
            }.bind(this),
            function(err) {
                this.setState({ invite_error: err.message });
            }.bind(this)
        );
    },
    getInitialState: function() {
        return getStateFromStores();
    },
    render: function() {
        var invite_error = this.state.invite_error ? <label className='has-error control-label'>{this.state.invite_error}</label> : null;

        var currentMember = ChannelStore.getCurrentMember();
        var isAdmin = false;
        if (currentMember) {
            isAdmin = currentMember.roles.indexOf("admin") > -1 || UserStore.getCurrentUser().roles.indexOf("admin") > -1;
        }

        return (
            <div className="modal fade" ref="modal" id="channel_invite" role="dialog" aria-hidden="true">
              <div className="modal-dialog">
                <div className="modal-content">
                  <div className="modal-header">
                    <button type="button" className="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">×</span></button>
                    <h4 className="modal-title">Add New Members to {this.state.channel_name}</h4>
                  </div>
                  <div className="modal-body">
                    { invite_error }
                    { this.state.render_members ?
                    <MemberList
                        memberList={this.state.nonmember_list}
                        isAdmin={isAdmin}
                        handleInvite={this.handleInvite}
                    />
                    : "" }
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




