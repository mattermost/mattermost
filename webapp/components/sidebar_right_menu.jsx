// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import TeamMembersModal from './team_members_modal.jsx';
import ToggleModalButton from './toggle_modal_button.jsx';
import UserSettingsModal from './user_settings/user_settings_modal.jsx';
import AboutBuildModal from './about_build_modal.jsx';

import UserStore from 'stores/user_store.jsx';
import TeamStore from 'stores/team_store.jsx';
import SearchStore from 'stores/search_store.jsx';
import PreferenceStore from 'stores/preference_store.jsx';
import WebrtcStore from 'stores/webrtc_store.jsx';

import * as GlobalActions from 'actions/global_actions.jsx';
import {getFlaggedPosts} from 'actions/post_actions.jsx';
import * as UserAgent from 'utils/user_agent.jsx';
import * as Utils from 'utils/utils.jsx';
import {Constants, WebrtcActionTypes} from 'utils/constants.jsx';

const ActionTypes = Constants.ActionTypes;
const Preferences = Constants.Preferences;
const TutorialSteps = Constants.TutorialSteps;

import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router/es6';
import {createMenuTip} from 'components/tutorial/tutorial_tip.jsx';

import React from 'react';
import PureRenderMixin from 'react-addons-pure-render-mixin';

export default class SidebarRightMenu extends React.Component {
    constructor(props) {
        super(props);

        this.onPreferenceChange = this.onPreferenceChange.bind(this);
        this.handleClick = this.handleClick.bind(this);
        this.handleAboutModal = this.handleAboutModal.bind(this);
        this.searchMentions = this.searchMentions.bind(this);
        this.aboutModalDismissed = this.aboutModalDismissed.bind(this);
        this.getFlagged = this.getFlagged.bind(this);

        const state = this.getStateFromStores();
        state.showUserSettingsModal = false;
        state.showAboutModal = false;

        this.shouldComponentUpdate = PureRenderMixin.shouldComponentUpdate.bind(this);

        this.state = state;
    }

    handleClick(e) {
        if (WebrtcStore.isBusy()) {
            WebrtcStore.emitChanged({action: WebrtcActionTypes.IN_PROGRESS});
            e.preventDefault();
        }
    }

    handleAboutModal() {
        this.setState({showAboutModal: true});
    }

    aboutModalDismissed() {
        this.setState({showAboutModal: false});
    }

    getFlagged(e) {
        e.preventDefault();
        getFlaggedPosts();
    }

    componentDidMount() {
        PreferenceStore.addChangeListener(this.onPreferenceChange);
    }

    componentWillUnmount() {
        PreferenceStore.removeChangeListener(this.onPreferenceChange);
    }

    getStateFromStores() {
        const tutorialStep = PreferenceStore.getInt(Preferences.TUTORIAL_STEP, UserStore.getCurrentId(), 999);

        return {
            currentUser: UserStore.getCurrentUser(),
            showTutorialTip: tutorialStep === TutorialSteps.MENU_POPOVER && Utils.isMobile()
        };
    }

    onPreferenceChange() {
        this.setState(this.getStateFromStores());
    }

    searchMentions(e) {
        e.preventDefault();
        const user = this.state.currentUser;
        if (SearchStore.isMentionSearch) {
            GlobalActions.toggleSideBarAction(false);
        } else {
            GlobalActions.emitSearchMentionsEvent(user);
            this.hideSidebars();
        }
    }

    closeLeftSidebar() {
        if (Utils.isMobile()) {
            setTimeout(() => {
                document.querySelector('.app__body .inner-wrap').classList.remove('move--right');
                document.querySelector('.app__body .sidebar--left').classList.remove('move--right');
            });
        }
    }

    openRightSidebar() {
        if (Utils.isMobile()) {
            setTimeout(() => {
                document.querySelector('.app__body .inner-wrap').classList.add('move--left-small');
                document.querySelector('.app__body .sidebar--menu').classList.add('move--left');
            });
        }
    }

    hideSidebars() {
        if (Utils.isMobile()) {
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_SEARCH,
                results: null
            });

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_POST_SELECTED,
                postId: null
            });

            document.querySelector('.app__body .inner-wrap').classList.remove('move--right', 'move--left', 'move--left-small');
            document.querySelector('.app__body .sidebar--left').classList.remove('move--right');
            document.querySelector('.app__body .sidebar--right').classList.remove('move--left');
            document.querySelector('.app__body .sidebar--menu').classList.remove('move--left');
        }
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
            isAdmin = TeamStore.isTeamAdminForCurrentTeam() || UserStore.isSystemAdminForCurrentUser();
            isSystemAdmin = UserStore.isSystemAdminForCurrentUser();

            inviteLink = (
                <li>
                    <a
                        href='#'
                        onClick={GlobalActions.showInviteMemberModal}
                    >
                        <i className='icon fa fa-user-plus'/>
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
                            onClick={GlobalActions.showGetTeamInviteLinkModal}
                        >
                            <i className='icon fa fa-link'/>
                            <FormattedMessage
                                id='sidebar_right_menu.teamLink'
                                defaultMessage='Get Team Invite Link'
                            />
                        </a>
                    </li>
                );
            }

            if (global.window.mm_license.IsLicensed === 'true') {
                if (global.window.mm_config.RestrictTeamInvite === Constants.PERMISSIONS_SYSTEM_ADMIN && !isSystemAdmin) {
                    teamLink = null;
                    inviteLink = null;
                } else if (global.window.mm_config.RestrictTeamInvite === Constants.PERMISSIONS_TEAM_ADMIN && !isAdmin) {
                    teamLink = null;
                    inviteLink = null;
                }
            }
        }

        manageLink = (
            <li>
                <ToggleModalButton dialogType={TeamMembersModal}>
                    <i className='icon fa fa-users'/>
                    <FormattedMessage
                        id='sidebar_right_menu.viewMembers'
                        defaultMessage='View Members'
                    />
                </ToggleModalButton>
            </li>
        );

        if (isAdmin) {
            teamSettingsLink = (
                <li>
                    <a
                        href='#'
                        data-toggle='modal'
                        data-target='#team_settings'
                    >
                        <i className='icon fa fa-globe'/>
                        <FormattedMessage
                            id='sidebar_right_menu.teamSettings'
                            defaultMessage='Team Settings'
                        />
                    </a>
                </li>
            );
            manageLink = (
                <li>
                    <ToggleModalButton
                        dialogType={TeamMembersModal}
                        dialogProps={{isAdmin}}
                    >
                        <i className='icon fa fa-users'/>
                        <FormattedMessage
                            id='sidebar_right_menu.manageMembers'
                            defaultMessage='Manage Members'
                        />
                    </ToggleModalButton>
                </li>
            );
        }

        if (isSystemAdmin && !Utils.isMobile()) {
            consoleLink = (
                <li>
                    <Link
                        to={'/admin_console'}
                        onClick={this.handleClick}
                    >
                        <i className='icon fa fa-wrench'/>
                        <FormattedMessage
                            id='sidebar_right_menu.console'
                            defaultMessage='System Console'
                        />
                    </Link>
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
                    <Link
                        target='_blank'
                        rel='noopener noreferrer'
                        to={global.window.mm_config.HelpLink}
                    >
                        <i className='icon fa fa-question'/>
                        <FormattedMessage
                            id='sidebar_right_menu.help'
                            defaultMessage='Help'
                        />
                    </Link>
                </li>
            );
        }

        let reportLink = null;
        if (global.window.mm_config.ReportAProblemLink) {
            reportLink = (
                <li>
                    <Link
                        target='_blank'
                        rel='noopener noreferrer'
                        to={global.window.mm_config.ReportAProblemLink}
                    >
                        <i className='icon fa fa-phone'/>
                        <FormattedMessage
                            id='sidebar_right_menu.report'
                            defaultMessage='Report a Problem'
                        />
                    </Link>
                </li>
            );
        }

        let tutorialTip = null;
        if (this.state.showTutorialTip) {
            tutorialTip = createMenuTip((e) => e.preventDefault(), true);
            this.closeLeftSidebar();
            this.openRightSidebar();
        }

        let nativeAppLink = null;
        if (global.window.mm_config.AppDownloadLink && !UserAgent.isMobileApp()) {
            nativeAppLink = (
                <li>
                    <Link
                        target='_blank'
                        rel='noopener noreferrer'
                        to={global.window.mm_config.AppDownloadLink}
                    >
                        <i className='icon fa fa-mobile'/>
                        <FormattedMessage
                            id='sidebar_right_menu.nativeApps'
                            defaultMessage='Download Apps'
                        />
                    </Link>
                </li>
            );
        }

        return (
            <div
                className='sidebar--menu'
                id='sidebar-menu'
            >
                <div className='team__header theme'>
                    <Link
                        className='team__name'
                        to='/channels/town-square'
                    >
                        {teamDisplayName}
                    </Link>
                </div>

                <div className='nav-pills__container'>
                    {tutorialTip}
                    <ul className='nav nav-pills nav-stacked'>
                        <li>
                            <a
                                href='#'
                                onClick={this.searchMentions}
                            >
                                <i className='icon mentions'>{'@'}</i>
                                <FormattedMessage
                                    id='sidebar_right_menu.recentMentions'
                                    defaultMessage='Recent Mentions'
                                />
                            </a>
                        </li>
                        <li>
                            <a
                                href='#'
                                onClick={this.getFlagged}
                            >
                                <i className='icon fa fa-flag'/>
                                <FormattedMessage
                                    id='sidebar_right_menu.flagged'
                                    defaultMessage='Flagged Posts'
                                />
                            </a>
                        </li>
                        <li className='divider'/>
                        <li>
                            <a
                                href='#'
                                onClick={() => this.setState({showUserSettingsModal: true})}
                            >
                                <i className='icon fa fa-cog'/>
                                <FormattedMessage
                                    id='sidebar_right_menu.accountSettings'
                                    defaultMessage='Account Settings'
                                />
                            </a>
                        </li>
                        {inviteLink}
                        {teamLink}
                        <li className='divider'/>
                        {teamSettingsLink}
                        {manageLink}
                        {consoleLink}
                        <li>
                            <Link to='/select_team'>
                                <i className='icon fa fa-exchange'/>
                                <FormattedMessage
                                    id='sidebar_right_menu.switch_team'
                                    defaultMessage='Team Selection'
                                />
                            </Link>
                        </li>
                        <li className='divider'/>
                        {helpLink}
                        {reportLink}
                        <li>
                            <a
                                href='#'
                                onClick={this.handleAboutModal}
                            >
                                <i className='icon fa fa-info'/>
                                <FormattedMessage
                                    id='navbar_dropdown.about'
                                    defaultMessage='About Mattermost'
                                />
                            </a>
                        </li>
                        <li className='divider'/>
                        {nativeAppLink}
                        <li className='divider'/>
                        <li>
                            <a
                                href='#'
                                onClick={GlobalActions.emitUserLoggedOutEvent}
                            >
                                <i className='icon fa fa-sign-out'/>
                                <FormattedMessage
                                    id='sidebar_right_menu.logout'
                                    defaultMessage='Logout'
                                />
                            </a>
                        </li>
                    </ul>
                </div>
                <UserSettingsModal
                    show={this.state.showUserSettingsModal}
                    onModalDismissed={() => this.setState({showUserSettingsModal: false})}
                />
                <AboutBuildModal
                    show={this.state.showAboutModal}
                    onModalDismissed={this.aboutModalDismissed}
                />
            </div>
        );
    }
}

SidebarRightMenu.propTypes = {
    teamType: React.PropTypes.string,
    teamDisplayName: React.PropTypes.string
};
