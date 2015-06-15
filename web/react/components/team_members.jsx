// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var UserStore = require('../stores/user_store.jsx');
var ChannelStore = require('../stores/channel_store.jsx');
var MemberListTeam = require('./member_list_team.jsx');
var Client = require('../utils/client.jsx');
var utils = require('../utils/utils.jsx');

function getStateFromStores() {
    var users = UserStore.getProfiles();
    var member_list = [];
    for (var id in users) member_list.push(users[id]);

    member_list.sort(function(a,b) {
        if (a.username < b.username) return -1;
        if (a.username > b.username) return 1;
        return 0;
    });

    return {
        member_list: member_list
    };
}

module.exports = React.createClass({
    componentDidMount: function() {
        UserStore.addChangeListener(this._onChange);

        var self = this;
        $(this.refs.modal.getDOMNode()).on('hidden.bs.modal', function(e) {
            self.setState({ render_members: false });
        });

        $(this.refs.modal.getDOMNode()).on('show.bs.modal', function(e) {
            self.setState({ render_members: true });
        });
    },
     componentWillUnmount: function() {
        UserStore.removeChangeListener(this._onChange);
    },
    _onChange: function() {
        var newState = getStateFromStores();
        if (!utils.areStatesEqual(newState, this.state)) {
            this.setState(newState);
        }
    },
    getInitialState: function() {
        return getStateFromStores();
    },
    render: function() {
        var server_error = this.state.server_error ? <label className='has-error control-label'>{this.state.server_error}</label> : null;

        return (
            <div className="modal fade" ref="modal" id="team_members" tabIndex="-1" role="dialog" aria-hidden="true">
               <div className="modal-dialog">
                  <div className="modal-content">
                    <div className="modal-header">
                      <button type="button" className="close" data-dismiss="modal" aria-label="Close" data-reactid=".5.0.0.0.0"><span aria-hidden="true" data-reactid=".5.0.0.0.0.0">×</span></button>
                      <h4 className="modal-title" id="myModalLabel">{this.props.teamName + " Members"}</h4>
                    </div>
                    <div ref="modalBody" className="modal-body">
                        <div className="channel-settings">
                            <div className="team-member-list">
                                { this.state.render_members ? <MemberListTeam users={this.state.member_list} /> : "" }
                            </div>
                            { server_error }
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
