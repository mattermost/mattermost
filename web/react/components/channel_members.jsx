// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var UserStore = require('../stores/user_store.jsx');
var ChannelStore = require('../stores/channel_store.jsx');
var AsyncClient = require('../utils/async_client.jsx');
var MemberList = require('./member_list.jsx');
var client = require('../utils/client.jsx');
var utils = require('../utils/utils.jsx');

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
    handleRemove: function(user_id) {
        // Make sure the user is a member of the channel
        var member_list = this.state.member_list;
        var found = false;
        for (var i = 0; i < member_list.length; i++) {
            if (member_list[i].id === user_id) {
                found = true;
                break;
            }
        }

        if (!found) { return };

        var data = {};
        data['user_id'] = user_id;

        client.removeChannelMember(ChannelStore.getCurrentId(), data,
            function(data) {
                var old_member;
                for (var i = 0; i < member_list.length; i++) {
                    if (user_id === member_list[i].id) {
                        old_member = member_list[i];
                        member_list.splice(i, 1);
                        break;
                    }
                }

                var nonmember_list = this.state.nonmember_list;
                if (old_member) {
                    nonmember_list.push(old_member);
                }

                this.setState({ member_list: member_list, nonmember_list: nonmember_list });
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
        var currentMember = ChannelStore.getCurrentMember();
        var isAdmin = false;
        if (currentMember) {
            isAdmin = currentMember.roles.indexOf("admin") > -1 || UserStore.getCurrentUser().roles.indexOf("admin") > -1;
        }

        return (
            <div className="modal fade" ref="modal" id="channel_members" tabIndex="-1" role="dialog" aria-hidden="true">
               <div className="modal-dialog">
                  <div className="modal-content">
                    <div className="modal-header">
                        <button type="button" className="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">×</span></button>
                        <h4 className="modal-title">{this.state.channel_name + " Members"}</h4>
                        <a className="btn btn-md btn-primary" data-toggle="modal" data-target="#channel_invite"><i className="glyphicon glyphicon-envelope"/>  Add New Members</a>
                    </div>
                    <div ref="modalBody" className="modal-body">
                        <div className="col-sm-12">
                            <div className="team-member-list">
                                { this.state.render_members ?
                                <MemberList
                                    memberList={this.state.member_list}
                                    isAdmin={isAdmin}
                                    handleRemove={this.handleRemove}
                                    allAdminAccess={true}
                                />
                                : "" }
                            </div>
                        </div>
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
