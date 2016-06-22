/**
 * Created by enahum on 3/25/16.
 */

import ChannelStore from 'stores/channel_store.jsx';
import UserStore from 'stores/user_store.jsx';
import WebrtcStore from 'stores/webrtc_store.jsx';
import * as GlobalActions from 'actions/global_actions.jsx';
import * as Websockets from 'actions/websocket_actions.jsx';
import * as Utils from 'utils/utils.jsx';
import Client from 'utils/web_client.jsx';
import Constants from 'utils/constants.jsx';

import React from 'react';

import {FormattedMessage} from 'react-intl';

export default class WebrtcNotification extends React.Component {
    constructor() {
        super();

        this.mounted = false;

        this.closeBar = this.closeBar.bind(this);
        this.onIncomingCall = this.onIncomingCall.bind(this);
        this.onCancelCall = this.onCancelCall.bind(this);
        this.handleClose = this.handleClose.bind(this);
        this.handleAnswer = this.handleAnswer.bind(this);

        this.state = {
            channelId: ChannelStore.getCurrentId(),
            userCalling: null,
            notSupported: false
        };
    }

    componentDidMount() {
        WebrtcStore.addIncomingCallListener(this.onIncomingCall);
        WebrtcStore.addCancelCallListener(this.onCancelCall);
        this.mounted = true;
    }

    componentWillUnmount() {
        WebrtcStore.removeIncomingCallListener(this.onIncomingCall);
        WebrtcStore.removeCancelCallListener(this.onCancelCall);
        this.mounted = false;
    }

    closeBar() {
        this.setState({
            userCalling: null,
            notSupported: false
        });
    }

    onIncomingCall(incoming) {
        if (this.mounted) {
            const userId = incoming.from_id;
            const userMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

            if (userMedia) {
                // here we should check if the user is already in a call
                if (!this.state.callerId) {
                    this.setState({
                        userCalling: UserStore.getProfile(userId),
                        notSupported: false
                    });
                }
            } else {
                Websockets.sendMessage({
                    channel_id: this.state.channelId,
                    action: Constants.SocketEvents.VIDEO_CALL_NOT_SUPPORTED,
                    props: {
                        from_id: userId,
                        to_id: UserStore.getCurrentId()
                    }
                });

                this.setState({
                    userCalling: UserStore.getProfile(userId),
                    notSupported: true
                });
            }
        }
    }

    onCancelCall() {
        this.closeBar();
    }

    handleAnswer(e) {
        if (e) {
            e.preventDefault();
        }

        const caller = this.state.userCalling;
        if (caller) {
            const callerId = caller.id;
            GlobalActions.answerVideoCall(callerId);

            Websockets.sendMessage({
                channel_id: this.state.channelId,
                action: Constants.SocketEvents.VIDEO_CALL_ANSWER,
                props: {
                    from_id: callerId,
                    to_id: UserStore.getCurrentId()
                }
            });

            this.closeBar();
        }
    }

    handleClose(e) {
        if (e) {
            e.preventDefault();
        }

        if (this.state.userCalling && !this.state.notSupported) {
            Websockets.sendMessage({
                channel_id: this.state.channelId,
                action: Constants.SocketEvents.VIDEO_CALL_REJECT,
                props: {
                    from_id: this.state.userCalling.id,
                    to_id: UserStore.getCurrentId()
                }
            });
        }

        this.closeBar();
    }

    render() {
        let msg;
        if (this.state.userCalling) {
            const user = this.state.userCalling;
            const username = Utils.displayUsername(user.id);
            const profileImgSrc = Client.getUsersRoute() + '/' + user.id + '/image?time=' + user.update_at;
            const profileImg = (
                <img
                    className='user-popover__image'
                    src={profileImgSrc}
                    height='128'
                    width='128'
                    key='user-popover-image'
                />
            );

            if (this.state.notSupported) {
                msg = (
                    <FormattedMessage
                        id='webrtc.notification.not_supported'
                        defaultMessage='{username} is calling you, but your client does not support video calls'
                        values={{
                            username
                        }}
                    />
                );
            } else {
                const answerBtn = (
                    <svg
                        className='webrtc-icons__call'
                        xmlns='http://www.w3.org/2000/svg'
                        width='48'
                        height='48'
                        viewBox='-10 -10 68 68'
                        onClick={this.handleAnswer}
                    >
                        <circle
                            cx='24'
                            cy='24'
                            r='34'
                        >
                            <title>
                                <FormattedMessage
                                    id='webrtc.notification.answer'
                                    defaultMessage='Answer'
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

                const rejectBtn = (
                    <svg
                        className='webrtc-icons__cancel'
                        xmlns='http://www.w3.org/2000/svg'
                        width='48'
                        height='48'
                        viewBox='-10 -10 68 68'
                        onClick={this.handleClose}
                    >
                        <circle
                            cx='24'
                            cy='24'
                            r='34'
                        >
                            <title>
                                <FormattedMessage
                                    id='webrtc.notification.decline'
                                    defaultMessage='Decline'
                                />
                            </title>
                        </circle>
                        <path
                            transform='scale(0.7), translate(11,10)'
                            d='M24 18c-3.21 0-6.3.5-9.2 1.44v6.21c0 .79-.46 1.47-1.12 1.8-1.95.98-3.74 2.23-5.33 3.7-.36.35-.85.57-1.4.57-.55 0-1.05-.22-1.41-.59L.59 26.18c-.37-.37-.59-.87-.59-1.42 0-.55.22-1.05.59-1.42C6.68 17.55 14.93 14 24 14s17.32 3.55 23.41 9.34c.37.36.59.87.59 1.42 0 .55-.22 1.05-.59 1.41l-4.95 4.95c-.36.36-.86.59-1.41.59-.54 0-1.04-.22-1.4-.57-1.59-1.47-3.38-2.72-5.33-3.7-.66-.33-1.12-1.01-1.12-1.8v-6.21C30.3 18.5 27.21 18 24 18z'
                            fill='white'
                        />
                    </svg>
                );

                msg = (
                    <div>
                        <FormattedMessage
                            id='webrtc.notification.incoming_call'
                            defaultMessage='{username} is calling you.'
                            values={{
                                username
                            }}
                        />
                        <div
                            className='webrtc-buttons webrtc-icons active'
                            style={{marginTop: '5px'}}
                        >
                            {answerBtn}
                            {rejectBtn}
                        </div>
                    </div>
                );
            }

            return (
                <div className='webrtc-notification'>
                    <div>
                        {profileImg}
                    </div>
                    {msg}
                </div>
            );
        }

        return <div/>;
    }
}
