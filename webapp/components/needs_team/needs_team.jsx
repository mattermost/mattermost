// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import $ from 'jquery';

import {browserHistory} from 'react-router/es6';
import * as Utils from 'utils/utils.jsx';
import TeamStore from 'stores/team_store.jsx';
import UserStore from 'stores/user_store.jsx';
import PreferenceStore from 'stores/preference_store.jsx';
import ChannelStore from 'stores/channel_store.jsx';
import PostStore from 'stores/post_store.jsx';
import * as GlobalActions from 'actions/global_actions.jsx';
import {startPeriodicStatusUpdates, stopPeriodicStatusUpdates} from 'actions/status_actions.jsx';
import {startPeriodicSync, stopPeriodicSync} from 'actions/websocket_actions.jsx';
import {loadProfilesForSidebar} from 'actions/user_actions.jsx';

import Constants from 'utils/constants.jsx';
const TutorialSteps = Constants.TutorialSteps;
const Preferences = Constants.Preferences;

import ErrorBar from 'components/error_bar.jsx';
import SidebarRight from 'components/sidebar_right.jsx';
import SidebarRightMenu from 'components/sidebar_right_menu.jsx';
import Navbar from 'components/navbar.jsx';
import WebrtcSidebar from 'components/webrtc/components/webrtc_sidebar.jsx';

import WebrtcNotification from 'components/webrtc/components/webrtc_notification.jsx';

// Modals
import GetPostLinkModal from 'components/get_post_link_modal.jsx';
import GetPublicLinkModal from 'components/get_public_link_modal.jsx';
import GetTeamInviteLinkModal from 'components/get_team_invite_link_modal.jsx';
import EditPostModal from 'components/edit_post_modal.jsx';
import DeletePostModal from 'components/delete_post_modal.jsx';
import TeamSettingsModal from 'components/team_settings_modal.jsx';
import RemovedFromChannelModal from 'components/removed_from_channel_modal.jsx';
import ImportThemeModal from 'components/user_settings/import_theme_modal.jsx';
import InviteMemberModal from 'components/invite_member_modal.jsx';
import LeaveTeamModal from 'components/leave_team_modal.jsx';

import iNoBounce from 'inobounce';
import * as UserAgent from 'utils/user_agent.jsx';

const UNREAD_CHECK_TIME_MILLISECONDS = 10000;

export default class NeedsTeam extends React.Component {
    static propTypes = {
        children: React.PropTypes.oneOfType([
            React.PropTypes.arrayOf(React.PropTypes.element),
            React.PropTypes.element
        ]),
        navbar: React.PropTypes.element,
        sidebar: React.PropTypes.element,
        team_sidebar: React.PropTypes.element,
        center: React.PropTypes.element,
        params: React.PropTypes.object,
        user: React.PropTypes.object,
        actions: React.PropTypes.shape({
            viewChannel: React.PropTypes.func.isRequired,
            getMyChannelMembers: React.PropTypes.func.isRequired
        }).isRequired
    }

    constructor(params) {
        super(params);

        this.onTeamChanged = this.onTeamChanged.bind(this);
        this.onPreferencesChanged = this.onPreferencesChanged.bind(this);

        this.blurTime = new Date().getTime();

        const team = TeamStore.getCurrent();

        this.state = {
            team,
            theme: PreferenceStore.getTheme(team.id)
        };
    }

    onTeamChanged() {
        const team = TeamStore.getCurrent();

        this.setState({
            team,
            theme: PreferenceStore.getTheme(team.id)
        });
    }

    onPreferencesChanged(category) {
        if (!category || category === Preferences.CATEGORY_THEME) {
            this.setState({
                theme: PreferenceStore.getTheme(this.state.team.id)
            });
        }
    }

    componentWillMount() {
        // Go to tutorial if we are first arriving
        const tutorialStep = PreferenceStore.getInt(Preferences.TUTORIAL_STEP, UserStore.getCurrentId(), 999);
        if (tutorialStep <= TutorialSteps.INTRO_SCREENS) {
            browserHistory.push(TeamStore.getCurrentTeamRelativeUrl() + '/tutorial');
        }
    }

    componentDidMount() {
        TeamStore.addChangeListener(this.onTeamChanged);
        PreferenceStore.addChangeListener(this.onPreferencesChanged);

        // Emit view action
        GlobalActions.viewLoggedIn();

        startPeriodicStatusUpdates();
        startPeriodicSync();

        // Set up tracking for whether the window is active
        window.isActive = true;
        $(window).on('focus', () => {
            this.props.actions.viewChannel(ChannelStore.getCurrentId());
            ChannelStore.resetCounts([ChannelStore.getCurrentId()]);
            ChannelStore.emitChange();

            window.isActive = true;
            if (new Date().getTime() - this.blurTime > UNREAD_CHECK_TIME_MILLISECONDS) {
                this.props.actions.getMyChannelMembers(TeamStore.getCurrentId()).then(loadProfilesForSidebar);
            }
        });

        $(window).on('blur', () => {
            window.isActive = false;
            this.blurTime = new Date().getTime();
            if (UserStore.getCurrentUser()) {
                this.props.actions.viewChannel('');
            }
        });

        Utils.applyTheme(this.state.theme);

        if (UserAgent.isIosSafari()) {
            // Use iNoBounce to prevent scrolling past the boundaries of the page
            iNoBounce.enable();
        }
    }

    componentDidUpdate(prevProps, prevState) {
        if (!Utils.areObjectsEqual(prevState.theme, this.state.theme)) {
            Utils.applyTheme(this.state.theme);
        }
    }

    componentWillUnmount() {
        TeamStore.removeChangeListener(this.onTeamChanged);
        PreferenceStore.removeChangeListener(this.onPreferencesChanged);
        $(window).off('focus');
        $(window).off('blur');

        if (UserAgent.isIosSafari()) {
            iNoBounce.disable();
        }
        stopPeriodicStatusUpdates();
        stopPeriodicSync();
    }

    render() {
        let content = [];
        if (this.props.children) {
            content = this.props.children;
        } else {
            content.push(
                this.props.navbar
            );
            content.push(this.props.team_sidebar);
            content.push(
                this.props.sidebar
            );
            content.push(
                <div
                    key='inner-wrap'
                    className='inner-wrap channel__wrap'
                >
                    <div className='row header'>
                        <div id='navbar'>
                            <Navbar/>
                        </div>
                    </div>
                    <div className='row main'>
                        {React.cloneElement(this.props.center, {
                            user: this.props.user,
                            team: this.state.team
                        })}
                    </div>
                </div>
            );
        }

        let channel = ChannelStore.getByName(this.props.params.channel);
        if (channel == null) {
            // the permalink view is not really tied to a particular channel but still needs it
            const postId = PostStore.getFocusedPostId();
            const post = PostStore.getEarliestPostFromPage(postId);

            // the post take some time before being available on page load
            if (post != null) {
                channel = ChannelStore.get(post.channel_id);
            }
        }

        return (
            <div className='channel-view'>
                <ErrorBar/>
                <WebrtcNotification/>
                <div className='container-fluid'>
                    <SidebarRight channel={channel}/>
                    <SidebarRightMenu teamType={this.state.team.type}/>
                    <WebrtcSidebar/>
                    {content}

                    <GetPostLinkModal/>
                    <GetPublicLinkModal/>
                    <GetTeamInviteLinkModal/>
                    <InviteMemberModal/>
                    <LeaveTeamModal/>
                    <ImportThemeModal/>
                    <TeamSettingsModal/>
                    <EditPostModal/>
                    <DeletePostModal/>
                    <RemovedFromChannelModal/>
                </div>
            </div>
        );
    }
}
