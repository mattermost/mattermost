// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import LoadingScreen from 'components/loading_screen.jsx';

import UserStore from 'stores/user_store.jsx';

import * as GlobalActions from 'actions/global_actions.jsx';
import * as WebSocketActions from 'actions/websocket_actions.jsx';
import {loadEmoji} from 'actions/emoji_actions.jsx';

import * as Utils from 'utils/utils.jsx';

const BACKSPACE_CHAR = 8;

import $ from 'jquery';
import PropTypes from 'prop-types';
import React from 'react';

// import the EmojiStore so that it'll register to receive the results of the listEmojis call further down
import 'stores/emoji_store.jsx';

export default class LoggedIn extends React.Component {
    constructor(params) {
        super(params);

        this.onUserChanged = this.onUserChanged.bind(this);

        // Because current CSS requires the root tag to have specific stuff
        $('#root').attr('class', 'channel-view');

        // Device tracking setup
        var iOS = (/(iPad|iPhone|iPod)/g).test(navigator.userAgent);
        if (iOS) {
            $('body').addClass('ios');
        }

        this.state = {
            user: UserStore.getCurrentUser()
        };

        if (!this.state.user) {
            GlobalActions.emitUserLoggedOutEvent('/login');
        }
    }

    isValidState() {
        return this.state.user != null;
    }

    onUserChanged() {
        // Grab the current user
        const user = UserStore.getCurrentUser();
        if (!Utils.areObjectsEqual(this.state.user, user)) {
            this.setState({
                user
            });
        }
    }

    componentDidMount() {
        // Initialize websocket
        WebSocketActions.initialize();

        // Listen for user
        UserStore.addChangeListener(this.onUserChanged);

        // Listen for focussed tab/window state
        window.addEventListener('focus', this.onFocusListener);
        window.addEventListener('blur', this.onBlurListener);

        // ???
        $('body').on('mouseenter mouseleave', '.post', function mouseOver(ev) {
            if (ev.type === 'mouseenter') {
                $(this).parent('div').prev('.date-separator, .new-separator').addClass('hovered--after');
                $(this).parent('div').next('.date-separator, .new-separator').addClass('hovered--before');
            } else {
                $(this).parent('div').prev('.date-separator, .new-separator').removeClass('hovered--after');
                $(this).parent('div').next('.date-separator, .new-separator').removeClass('hovered--before');
            }
        });

        $('body').on('mouseenter mouseleave', '.search-item__container .post', function mouseOver(ev) {
            if (ev.type === 'mouseenter') {
                $(this).closest('.search-item__container').find('.date-separator').addClass('hovered--after');
                $(this).closest('.search-item__container').next('div').find('.date-separator').addClass('hovered--before');
            } else {
                $(this).closest('.search-item__container').find('.date-separator').removeClass('hovered--after');
                $(this).closest('.search-item__container').next('div').find('.date-separator').removeClass('hovered--before');
            }
        });

        $('body').on('mouseenter mouseleave', '.post.post--comment.same--root', function mouseOver(ev) {
            if (ev.type === 'mouseenter') {
                $(this).parent('div').prev('.date-separator, .new-separator').addClass('hovered--comment');
                $(this).parent('div').next('.date-separator, .new-separator').addClass('hovered--comment');
            } else {
                $(this).parent('div').prev('.date-separator, .new-separator').removeClass('hovered--comment');
                $(this).parent('div').next('.date-separator, .new-separator').removeClass('hovered--comment');
            }
        });

        // Prevent backspace from navigating back a page
        $(window).on('keydown.preventBackspace', (e) => {
            if (e.which === BACKSPACE_CHAR && !$(e.target).is('input, textarea')) {
                e.preventDefault();
            }
        });

        // Get custom emoji from the server
        if (window.mm_config.EnableCustomEmoji === 'true') {
            loadEmoji(false);
        }
    }

    componentWillUnmount() {
        $('#root').attr('class', '');

        WebSocketActions.close();
        UserStore.removeChangeListener(this.onUserChanged);

        $('body').off('click.userpopover');
        $('body').off('mouseenter mouseleave', '.post');
        $('body').off('mouseenter mouseleave', '.post.post--comment.same--root');

        $('.modal').off('show.bs.modal');

        $(window).off('keydown.preventBackspace');

        // Listen for focussed tab/window state
        window.removeEventListener('focus', this.onFocusListener);
        window.removeEventListener('blur', this.onBlurListener);
    }

    render() {
        if (!this.isValidState()) {
            return <LoadingScreen/>;
        }

        return React.cloneElement(this.props.children, {
            user: this.state.user
        });
    }

    onFocusListener() {
        GlobalActions.emitBrowserFocus(true);
    }

    onBlurListener() {
        GlobalActions.emitBrowserFocus(false);
    }
}

LoggedIn.propTypes = {
    children: PropTypes.object
};
