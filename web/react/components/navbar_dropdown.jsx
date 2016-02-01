// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from '../utils/utils.jsx';
import * as client from '../utils/client.jsx';
import UserStore from '../stores/user_store.jsx';
import TeamStore from '../stores/team_store.jsx';
import * as EventHelpers from '../dispatcher/event_helpers.jsx';

import AboutBuildModal from './about_build_modal.jsx';
import TeamMembersModal from './team_members_modal.jsx';
import ToggleModalButton from './toggle_modal_button.jsx';
import UserSettingsModal from './user_settings/user_settings_modal.jsx';

import Constants from '../utils/constants.jsx';

import {FormattedMessage} from 'mm-intl';

function getStateFromStores() {
    const teams = [];
    const teamsObject = UserStore.getTeams();
    for (const teamId in teamsObject) {
        if (teamsObject.hasOwnProperty(teamId)) {
            teams.push(teamsObject[teamId]);
        }
    }

    teams.sort(Utils.sortByDisplayName);
    return {teams};
}

export default class NavbarDropdown extends React.Component {
    constructor(props) {
        super(props);
        this.blockToggle = false;

        this.handleLogoutClick = this.handleLogoutClick.bind(this);
        this.handleAboutModal = this.handleAboutModal.bind(this);
        this.onListenerChange = this.onListenerChange.bind(this);
        this.aboutModalDismissed = this.aboutModalDismissed.bind(this);

        const state = getStateFromStores();
        state.showUserSettingsModal = false;
        state.showAboutModal = false;
        this.state = state;
    }
    handleLogoutClick(e) {
        e.preventDefault();
        client.logout();
    }
    handleAboutModal() {
        this.setState({showAboutModal: true});
    }
    aboutModalDismissed() {
        this.setState({showAboutModal: false});
    }
    componentDidMount() {
        UserStore.addTeamsChangeListener(this.onListenerChange);
        TeamStore.addChangeListener(this.onListenerChange);

        $(ReactDOM.findDOMNode(this.refs.dropdown)).on('hide.bs.dropdown', () => {
            $('.sidebar--left .dropdown-menu').scrollTop(0);
            this.blockToggle = true;
            setTimeout(() => {
                this.blockToggle = false;
            }, 100);
        });
    }
    componentWillUnmount() {
        UserStore.removeTeamsChangeListener(this.onListenerChange);
        TeamStore.removeChangeListener(this.onListenerChange);

        $(ReactDOM.findDOMNode(this.refs.dropdown)).off('hide.bs.dropdown');
    }
    onListenerChange() {
        var newState = getStateFromStores();
        if (!Utils.areObjectsEqual(newState, this.state)) {
            this.setState(newState);
        }
    }
    render() {
        var teamLink = '';
        var inviteLink = '';
        var manageLink = '';
        var sysAdminLink = '';
        var adminDivider = '';
        var currentUser = UserStore.getCurrentUser();
        var isAdmin = false;
        var isSystemAdmin = false;
        var teamSettings = null;

        if (currentUser != null) {
            isAdmin = Utils.isAdmin(currentUser.roles);
            isSystemAdmin = Utils.isSystemAdmin(currentUser.roles);

            inviteLink = (
                <li>
                    <a
                        href='#'
                        onClick={EventHelpers.showInviteMemberModal}
                    >
                        <FormattedMessage
                            id='navbar_dropdown.inviteMember'
                            defaultMessage='Invite New Member'
                        />
                    </a>
                </li>
            );

            if (this.props.teamType === Constants.OPEN_TEAM) {
                teamLink = (
                    <li>
                        <a
                            href='#'
                            onClick={EventHelpers.showGetTeamInviteLinkModal}
                        >
                            <FormattedMessage
                                id='navbar_dropdown.teamLink'
                                defaultMessage='Get Team Invite Link'
                            />
                        </a>
                    </li>
                );
            }
        }

        if (isAdmin) {
            manageLink = (
                <li>
                    <ToggleModalButton dialogType={TeamMembersModal}>
                        <FormattedMessage
                            id='navbar_dropdown.manageMembers'
                            defaultMessage='Manage Members'
                        />
                    </ToggleModalButton>
                </li>
            );

            adminDivider = (<li className='divider'></li>);

            teamSettings = (
                <li>
                    <a
                        href='#'
                        data-toggle='modal'
                        data-target='#team_settings'
                    >
                        <FormattedMessage
                            id='navbar_dropdown.teamSettings'
                            defaultMessage='Team Settings'
                        />
                    </a>
                </li>
            );
        }

        if (isSystemAdmin) {
            sysAdminLink = (
                <li>
                    <a
                        href={'/admin_console?' + Utils.getSessionIndex()}
                    >
                        <FormattedMessage
                            id='navbar_dropdown.console'
                            defaultMessage='System Console'
                        />
                    </a>
                </li>
            );
        }

        var teams = [];

        if (this.state.teams.length > 1) {
            teams.push(
                <li
                    className='divider'
                    key='div'
                >
                </li>
            );

            this.state.teams.forEach((team) => {
                if (team.name !== this.props.teamName) {
                    teams.push(
                        <li key={team.name}><a href={Utils.getWindowLocationOrigin() + '/' + team.name}>
                            <FormattedMessage
                                id='navbar_dropdown.switchTeam'
                                defaultMessage='Switch to {team}'
                                values={{
                                    team: team.display_name
                                }}
                            />
                        </a></li>);
                }
            });
        }

        if (global.window.mm_config.EnableTeamCreation === 'true') {
            teams.push(
                <li key='newTeam_li'>
                    <a
                        key='newTeam_a'
                        target='_blank'
                        href={Utils.getWindowLocationOrigin() + '/signup_team'}
                    >
                        <FormattedMessage
                            id='navbar_dropdown.create'
                            defaultMessage='Create a New Team'
                        />
                    </a>
                </li>
            );
        }

        let helpLink = null;
        if (global.window.mm_config.HelpLink) {
            helpLink = (
                <li>
                    <a
                        target='_blank'
                        href={global.window.mm_config.HelpLink}
                    >
                        <FormattedMessage
                            id='navbar_dropdown.help'
                            defaultMessage='Help'
                        />
                    </a>
                </li>
            );
        }

        let reportLink = null;
        if (global.window.mm_config.ReportAProblemLink) {
            reportLink = (
                <li>
                    <a
                        target='_blank'
                        href={global.window.mm_config.ReportAProblemLink}
                    >
                        <FormattedMessage
                            id='navbar_dropdown.report'
                            defaultMessage='Report a Problem'
                        />
                    </a>
                </li>
            );
        }

        return (
            <ul className='nav navbar-nav navbar-right'>
                <li
                    ref='dropdown'
                    className='dropdown'
                >
                    <a
                        href='#'
                        className='dropdown-toggle'
                        data-toggle='dropdown'
                        role='button'
                        aria-expanded='false'
                    >
                        <span
                            className='dropdown__icon'
                            dangerouslySetInnerHTML={{__html: Constants.MENU_ICON}}
                        />
                    </a>
                    <ul
                        className='dropdown-menu'
                        role='menu'
                    >
                        <li>
                            <a
                                href='#'
                                onClick={() => this.setState({showUserSettingsModal: true})}
                            >
                                <FormattedMessage
                                    id='navbar_dropdown.accountSettings'
                                    defaultMessage='Account Settings'
                                />
                            </a>
                        </li>
                        {inviteLink}
                        {teamLink}
                        <li>
                            <a
                                href='#'
                                onClick={this.handleLogoutClick}
                            >
                                <FormattedMessage
                                    id='navbar_dropdown.logout'
                                    defaultMessage='Logout'
                                />
                            </a>
                        </li>
                        {adminDivider}
                        {teamSettings}
                        {manageLink}
                        {sysAdminLink}
                        {teams}
                        <li className='divider'></li>
                        {helpLink}
                        {reportLink}
                        <li>
                            <a
                                href='#'
                                onClick={this.handleAboutModal}
                            >
                                <FormattedMessage
                                    id='navbar_dropdown.about'
                                    defaultMessage='About Mattermost'
                                />
                            </a>
                        </li>
                        <UserSettingsModal
                            show={this.state.showUserSettingsModal}
                            onModalDismissed={() => this.setState({showUserSettingsModal: false})}
                        />
                        <AboutBuildModal
                            show={this.state.showAboutModal}
                            onModalDismissed={this.aboutModalDismissed}
                        />
                    </ul>
                </li>
            </ul>
        );
    }
}

NavbarDropdown.defaultProps = {
    teamType: ''
};
NavbarDropdown.propTypes = {
    teamType: React.PropTypes.string,
    teamDisplayName: React.PropTypes.string,
    teamName: React.PropTypes.string
};
