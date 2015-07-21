// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var UserStore = require('../stores/user_store.jsx');
var client = require('../utils/client.jsx');

module.exports = React.createClass({
    handleLogoutClick: function(e) {
        e.preventDefault();
        client.logout();
    },
    render: function() {
        var team_link = "";
        var invite_link = "";
        var manage_link = "";
        var rename_link = "";
        var currentUser = UserStore.getCurrentUser()
        var isAdmin = false;

        if (currentUser != null) {
            isAdmin = currentUser.roles.indexOf("admin") > -1;

            invite_link = (
                <li>
                    <a href="#" data-toggle="modal" data-target="#invite_member"><i className="glyphicon glyphicon-user"></i>Invite New Member</a>
                </li>
            );

            if (this.props.teamType == "O") {
                team_link = (
                    <li>
                        <a href="#" data-toggle="modal" data-target="#get_link" data-title="Team Invite" data-value={location.origin+"/signup_user_complete/?id="+currentUser.team_id}><i className="glyphicon glyphicon-link"></i>Get Team Invite Link</a>
                    </li>
                );
            }
        }

        if (isAdmin) {
            manage_link = (
                <li>
                    <a href="#" data-toggle="modal" data-target="#team_members"><i className="glyphicon glyphicon-wrench"></i>Manage Team</a>
                </li>
            );
            rename_link = (
                <li>
                    <a href="#" data-toggle="modal" data-target="#rename_team_link"><i className="glyphicon glyphicon-pencil"></i>Rename</a>
                </li>
            );
        }

        var siteName = config.SiteName != null ? config.SiteName : "";
        var teamDisplayName = this.props.teamDisplayName ? this.props.teamDisplayName : siteName;

        return (
            <div>
                <div className="team__header theme">
                    <a className="team__name" href="/channels/town-square">{ teamDisplayName }</a>
                </div>

                <div className="nav-pills__container">
                    <ul className="nav nav-pills nav-stacked">
                        <li><a href="#" data-toggle="modal" data-target="#user_settings1"><i className="glyphicon glyphicon-cog"></i>Account Settings</a></li>
                        { isAdmin ? <li><a href="#" data-toggle="modal" data-target="#team_settings"><i className="glyphicon glyphicon-globe"></i>Team Settings</a></li> : "" }
                        { invite_link }
                        { team_link }
                        { manage_link }
                        { rename_link }
                        <li><a href="#" onClick={this.handleLogoutClick}><i className="glyphicon glyphicon-log-out"></i>Logout</a></li>
                        <li className="divider"></li>
                        <li><a target="_blank" href="/static/help/configure_links.html"><i className="glyphicon glyphicon-question-sign"></i>Help</a></li>
                        <li><a target="_blank" href="/static/help/configure_links.html"><i className="glyphicon glyphicon-earphone"></i>Report a Problem</a></li>
                    </ul>
                </div>
            </div>
        );
    }
});
