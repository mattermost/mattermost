// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from 'utils/utils.jsx';
import UserStore from 'stores/user_store.jsx';
import WebrtcStore from 'stores/webrtc_store.jsx';
import TeamStore from 'stores/team_store.jsx';
import * as GlobalActions from 'actions/global_actions.jsx';
import * as WebrtcActions from 'actions/webrtc_actions.jsx';
import {openDirectChannelToUser} from 'actions/channel_actions.jsx';
import Constants from 'utils/constants.jsx';
const UserStatuses = Constants.UserStatuses;
const PreReleaseFeatures = Constants.PRE_RELEASE_FEATURES;

import {Popover, OverlayTrigger, Tooltip} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';
import {browserHistory} from 'react-router/es6';
import React from 'react';

export default class ProfilePopover extends React.Component {
    constructor(props) {
        super(props);

        this.initWebrtc = this.initWebrtc.bind(this);
        this.handleShowDirectChannel = this.handleShowDirectChannel.bind(this);
        this.state = {
            currentUserId: UserStore.getCurrentId(),
            loadingDMChannel: -1
        };
    }
    shouldComponentUpdate(nextProps) {
        if (!Utils.areObjectsEqual(nextProps.user, this.props.user)) {
            return true;
        }

        if (nextProps.src !== this.props.src) {
            return true;
        }

        if (nextProps.status !== this.props.status) {
            return true;
        }

        if (nextProps.isBusy !== this.props.isBusy) {
            return true;
        }

        // React-Bootstrap Forwarded Props from OverlayTrigger to Popover
        if (nextProps.arrowOffsetLeft !== this.props.arrowOffsetLeft) {
            return true;
        }

        if (nextProps.arrowOffsetTop !== this.props.arrowOffsetTop) {
            return true;
        }

        if (nextProps.positionLeft !== this.props.positionLeft) {
            return true;
        }

        if (nextProps.positionTop !== this.props.positionTop) {
            return true;
        }

        return false;
    }

    handleShowDirectChannel(e) {
        e.preventDefault();

        if (!this.props.user) {
            return;
        }

        const user = this.props.user;

        if (this.state.loadingDMChannel !== -1) {
            return;
        }

        this.setState({loadingDMChannel: user.id});

        openDirectChannelToUser(
            user.id,
            (channel) => {
                if (Utils.isMobile()) {
                    GlobalActions.emitCloseRightHandSide();
                }
                this.setState({loadingDMChannel: -1});
                if (this.props.hide) {
                    this.props.hide();
                }
                browserHistory.push(TeamStore.getCurrentTeamRelativeUrl() + '/channels/' + channel.name);
            }
        );
    }

    initWebrtc() {
        if (this.props.status !== UserStatuses.OFFLINE && !WebrtcStore.isBusy()) {
            GlobalActions.emitCloseRightHandSide();
            WebrtcActions.initWebrtc(this.props.user.id, true);
        }
    }

    render() {
        const popoverProps = Object.assign({}, this.props);
        delete popoverProps.user;
        delete popoverProps.src;
        delete popoverProps.status;
        delete popoverProps.isBusy;
        delete popoverProps.hide;

        let webrtc;
        const userMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

        const webrtcEnabled = global.mm_config.EnableWebrtc === 'true' && userMedia && Utils.isFeatureEnabled(PreReleaseFeatures.WEBRTC_PREVIEW);

        if (webrtcEnabled && this.props.user.id !== this.state.currentUserId) {
            const isOnline = this.props.status !== UserStatuses.OFFLINE;
            let webrtcMessage;
            let circleClass = 'offline';
            if (isOnline && !this.props.isBusy) {
                circleClass = '';
                webrtcMessage = (
                    <FormattedMessage
                        id='user_profile.webrtc.call'
                        defaultMessage='Start Video Call'
                    />
                );
            } else if (this.props.isBusy) {
                webrtcMessage = (
                    <FormattedMessage
                        id='user_profile.webrtc.unavailable'
                        defaultMessage='New call unavailable until your existing call ends'
                    />
                );
            } else {
                webrtcMessage = (
                    <FormattedMessage
                        id='user_profile.webrtc.offline'
                        defaultMessage='The user is offline'
                    />
                );
            }

            const webrtcTooltip = (
                <Tooltip id='webrtcTooltip'>{webrtcMessage}</Tooltip>
            );

            webrtc = (
                <div
                    className='webrtc__user-profile'
                    key='makeCall'
                >
                    <a
                        href='#'
                        onClick={() => this.initWebrtc()}
                        disabled={!isOnline}
                    >
                        <OverlayTrigger
                            delayShow={Constants.WEBRTC_TIME_DELAY}
                            placement='top'
                            overlay={webrtcTooltip}
                        >
                            <div
                                id='webrtc-btn'
                                className={'webrtc__button ' + circleClass}
                            >
                                <span dangerouslySetInnerHTML={{__html: Constants.VIDEO_ICON}}/>
                            </div>
                        </OverlayTrigger>
                    </a>
                </div>
            );
        }

        var dataContent = [];
        dataContent.push(
            <img
                className='user-popover__image'
                src={this.props.src}
                height='128'
                width='128'
                key='user-popover-image'
            />
        );

        const fullname = Utils.getFullName(this.props.user);
        if (fullname) {
            dataContent.push(
                <OverlayTrigger
                    delayShow={Constants.WEBRTC_TIME_DELAY}
                    placement='top'
                    overlay={<Tooltip id='fullNameTooltip'>{fullname}</Tooltip>}
                >
                    <div
                        className='overflow--ellipsis text-nowrap padding-bottom'
                    >
                        {fullname}
                    </div>
                </OverlayTrigger>
            );
        }

        if (this.props.user.position) {
            const position = this.props.user.position.substring(0, Constants.MAX_POSITION_LENGTH);
            dataContent.push(
                <OverlayTrigger
                    delayShow={Constants.WEBRTC_TIME_DELAY}
                    placement='top'
                    overlay={<Tooltip id='positionTooltip'>{position}</Tooltip>}
                >
                    <div
                        className='overflow--ellipsis text-nowrap padding-bottom'
                    >
                        {position}
                    </div>
                </OverlayTrigger>
            );
        }

        dataContent.push(webrtc);

        const email = this.props.user.email;
        if (global.window.mm_config.ShowEmailAddress === 'true' || UserStore.isSystemAdminForCurrentUser() || this.props.user === UserStore.getCurrentUser()) {
            dataContent.push(
                <div
                    data-toggle='tooltip'
                    title={email}
                    key='user-popover-email'
                >
                    <a
                        href={'mailto:' + email}
                        className='text-nowrap text-lowercase user-popover__email'
                    >
                        {email}
                    </a>
                </div>
            );
        }

        if (this.props.user.id !== UserStore.getCurrentId()) {
            dataContent.push(
                <div
                    data-toggle='tooltip'
                    key='user-popover-dm'
                    className='popover__row'
                >
                    <a
                        href='#'
                        className='text-nowrap text-lowercase user-popover__email'
                        onClick={this.handleShowDirectChannel}
                    >
                        <i className='fa fa-paper-plane'/>
                        <FormattedMessage
                            id='user_profile.send.dm'
                            defaultMessage='Send Message'
                        />
                    </a>
                </div>
            );
        }

        return (
            <Popover
                {...popoverProps}
                title={'@' + this.props.user.username}
                id='user-profile-popover'
            >
                {dataContent}
            </Popover>
        );
    }
}

ProfilePopover.propTypes = Object.assign({
    src: React.PropTypes.string.isRequired,
    user: React.PropTypes.object.isRequired,
    status: React.PropTypes.string,
    isBusy: React.PropTypes.bool,
    hide: React.PropTypes.func
}, Popover.propTypes);
delete ProfilePopover.propTypes.id;
