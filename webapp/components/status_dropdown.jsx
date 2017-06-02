// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import {Dropdown} from 'react-bootstrap';
import StatusIcon from './status_icon.jsx';
import * as ChannelActions from 'actions/channel_actions.jsx';
import ChannelStore from 'stores/channel_store.jsx';
import TeamStore from 'stores/team_store.jsx';
import {FormattedMessage} from 'react-intl';
import PreferenceStore from 'stores/preference_store.jsx';
import {UserStatuses} from '../utils/constants.jsx';
import BootstrapSpan from './bootstrap_span.jsx';

export default class StatusDropdown extends React.Component {

    static propTypes = {
        status: React.PropTypes.string,
        profilePicture: React.PropTypes.element,
        style: React.PropTypes.object
    }

    constructor(props) {
        super(props);

        this.state = {
            showDropdown: false,
            mouseOver: false
        };
    }

    onMouseEnter = () => {
        this.setState({mouseOver: true});
    }

    onMouseLeave = () => {
        this.setState({mouseOver: false});
    }

    onToggle = (showDropdown) => {
        this.setState({showDropdown});
    }

    closeDropdown = () => {
        this.setState({showDropdown: false});
    }

    setOnline = (event) => {
        event.preventDefault();
        this.setStatus(UserStatuses.ONLINE);
    }

    setOffline = (event) => {
        event.preventDefault();
        this.setStatus(UserStatuses.OFFLINE);
    }

    setAway = (event) => {
        event.preventDefault();
        this.setStatus(UserStatuses.AWAY);
    }

    setStatus = (status) => {
        const channel = ChannelStore.getCurrent();
        const channelId = channel.id;
        const args = {channel_id: channelId};

        ChannelActions.executeCommand(
            `/${status}`,
            args,
            this.closeDropdown,
            this.closeDropdown
        );
    }

    renderStatusOnlineAction = () => {
        return this.renderStatusAction(UserStatuses.ONLINE, this.setOnline);
    }

    renderStatusAwayAction = () => {
        return this.renderStatusAction(UserStatuses.AWAY, this.setAway);
    }

    renderStatusOfflineAction = () => {
        return this.renderStatusAction(UserStatuses.OFFLINE, this.setOffline);
    }

    renderStatusAction = (status, onClick) => {
        return (
            <li key={status}>
                <a
                    href={'#'}
                    onClick={onClick}
                >
                    <FormattedMessage
                        id={`status_dropdown.set_${status}`}
                        defaultMessage={status}
                    />
                </a>
            </li>
        );
    }

    renderStatusIcon = () => {
        if (this.state.mouseOver) {
            const team = TeamStore.getCurrent();
            const theme = PreferenceStore.getTheme(team.id);
            const iconStyle = {color: theme.sidebarHeaderTextColor};
            return (
                <span className={'status status-edit'}>
                    <i
                        className={'fa fa-caret-down'}
                        style={iconStyle}
                    />
                </span>
            );
        }
        return (
            <StatusIcon
                status={this.props.status}
            />
        );
    }

    render() {
        const statusIcon = this.renderStatusIcon();
        const actions = [
            this.renderStatusOnlineAction(),
            this.renderStatusAwayAction(),
            this.renderStatusOfflineAction()
        ];
        return (
            <Dropdown
                id={'status-dropdown'}
                open={this.state.showDropdown}
                onToggle={this.onToggle}
                style={this.props.style}
            >
                <BootstrapSpan
                    bsRole={'toggle'}
                    onMouseEnter={this.onMouseEnter}
                    onMouseLeave={this.onMouseLeave}
                >
                    <div className='status-wrapper'>
                        {this.props.profilePicture}
                        <div className='status_dropdown__toggle'>
                            {statusIcon}
                        </div>
                    </div>
                </BootstrapSpan>
                <Dropdown.Menu>
                    {actions}
                </Dropdown.Menu>
            </Dropdown>
        );
    }
}
