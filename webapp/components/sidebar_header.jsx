// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import PreferenceStore from 'stores/preference_store.jsx';
import * as Utils from 'utils/utils.jsx';

import SidebarHeaderDropdown from './sidebar_header_dropdown.jsx';
import SidebarHeaderStatusDropdown from './sidebar_header_status_dropdown.jsx';
import {Tooltip, OverlayTrigger} from 'react-bootstrap';

import {Preferences, TutorialSteps} from 'utils/constants.jsx';
import {createMenuTip} from 'components/tutorial/tutorial_tip.jsx';

import statusAway from 'images/icons/IC_DM_Away.svg';
import statusOnline from 'images/icons/IC_DM_Online.svg';
import statusOffline from 'images/icons/IC_DM_Offline.svg';

export default class SidebarHeader extends React.Component {
    constructor(props) {
        super(props);

        this.toggleDropdown = this.toggleDropdown.bind(this);
        this.toggleStatusDropdown = this.toggleStatusDropdown.bind(this);
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

        this.refs.dropdown.toggleDropdown();
    }

    toggleStatusDropdown(e) {
        e.preventDefault();

        this.refs.statusDropdown.toggleDropdown();
    }

    render() {
        var me = this.props.currentUser;
        const fullName = Utils.getFullName(me);

        if (!me) {
            return null;
        }

        let tutorialTip = null;
        if (this.state.showTutorialTip) {
            tutorialTip = createMenuTip(this.toggleDropdown);
        }

        let statusIconUrl;
        switch (this.props.currentUserStatus) {
        case 'away':
            statusIconUrl = statusAway;
            break;
        case 'online':
            statusIconUrl = statusOnline;
            break;
        case 'offline':
            statusIconUrl = statusOffline;
            break;
        }

        return (
            <div className='team__header theme'>
                {tutorialTip}
                <a
                    href='#'
                    onClick={this.toggleStatusDropdown}
                >
                    <div className='header__info'>
                        <div className='header__status-border'>
                            <div
                                className='header__status'
                                style={{
                                    backgroundImage: `url(${statusIconUrl})`
                                }}
                            />
                        </div>
                        <OverlayTrigger
                            className='hidden-xs'
                            trigger={['hover', 'focus']}
                            delayShow={1000}
                            placement='bottom'
                            overlay={(
                                <Tooltip
                                    id='full-name__tooltip'
                                    className='hidden-xs'
                                >
                                    {fullName}
                                </Tooltip>
                            )}
                            ref='descriptionOverlay'
                        >
                            <div className='full__name'>{fullName}</div>
                        </OverlayTrigger>
                    </div>
                </a>
                <SidebarHeaderDropdown
                    ref='dropdown'
                    teamType={this.props.teamType}
                    teamDisplayName={this.props.teamDisplayName}
                    teamName={this.props.teamName}
                    currentUser={this.props.currentUser}
                />
                <SidebarHeaderStatusDropdown
                    ref='statusDropdown'
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
    currentUser: React.PropTypes.object,
    currentUserStatus: React.PropTypes.string
};
