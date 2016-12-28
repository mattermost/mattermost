// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {openDirectChannelToUser} from 'actions/channel_actions.jsx';
import {browserHistory} from 'react-router/es6';

import * as Utils from 'utils/utils.jsx';
import UserStore from 'stores/user_store.jsx';
import TeamStore from 'stores/team_store.jsx';
import React from 'react';

import emailIcon from 'images/icons/email_cta.png';
import dmIcon from 'images/icons/dm_cta.png';

export default class ProfilePopover extends React.Component {
    constructor(props) {
        super(props);

        this.handleShowDirectChannel = this.handleShowDirectChannel.bind(this);
        this.state = {
            loadingDMChannel: false
        };
    }

    shouldComponentUpdate(nextProps) {
        if (nextProps.src !== this.props.src) {
            return true;
        }
        return false;
    }

    handleShowDirectChannel(teammate, e) {
        e.preventDefault();

        if (this.state.loadingDMChannel) {
            return;
        }

        this.setState({loadingDMChannel: true});
        openDirectChannelToUser(
            teammate,
            (channel) => {
                this.exitToDirectChannel = TeamStore.getCurrentTeamRelativeUrl() + '/channels/' + channel.name;
                this.setState({loadingDMChannel: false});
                if (this.props.parent && this.props.parent.refs.overlay) {
                    this.props.parent.refs.overlay.hide();
                }
                if (this.exitToDirectChannel) {
                    browserHistory.push(this.exitToDirectChannel);
                }
            },
            () => {
                this.setState({loadingDMChannel: false});
            }
        );
    }

    render() {
        const email = this.props.user.email;
        var dataContent = [];
        var dataContentIcons = [];
        var showEmail = global.window.mm_config.ShowEmailAddress === 'true' || UserStore.isSystemAdminForCurrentUser() || this.props.user.id === UserStore.getCurrentId();
        var showDirectChannel = this.props.user.id !== UserStore.getCurrentId();
        const fullname = Utils.getFullName(this.props.user);
        if (fullname) {
            dataContent.push(
                <div
                    data-toggle='tooltip'
                    title={fullname}
                    key='user-popover-fullname'
                    className='profile-popover-name'
                >
                    <p
                        className='text-nowrap'
                    >
                        <a
                            href={`https://whober.uberinternal.com/${email}`}
                            target='_blank'
                            rel='noopener noreferrer'
                        >
                            {fullname}
                        </a>
                    </p>
                </div>
            );
        }
        if (showDirectChannel) {
            dataContentIcons.push(
                <div
                    data-toggle='tooltip'
                    title={this.props.user.username}
                    className='pull-left profile-popover-icon'
                >
                    <a
                        onClick={this.handleShowDirectChannel.bind(this, this.props.user)}
                        href='#'
                    >
                        <img
                            width='32px'
                            height='32px'
                            src={dmIcon}
                        />
                    </a>
                </div>
            );
        }
        if (showEmail) {
            dataContentIcons.push(
                <div
                    data-toggle='tooltip'
                    title={email}
                    className='pull-left profile-popover-icon'
                >
                    <a
                        href={'mailto:' + email}
                    >
                        <img
                            width='32px'
                            height='32px'
                            src={emailIcon}
                        />
                    </a>
                </div>
            );
        }
        if (showEmail || showDirectChannel) {
            dataContent.push(
                <div
                    className='profile-popover-icons'
                    style={{width: `${56 * dataContentIcons.length}px`}}
                >
                    {dataContentIcons}
                </div>
            );
        }
        return (
            <div className='profile-popover-container'>
                <img
                    className='user-popover__image'
                    src={this.props.src}
                    height='100'
                    width='100'
                    key='user-popover-image'
                />
                {dataContent}
            </div>
        );
    }
}

ProfilePopover.defaultProps = {
};
ProfilePopover.propTypes = {
    src: React.PropTypes.string.isRequired,
    user: React.PropTypes.object,
    parent: React.PropTypes.object
};
