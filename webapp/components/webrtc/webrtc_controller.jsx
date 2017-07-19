// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import UserStore from 'stores/user_store.jsx';
import ChannelStore from 'stores/channel_store.jsx';
import WebrtcStore from 'stores/webrtc_store.jsx';

import WebSocketClient from 'client/web_websocket_client.jsx';
import Janus from 'janus';

import SearchBox from '../search_bar.jsx';
import WebrtcHeader from './components/webrtc_header.jsx';
import ConnectingScreen from 'components/loading_screen.jsx';

import {trackEvent} from 'actions/diagnostics_actions.jsx';
import * as WebrtcActions from 'actions/webrtc_actions.jsx';

import * as Utils from 'utils/utils.jsx';
import {Constants, UserStatuses, WebrtcActionTypes} from 'utils/constants.jsx';

import PropTypes from 'prop-types';

import React from 'react';
import {FormattedMessage} from 'react-intl';

import ring from 'images/ring.mp3';

const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 360;
const MIN_ASPECT = 1.777;
const MAX_ASPECT = 1.778;
const ALREADY_REGISTERED_ERROR = 477;
const USERNAME_TAKEN = 476;

export default class WebrtcController extends React.Component {
    constructor(props) {
        super(props);

        this.mounted = false;
        this.localMedia = null;
        this.session = null;
        this.videocall = null;

        this.handleResize = this.handleResize.bind(this);
        this.handleClose = this.handleClose.bind(this);
        this.close = this.close.bind(this);
        this.clearError = this.clearError.bind(this);

        this.getLocalMedia = this.getLocalMedia.bind(this);
        this.stopMediaStream = this.stopMediaStream.bind(this);
        this.previewVideo = this.previewVideo.bind(this);
        this.stopRinging = this.stopRinging.bind(this);

        this.handleMakeOffer = this.handleMakeOffer.bind(this);
        this.handleCancelOffer = this.handleCancelOffer.bind(this);
        this.handleWebrtcEvent = this.handleWebrtcEvent.bind(this);
        this.handleVideoCallEvent = this.handleVideoCallEvent.bind(this);
        this.handleRemoteStream = this.handleRemoteStream.bind(this);

        this.onStatusChange = this.onStatusChange.bind(this);
        this.onCallDeclined = this.onCallDeclined.bind(this);
        this.onUnsupported = this.onUnsupported.bind(this);
        this.onNoAnswer = this.onNoAnswer.bind(this);
        this.onBusy = this.onBusy.bind(this);
        this.onDisabled = this.onDisabled.bind(this);
        this.onFailed = this.onFailed.bind(this);
        this.onCancelled = this.onCancelled.bind(this);
        this.onConnectCall = this.onConnectCall.bind(this);

        this.onSessionCreated = this.onSessionCreated.bind(this);
        this.onSessionError = this.onSessionError.bind(this);

        this.doCall = this.doCall.bind(this);
        this.doAnswer = this.doAnswer.bind(this);
        this.doHangup = this.doHangup.bind(this);
        this.doCleanup = this.doCleanup.bind(this);

        this.renderButtons = this.renderButtons.bind(this);
        this.onToggleVideo = this.onToggleVideo.bind(this);
        this.onToggleAudio = this.onToggleAudio.bind(this);
        this.onToggleRemoteMute = this.onToggleRemoteMute.bind(this);
        this.toggleIcons = this.toggleIcons.bind(this);

        const currentUser = UserStore.getCurrentUser();
        const remoteUser = UserStore.getProfile(props.userId);
        const remoteUserImage = Utils.imageURLForUser(remoteUser);

        this.state = {
            windowWidth: Utils.windowWidth(),
            windowHeight: Utils.windowHeight(),
            channelId: ChannelStore.getCurrentId(),
            currentUser,
            currentUserImage: Utils.imageURLForUser(currentUser),
            remoteUserImage,
            localMediaLoaded: false,
            isPaused: false,
            isMuted: false,
            isRemotePaused: false,
            isRemoteMuted: false,
            isCalling: false,
            isAnswering: false,
            callInProgress: false,
            error: null,
            errorType: '',
            ended: null
        };
    }

    componentDidMount() {
        window.addEventListener('resize', this.handleResize);
        WebrtcStore.addChangedListener(this.handleWebrtcEvent);
        UserStore.addStatusesChangeListener(this.onStatusChange);

        this.mounted = true;
        this.previewVideo();

        if (this.props.isCaller) {
            this.handleMakeOffer();
        }
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.handleResize);
        WebrtcStore.removeChangedListener(this.handleWebrtcEvent);
        UserStore.removeStatusesChangeListener(this.onStatusChange);
        this.mounted = false;
        this.close();
    }

    componentWillReceiveProps(nextProps) {
        if ((nextProps.currentUser !== this.props.currentUser) ||
            (nextProps.userId !== this.props.userId) ||
            (nextProps.isCaller !== this.props.isCaller)) {
            const remoteUser = UserStore.getProfile(nextProps.userId);
            const remoteUserImage = Utils.imageURLForUser(remoteUser);
            this.setState({
                error: null,
                remoteUserImage
            });
        }

        if (nextProps.isCaller && nextProps.expanded === this.props.expanded) {
            this.startCall = true;
        }
    }

    componentDidUpdate() {
        if (this.props.isCaller && this.startCall) {
            this.startCall = false;
            this.handleMakeOffer();
        }
    }

    handleResize() {
        this.setState({
            windowWidth: Utils.windowWidth(),
            windowHeight: Utils.windowHeight()
        });
    }

    clearError() {
        setTimeout(() => {
            this.setState({error: null, ended: null, errorType: ''});
        }, Constants.WEBRTC_CLEAR_ERROR_DELAY);
    }

    getLocalMedia(constraints, element, callback) {
        const media = constraints || {audio: true, video: true};
        navigator.mediaDevices.getUserMedia(media).
        then((stream) => {
            if (element) {
                element.srcObject = stream;
            }

            if (callback && typeof callback === 'function') {
                callback(null, stream);
            }
        }).
        catch((error) => {
            callback(error);
        });
    }

    stopMediaStream(stream) {
        const tracks = stream.getTracks();
        tracks.forEach((track) => {
            track.stop();
        });
    }

    previewVideo() {
        if (this.mounted) {
            if (this.localMedia) {
                this.setState({
                    localMediaLoaded: true,
                    error: null
                });
                this.localMedia.enabled = true;
            } else {
                this.getLocalMedia(
                    {
                        audio: true,
                        video: {
                            minAspectRatio: MIN_ASPECT,
                            maxAspectRatio: MAX_ASPECT,
                            width: VIDEO_WIDTH,
                            height: VIDEO_HEIGHT
                        }
                    },
                    this.refs['local-video'],
                    (error, stream) => {
                        if (error) {
                            this.setState({
                                error: (
                                    <FormattedMessage
                                        id='webrtc.mediaError'
                                        defaultMessage='Unable to access Camera and Microphone'
                                    />
                                )
                            });
                            return;
                        }
                        this.localMedia = stream;
                        this.setState({
                            localMediaLoaded: true
                        });
                    });
            }
        }
    }

    stopRinging() {
        if (this.refs.ring) {
            this.refs.ring.pause();
            this.refs.ring.currentTime = 0;
        }
    }

    handleMakeOffer() {
        if (UserStore.getStatus(this.props.userId) === UserStatuses.OFFLINE) {
            this.onStatusChange();
        } else {
            const connectingMsg = (
                <FormattedMessage
                    id='calling_screen'
                    defaultMessage='Calling'
                />
            );

            this.setState({
                isCalling: true,
                isAnswering: false,
                callInProgress: false,
                error: null,
                ended: null,
                connectingMsg
            });

            WebrtcStore.setVideoCallWith(this.props.userId);

            const user = this.state.currentUser;
            WebSocketClient.sendMessage('webrtc', {
                action: WebrtcActionTypes.NOTIFY,
                from_user_id: user.id,
                to_user_id: this.props.userId
            });
        }
    }

    handleCancelOffer() {
        this.setState({
            isCalling: false,
            isAnswering: false,
            callInProgress: false,
            error: null,
            ended: null
        });

        const user = this.state.currentUser;
        WebSocketClient.sendMessage('webrtc', {
            action: WebrtcActionTypes.CANCEL,
            from_user_id: user.id,
            to_user_id: this.props.userId
        });

        this.doCleanup();
    }

    handleWebrtcEvent(message) {
        switch (message.action) {
        case WebrtcActionTypes.DECLINE:
            this.onCallDeclined();
            this.clearError();
            break;
        case WebrtcActionTypes.UNSUPPORTED:
            this.onUnsupported();
            this.clearError();
            break;
        case WebrtcActionTypes.BUSY:
            this.onBusy();
            this.clearError();
            break;
        case WebrtcActionTypes.NO_ANSWER:
            this.onNoAnswer();
            this.clearError();
            break;
        case WebrtcActionTypes.FAILED:
            this.onFailed();
            this.clearError();
            break;
        case WebrtcActionTypes.ANSWER:
            this.onConnectCall();
            break;
        case WebrtcActionTypes.CANCEL:
            this.onCancelled();
            this.clearError();
            break;
        case WebrtcActionTypes.MUTED:
            this.onToggleRemoteMute(message);
            break;
        case WebrtcActionTypes.IN_PROGRESS:
            this.setState({
                error: (
                    <FormattedMessage
                        id='webrtc.inProgress'
                        defaultMessage='You have a call in progress. Please hang up first.'
                    />
                ),
                errorType: ' warning'
            });
            this.clearError();
            break;
        case WebrtcActionTypes.DISABLED:
            this.onDisabled();
            this.clearError();
            break;
        }
    }

    handleVideoCallEvent(msg, jsep) {
        const result = msg.result;

        if (result) {
            const event = result.event;
            switch (event) {
            case 'registered':
                if (this.state.isCalling) {
                    this.doCall();
                }
                break;
            case 'incomingcall':
                this.doAnswer(jsep);
                break;
            case 'accepted':
                this.stopRinging();

                if (jsep) {
                    this.videocall.handleRemoteJsep({jsep});
                }
                break;
            case 'hangup':
                this.doHangup(false);
                break;
            }
        } else {
            const errorCode = msg.error_code;
            if (errorCode !== ALREADY_REGISTERED_ERROR && errorCode !== USERNAME_TAKEN) {
                this.doHangup(true);
            } else if (this.state.isCalling) {
                this.doCall();
            }
        }
    }

    handleRemoteStream(stream) {
        // attaching stream to where they belong
        this.refs['main-video'].srcObject = stream;

        let isRemotePaused = false;
        let isRemoteMuted = false;
        const videoTracks = stream.getVideoTracks();
        const audioTracks = stream.getAudioTracks();
        if (!videoTracks || videoTracks.length === 0 || videoTracks[0].muted || !videoTracks[0].enabled) {
            isRemotePaused = true;
        }

        if (!audioTracks || audioTracks.length === 0 || audioTracks[0].muted || !audioTracks[0].enabled) {
            isRemoteMuted = true;
        }

        this.setState({
            isCalling: false,
            isAnswering: false,
            callInProgress: true,
            isMuted: false,
            isPaused: false,
            error: null,
            ended: null,
            isRemotePaused,
            isRemoteMuted
        });
        this.toggleIcons();
    }

    handleClose(e) {
        e.preventDefault();
        if (this.state.callInProgress) {
            this.setState({
                error: (
                    <FormattedMessage
                        id='webrtc.inProgress'
                        defaultMessage='You have a call in progress. Please hang up first.'
                    />
                ),
                errorType: ' warning'
            });
        } else if (this.state.isCalling) {
            this.handleCancelOffer();
            this.close();
        } else {
            this.close();
        }
    }

    close() {
        this.doCleanup();

        if (this.session) {
            this.session.destroy();
            this.session = null;
        }

        if (this.localMedia) {
            this.stopMediaStream(this.localMedia);
            this.localMedia = null;
        }

        WebrtcActions.initWebrtc(null, false);
    }

    onStatusChange() {
        const status = UserStore.getStatus(this.props.userId);

        if (status === UserStatuses.OFFLINE) {
            const error = (
                <FormattedMessage
                    id='webrtc.offline'
                    defaultMessage='{username} is offline'
                    values={{
                        username: Utils.displayUsername(this.props.userId)
                    }}
                />
            );

            if (this.state.isCalling || this.state.isAnswering) {
                this.setState({
                    isCalling: false,
                    isAnswering: false,
                    callInProgress: false,
                    error
                });
            } else {
                this.setState({
                    error
                });
            }
        } else if (status !== UserStatuses.OFFLINE && this.state.error) {
            this.setState({
                error: null,
                ended: null
            });
        }
    }

    onCallDeclined() {
        let error = null;

        if (this.state.isCalling) {
            error = (
                <FormattedMessage
                    id='webrtc.declined'
                    defaultMessage='Your call has been declined by {username}'
                    values={{
                        username: Utils.displayUsername(this.props.userId)
                    }}
                />
            );
        }

        this.stopRinging();

        this.setState({
            isCalling: false,
            isAnswering: false,
            callInProgress: false,
            error
        });

        this.doCleanup();
    }

    onUnsupported() {
        if (this.mounted) {
            this.stopRinging();

            this.setState({
                error: (
                    <FormattedMessage
                        id='webrtc.unsupported'
                        defaultMessage='Call to {username} not successful. Their client does not support video calls.'
                        values={{
                            username: Utils.displayUsername(this.props.userId)
                        }}
                    />
                ),
                callInProgress: false,
                isCalling: false,
                isAnswering: false
            });
        }

        this.doCleanup();
    }

    onNoAnswer() {
        let error = null;

        if (this.state.isCalling) {
            error = (
                <FormattedMessage
                    id='webrtc.noAnswer'
                    defaultMessage='{username} is not answering the call'
                    values={{
                        username: Utils.displayUsername(this.props.userId)
                    }}
                />
            );
        }
        this.stopRinging();

        this.setState({
            isCalling: false,
            isAnswering: false,
            callInProgress: false,
            error
        });

        this.doCleanup();
    }

    onBusy() {
        let error = null;

        if (this.state.isCalling) {
            error = (
                <FormattedMessage
                    id='webrtc.busy'
                    defaultMessage='{username} is busy'
                    values={{
                        username: Utils.displayUsername(this.props.userId)
                    }}
                />
            );
        }
        this.stopRinging();

        this.setState({
            isCalling: false,
            isAnswering: false,
            callInProgress: false,
            error
        });

        this.doCleanup();
    }

    onDisabled() {
        let error = null;

        if (this.state.isCalling) {
            error = (
                <FormattedMessage
                    id='webrtc.disabled'
                    defaultMessage='{username} has WebRTC disabled, and cannot receive calls. To enable the feature, they must go to Account Settings > Advanced > Preview pre-release features and turn on WebRTC.'
                    values={{
                        username: Utils.displayUsername(this.props.userId)
                    }}
                />
            );
        }

        this.stopRinging();

        this.setState({
            isCalling: false,
            isAnswering: false,
            callInProgress: false,
            error
        });

        this.doCleanup();
    }

    onFailed() {
        trackEvent('api', 'api_users_webrtc_failed');

        this.setState({
            isCalling: false,
            isAnswering: false,
            callInProgress: false,
            isPaused: false,
            isMuted: false,
            isRemotePaused: false,
            isRemoteMuted: false,
            error: (
                <FormattedMessage
                    id='webrtc.failed'
                    defaultMessage='There was a problem connecting the video call'
                />
            )
        });

        this.stopRinging();

        this.doCleanup();
    }

    onCancelled() {
        if (this.mounted && this.state.isAnswering) {
            this.stopRinging();
            this.setState({
                isCalling: false,
                isAnswering: false,
                callInProgress: false,
                error: (
                    <FormattedMessage
                        id='webrtc.cancelled'
                        defaultMessage='{username} cancelled the call'
                        values={{
                            username: Utils.displayUsername(this.props.userId)
                        }}
                    />
                )
            });
        }

        this.doCleanup();
    }

    onConnectCall() {
        WebrtcActions.webrtcToken(
            (info) => {
                const connectingMsg = (
                    <FormattedMessage
                        id='connecting_screen'
                        defaultMessage='Connecting'
                    />
                );

                this.setState({isAnswering: !this.state.isCalling, connectingMsg});
                if (this.session) {
                    this.onSessionCreated();
                } else {
                    const iceServers = [];

                    if (info.stun_uri) {
                        iceServers.push({
                            urls: [info.stun_uri]
                        });
                    }

                    if (info.turn_uri) {
                        iceServers.push({
                            urls: [info.turn_uri],
                            username: info.turn_username,
                            credential: info.turn_password
                        });
                    }

                    Janus.init({debug: global.mm_config.EnableDeveloper === 'true'});
                    this.session = new Janus({
                        server: info.gateway_url,
                        iceServers,
                        token: info.token,
                        success: this.onSessionCreated,
                        error: this.onSessionError
                    });
                }
            },
            () => {
                this.onSessionError();
            });
    }

    onSessionCreated() {
        if (this.videocall) {
            this.doCall();
        } else {
            this.session.attach({
                plugin: 'janus.plugin.videocall',
                success: (plugin) => {
                    this.videocall = plugin;
                    this.videocall.send({message: {request: 'register', username: this.state.currentUser.id}});
                },
                error: this.onSessionError,
                onmessage: this.handleVideoCallEvent,
                onremotestream: this.handleRemoteStream
            });
        }
    }

    onSessionError() {
        const user = this.state.currentUser;
        WebSocketClient.sendMessage('webrtc', {
            action: WebrtcActionTypes.FAILED,
            from_user_id: user.id,
            to_user_id: this.props.userId
        });

        this.onFailed();
    }

    doCall() {
        // delay call so receiver has time to register
        setTimeout(() => {
            this.videocall.createOffer({
                stream: this.localMedia,
                success: (jsep) => {
                    const body = {request: 'call', username: this.props.userId};
                    this.videocall.send({message: body, jsep});
                },
                error: () => {
                    this.doHangup(true);
                }
            });
        }, Constants.WEBRTC_TIME_DELAY);
    }

    doAnswer(jsep) {
        trackEvent('api', 'api_users_webrtc_start');
        this.videocall.createAnswer({
            jsep,
            stream: this.localMedia,
            success: (jsepSuccess) => {
                const body = {request: 'accept'};
                this.videocall.send({message: body, jsep: jsepSuccess});
            },
            error: () => {
                this.doHangup(true);
            }
        });
    }

    doHangup(error, manual) {
        trackEvent('api', 'api_users_webrtc_end');
        if (this.videocall && this.state.callInProgress) {
            this.videocall.send({message: {request: 'hangup'}});
            this.videocall.hangup();
            this.toggleIcons();

            if (this.localMedia) {
                this.localMedia.getVideoTracks()[0].enabled = true;
                this.localMedia.getAudioTracks()[0].enabled = true;
            }
        }

        if (error) {
            this.onSessionError();
            return this.doCleanup();
        }

        WebrtcStore.setVideoCallWith(null);
        WebrtcStore.emitRhsChanged(false);

        if (manual) {
            return this.close();
        }

        this.setState({
            isCalling: false,
            isAnswering: false,
            callInProgress: false,
            isPaused: false,
            isMuted: false,
            isRemotePaused: false,
            isRemoteMuted: false,
            error: null,
            ended: (
                <FormattedMessage
                    id='webrtc.callEnded'
                    defaultMessage='Call with {username} ended.'
                    values={{
                        username: Utils.displayUsername(this.props.userId)
                    }}
                />
            )
        });
        this.clearError();
        return this.doCleanup();
    }

    doCleanup() {
        WebrtcStore.setVideoCallWith(null);

        if (this.videocall) {
            this.videocall.detach();
            this.videocall = null;
        }
    }

    onToggleVideo() {
        const shouldPause = !this.state.isPaused;
        if (shouldPause) {
            this.videocall.unmuteVideo();
        } else {
            this.videocall.muteVideo();
        }

        const user = this.state.currentUser;
        WebSocketClient.sendMessage('webrtc', {
            action: WebrtcActionTypes.MUTED,
            from_user_id: user.id,
            to_user_id: this.props.userId,
            type: 'video',
            mute: shouldPause
        });

        this.setState({
            isPaused: shouldPause,
            error: null,
            ended: null
        });
    }

    onToggleAudio() {
        const shouldMute = !this.state.isMuted;
        if (shouldMute) {
            this.videocall.unmuteAudio();
        } else {
            this.videocall.muteAudio();
        }

        const user = this.state.currentUser;
        WebSocketClient.sendMessage('webrtc', {
            action: WebrtcActionTypes.MUTED,
            from_user_id: user.id,
            to_user_id: this.props.userId,
            type: 'audio',
            mute: shouldMute
        });

        this.setState({
            isMuted: shouldMute,
            error: null,
            ended: null
        });
    }

    onToggleRemoteMute(message) {
        if (message.type === 'video') {
            this.setState({
                isRemotePaused: message.mute
            });
        } else {
            this.setState({isRemoteMuted: message.mute, error: null, ended: null});
        }
    }

    toggleIcons() {
        const icons = this.refs.icons;
        if (icons) {
            icons.classList.toggle('hidden');
            icons.classList.toggle('active');
        }
    }

    renderButtons() {
        let buttons;
        if (this.state.isCalling) {
            buttons = (
                <svg
                    id='cancel'
                    className='webrtc-icons__cancel'
                    xmlns='http://www.w3.org/2000/svg'
                    width='48'
                    height='48'
                    viewBox='-10 -10 68 68'
                    onClick={() => this.handleCancelOffer()}
                >
                    <circle
                        cx='24'
                        cy='24'
                        r='34'
                    >
                        <title>
                            <FormattedMessage
                                id='webrtc.cancel'
                                defaultMessage='Cancel Call'
                            />
                        </title>
                    </circle>
                    <path
                        transform='scale(0.8), translate(6,10)'
                        d='M24 18c-3.21 0-6.3.5-9.2 1.44v6.21c0 .79-.46 1.47-1.12 1.8-1.95.98-3.74 2.23-5.33 3.7-.36.35-.85.57-1.4.57-.55 0-1.05-.22-1.41-.59L.59 26.18c-.37-.37-.59-.87-.59-1.42 0-.55.22-1.05.59-1.42C6.68 17.55 14.93 14 24 14s17.32 3.55 23.41 9.34c.37.36.59.87.59 1.42 0 .55-.22 1.05-.59 1.41l-4.95 4.95c-.36.36-.86.59-1.41.59-.54 0-1.04-.22-1.4-.57-1.59-1.47-3.38-2.72-5.33-3.7-.66-.33-1.12-1.01-1.12-1.8v-6.21C30.3 18.5 27.21 18 24 18z'
                        fill='white'
                    />
                </svg>
            );
        } else if (!this.state.callInProgress && this.state.localMediaLoaded) {
            buttons = (
                <svg
                    id='call'
                    className='webrtc-icons__call'
                    xmlns='http://www.w3.org/2000/svg'
                    width='48'
                    height='48'
                    viewBox='-10 -10 68 68'
                    onClick={() => this.handleMakeOffer()}
                    disabled={UserStore.getStatus(this.props.userId) === 'offline'}
                >
                    <circle
                        cx='24'
                        cy='24'
                        r='34'
                    >
                        <title>
                            <FormattedMessage
                                id='webrtc.call'
                                defaultMessage='Call'
                            />
                        </title>
                    </circle>
                    <path
                        transform='translate(-10,-10)'
                        fill='#fff'
                        d='M29.854,37.627c1.723,1.904 3.679,3.468 5.793,4.684l3.683,-3.334c0.469,-0.424 1.119,-0.517 1.669,-0.302c1.628,0.63 3.331,1.021 5.056,1.174c0.401,0.026 0.795,0.199 1.09,0.525c0.295,0.326 0.433,0.741 0.407,1.153l-0.279,5.593c-0.02,0.418 -0.199,0.817 -0.525,1.112c-0.326,0.296 -0.741,0.434 -1.159,0.413c-6.704,-0.504 -13.238,-3.491 -18.108,-8.87c-4.869,-5.38 -7.192,-12.179 -7.028,-18.899c0.015,-0.413 0.199,-0.817 0.526,-1.113c0.326,-0.295 0.74,-0.433 1.153,-0.407l5.593,0.279c0.407,0.02 0.812,0.193 1.107,0.519c0.29,0.32 0.428,0.735 0.413,1.137c-0.018,1.732 0.202,3.464 0.667,5.147c0.159,0.569 0.003,1.207 -0.466,1.631l-3.683,3.334c1.005,2.219 2.368,4.32 4.091,6.224Z'
                    />
                </svg>
            );
        } else if (this.state.callInProgress) {
            const onClass = 'on';
            const offClass = 'off';
            let audioOnClass = offClass;
            let audioOffClass = onClass;
            let videoOnClass = offClass;
            let videoOffClass = onClass;

            let audioTitle = (
                <FormattedMessage
                    id='webrtc.mute_audio'
                    defaultMessage='Mute'
                />
            );

            let videoTitle = (
                <FormattedMessage
                    id='webrtc.pause_video'
                    defaultMessage='Turn off Video'
                />
            );

            if (this.state.isMuted) {
                audioOnClass = onClass;
                audioOffClass = offClass;
                audioTitle = (
                    <FormattedMessage
                        id='webrtc.unmute_audio'
                        defaultMessage='Unmute'
                    />
                );
            }

            if (this.state.isPaused) {
                videoOnClass = onClass;
                videoOffClass = offClass;
                videoTitle = (
                    <FormattedMessage
                        id='webrtc.unpause_video'
                        defaultMessage='Turn on Video'
                    />
                );
            }

            buttons = (
                <div
                    ref='icons'
                    className='webrtc-icons hidden'
                >

                    <svg
                        id='mute-audio'
                        className='webrtc-icons__call'
                        xmlns='http://www.w3.org/2000/svg'
                        width='48'
                        height='48'
                        viewBox='-10 -10 68 68'
                        onClick={() => this.onToggleAudio()}
                    >
                        <circle
                            cx='24'
                            cy='24'
                            r='34'
                        >
                            <title>{audioTitle}</title>
                        </circle>
                        <path
                            className={audioOnClass}
                            transform='scale(0.6), translate(17,18)'
                            d='M38 22h-3.4c0 1.49-.31 2.87-.87 4.1l2.46 2.46C37.33 26.61 38 24.38 38 22zm-8.03.33c0-.11.03-.22.03-.33V10c0-3.32-2.69-6-6-6s-6 2.68-6 6v.37l11.97 11.96zM8.55 6L6 8.55l12.02 12.02v1.44c0 3.31 2.67 6 5.98 6 .45 0 .88-.06 1.3-.15l3.32 3.32c-1.43.66-3 1.03-4.62 1.03-5.52 0-10.6-4.2-10.6-10.2H10c0 6.83 5.44 12.47 12 13.44V42h4v-6.56c1.81-.27 3.53-.9 5.08-1.81L39.45 42 42 39.46 8.55 6z'
                            fill='white'
                        />
                        <path
                            className={audioOffClass}
                            transform='scale(0.6), translate(17,18)'
                            d='M24 28c3.31 0 5.98-2.69 5.98-6L30 10c0-3.32-2.68-6-6-6-3.31 0-6 2.68-6 6v12c0 3.31 2.69 6 6 6zm10.6-6c0 6-5.07 10.2-10.6 10.2-5.52 0-10.6-4.2-10.6-10.2H10c0 6.83 5.44 12.47 12 13.44V42h4v-6.56c6.56-.97 12-6.61 12-13.44h-3.4z'
                            fill='white'
                        />
                    </svg>

                    <svg
                        id='mute-video'
                        className='webrtc-icons__call'
                        xmlns='http://www.w3.org/2000/svg'
                        width='48'
                        height='48'
                        viewBox='-10 -10 68 68'
                        onClick={() => this.onToggleVideo()}
                    >
                        <circle
                            cx='24'
                            cy='24'
                            r='34'
                        >
                            <title>{videoTitle}</title>
                        </circle>
                        <path
                            className={videoOnClass}
                            transform='scale(0.6), translate(17,16)'
                            d='M40 8H15.64l8 8H28v4.36l1.13 1.13L36 16v12.36l7.97 7.97L44 36V12c0-2.21-1.79-4-4-4zM4.55 2L2 4.55l4.01 4.01C4.81 9.24 4 10.52 4 12v24c0 2.21 1.79 4 4 4h29.45l4 4L44 41.46 4.55 2zM12 16h1.45L28 30.55V32H12V16z'
                            fill='white'
                        />
                        <path
                            className={videoOffClass}
                            transform='scale(0.6), translate(17,16)'
                            d='M40 8H8c-2.21 0-4 1.79-4 4v24c0 2.21 1.79 4 4 4h32c2.21 0 4-1.79 4-4V12c0-2.21-1.79-4-4-4zm-4 24l-8-6.4V32H12V16h16v6.4l8-6.4v16z'
                            fill='white'
                        />
                    </svg>

                    <svg
                        id='hangup'
                        className='webrtc-icons__cancel'
                        xmlns='http://www.w3.org/2000/svg'
                        width='48'
                        height='48'
                        viewBox='-10 -10 68 68'
                        onClick={() => this.doHangup(false, true)}
                    >
                        <circle
                            cx='24'
                            cy='24'
                            r='34'
                        >
                            <title>
                                <FormattedMessage
                                    id='webrtc.hangup'
                                    defaultMessage='Hang up'
                                />
                            </title>
                        </circle>
                        <path
                            transform='scale(0.7), translate(11,10)'
                            d='M24 18c-3.21 0-6.3.5-9.2 1.44v6.21c0 .79-.46 1.47-1.12 1.8-1.95.98-3.74 2.23-5.33 3.7-.36.35-.85.57-1.4.57-.55 0-1.05-.22-1.41-.59L.59 26.18c-.37-.37-.59-.87-.59-1.42 0-.55.22-1.05.59-1.42C6.68 17.55 14.93 14 24 14s17.32 3.55 23.41 9.34c.37.36.59.87.59 1.42 0 .55-.22 1.05-.59 1.41l-4.95 4.95c-.36.36-.86.59-1.41.59-.54 0-1.04-.22-1.4-.57-1.59-1.47-3.38-2.72-5.33-3.7-.66-.33-1.12-1.01-1.12-1.8v-6.21C30.3 18.5 27.21 18 24 18z'
                            fill='white'
                        />
                    </svg>

                </div>
            );
        }

        return buttons;
    }

    render() {
        const currentId = UserStore.getCurrentId();
        const remoteImage = (<img src={this.state.remoteUserImage}/>);
        let localImage;
        let localVideoHidden = '';
        let remoteVideoHidden = 'hidden';
        let error;
        let remoteMute;
        let localImageHidden = 'webrtc__local-image hidden';
        let remoteImageHidden = 'webrtc__remote-image';

        if (this.state.error) {
            error = (
                <div className='webrtc__error'>
                    <div className='form-group has-error'>
                        <label className={'control-label' + this.state.errorType}>{this.state.error}</label>
                    </div>
                </div>
            );
        } else if (this.state.ended) {
            error = (
                <div className='webrtc__error'>
                    <div className='form-group'>
                        <label className='control-label'>{this.state.ended}</label>
                    </div>
                </div>
            );
        }

        if (this.state.isRemoteMuted) {
            remoteMute = (
                <div className='webrtc__remote-mute'>
                    <svg
                        xmlns='http://www.w3.org/2000/svg'
                        width='60'
                        height='60'
                        viewBox='-10 -10 68 68'
                    >
                        <path
                            className='off'
                            transform='scale(0.6), translate(17,18)'
                            d='M38 22h-3.4c0 1.49-.31 2.87-.87 4.1l2.46 2.46C37.33 26.61 38 24.38 38 22zm-8.03.33c0-.11.03-.22.03-.33V10c0-3.32-2.69-6-6-6s-6 2.68-6 6v.37l11.97 11.96zM8.55 6L6 8.55l12.02 12.02v1.44c0 3.31 2.67 6 5.98 6 .45 0 .88-.06 1.3-.15l3.32 3.32c-1.43.66-3 1.03-4.62 1.03-5.52 0-10.6-4.2-10.6-10.2H10c0 6.83 5.44 12.47 12 13.44V42h4v-6.56c1.81-.27 3.53-.9 5.08-1.81L39.45 42 42 39.46 8.55 6z'
                            fill='white'
                        />
                        <path
                            className='on'
                            transform='scale(0.6), translate(17,18)'
                            d='M24 28c3.31 0 5.98-2.69 5.98-6L30 10c0-3.32-2.68-6-6-6-3.31 0-6 2.68-6 6v12c0 3.31 2.69 6 6 6zm10.6-6c0 6-5.07 10.2-10.6 10.2-5.52 0-10.6-4.2-10.6-10.2H10c0 6.83 5.44 12.47 12 13.44V42h4v-6.56c6.56-.97 12-6.61 12-13.44h-3.4z'
                            fill='white'
                        />
                    </svg>
                </div>
            );
        }

        let searchForm;
        if (currentId != null) {
            searchForm = <SearchBox/>;
        }

        const buttons = this.renderButtons();
        const calling = this.state.isCalling;
        let connecting;
        let audio;
        if (calling || this.state.isAnswering) {
            if (calling) {
                audio = (
                    <audio
                        ref='ring'
                        src={ring}
                        autoPlay={true}
                    />
                );
            }

            connecting = (
                <div className='connecting'>
                    <ConnectingScreen
                        position='absolute'
                        message={this.state.connectingMsg}
                    />
                    {audio}
                </div>
            );
        }

        if (this.state.callInProgress) {
            if (this.state.isPaused) {
                localVideoHidden = 'hidden';
                localImageHidden = 'webrtc__local-image';
                localImage = (<img src={this.state.currentUserImage}/>);
            }

            if (this.state.isRemotePaused) {
                remoteVideoHidden = 'hidden';
                remoteImageHidden = 'webrtc__remote-image';
            } else {
                remoteVideoHidden = '';
                remoteImageHidden = 'webrtc__remote-image hidden';
            }
        }

        return (
            <div className='post-right__container'>
                <div className='search-bar__container sidebar--right__search-header'>{searchForm}</div>
                <div className='sidebar-right__body'>
                    <WebrtcHeader
                        username={Utils.displayUsername(this.props.userId)}
                        onClose={this.handleClose}
                        toggleSize={this.props.toggleSize}
                    />
                    <div className='post-right__scroll'>
                        <div id='videos'>
                            {remoteMute}
                            <div
                                id='main-video'
                                className={remoteVideoHidden}
                                autoPlay={true}
                            >
                                <video
                                    ref='main-video'
                                    autoPlay={true}
                                />
                            </div>
                            <div
                                id='local-video'
                                className={localVideoHidden}
                            >
                                <video
                                    ref='local-video'
                                    autoPlay={true}
                                    muted={true}
                                />
                            </div>
                            <div className={remoteImageHidden}>
                                {remoteImage}
                            </div>
                            <div className={localImageHidden}>
                                {localImage}
                            </div>
                        </div>
                        {error}
                        {connecting}
                        <div className='webrtc-buttons'>
                            {buttons}
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

WebrtcController.propTypes = {
    currentUser: PropTypes.object,
    userId: PropTypes.string.isRequired,
    isCaller: PropTypes.bool.isRequired,
    expanded: PropTypes.bool.isRequired,
    toggleSize: PropTypes.func
};
