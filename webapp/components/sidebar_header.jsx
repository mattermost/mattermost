import PropTypes from 'prop-types';

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import Client from 'client/web_client.jsx';
import PreferenceStore from 'stores/preference_store.jsx';
import UserStore from 'stores/user_store.jsx';
import * as Utils from 'utils/utils.jsx';

import SidebarHeaderDropdown from './sidebar_header_dropdown.jsx';
import {Tooltip, OverlayTrigger} from 'react-bootstrap';

import {Preferences, TutorialSteps, Constants} from 'utils/constants.jsx';
import {createMenuTip} from 'components/tutorial/tutorial_tip.jsx';
import StatusDropdown from './status_dropdown.jsx';

export default class SidebarHeader extends React.Component {
    constructor(props) {
        super(props);

        this.state = this.getStateFromStores();
    }

    componentDidMount() {
        PreferenceStore.addChangeListener(this.onPreferenceChange);
        UserStore.addStatusesChangeListener(this.onStatusChange);
        window.addEventListener('resize', this.handleResize);
    }

    componentWillUnmount() {
        PreferenceStore.removeChangeListener(this.onPreferenceChange);
        UserStore.removeStatusesChangeListener(this.onStatusChange);
        window.removeEventListener('resize', this.handleResize);
    }

    handleResize = () => {
        const isMobile = Utils.isMobile();
        this.setState({isMobile});
    }

    getPreferences = () => {
        if (!this.props.currentUser) {
            return {};
        }
        const tutorialStep = PreferenceStore.getInt(Preferences.TUTORIAL_STEP, this.props.currentUser.id, 999);
        const showTutorialTip = tutorialStep === TutorialSteps.MENU_POPOVER && !Utils.isMobile();

        return {showTutorialTip};
    }

    getCurrentUserStatus = () => {
        if (!this.props.currentUser) {
            return null;
        }
        return UserStore.getStatus(this.props.currentUser.id);
    }

    getStateFromStores = () => {
        const preferences = this.getPreferences();
        const status = this.getCurrentUserStatus();
        const isMobile = Utils.isMobile();
        return {...preferences, status, isMobile};
    }

    onPreferenceChange = () => {
        this.setState(this.getPreferences());
    }

    onStatusChange = () => {
        this.setState({status: this.getCurrentUserStatus()});
    }

    toggleDropdown = (e) => {
        e.preventDefault();

        this.refs.dropdown.toggleDropdown();
    }

    renderProfilePicture = () => {
        var user = this.props.currentUser;
        if (!user) {
            return null;
        }
        const profilePictureSrc = Client.getProfilePictureUrl(
            user.id, user.last_picture_update);
        return (
            <img
                className='user__picture'
                src={profilePictureSrc}
            />
        );
    }

    renderStatusDropdown = () => {
        if (this.state.isMobile) {
            return null;
        }
        const profilePicture = this.renderProfilePicture();
        return (
            <StatusDropdown
                status={this.state.status}
                profilePicture={profilePicture}
            />
        );
    }

    render() {
        const statusDropdown = this.renderStatusDropdown();

        let tutorialTip = null;
        if (this.state.showTutorialTip) {
            tutorialTip = createMenuTip(this.toggleDropdown);
        }

        let teamNameWithToolTip = null;
        if (this.props.teamDescription === '') {
            teamNameWithToolTip = (
                <div className='team__name'>{this.props.teamDisplayName}</div>
            );
        } else {
            teamNameWithToolTip = (
                <OverlayTrigger
                    trigger={['hover', 'focus']}
                    delayShow={Constants.OVERLAY_TIME_DELAY}
                    placement='bottom'
                    overlay={<Tooltip id='team-name__tooltip'>{this.props.teamDescription}</Tooltip>}
                    ref='descriptionOverlay'
                >
                    <div className='team__name'>{this.props.teamDisplayName}</div>
                </OverlayTrigger>
            );
        }

        return (
            <div className='team__header theme'>
                {tutorialTip}
                <div className='header__info'>
                    <div className='user__name'>{'@' + this.props.currentUser.username}</div>
                    {teamNameWithToolTip}
                </div>
                <SidebarHeaderDropdown
                    ref='dropdown'
                    teamType={this.props.teamType}
                    teamDisplayName={this.props.teamDisplayName}
                    teamName={this.props.teamName}
                    currentUser={this.props.currentUser}
                />
                {statusDropdown}
            </div>
        );
    }
}

SidebarHeader.defaultProps = {
    teamDisplayName: '',
    teamDescription: '',
    teamType: ''
};
SidebarHeader.propTypes = {
    teamDisplayName: PropTypes.string,
    teamDescription: PropTypes.string,
    teamName: PropTypes.string,
    teamType: PropTypes.string,
    currentUser: PropTypes.object
};
