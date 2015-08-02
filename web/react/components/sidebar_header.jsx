// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.


var utils = require('../utils/utils.jsx');
var client = require('../utils/client.jsx');
var UserStore = require('../stores/user_store.jsx');

var Constants = require('../utils/constants.jsx');

function getStateFromStores() {
    return { teams: UserStore.getTeams() };
}

var NavbarDropdown = React.createClass({
    handleLogoutClick: function(e) {
        e.preventDefault();
        client.logout();
    },
    blockToggle: false,
    componentDidMount: function() {
        UserStore.addTeamsChangeListener(this._onChange);

        var self = this;
        $(this.refs.dropdown.getDOMNode()).on('hide.bs.dropdown', function(e) {
            self.blockToggle = true;
            setTimeout(function(){self.blockToggle = false;}, 100);
        });
    },
    componentWillUnmount: function() {
        UserStore.removeTeamsChangeListener(this._onChange);

        $(this.refs.dropdown.getDOMNode()).off('hide.bs.dropdown');
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
        var currentUser = UserStore.getCurrentUser();
        var isAdmin = false;

        if (currentUser != null) {
            isAdmin = currentUser.roles.indexOf("admin") > -1;

            invite_link = ( <li> <a href="#" data-toggle="modal" data-target="#invite_member">Invite New Member</a> </li>);

            if (this.props.teamType == "O") {
                team_link = (
                    <li>
                        <a href="#" data-toggle="modal" data-target="#get_link" data-title="Team Invite" data-value={location.origin+"/signup_user_complete/?id="+currentUser.team_id}>Get Team Invite Link</a>
                    </li>
                );
            }
        }

        if (isAdmin) {
            manage_link = ( <li> <a href="#" data-toggle="modal" data-target="#team_members">Manage Team</a> </li>);
            rename_link = ( <li> <a href="#" data-toggle="modal" data-target="#rename_team_link">Rename</a> </li>);
        }

        var teams = [];

        teams.push(<li className="divider" key="div"></li>);
        if (this.state.teams.length > 1) {
            for (var i = 0; i < this.state.teams.length; i++) {
                var teamName = this.state.teams[i];

                teams.push(<li key={ teamName }><a href={utils.getWindowLocationOrigin() + "/" + teamName }>Switch to { teamName }</a></li>);
            }
        }
        teams.push(<li><a href={utils.getWindowLocationOrigin() + "/signup_team" }>Create a New Team</a></li>);

        return (
            <ul className="nav navbar-nav navbar-right">
                <li ref="dropdown" className="dropdown">
                    <a href="#" className="dropdown-toggle" data-toggle="dropdown" role="button" aria-expanded="false">
                        <span className="dropdown__icon" dangerouslySetInnerHTML={{__html: Constants.MENU_ICON }} />
                    </a>
                    <ul className="dropdown-menu" role="menu">
                        <li><a href="#" data-toggle="modal" data-target="#user_settings1">Account Settings</a></li>
                        { isAdmin ? <li><a href="#" data-toggle="modal" data-target="#team_settings">Team Settings</a></li> : null }
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
    displayName: 'SidebarHeader',

    getDefaultProps: function() {
        return {
            teamDisplayName: config.SiteName
        };
    },

    toggleDropdown: function(e) {
        if (this.refs.dropdown.blockToggle) {
            this.refs.dropdown.blockToggle = false;
            return;
        }
        $('.team__header').find('.dropdown-toggle').dropdown('toggle');
    },

    render: function() {
        var me = UserStore.getCurrentUser();

        if (!me) {
            return null;
        }

        return (
            <div className="team__header theme">
                <a href="#" onClick={this.toggleDropdown}>
                    { me.last_picture_update ?
                    <img className="user__picture" src={"/api/v1/users/" + me.id + "/image?time=" + me.update_at} />
                    :
                    null
                    }
                    <div className="header__info">
                        <div className="user__name">{ '@' + me.username}</div>
                        <div className="team__name">{ this.props.teamDisplayName }</div>
                    </div>
                </a>
                <NavbarDropdown ref="dropdown" teamType={this.props.teamType} />
            </div>
        );
    }
});
