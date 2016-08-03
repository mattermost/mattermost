// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import $ from 'jquery';

import {browserHistory} from 'react-router/es6';
import * as Utils from 'utils/utils.jsx';
import * as AsyncClient from 'utils/async_client.jsx';
import TeamStore from 'stores/team_store.jsx';
import UserStore from 'stores/user_store.jsx';
import PreferenceStore from 'stores/preference_store.jsx';
import ChannelStore from 'stores/channel_store.jsx';
import * as GlobalActions from 'actions/global_actions.jsx';
import Constants from 'utils/constants.jsx';
const TutorialSteps = Constants.TutorialSteps;
const Preferences = Constants.Preferences;

import ErrorBar from 'components/error_bar.jsx';
import SidebarRight from 'components/sidebar_right.jsx';
import SidebarRightMenu from 'components/sidebar_right_menu.jsx';
import Navbar from 'components/navbar.jsx';

// Modals
import GetPostLinkModal from 'components/get_post_link_modal.jsx';
import GetPublicLinkModal from 'components/get_public_link_modal.jsx';
import GetTeamInviteLinkModal from 'components/get_team_invite_link_modal.jsx';
import EditPostModal from 'components/edit_post_modal.jsx';
import DeletePostModal from 'components/delete_post_modal.jsx';
import MoreChannelsModal from 'components/more_channels.jsx';
import TeamSettingsModal from 'components/team_settings_modal.jsx';
import RemovedFromChannelModal from 'components/removed_from_channel_modal.jsx';
import ImportThemeModal from 'components/user_settings/import_theme_modal.jsx';
import InviteMemberModal from 'components/invite_member_modal.jsx';
import LeaveTeamModal from 'components/leave_team_modal.jsx';
import SelectTeamModal from 'components/admin_console/select_team_modal.jsx';

export default class NeedsTeam extends React.Component {
    constructor(params) {
        super(params);

        this.onTeamChanged = this.onTeamChanged.bind(this);
        this.onPreferencesChanged = this.onPreferencesChanged.bind(this);

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

        // Set up tracking for whether the window is active
        window.isActive = true;
        $(window).on('focus', () => {
            AsyncClient.updateLastViewedAt();
            ChannelStore.resetCounts(ChannelStore.getCurrentId());
            ChannelStore.emitChange();
            window.isActive = true;
        });

        $(window).on('blur', () => {
            window.isActive = false;
        });

        Utils.applyTheme(this.state.theme);
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
    }

    render() {
        let content = [];
        if (this.props.children) {
            content = this.props.children;
        } else {
            content.push(
                this.props.navbar
            );
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
        return (
            <div className='channel-view'>
                <ErrorBar/>
                <div className='container-fluid'>
                    <SidebarRight/>
                    <SidebarRightMenu teamType={this.state.team.type}/>
                    {content}

                    <GetPostLinkModal/>
                    <GetPublicLinkModal/>
                    <GetTeamInviteLinkModal/>
                    <InviteMemberModal/>
                    <LeaveTeamModal/>
                    <ImportThemeModal/>
                    <TeamSettingsModal/>
                    <MoreChannelsModal/>
                    <EditPostModal/>
                    <DeletePostModal/>
                    <RemovedFromChannelModal/>
                    <SelectTeamModal/>
                </div>
            </div>
        );
    }
}

NeedsTeam.propTypes = {
    children: React.PropTypes.oneOfType([
        React.PropTypes.arrayOf(React.PropTypes.element),
        React.PropTypes.element
    ]),
    navbar: React.PropTypes.element,
    sidebar: React.PropTypes.element,
    center: React.PropTypes.element,
    params: React.PropTypes.object,
    user: React.PropTypes.object
};
