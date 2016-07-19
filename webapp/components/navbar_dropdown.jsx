// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import ReactDOM from 'react-dom';
import * as Utils from 'utils/utils.jsx';
import * as GlobalActions from 'actions/global_actions.jsx';

import TeamStore from 'stores/team_store.jsx';
import UserStore from 'stores/user_store.jsx';
import AboutBuildModal from './about_build_modal.jsx';
import TeamMembersModal from './team_members_modal.jsx';
import ToggleModalButton from './toggle_modal_button.jsx';
import UserSettingsModal from './user_settings/user_settings_modal.jsx';

import Constants from 'utils/constants.jsx';

import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router/es6';

import React from 'react';

export default class NavbarDropdown extends React.Component {
    constructor(props) {
        super(props);
        this.blockToggle = false;

        this.handleAboutModal = this.handleAboutModal.bind(this);
        this.aboutModalDismissed = this.aboutModalDismissed.bind(this);
        this.onTeamChange = this.onTeamChange.bind(this);
        this.openAccountSettings = this.openAccountSettings.bind(this);

        this.renderCustomEmojiLink = this.renderCustomEmojiLink.bind(this);

        this.state = {
            showUserSettingsModal: false,
            showAboutModal: false,
            teams: TeamStore.getAll(),
            teamMembers: TeamStore.getTeamMembers()
        };
    }

    handleAboutModal() {
        this.setState({showAboutModal: true});
    }

    aboutModalDismissed() {
        this.setState({showAboutModal: false});
    }

    componentDidMount() {
        $(ReactDOM.findDOMNode(this.refs.dropdown)).on('hide.bs.dropdown', () => {
            $('.sidebar--left .dropdown-menu').scrollTop(0);
            this.blockToggle = true;
            setTimeout(() => {
                this.blockToggle = false;
            }, 100);
        });

        TeamStore.addChangeListener(this.onTeamChange);
        document.addEventListener('keydown', this.openAccountSettings);
    }

    onTeamChange() {
        this.setState({
            teams: TeamStore.getAll(),
            teamMembers: TeamStore.getTeamMembers()
        });
    }

    componentWillUnmount() {
        $(ReactDOM.findDOMNode(this.refs.dropdown)).off('hide.bs.dropdown');
        TeamStore.removeChangeListener(this.onTeamChange);
        document.removeEventListener('keydown', this.openAccountSettings);
    }

    openAccountSettings(e) {
        if (Utils.cmdOrCtrlPressed(e) && e.shiftKey && e.keyCode === Constants.KeyCodes.A) {
            e.preventDefault();
            this.setState({showUserSettingsModal: !this.state.showUserSettingsModal});
        }
    }

    renderCustomEmojiLink() {
        if (window.mm_config.EnableCustomEmoji !== 'true' || !Utils.canCreateCustomEmoji(this.props.currentUser)) {
            return null;
        }

        return (
            <li>
                <Link to={'/' + Utils.getTeamNameFromUrl() + '/emoji'}>
                    <FormattedMessage
                        id='navbar_dropdown.emoji'
                        defaultMessage='Custom Emoji'
                    />
                </Link>
            </li>
        );
    }

    render() {
        const config = global.window.mm_config;
        var teamLink = '';
        var inviteLink = '';
        var manageLink = '';
        var sysAdminLink = '';
        var currentUser = this.props.currentUser;
        var isAdmin = false;
        var isSystemAdmin = false;
        var teamSettings = null;
        let integrationsLink = null;

        if (!currentUser) {
            return null;
        }

        if (currentUser != null) {
            isAdmin = TeamStore.isTeamAdminForCurrentTeam() || UserStore.isSystemAdminForCurrentUser();
            isSystemAdmin = UserStore.isSystemAdminForCurrentUser();

            inviteLink = (
                <li>
                    <a
                        href='#'
                        onClick={GlobalActions.showInviteMemberModal}
                    >
                        <FormattedMessage
                            id='navbar_dropdown.inviteMember'
                            defaultMessage='Invite New Member'
                        />
                    </a>
                </li>
            );

            if (this.props.teamType === Constants.OPEN_TEAM && config.EnableUserCreation === 'true') {
                teamLink = (
                    <li>
                        <a
                            href='#'
                            onClick={GlobalActions.showGetTeamInviteLinkModal}
                        >
                            <FormattedMessage
                                id='navbar_dropdown.teamLink'
                                defaultMessage='Get Team Invite Link'
                            />
                        </a>
                    </li>
                );
            }

            if (global.window.mm_license.IsLicensed === 'true') {
                if (config.RestrictTeamInvite === Constants.PERMISSIONS_SYSTEM_ADMIN && !isSystemAdmin) {
                    teamLink = null;
                    inviteLink = null;
                } else if (config.RestrictTeamInvite === Constants.PERMISSIONS_TEAM_ADMIN && !isAdmin) {
                    teamLink = null;
                    inviteLink = null;
                }
            }
        }

        let membersName = (
            <FormattedMessage
                id='navbar_dropdown.manageMembers'
                defaultMessage='Manage Members'
            />
        );

        if (isAdmin) {
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
        } else {
            membersName = (
                <FormattedMessage
                    id='navbar_dropdown.viewMembers'
                    defaultMessage='View Members'
                />
            );
        }

        manageLink = (
            <li>
                <ToggleModalButton
                    dialogType={TeamMembersModal}
                    dialogProps={{isAdmin}}
                >
                    {membersName}
                </ToggleModalButton>
            </li>
        );

        const integrationsEnabled =
            config.EnableIncomingWebhooks === 'true' ||
            config.EnableOutgoingWebhooks === 'true' ||
            config.EnableCommands === 'true' ||
            config.EnableOAuthServiceProvider === 'true';
        if (integrationsEnabled && (isAdmin || config.EnableOnlyAdminIntegrations !== 'true')) {
            integrationsLink = (
                <li>
                    <Link to={'/' + Utils.getTeamNameFromUrl() + '/integrations'}>
                        <FormattedMessage
                            id='navbar_dropdown.integrations'
                            defaultMessage='Integrations'
                        />
                    </Link>
                </li>
            );
        }

        if (isSystemAdmin) {
            sysAdminLink = (
                <li>
                    <Link
                        to={'/admin_console'}
                    >
                        <FormattedMessage
                            id='navbar_dropdown.console'
                            defaultMessage='System Console'
                        />
                    </Link>
                </li>
            );
        }

        var teams = [];

        if (config.EnableTeamCreation === 'true') {
            teams.push(
                <li key='newTeam_li'>
                    <Link
                        key='newTeam_a'
                        to='/create_team'
                    >
                        <FormattedMessage
                            id='navbar_dropdown.create'
                            defaultMessage='Create a New Team'
                        />
                    </Link>
                </li>
            );
        }

        teams.push(
            <li key='leaveTeam_li'>
                <a
                    href='#'
                    onClick={GlobalActions.showLeaveTeamModal}
                >
                    <FormattedMessage
                        id='navbar_dropdown.leave'
                        defaultMessage='Leave Team'
                    />
                </a>
            </li>
        );

        if (this.state.teamMembers && this.state.teamMembers.length > 1) {
            teams.push(
                <li
                    key='teamDiv'
                    className='divider'
                ></li>
            );

            for (var index in this.state.teamMembers) {
                if (this.state.teamMembers.hasOwnProperty(index)) {
                    var teamMember = this.state.teamMembers[index];
                    var team = this.state.teams[teamMember.team_id];

                    if (team.name !== this.props.teamName) {
                        teams.push(
                            <li key={'team_' + team.name}>
                                <Link
                                    to={'/' + team.name + '/channels/town-square'}
                                >
                                    <FormattedMessage
                                        id='navbar_dropdown.switchTo'
                                        defaultMessage='Switch to '
                                    />
                                    {team.display_name}
                                </Link>
                            </li>
                        );
                    }
                }
            }
        }

        let helpLink = null;
        if (config.HelpLink) {
            helpLink = (
                <li>
                    <Link
                        target='_blank'
                        rel='noopener noreferrer'
                        to={config.HelpLink}
                    >
                        <FormattedMessage
                            id='navbar_dropdown.help'
                            defaultMessage='Help'
                        />
                    </Link>
                </li>
            );
        }

        let reportLink = null;
        if (config.ReportAProblemLink) {
            reportLink = (
                <li>
                    <Link
                        target='_blank'
                        rel='noopener noreferrer'
                        to={config.ReportAProblemLink}
                    >
                        <FormattedMessage
                            id='navbar_dropdown.report'
                            defaultMessage='Report a Problem'
                        />
                    </Link>
                </li>
            );
        }

        let nativeAppDivider = null;
        let nativeAppLink = null;
        if (global.window.mm_config.AppDownloadLink) {
            nativeAppDivider = <li className='divider'/>;
            nativeAppLink = (
                <li>
                    <Link
                        target='_blank'
                        rel='noopener noreferrer'
                        to={global.window.mm_config.AppDownloadLink}
                    >
                        <FormattedMessage
                            id='navbar_dropdown.nativeApps'
                            defaultMessage='Download Native Apps'
                        />
                    </Link>
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
                                onClick={(e) => {
                                    e.preventDefault();
                                    this.setState({showUserSettingsModal: true});
                                }}
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
                                onClick={GlobalActions.emitUserLoggedOutEvent}
                            >
                                <FormattedMessage
                                    id='navbar_dropdown.logout'
                                    defaultMessage='Logout'
                                />
                            </a>
                        </li>
                        <li className='divider'></li>
                        {integrationsLink}
                        {this.renderCustomEmojiLink()}
                        <li className='divider'></li>
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
                        {nativeAppDivider}
                        {nativeAppLink}
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
    teamName: React.PropTypes.string,
    currentUser: React.PropTypes.object
};
