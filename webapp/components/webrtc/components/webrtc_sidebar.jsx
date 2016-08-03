// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';

import WebrtcContainer from '../webrtc_controller.jsx';
import UserStore from 'stores/user_store.jsx';
import WebrtcStore from 'stores/webrtc_store.jsx';
import * as Utils from 'utils/utils.jsx';

import React from 'react';

export default class SidebarRight extends React.Component {
    constructor(props) {
        super(props);

        this.plScrolledToBottom = true;

        this.onShrink = this.onShrink.bind(this);
        this.toggleSize = this.toggleSize.bind(this);
        this.onInitializeVideoCall = this.onInitializeVideoCall.bind(this);

        this.doStrangeThings = this.doStrangeThings.bind(this);

        this.state = {
            expanded: false,
            currentUser: UserStore.getCurrentUser(),
            videoCallVisible: false,
            isCaller: false,
            videoCallWithUserId: null
        };
    }

    componentDidMount() {
        WebrtcStore.addInitListener(this.onInitializeVideoCall);
        this.doStrangeThings();
    }

    componentWillUnmount() {
        WebrtcStore.removeInitListener(this.onInitializeVideoCall);
    }

    shouldComponentUpdate(nextProps, nextState) {
        return !Utils.areObjectsEqual(nextState, this.state);
    }

    doStrangeThings() {
        // We should have a better way to do this stuff
        // Hence the function name.
        $('.app__body .inner-wrap').removeClass('move--right');
        $('.app__body .inner-wrap').addClass('webrtc--show');
        $('.app__body .sidebar--left').removeClass('move--right');
        $('.app__body .webrtc').addClass('webrtc--show');

        //$('.sidebar--right').prepend('<div class="sidebar__overlay"></div>');
        if (!this.state.videoCallVisible) {
            $('.app__body .inner-wrap').removeClass('webrtc--show').removeClass('move--right');
            $('.app__body .webrtc').removeClass('webrtc--show');
            return (
                <div></div>
            );
        }

        /*setTimeout(() => {
         $('.sidebar__overlay').fadeOut('200', () => {
         $('.sidebar__overlay').remove();
         });
         }, 500);*/
        return null;
    }

    componentDidUpdate() {
        this.doStrangeThings();
    }

    onShrink() {
        this.setState({expanded: false});
    }

    toggleSize(e) {
        if (e) {
            e.preventDefault();
        }
        this.setState({expanded: !this.state.expanded});
    }

    onInitializeVideoCall(userId, isCaller) {
        this.setState({
            videoCallVisible: (userId !== null),
            isCaller,
            videoCallWithUserId: userId
        });
    }

    render() {
        let content = null;
        let expandedClass = '';

        if (this.state.expanded) {
            expandedClass = 'sidebar--right--expanded';
        }

        if (this.state.videoCallVisible) {
            content = (
                <WebrtcContainer
                    currentUser={this.state.currentUser}
                    userId={this.state.videoCallWithUserId}
                    isCaller={this.state.isCaller}
                    toggleSize={this.toggleSize}
                />
            );
        }

        return (
            <div
                className={'sidebar--right webrtc ' + expandedClass}
                id='sidebar-webrtc'
            >
                <div
                    onClick={this.onShrink}
                    className='sidebar--right__bg'
                />
                <div className='sidebar-right-container'>
                    {content}
                </div>
            </div>
        );
    }
}
