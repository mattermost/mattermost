// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import ReactDOM from 'react-dom';
import * as Utils from 'utils/utils.jsx';
import * as GlobalActions from 'actions/global_actions.jsx';

import TeamStore from 'stores/team_store.jsx';
import UserStore from 'stores/user_store.jsx';
import WebrtcStore from 'stores/webrtc_store.jsx';
import AboutBuildModal from './about_build_modal.jsx';
import TeamMembersModal from './team_members_modal.jsx';
import UserSettingsModal from './user_settings/user_settings_modal.jsx';

import {Constants, WebrtcActionTypes} from 'utils/constants.jsx';

import {Dropdown} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router/es6';

import React from 'react';

export default class SidebarHeaderDropdown extends React.Component {
    static propTypes = {
        teamType: React.PropTypes.string,
        teamDisplayName: React.PropTypes.string,
        teamName: React.PropTypes.string,
        currentUser: React.PropTypes.object
    };

    static defaultProps = {
        teamType: ''
    };

    constructor(props) {
        super(props);

        this.toggleDropdown = this.toggleDropdown.bind(this);

        this.handleAboutModal = this.handleAboutModal.bind(this);
        this.aboutModalDismissed = this.aboutModalDismissed.bind(this);
        this.toggleAccountSettingsModal = this.toggleAccountSettingsModal.bind(this);
        this.showInviteMemberModal = this.showInviteMemberModal.bind(this);
        this.showGetTeamInviteLinkModal = this.showGetTeamInviteLinkModal.bind(this);
        this.showTeamMembersModal = this.showTeamMembersModal.bind(this);
        this.hideTeamMembersModal = this.hideTeamMembersModal.bind(this);

        this.onTeamChange = this.onTeamChange.bind(this);
        this.openAccountSettings = this.openAccountSettings.bind(this);

        this.renderCustomEmojiLink = this.renderCustomEmojiLink.bind(this);

        this.handleClick = this.handleClick.bind(this);

        this.state = {
            teams: TeamStore.getAll(),
            teamMembers: TeamStore.getMyTeamMembers(),
            showAboutModal: false,
            showDropdown: false,
            showTeamMembersModal: false,
            showUserSettingsModal: false
        };
    }

    handleClick(e) {
        if (WebrtcStore.isBusy()) {
            WebrtcStore.emitChanged({action: WebrtcActionTypes.IN_PROGRESS});
            e.preventDefault();
        }
    }

    toggleDropdown(e) {
        if (e) {
            e.preventDefault();
        }

        this.setState({showDropdown: !this.state.showDropdown});
    }

    handleAboutModal(e) {
        e.preventDefault();

        this.setState({
            showAboutModal: true,
            showDropdown: false
        });
    }

    aboutModalDismissed() {
        this.setState({showAboutModal: false});
    }

    toggleAccountSettingsModal(e) {
        e.preventDefault();

        this.setState({
            showUserSettingsModal: !this.state.showUserSettingsModal,
            showDropdown: false
        });
    }

    showInviteMemberModal(e) {
        e.preventDefault();

        this.setState({showDropdown: false});

        GlobalActions.showInviteMemberModal();
    }

    showGetTeamInviteLinkModal(e) {
        e.preventDefault();

        this.setState({showDropdown: false});

        GlobalActions.showGetTeamInviteLinkModal();
    }

    showTeamMembersModal(e) {
        e.preventDefault();

        this.setState({
            showDropdown: false,
            showTeamMembersModal: true
        });
    }

    hideTeamMembersModal() {
        this.setState({
            showTeamMembersModal: false
        });
    }

    componentDidMount() {
        TeamStore.addChangeListener(this.onTeamChange);
        document.addEventListener('keydown', this.openAccountSettings);
    }

    onTeamChange() {
        this.setState({
            teams: TeamStore.getAll(),
            teamMembers: TeamStore.getMyTeamMembers()
        });
    }

    componentWillUnmount() {
        $(ReactDOM.findDOMNode(this.refs.dropdown)).off('hide.bs.dropdown');
        TeamStore.removeChangeListener(this.onTeamChange);
        document.removeEventListener('keydown', this.openAccountSettings);
    }

    openAccountSettings(e) {
        if (Utils.cmdOrCtrlPressed(e) && e.shiftKey && e.keyCode === Constants.KeyCodes.A) {
            this.toggleAccountSettingsModal(e);
        }
    }

    renderCustomEmojiLink() {
        if (window.mm_config.EnableCustomEmoji !== 'true' || !Utils.canCreateCustomEmoji(this.props.currentUser)) {
            return null;
        }

        return (
            <li>
                <Link
                    onClick={this.handleClick}
                    to={'/' + this.props.teamName + '/emoji'}
                >
                    <FormattedMessage
                        id='navbar_dropdown.emoji'
                        defaultMessage='Custom Emoji'
                    />
                </Link>
            </li>
        );
    }

    render() {
        const config = global.mm_config;
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
                        onClick={this.showInviteMemberModal}
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
                            onClick={this.showGetTeamInviteLinkModal}
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
                        onClick={this.toggleDropdown}
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
                <a
                    href='#'
                    onClick={this.showTeamMembersModal}
                >
                    {membersName}
                </a>
            </li>
        );

        const integrationsEnabled =
            config.EnableIncomingWebhooks === 'true' ||
            config.EnableOutgoingWebhooks === 'true' ||
            config.EnableCommands === 'true' ||
            (config.EnableOAuthServiceProvider === 'true' && (isSystemAdmin || config.EnableOnlyAdminIntegrations !== 'true'));
        if (integrationsEnabled && (isAdmin || config.EnableOnlyAdminIntegrations !== 'true')) {
            integrationsLink = (
                <li>
                    <Link
                        to={'/' + this.props.teamName + '/integrations'}
                        onClick={this.handleClick}
                    >
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
                        onClick={this.handleClick}
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
                        onClick={this.handleClick}
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
                />
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
                            defaultMessage='Download Apps'
                        />
                    </Link>
                </li>
            );
        }

        let teamMembersModal;
        if (this.state.showTeamMembersModal) {
            teamMembersModal = (
                <TeamMembersModal
                    onHide={this.hideTeamMembersModal}
                    isAdmin={isAdmin}
                />
            );
        }

        return (
            <Dropdown
                open={this.state.showDropdown}
                onClose={this.toggleDropdown}
                className='sidebar-header-dropdown'
                pullRight={true}
            >
                <a
                    href='#'
                    className='sidebar-header-dropdown__toggle'
                    bsRole='toggle'
                    onClick={this.toggleDropdown}
                >
                    <span
                        className='sidebar-header-dropdown__icon'
                        dangerouslySetInnerHTML={{__html: Constants.MENU_ICON}}
                    />
                </a>
                <Dropdown.Menu>
                    <li>
                        <a
                            href='#'
                            onClick={this.toggleAccountSettingsModal}
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
                    <li className='divider'/>
                    {integrationsLink}
                    {this.renderCustomEmojiLink()}
                    <li className='divider'/>
                    {teamSettings}
                    {manageLink}
                    {sysAdminLink}
                    {teams}
                    <li className='divider'/>
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
                    {teamMembersModal}
                    <AboutBuildModal
                        show={this.state.showAboutModal}
                        onModalDismissed={this.aboutModalDismissed}
                    />
                </Dropdown.Menu>
            </Dropdown>
        );
    }
}
