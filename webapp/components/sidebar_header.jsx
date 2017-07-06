// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import PropTypes from 'prop-types';

import PreferenceStore from 'stores/preference_store.jsx';
import * as Utils from 'utils/utils.jsx';

import SidebarHeaderDropdown from './sidebar_header_dropdown.jsx';
import {Tooltip, OverlayTrigger} from 'react-bootstrap';

import {Preferences, TutorialSteps, Constants} from 'utils/constants.jsx';
import {createMenuTip} from 'components/tutorial/tutorial_tip.jsx';
import StatusDropdown from 'components/status_dropdown/index.jsx';

export default class SidebarHeader extends React.Component {
    constructor(props) {
        super(props);

        this.state = this.getStateFromStores();
    }

    componentDidMount() {
        PreferenceStore.addChangeListener(this.onPreferenceChange);
        window.addEventListener('resize', this.handleResize);
    }

    componentWillUnmount() {
        PreferenceStore.removeChangeListener(this.onPreferenceChange);
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

    getStateFromStores = () => {
        const preferences = this.getPreferences();
        const isMobile = Utils.isMobile();
        return {...preferences, isMobile};
    }

    onPreferenceChange = () => {
        this.setState(this.getPreferences());
    }

    toggleDropdown = (e) => {
        e.preventDefault();

        this.refs.dropdown.toggleDropdown();
    }

    renderStatusDropdown = () => {
        if (this.state.isMobile) {
            return null;
        }
        return (
            <StatusDropdown/>
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
                    {teamNameWithToolTip}
                    <div className='user__name'>{'@' + this.props.currentUser.username}</div>
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
