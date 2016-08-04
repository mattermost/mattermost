// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import NavbarDropdown from './navbar_dropdown.jsx';
import 'bootstrap';

import PreferenceStore from 'stores/preference_store.jsx';

import * as Utils from 'utils/utils.jsx';
import Client from 'client/web_client.jsx';
import Constants from 'utils/constants.jsx';

const Preferences = Constants.Preferences;
const TutorialSteps = Constants.TutorialSteps;

import {Tooltip, OverlayTrigger} from 'react-bootstrap';

import {createMenuTip} from 'components/tutorial/tutorial_tip.jsx';

import React from 'react';

export default class SidebarHeader extends React.Component {
    constructor(props) {
        super(props);

        this.toggleDropdown = this.toggleDropdown.bind(this);
        this.onPreferenceChange = this.onPreferenceChange.bind(this);

        this.state = this.getStateFromStores();
    }
    componentDidMount() {
        PreferenceStore.addChangeListener(this.onPreferenceChange);
    }
    componentWillUnmount() {
        PreferenceStore.removeChangeListener(this.onPreferenceChange);
    }
    getStateFromStores() {
        const tutorialStep = PreferenceStore.getInt(Preferences.TUTORIAL_STEP, this.props.currentUser.id, 999);

        return {showTutorialTip: tutorialStep === TutorialSteps.MENU_POPOVER && !Utils.isMobile()};
    }
    onPreferenceChange() {
        this.setState(this.getStateFromStores());
    }
    toggleDropdown(e) {
        e.preventDefault();
        if (this.refs.dropdown.blockToggle) {
            this.refs.dropdown.blockToggle = false;
            return;
        }
        $('.team__header').find('.dropdown-toggle').dropdown('toggle');
    }
    render() {
        var me = this.props.currentUser;
        var profilePicture = null;

        if (!me) {
            return null;
        }

        if (me.last_picture_update) {
            profilePicture = (
                <img
                    className='user__picture'
                    src={Client.getUsersRoute() + '/' + me.id + '/image?time=' + me.update_at}
                />
            );
        }

        let tutorialTip = null;
        if (this.state.showTutorialTip) {
            tutorialTip = createMenuTip(this.toggleDropdown);
        }

        return (
            <div className='team__header theme'>
                {tutorialTip}
                <a
                    href='#'
                    onClick={this.toggleDropdown}
                >
                    {profilePicture}
                    <div className='header__info'>
                        <div className='user__name'>{'@' + me.username}</div>
                        <OverlayTrigger
                            trigger={['hover', 'focus']}
                            delayShow={1000}
                            placement='bottom'
                            overlay={<Tooltip id='team-name__tooltip'>{this.props.teamDisplayName}</Tooltip>}
                            ref='descriptionOverlay'
                        >
                            <div className='team__name'>{this.props.teamDisplayName}</div>
                        </OverlayTrigger>
                    </div>
                </a>
                <NavbarDropdown
                    ref='dropdown'
                    teamType={this.props.teamType}
                    teamDisplayName={this.props.teamDisplayName}
                    teamName={this.props.teamName}
                    currentUser={this.props.currentUser}
                />
            </div>
        );
    }
}

SidebarHeader.defaultProps = {
    teamDisplayName: '',
    teamType: ''
};
SidebarHeader.propTypes = {
    teamDisplayName: React.PropTypes.string,
    teamName: React.PropTypes.string,
    teamType: React.PropTypes.string,
    currentUser: React.PropTypes.object
};
