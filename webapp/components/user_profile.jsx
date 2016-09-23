// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from 'utils/utils.jsx';
import Client from 'client/web_client.jsx';
import UserStore from 'stores/user_store.jsx';
import WebrtcStore from 'stores/webrtc_store.jsx';
import * as GlobalActions from 'actions/global_actions.jsx';
import * as WebrtcActions from 'actions/webrtc_actions.jsx';
import Constants from 'utils/constants.jsx';
const UserStatuses = Constants.UserStatuses;
const PreReleaseFeatures = Constants.PRE_RELEASE_FEATURES;

import {Popover, OverlayTrigger} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import React from 'react';

export default class UserProfile extends React.Component {
    constructor(props) {
        super(props);

        this.initWebrtc = this.initWebrtc.bind(this);
        this.state = {
            currentUserId: UserStore.getCurrentId()
        };
    }

    initWebrtc() {
        if (this.props.status !== UserStatuses.OFFLINE && !WebrtcStore.isBusy()) {
            GlobalActions.emitCloseRightHandSide();
            WebrtcActions.initWebrtc(this.props.user.id, true);
        }
    }

    shouldComponentUpdate(nextProps) {
        if (!Utils.areObjectsEqual(nextProps.user, this.props.user)) {
            return true;
        }

        if (nextProps.overwriteName !== this.props.overwriteName) {
            return true;
        }

        if (nextProps.overwriteImage !== this.props.overwriteImage) {
            return true;
        }

        if (nextProps.disablePopover !== this.props.disablePopover) {
            return true;
        }

        if (nextProps.displayNameType !== this.props.displayNameType) {
            return true;
        }

        if (nextProps.status !== this.props.status) {
            return true;
        }

        if (nextProps.isBusy !== this.props.isBusy) {
            return true;
        }

        return false;
    }

    render() {
        let name = '...';
        let email = '';
        let profileImg = '';
        if (this.props.user) {
            name = Utils.displayUsername(this.props.user.id);
            email = this.props.user.email;
            profileImg = Client.getUsersRoute() + '/' + this.props.user.id + '/image?time=' + this.props.user.update_at;
        }

        if (this.props.overwriteName) {
            name = this.props.overwriteName;
        }

        if (this.props.overwriteImage) {
            profileImg = this.props.overwriteImage;
        }

        if (this.props.disablePopover) {
            return <div className='user-popover'>{name}</div>;
        }

        let webrtc;
        const userMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

        const webrtcEnabled = global.mm_config.EnableWebrtc === 'true' && global.mm_license.Webrtc === 'true' &&
            global.mm_config.EnableDeveloper === 'true' && userMedia && Utils.isFeatureEnabled(PreReleaseFeatures.WEBRTC_PREVIEW);

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
            }

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
                        <svg
                            id='webrtc-btn'
                            className='webrtc__button'
                            xmlns='http://www.w3.org/2000/svg'
                        >
                            <circle
                                className={circleClass}
                                cx='16'
                                cy='16'
                                r='18'
                            >
                                <title>
                                    {webrtcMessage}
                                </title>
                            </circle>
                            <path
                                className='off'
                                transform='scale(0.4), translate(17,16)'
                                d='M40 8H8c-2.21 0-4 1.79-4 4v24c0 2.21 1.79 4 4 4h32c2.21 0 4-1.79 4-4V12c0-2.21-1.79-4-4-4zm-4 24l-8-6.4V32H12V16h16v6.4l8-6.4v16z'
                                fill='white'
                            />
                        </svg>
                    </a>
                </div>
            );
        }

        var dataContent = [];
        dataContent.push(
            <img
                className='user-popover__image'
                src={profileImg}
                height='128'
                width='128'
                key='user-popover-image'
            />
        );

        const fullname = Utils.getFullName(this.props.user);
        if (fullname) {
            dataContent.push(
                <div
                    data-toggle='tooltip'
                    title={fullname}
                    key='user-popover-fullname'
                >

                    <p
                        className='text-nowrap'
                    >
                        {fullname}
                    </p>
                </div>
            );
        }

        dataContent.push(webrtc);

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

        return (
            <OverlayTrigger
                trigger='click'
                placement='right'
                rootClose={true}
                overlay={
                    <Popover
                        title={'@' + this.props.user.username}
                        id='user-profile-popover'
                    >
                        {dataContent}
                    </Popover>
                }
            >
                <div
                    className='user-popover'
                    id={'profile_' + this.uniqueId}
                >
                    {name}
                </div>
            </OverlayTrigger>
        );
    }
}

UserProfile.defaultProps = {
    user: {},
    overwriteName: '',
    overwriteImage: '',
    disablePopover: false
};
UserProfile.propTypes = {
    user: React.PropTypes.object,
    overwriteName: React.PropTypes.string,
    overwriteImage: React.PropTypes.string,
    disablePopover: React.PropTypes.bool,
    displayNameType: React.PropTypes.string,
    status: React.PropTypes.string,
    isBusy: React.PropTypes.bool
};
