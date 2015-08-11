// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var utils = require('../utils/utils.jsx');
var client = require('../utils/client.jsx');
var UserStore = require('../stores/user_store.jsx');
var TeamStore = require('../stores/team_store.jsx');

var Constants = require('../utils/constants.jsx');

function getStateFromStores() {
    return {teams: UserStore.getTeams(), currentTeam: TeamStore.getCurrent()};
}

var NavbarDropdown = React.createClass({
    handleLogoutClick: function(e) {
        e.preventDefault();
        client.logout();
    },
    blockToggle: false,
    componentDidMount: function() {
        UserStore.addTeamsChangeListener(this.onListenerChange);
        TeamStore.addChangeListener(this.onListenerChange);

        var self = this;
        $(this.refs.dropdown.getDOMNode()).on('hide.bs.dropdown', function() {
            self.blockToggle = true;
            setTimeout(function() {
                self.blockToggle = false;
            }, 100);
        });
    },
    componentWillUnmount: function() {
        UserStore.removeTeamsChangeListener(this.onListenerChange);
        TeamStore.removeChangeListener(this.onListenerChange);

        $(this.refs.dropdown.getDOMNode()).off('hide.bs.dropdown');
    },
    onListenerChange: function() {
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
        var teamLink = '';
        var inviteLink = '';
        var manageLink = '';
        var renameLink = '';
        var currentUser = UserStore.getCurrentUser();
        var isAdmin = false;
        var teamSettings = null;

        if (currentUser != null) {
            isAdmin = currentUser.roles.indexOf('admin') > -1;

            inviteLink = (<li> <a href='#' data-toggle='modal' data-target='#invite_member'>Invite New Member</a> </li>);

            if (this.props.teamType === 'O') {
                teamLink = (
                    <li>
                        <a href='#' data-toggle='modal' data-target='#get_link' data-title='Team Invite' data-value={utils.getWindowLocationOrigin() + '/signup_user_complete/?id=' + currentUser.team_id}>Get Team Invite Link</a>
                    </li>
                );
            }
        }

        if (isAdmin) {
            manageLink = (<li> <a href='#' data-toggle='modal' data-target='#team_members'>Manage Team</a> </li>);
            renameLink = (<li> <a href='#' data-toggle='modal' data-target='#rename_team_link'>Rename</a> </li>);
            teamSettings = (<li> <a href='#' data-toggle='modal' data-target='#team_settings'>Team Settings</a> </li>);
        }

        var teams = [];

        teams.push(<li className='divider' key='div'></li>);
        if (this.state.teams.length > 1 && this.state.currentTeam) {
            var curTeamName = this.state.currentTeam.name;
            this.state.teams.forEach(function(teamName) {
                if (teamName !== curTeamName) {
                    teams.push(<li key={teamName}><a href={utils.getWindowLocationOrigin() + '/' + teamName}>Switch to {teamName}</a></li>);
                }
            });
        }
        teams.push(<li key='newTeam_li'><a key='newTeam_a' href={utils.getWindowLocationOrigin() + '/signup_team' }>Create a New Team</a></li>);

        return (
            <ul className='nav navbar-nav navbar-right'>
                <li ref='dropdown' className='dropdown'>
                    <a href='#' className='dropdown-toggle' data-toggle='dropdown' role='button' aria-expanded='false'>
                        <span className='dropdown__icon' dangerouslySetInnerHTML={{__html: Constants.MENU_ICON}} />
                    </a>
                    <ul className='dropdown-menu' role='menu'>
                        <li><a href='#' data-toggle='modal' data-target='#user_settings1'>Account Settings</a></li>
                        {teamSettings}
                        {inviteLink}
                        {teamLink}
                        {manageLink}
                        {renameLink}
                        <li><a href='#' onClick={this.handleLogoutClick}>Logout</a></li>
                        {teams}
                        <li className='divider'></li>
                        <li><a target='_blank' href={config.HelpLink}>Help</a></li>
                        <li><a target='_blank' href={config.ReportProblemLink}>Report a Problem</a></li>
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

    toggleDropdown: function() {
        if (this.refs.dropdown.blockToggle) {
            this.refs.dropdown.blockToggle = false;
            return;
        }
        $('.team__header').find('.dropdown-toggle').dropdown('toggle');
    },

    render: function() {
        var me = UserStore.getCurrentUser();
        var profilePicture = null;

        if (!me) {
            return null;
        }

        if (me.last_picture_update) {
            profilePicture = (<img className='user__picture' src={'/api/v1/users/' + me.id + '/image?time=' + me.update_at} />);
        }

        return (
            <div className='team__header theme'>
                <a href='#' onClick={this.toggleDropdown}>
                    {profilePicture}
                    <div className='header__info'>
                        <div className='user__name'>{'@' + me.username}</div>
                        <div className='team__name'>{this.props.teamDisplayName }</div>
                    </div>
                </a>
                <NavbarDropdown ref='dropdown' teamType={this.props.teamType} />
            </div>
        );
    }
});
