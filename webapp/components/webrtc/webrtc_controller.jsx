/**
 * Created by enahum on 3/24/16.
 */

import UserStore from 'stores/user_store.jsx';
import ChannelStore from 'stores/channel_store.jsx';
import WebrtcStore from 'stores/webrtc_store.jsx';

import Client from 'utils/web_client.jsx';

import * as Utils from 'utils/utils.jsx';
import * as Websockets from 'actions/websocket_actions.jsx';

import SearchBox from '../search_bar.jsx';
import WebrtcHeader from './components/webrtc_header.jsx';
import ConnectingScreen from './components/connecting_screen.jsx';

import AppDispatcher from 'dispatcher/app_dispatcher.jsx';
import Constants from 'utils/constants.jsx';

import {AccessManager} from 'twilio-common';
import Conversations from 'twilio-conversations';

import React from 'react';
import {FormattedMessage} from 'react-intl';

const ActionTypes = Constants.ActionTypes;

export default class WebrtcController extends React.Component {
    constructor(props) {
        super(props);

        this.mounted = false;
        this.localMedia = null;
        this.accessManager = null;
        this.conversationsClient = null;
        this.conversation = null;
        this.outgoingInvitation = null;

        this.handleResize = this.handleResize.bind(this);
        this.handleClose = this.handleClose.bind(this);
        this.handlePlaceCall = this.handlePlaceCall.bind(this);
        this.handleCancelCall = this.handleCancelCall.bind(this);
        this.handleFailedCall = this.handleFailedCall.bind(this);

        this.onStatusChange = this.onStatusChange.bind(this);
        this.onCallDeclined = this.onCallDeclined.bind(this);
        this.onConnectCall = this.onConnectCall.bind(this);
        this.onCancelCall = this.onCancelCall.bind(this);
        this.onToggleAudio = this.onToggleAudio.bind(this);
        this.onToggleVideo = this.onToggleVideo.bind(this);
        this.onToggleRemoteAudio = this.onToggleRemoteAudio.bind(this);
        this.onToggleRemoteVideo = this.onToggleRemoteVideo.bind(this);
        this.onNotSupported = this.onNotSupported.bind(this);
        this.onFailed = this.onFailed.bind(this);

        this.onInvite = this.onInvite.bind(this);
        this.onParticipantConnected = this.onParticipantConnected.bind(this);
        this.onParticipantDisconnected = this.onParticipantDisconnected.bind(this);
        this.onParticipantFailed = this.onParticipantFailed.bind(this);
        this.onDisconnect = this.onDisconnect.bind(this);

        this.previewVideo = this.previewVideo.bind(this);
        this.connected = this.connected.bind(this);
        this.conversationStarted = this.conversationStarted.bind(this);
        this.localMediaToMain = this.localMediaToMain.bind(this);
        this.mainMediaToLocal = this.mainMediaToLocal.bind(this);
        this.unregister = this.unregister.bind(this);
        this.close = this.close.bind(this);

        this.renderButtons = this.renderButtons.bind(this);

        const currentUser = UserStore.getCurrentUser();

        this.state = {
            windowWidth: Utils.windowWidth(),
            windowHeight: Utils.windowHeight(),
            channelId: ChannelStore.getCurrentId(),
            currentUser,
            currentUserImage: Client.getUsersRoute() + '/' + currentUser.id + '/image?time=' + currentUser.update_at,
            remoteUserImage: null,
            localMediaLoaded: false,
            isPaused: false,
            isMuted: false,
            isRemotePaused: false,
            isRemoteMuted: false,
            isCalling: false,
            callInProgress: false,
            error: null
        };
    }

    componentDidMount() {
        window.addEventListener('resize', this.handleResize);

        WebrtcStore.addRejectedCallListener(this.onCallDeclined);
        WebrtcStore.addCancelCallListener(this.onCancelCall);
        WebrtcStore.addConnectCallListener(this.onConnectCall);
        WebrtcStore.addNotSupportedCallListener(this.onNotSupported);
        WebrtcStore.addFailedCallListener(this.onFailed);

        UserStore.addStatusesChangeListener(this.onStatusChange);

        this.mounted = true;
        this.previewVideo();
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.handleResize);

        WebrtcStore.removeRejectedCallListener(this.onCallDeclined);
        WebrtcStore.removeCancelCallListener(this.onCancelCall);
        WebrtcStore.removeConnectCallListener(this.onConnectCall);
        WebrtcStore.removeNotSupportedCallListener(this.onNotSupported);
        WebrtcStore.removeFailedCallListener(this.onFailed);

        UserStore.removeStatusesChangeListener(this.onStatusChange);

        this.mounted = false;
    }

    handleResize() {
        this.setState({
            windowWidth: Utils.windowWidth(),
            windowHeight: Utils.windowHeight()
        });
    }

    previewVideo() {
        if (this.mounted) {
            if (this.localMedia) {
                this.setState({
                    localMediaLoaded: true
                });
                this.localMedia.pause(false);
            } else {
                this.localMedia = new Conversations.LocalMedia();
                Conversations.getUserMedia().then(
                    (mediaStream) => {
                        this.localMedia.addStream(mediaStream);
                        this.localMedia.attach('#main-video');
                        this.setState({
                            localMediaLoaded: true
                        });
                    },
                    () => {
                        this.setState({
                            error: (
                                <FormattedMessage
                                    id='webrtc.mediaError'
                                    defaultMessage='Unable to access Camera and Microphone'
                                />
                            )
                        });
                    });
            }
        }
    }

    handlePlaceCall() {
        if (UserStore.getStatus(this.props.userId) !== 'offline') {
            this.setState({
                isCalling: true,
                callInProgress: false,
                error: null
            });

            Websockets.sendMessage({
                channel_id: this.state.channelId,
                action: Constants.SocketEvents.START_VIDEO_CALL,
                props: {
                    from_id: UserStore.getCurrentId(),
                    to_id: this.props.userId
                }
            });
        }
    }

    handleCancelCall() {
        Websockets.sendMessage({
            channel_id: this.state.channelId,
            action: Constants.SocketEvents.CANCEL_VIDEO_CALL,
            props: {
                from_id: UserStore.getCurrentId(),
                to_id: this.props.userId
            }
        });

        this.previewVideo();
        this.unregister();
    }

    handleFailedCall() {
        Websockets.sendMessage({
            channel_id: this.state.channelId,
            action: Constants.SocketEvents.VIDEO_CALL_FAILED,
            props: {
                from_id: UserStore.getCurrentId(),
                to_id: this.props.userId
            }
        });

        this.unregister();
    }

    onCancelCall() {
        const isAnswering = this.state.isAnswering;
        this.unregister();
        this.previewVideo();

        if (this.mounted && isAnswering) {
            this.setState({
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
    }

    handleClose() {
        if (this.conversation) {
            this.setState({
                error: (
                    <FormattedMessage
                        id='webrtc.inProgress'
                        defaultMessage='You have a video call in progress. Hangup before closing this window.'
                    />
                )
            });
        } else if (this.state.isCalling) {
            this.handleCancelCall();
            this.close();
        } else {
            this.unregister();
            this.close();
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

        this.setState({
            isCalling: false,
            callInProgress: false,
            error
        });
    }

    onStatusChange() {
        const status = UserStore.getStatus(this.props.userId);

        if (status === 'offline') {
            const error = (
                <FormattedMessage
                    id='webrtc.offline'
                    defaultMessage='{username} is offline'
                    values={{
                        username: Utils.displayUsername(this.props.userId)
                    }}
                />
            );

            if (this.state.isCalling) {
                this.setState({
                    isCalling: false,
                    callInProgress: false,
                    error
                });
            } else {
                this.setState({
                    error
                });
            }
        } else if (status !== 'offline' && this.state.error) {
            this.setState({
                error: null
            });
        }
    }

    onConnectCall() {
        const self = this;
        Client.getTwilioToken(
            (data) => {
                self.accessManager = new AccessManager(data.token);
                self.conversationsClient = new Conversations.Client(self.accessManager);

                self.conversationsClient.listen().then(
                    self.connected,
                    (error) => {
                        console.error(Utils.localizeMessage('webrtc.unable', 'Unable to create conversation'), error); //eslint-disable-line no-console

                        self.handleFailedCall();
                    }
                );
            },
            (error) => {
                console.error(Utils.localizeMessage('webrtc.tokenFailed.', 'We encountered an error while getting the video call token'), error); //eslint-disable-line no-console

                self.handleFailedCall();
            }
        );
    }

    onToggleAudio() {
        this.conversation.localMedia.mute(!this.state.isMuted);
        this.setState({
            isMuted: !this.state.isMuted
        });
    }

    onToggleVideo() {
        const shouldPause = !this.state.isPaused;
        this.conversation.localMedia.pause(shouldPause);
        this.setState({
            isPaused: shouldPause
        });
    }

    onToggleRemoteAudio() {
        this.setState({
            isRemoteMuted: !this.state.isRemoteMuted
        });
    }

    onToggleRemoteVideo(participant) {
        const remoteUser = UserStore.getProfile(participant.identity);
        const shouldPause = !this.state.isRemotePaused;
        let remoteUserImage = null;
        if (shouldPause) {
            remoteUserImage = Client.getUsersRoute() + '/' + remoteUser.id + '/image?time=' + remoteUser.update_at;
        }
        this.setState({
            isRemotePaused: shouldPause,
            remoteUserImage
        });
    }

    onNotSupported() {
        if (this.mounted) {
            this.setState({
                error: (
                    <FormattedMessage
                        id='webrtc.notSupported'
                        defaultMessage="{username}'s client does not support video calls"
                        values={{
                            username: Utils.displayUsername(this.props.userId)
                        }}
                    />
                ),
                callInProgress: false,
                isCalling: false,
                isAnswering: false
            });

            this.conversationsClient = null;
            this.conversation = null;
            this.accessManager = null;
        }
    }

    onFailed() {
        this.setState({
            isCalling: false,
            callInProgress: false,
            error: (
                <FormattedMessage
                    id='webrtc.failed'
                    defaultMessage='There was a problem creating the video call'
                />
            )
        });

        this.previewVideo();
    }

    onInvite(invite) {
        if (invite.from === this.props.userId) {
            invite.accept().then(this.conversationStarted);
        } else {
            invite.reject();

            this.setState({
                isAnswering: false
            });

            Websockets.sendMessage({
                channel_id: this.state.channelId,
                action: Constants.SocketEvents.VIDEO_CALL_REJECT,
                props: {
                    from_id: this.props.userId,
                    to_id: this.state.currentUserId
                }
            });
        }
    }

    onParticipantConnected(participant) {
        const self = this;
        console.log('connected from video call'); //eslint-disable-line no-console

        if (self.mounted) {
            self.mainMediaToLocal();
            participant.media.attach('#main-video');

            participant.on('trackDisabled', this.onTrackDisabled.bind(this, participant));

            participant.on('trackEnabled', this.onTrackEnabled.bind(this, participant));

            self.setState({
                callInProgress: true,
                isCalling: false,
                isAnswering: false,
                isPaused: false,
                isMuted: false,
                isRemotePaused: false,
                isRemoteMuted: false,
                remoteUserImage: null
            });

            const icons = document.querySelector('.webrtc-icons');
            icons.classList.remove('hidden');
            icons.classList.add('active');
        }
    }

    onParticipantDisconnected(participant) {
        participant.removeListener('trackDisabled', this.onTrackDisabled);
        participant.removeListener('trackEnabled', this.onTrackEnabled);
    }

    onParticipantFailed(participant) {
        console.error(Utils.displayUsername(participant.identity) + ' failed to join the Conversation'); //eslint-disable-line no-console
        this.handleFailedCall();
    }

    onDisconnect() {
        console.log('disconnected from video call'); //eslint-disable-line no-console
        if (this.conversation && this.mounted) {
            this.conversation.removeListener('participantConnected', this.onParticipantConnected);
            this.conversation.removeListener('participantDisconnected', this.onParticipantDisconnected);
            this.conversation.removeListener('participantFailed', this.onParticipantFailed);
            this.conversation.removeListener('disconnected', this.onDisconnect);
            this.conversation = null;
            this.localMediaToMain();

            const icons = document.querySelector('.webrtc-icons');
            icons.classList.remove('active');
            icons.classList.add('hidden');
            this.unregister();
        }
    }

    onTrackDisabled(participant, track) {
        switch (track.kind) {
        case 'video':
            this.onToggleRemoteVideo(participant);
            break;
        case 'audio':
            this.onToggleRemoteAudio();
            break;
        }
    }

    onTrackEnabled(participant, track) {
        switch (track.kind) {
        case 'video':
            this.onToggleRemoteVideo(participant);
            break;
        case 'audio':
            this.onToggleRemoteAudio();
            break;
        }
    }

    unregister() {
        if (this.conversation) {
            this.conversation.disconnect();
        } else if (this.outgoingInvitation) {
            this.outgoingInvitation.cancel();
        }

        if (this.conversationsClient) {
            this.conversationsClient.unlisten();
        }

        this.conversationsClient = null;
        this.outgoingInvitation = null;
        this.conversation = null;
        this.accessManager = null;

        if (this.mounted) {
            this.setState({
                error: null,
                callInProgress: false,
                isCalling: false,
                isAnswering: false,
                isPaused: false,
                isMuted: false,
                isRemotePaused: false,
                isRemoteMuted: false,
                remoteUserImage: null
            });
        }
    }

    close() {
        if (this.localMedia) {
            this.localMedia.stop();
            this.localMedia = null;
        }

        AppDispatcher.handleServerAction({
            type: ActionTypes.RECEIVED_SEARCH,
            results: null
        });

        AppDispatcher.handleServerAction({
            type: ActionTypes.RECEIVED_POST_SELECTED,
            postId: null
        });
    }

    connected() {
        if (this.props.isCaller || this.state.isCalling) {
            const options = {};

            if (this.localMedia) {
                options.localMedia = this.localMedia;
            }

            if (this.conversationsClient) {
                this.outgoingInvitation = this.conversationsClient.inviteToConversation(this.props.userId, options);
                this.outgoingInvitation.then(
                    this.conversationStarted,
                    (error) => {
                        console.error('Unable to create conversation', error); //eslint-disable-line no-console
                        if (this.mounted) {
                            this.setState({
                                error: (
                                    <FormattedMessage
                                        id='webrtc.unable'
                                        defaultMessage='Unable to create conversation'
                                    />
                                )
                            });
                        }
                    }
                );
            }
        } else {
            this.setState({
                isAnswering: true
            });

            this.conversationsClient.on('invite', this.onInvite);
        }
    }

    conversationStarted(conversation) {
        if (this.outgoingInvitation) {
            this.outgoingInvitation = null;
        }

        this.conversation = conversation;
        conversation.on('participantConnected', this.onParticipantConnected);
        conversation.on('participantDisconnected', this.onParticipantDisconnected);
        conversation.on('participantFailed', this.onParticipantFailed);

        conversation.on('disconnected', this.onDisconnect);
    }

    localMediaToMain() {
        if (this.localMedia) {
            this.localMedia.detach('#local-video');
            this.localMedia.attach('#main-video');
            this.localMedia.pause(false);
        } else {
            document.querySelector('#local-video').innerHTML = null;
            this.previewVideo();
        }
    }

    mainMediaToLocal() {
        if (this.localMedia) {
            this.localMedia.detach('#main-video');
            this.localMedia.attach('#local-video');
        } else {
            this.conversation.localMedia.attach('#local-video');
        }
    }

    renderButtons() {
        let buttons;
        if (this.state.isCalling) {
            buttons = (
                <svg
                    id='cancel'
                    xmlns='http://www.w3.org/2000/svg'
                    width='48'
                    height='48'
                    viewBox='-10 -10 68 68'
                    onClick={() => this.handleCancelCall()}
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
                    xmlns='http://www.w3.org/2000/svg'
                    width='48'
                    height='48'
                    viewBox='-10 -10 68 68'
                    onClick={() => this.handlePlaceCall()}
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
                        transform='scale(0.8), translate(65,20), rotate(120)'
                        d='M24 18c-3.21 0-6.3.5-9.2 1.44v6.21c0 .79-.46 1.47-1.12 1.8-1.95.98-3.74 2.23-5.33 3.7-.36.35-.85.57-1.4.57-.55 0-1.05-.22-1.41-.59L.59 26.18c-.37-.37-.59-.87-.59-1.42 0-.55.22-1.05.59-1.42C6.68 17.55 14.93 14 24 14s17.32 3.55 23.41 9.34c.37.36.59.87.59 1.42 0 .55-.22 1.05-.59 1.41l-4.95 4.95c-.36.36-.86.59-1.41.59-.54 0-1.04-.22-1.4-.57-1.59-1.47-3.38-2.72-5.33-3.7-.66-.33-1.12-1.01-1.12-1.8v-6.21C30.3 18.5 27.21 18 24 18z'
                        fill='white'
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
                    className='webrtc-icons hidden'
                >

                    <svg
                        id='mute-audio'
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
                            className={audioOffClass}
                            transform='scale(0.6), translate(17,18)'
                            d='M38 22h-3.4c0 1.49-.31 2.87-.87 4.1l2.46 2.46C37.33 26.61 38 24.38 38 22zm-8.03.33c0-.11.03-.22.03-.33V10c0-3.32-2.69-6-6-6s-6 2.68-6 6v.37l11.97 11.96zM8.55 6L6 8.55l12.02 12.02v1.44c0 3.31 2.67 6 5.98 6 .45 0 .88-.06 1.3-.15l3.32 3.32c-1.43.66-3 1.03-4.62 1.03-5.52 0-10.6-4.2-10.6-10.2H10c0 6.83 5.44 12.47 12 13.44V42h4v-6.56c1.81-.27 3.53-.9 5.08-1.81L39.45 42 42 39.46 8.55 6z'
                            fill='white'
                        />
                        <path
                            className={audioOnClass}
                            transform='scale(0.6), translate(17,18)'
                            d='M24 28c3.31 0 5.98-2.69 5.98-6L30 10c0-3.32-2.68-6-6-6-3.31 0-6 2.68-6 6v12c0 3.31 2.69 6 6 6zm10.6-6c0 6-5.07 10.2-10.6 10.2-5.52 0-10.6-4.2-10.6-10.2H10c0 6.83 5.44 12.47 12 13.44V42h4v-6.56c6.56-.97 12-6.61 12-13.44h-3.4z'
                            fill='white'
                        />
                    </svg>

                    <svg
                        id='mute-video'
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
                            className={videoOffClass}
                            transform='scale(0.6), translate(17,16)'
                            d='M40 8H15.64l8 8H28v4.36l1.13 1.13L36 16v12.36l7.97 7.97L44 36V12c0-2.21-1.79-4-4-4zM4.55 2L2 4.55l4.01 4.01C4.81 9.24 4 10.52 4 12v24c0 2.21 1.79 4 4 4h29.45l4 4L44 41.46 4.55 2zM12 16h1.45L28 30.55V32H12V16z'
                            fill='white'
                        />
                        <path
                            className={videoOnClass}
                            transform='scale(0.6), translate(17,16)'
                            d='M40 8H8c-2.21 0-4 1.79-4 4v24c0 2.21 1.79 4 4 4h32c2.21 0 4-1.79 4-4V12c0-2.21-1.79-4-4-4zm-4 24l-8-6.4V32H12V16h16v6.4l8-6.4v16z'
                            fill='white'
                        />
                    </svg>

                    <svg
                        id='hangup'
                        xmlns='http://www.w3.org/2000/svg'
                        width='48'
                        height='48'
                        viewBox='-10 -10 68 68'
                        onClick={() => this.onCancelCall()}
                    >
                        <circle
                            cx='24'
                            cy='24'
                            r='34'
                        >
                            <title>
                                <FormattedMessage
                                    id='webrtc.hangup'
                                    defaultMessage='Hangup'
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
        let localImage;
        let localVideoHidden;
        let remoteImage;
        let remoteVideoHidden;
        let error;
        let remoteMute;

        let localImageHidden = 'webrtc__local-image hidden';
        let remoteImageHidden = 'webrtc__remote-image hidden';

        if (this.state.error) {
            error = (
                <div className='webrtc__error'>
                    <div className='form-group has-error'>
                        <label className='control-label'>{this.state.error}</label>
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
        let connecting;
        if (this.state.isCalling || this.state.isAnswering) {
            connecting = (
                <div className='connecting'>
                    <ConnectingScreen position='absolute'/>
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
                remoteImage = (<img src={this.state.remoteUserImage}/>);
            }
        }

        return (
            <div className='post-right__container'>
                <div className='search-bar__container sidebar--right__search-header'>{searchForm}</div>
                <div className='sidebar-right__body'>
                    <WebrtcHeader
                        userId={this.props.userId}
                        onClose={this.handleClose}
                    />
                    <div className='post-right__scroll'>
                        <div id='videos'>
                            {remoteMute}
                            <div
                                id='main-video'
                                className={remoteVideoHidden}
                                autoPlay={true}
                            />
                            <div
                                id='local-video'
                                className={localVideoHidden}
                                autoPlay={true}
                            />
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
    userId: React.PropTypes.string.isRequired,
    isCaller: React.PropTypes.bool.isRequired
};