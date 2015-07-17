// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var ChannelStore = require('../stores/channel_store.jsx');
var UserStore = require('../stores/user_store.jsx');
var Client = require('../utils/client.jsx');
var AsyncClient = require('../utils/async_client.jsx');

var MemberListTeamItem = React.createClass({
    handleMakeMember: function() {
        var data = {};
        data["user_id"] = this.props.user.id;
        data["new_roles"] = "";

        Client.updateRoles(data,
            function(data) {
                AsyncClient.getProfiles();
            }.bind(this),
            function(err) {
                this.setState({ server_error: err.message });
            }.bind(this)
        );
    },
    handleMakeActive: function() {
        Client.updateActive(this.props.user.id, true,
            function(data) {
                AsyncClient.getProfiles();
            }.bind(this),
            function(err) {
                this.setState({ server_error: err.message });
            }.bind(this)
        );
    },
    handleMakeNotActive: function() {
        Client.updateActive(this.props.user.id, false,
            function(data) {
                AsyncClient.getProfiles();
            }.bind(this),
            function(err) {
                this.setState({ server_error: err.message });
            }.bind(this)
        );
    },
    handleMakeAdmin: function() {
        var data = {};
        data["user_id"] = this.props.user.id;
        data["new_roles"] = "admin";

        Client.updateRoles(data,
            function(data) {
                AsyncClient.getProfiles();
            }.bind(this),
            function(err) {
                this.setState({ server_error: err.message });
            }.bind(this)
        );
    },
     getInitialState: function() {
        return {};
    },
    render: function() {
        var server_error = this.state.server_error ? <div className="has-error"><label className='has-error control-label'>{this.state.server_error}</label></div> : null;
        var user = this.props.user;
        var currentRoles = "Member";
        var timestamp = UserStore.getCurrentUser().update_at;

        if (user.roles.length > 0) {
            currentRoles = user.roles.charAt(0).toUpperCase() + user.roles.slice(1);
        }

        var email = user.email.length > 0 ? user.email : "";
        var showMakeMember = user.roles == "admin";
        var showMakeAdmin = user.roles == "";
        var showMakeActive = false;
        var showMakeNotActive = true;

        if (user.delete_at > 0) {
            currentRoles = "Inactive";
            showMakeMember = false;
            showMakeAdmin = false;
            showMakeActive = true;
            showMakeNotActive = false;
        }

        return (
            <div className="row member-div">
                <img className="post-profile-img pull-left" src={"/api/v1/users/" + user.id + "/image?time=" + timestamp} height="36" width="36" />
                <span className="member-name">{utils.getDisplayName(user)}</span>
                <span className="member-email">{email}</span>
                <div className="dropdown member-drop">
                    <a href="#" className="dropdown-toggle theme" type="button" id="channel_header_dropdown" data-toggle="dropdown" aria-expanded="true">
                        <span>{currentRoles}  </span>
                        <span className="caret"></span>
                    </a>
                    <ul className="dropdown-menu member-menu" role="menu" aria-labelledby="channel_header_dropdown">
                        { showMakeAdmin ? <li role="presentation"><a role="menuitem" href="#" onClick={this.handleMakeAdmin}>Make Admin</a></li> : "" }
                        { showMakeMember ? <li role="presentation"><a role="menuitem" href="#" onClick={this.handleMakeMember}>Make Member</a></li> : "" }
                        { showMakeActive ? <li role="presentation"><a role="menuitem" href="#" onClick={this.handleMakeActive}>Make Active</a></li> : "" }
                        { showMakeNotActive ? <li role="presentation"><a role="menuitem" href="#" onClick={this.handleMakeNotActive}>Make Inactive</a></li> : "" }
                    </ul>
                </div>
                { server_error }
            </div>
        );
    }
});


module.exports = React.createClass({
    render: function() {
        return (
            <div className="member-list-holder">
                {
                    this.props.users.map(function(user) {
                        return <MemberListTeamItem key={user.id} user={user} />;
                    }, this)
                }
            </div>
        );
    }
});
