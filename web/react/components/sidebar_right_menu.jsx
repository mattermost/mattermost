// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import TeamMembersModal from './team_members_modal.jsx';
import ToggleModalButton from './toggle_modal_button.jsx';
import UserSettingsModal from './user_settings/user_settings_modal.jsx';
import UserStore from '../stores/user_store.jsx';
import * as client from '../utils/client.jsx';
import * as EventHelpers from '../dispatcher/event_helpers.jsx';
import * as utils from '../utils/utils.jsx';

import {FormattedMessage} from 'mm-intl';

export default class SidebarRightMenu extends React.Component {
    componentDidMount() {
        $('.sidebar--left .dropdown-menu').perfectScrollbar();
    }

    constructor(props) {
        super(props);

        this.handleLogoutClick = this.handleLogoutClick.bind(this);

        this.state = {
            showUserSettingsModal: false
        };
    }

    handleLogoutClick(e) {
        e.preventDefault();
        client.logout();
    }

    render() {
        var teamLink = '';
        var inviteLink = '';
        var teamSettingsLink = '';
        var manageLink = '';
        var consoleLink = '';
        var currentUser = UserStore.getCurrentUser();
        var isAdmin = false;
        var isSystemAdmin = false;

        if (currentUser != null) {
            isAdmin = utils.isAdmin(currentUser.roles);
            isSystemAdmin = utils.isSystemAdmin(currentUser.roles);

            inviteLink = (
                <li>
                    <a
                        href='#'
                        onClick={EventHelpers.showInviteMemberModal}
                    >
                        <i className='fa fa-user'></i>
                        <FormattedMessage
                            id='sidebar_right_menu.inviteNew'
                            defaultMessage='Invite New Member'
                        />
                    </a>
                </li>
            );

            if (this.props.teamType === 'O') {
                teamLink = (
                    <li>
                        <a
                            href='#'
                            onClick={EventHelpers.showGetTeamInviteLinkModal}
                        >
                            <i className='glyphicon glyphicon-link'></i>
                            <FormattedMessage
                                id='sidebar_right_menu.teamLink'
                                defaultMessage='Get Team Invite Link'
                            />
                        </a>
                    </li>
                );
            }
        }

        if (isAdmin) {
            teamSettingsLink = (
                <li>
                    <a
                        href='#'
                        data-toggle='modal'
                        data-target='#team_settings'
                    >
                        <i className='fa fa-globe'></i>
                        <FormattedMessage
                            id='sidebar_right_menu.teamSettings'
                            defaultMessage='Team Settings'
                        />
                    </a>
                </li>
            );
            manageLink = (
                <li>
                    <ToggleModalButton dialogType={TeamMembersModal}>
                        <i className='fa fa-users'></i>
                        <FormattedMessage
                            id='sidebar_right_menu.manageMembers'
                            defaultMessage='Manage Members'
                        />
                    </ToggleModalButton>
                </li>
            );
        }

        if (isSystemAdmin && !utils.isMobile()) {
            consoleLink = (
                <li>
                    <a
                        href={'/admin_console?' + utils.getSessionIndex()}
                    >
                    <i className='fa fa-wrench'></i>
                        <FormattedMessage
                            id='sidebar_right_menu.console'
                            defaultMessage='System Console'
                        />
                    </a>
                </li>
            );
        }

        var siteName = '';
        if (global.window.mm_config.SiteName != null) {
            siteName = global.window.mm_config.SiteName;
        }
        var teamDisplayName = siteName;
        if (this.props.teamDisplayName) {
            teamDisplayName = this.props.teamDisplayName;
        }

        let helpLink = null;
        if (global.window.mm_config.HelpLink) {
            helpLink = (
                <li>
                    <a
                        target='_blank'
                        href={global.window.mm_config.HelpLink}
                    >
                        <i className='fa fa-question'></i>
                        <FormattedMessage
                            id='sidebar_right_menu.help'
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
                        <i className='fa fa-phone'></i>
                        <FormattedMessage
                            id='sidebar_right_menu.report'
                            defaultMessage='Report a Problem'
                        />
                    </a>
                </li>
            );
        }
        return (
            <div>
                <div className='team__header theme'>
                    <a
                        className='team__name'
                        href='/channels/town-square'
                    >{teamDisplayName}</a>
                </div>

                <div className='nav-pills__container'>
                    <ul className='nav nav-pills nav-stacked'>
                        <li>
                            <a
                                href='#'
                                onClick={() => this.setState({showUserSettingsModal: true})}
                            >
                                <i className='fa fa-cog'></i>
                                <FormattedMessage
                                    id='sidebar_right_menu.accountSettings'
                                    defaultMessage='Account Settings'
                                />
                            </a>
                        </li>
                        {teamSettingsLink}
                        {inviteLink}
                        {teamLink}
                        {manageLink}
                        {consoleLink}
                        <li>
                            <a
                                href='#'
                                onClick={this.handleLogoutClick}
                            >
                                <i className='fa fa-sign-out'></i>
                                <FormattedMessage
                                    id='sidebar_right_menu.logout'
                                    defaultMessage='Logout'
                                />
                            </a>
                        </li>
                        <li className='divider'></li>
                        {helpLink}
                        {reportLink}
                    </ul>
                </div>
                <UserSettingsModal
                    show={this.state.showUserSettingsModal}
                    onModalDismissed={() => this.setState({showUserSettingsModal: false})}
                />
            </div>
        );
    }
}

SidebarRightMenu.propTypes = {
    teamType: React.PropTypes.string,
    teamDisplayName: React.PropTypes.string
};
