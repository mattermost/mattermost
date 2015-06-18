// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.


var utils = require('../utils/utils.jsx');
var client = require('../utils/client.jsx');
var UserStore = require('../stores/user_store.jsx');

function getStateFromStores() {
    return { teams: UserStore.getTeams() };
}

var NavbarDropdown = React.createClass({
    handleLogoutClick: function(e) {
        e.preventDefault();
        client.logout();
    },
    componentDidMount: function() {
        UserStore.addTeamsChangeListener(this._onChange);
    },
    componentWillUnmount: function() {
        UserStore.removeTeamsChangeListener(this._onChange);
    },
    _onChange: function() {
        if (this.isMounted()) {
            var newState = getStateFromStores();
            if (!utils.areStatesEqual(newState, this.state)) {
                this.setState(newState);
            }
        }
    },
    getInitialState: function() {
        return getStateFromStores();
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
                    <a href="#" data-toggle="modal" data-target="#invite_member">Invite New Member</a>
                </li>
            );

            if (this.props.teamType == "O") {
                team_link = (
                    <li>
                        <a href="#" data-toggle="modal" data-target="#get_link" data-title="Team Invite" data-value={location.origin+"/signup_user_complete/?id="+currentUser.team_id}>Get Team Invite Link</a>
                    </li>
                );
            }
        }

        if (isAdmin) {
            manage_link = (
                <li>
                    <a href="#" data-toggle="modal" data-target="#team_members">Manage Team</a>
                </li>
            );
            rename_link = (
                <li>
                    <a href="#" data-toggle="modal" data-target="#rename_team_link">Rename</a>
                </li>
            );
        }

        var teams = [];

        if (this.state.teams.length > 1) {
            for (var i = 0; i < this.state.teams.length; i++) {
                var domain = this.state.teams[i];

                if (domain == utils.getSubDomain()) 
                    continue;

                if (teams.length == 0)
                    teams.push(<li className="divider" key="div"></li>);

                teams.push(<li key={ domain }><a href={window.location.protocol + "//" + domain + "." + utils.getDomainWithOutSub() }>Switch to { domain }</a></li>);
            }
        }

        return (
            <ul className="nav navbar-nav navbar-right">
                <li className="dropdown">
                    <a href="#" className="dropdown-toggle" data-toggle="dropdown" role="button" aria-expanded="false">
                        <i className="dropdown__icon"></i>
                    </a>
                    <ul className="dropdown-menu" role="menu">
                        <li><a href="#" data-toggle="modal" data-target="#user_settings1">Account Settings</a></li>
                        { isAdmin ? <li><a href="#" data-toggle="modal" data-target="#team_settings">Team Settings</a></li> : "" }
                        { invite_link }
                        { team_link }
                        { manage_link }
                        { rename_link }
                        <li><a href="#" onClick={this.handleLogoutClick}>Logout</a></li>
                        { teams }
                        <li className="divider"></li>
                        <li><a target="_blank" href={config.HelpLink}>Help</a></li>
                        <li><a target="_blank" href={config.ReportProblemLink}>Report a Problem</a></li>
                    </ul>
                </li>
            </ul>
        );
    }
});

module.exports = React.createClass({
    handleSubmit: function(e) {
        e.preventDefault();
    },
    getInitialState: function() {
        return { };
    },
    render: function() {
        var teamName = this.props.teamName ? this.props.teamName : config.SiteName;

        return (
            <div className="team__header theme">
                <a className="team__name" href="/channels/town-square">{ teamName }</a>
                <NavbarDropdown teamType={this.props.teamType} />
            </div>
        );
    }
});



