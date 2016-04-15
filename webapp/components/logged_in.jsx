// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import LoadingScreen from 'components/loading_screen.jsx';
import * as AsyncClient from 'utils/async_client.jsx';
import UserStore from 'stores/user_store.jsx';
import BrowserStore from 'stores/browser_store.jsx';
import PreferenceStore from 'stores/preference_store.jsx';
import * as Utils from 'utils/utils.jsx';
import * as Websockets from 'action_creators/websocket_actions.jsx';
import Constants from 'utils/constants.jsx';

import {browserHistory} from 'react-router';

const CLIENT_STATUS_INTERVAL = 30000;
const BACKSPACE_CHAR = 8;

import React from 'react';

export default class LoggedIn extends React.Component {
    constructor(params) {
        super(params);

        this.onUserChanged = this.onUserChanged.bind(this);
        this.setupUser = this.setupUser.bind(this);

        this.state = {
            user: UserStore.getCurrentUser()
        };

        if (this.state.user) {
            this.setupUser(this.state.user);
        }
    }

    isValidState() {
        return this.state.user != null;
    }

    setupUser(user) {
        // Update segment indentify
        if (global.window.mm_config.SegmentDeveloperKey != null && global.window.mm_config.SegmentDeveloperKey !== '') {
            global.window.analytics.identify(user.id, {
                name: user.nickname,
                email: user.email,
                createdAt: user.create_at,
                username: user.username,
                id: user.id
            });
        }

        // Update CSS classes to match user theme
        if (user) {
            if ($.isPlainObject(user.theme_props) && !$.isEmptyObject(user.theme_props)) {
                Utils.applyTheme(user.theme_props);
            } else {
                Utils.applyTheme(Constants.THEMES.default);
            }
        }
    }

    onUserChanged() {
        // Grab the current user
        const user = UserStore.getCurrentUser();
        this.setupUser(user);

        this.setState({
            user
        });
    }

    componentWillMount() {
        // Listen for user
        UserStore.addChangeListener(this.onUserChanged);

        // Initalize websockets
        Websockets.initialize();

        // Get all statuses regularally. (Soon to be switched to websocket)
        this.intervalId = setInterval(() => AsyncClient.getStatuses(), CLIENT_STATUS_INTERVAL);

        // Force logout of all tabs if one tab is logged out
        $(window).bind('storage', (e) => {
            // when one tab on a browser logs out, it sets __logout__ in localStorage to trigger other tabs to log out
            if (e.originalEvent.key === '__logout__' && e.originalEvent.storageArea === localStorage && e.originalEvent.newValue) {
                // make sure it isn't this tab that is sending the logout signal (only necessary for IE11)
                if (BrowserStore.isSignallingLogout(e.originalEvent.newValue)) {
                    return;
                }

                console.log('detected logout from a different tab'); //eslint-disable-line no-console
                browserHistory.push('/');
            }

            if (e.originalEvent.key === '__login__' && e.originalEvent.storageArea === localStorage && e.originalEvent.newValue) {
                // make sure it isn't this tab that is sending the logout signal (only necessary for IE11)
                if (BrowserStore.isSignallingLogin(e.originalEvent.newValue)) {
                    return;
                }

                console.log('detected login from a different tab'); //eslint-disable-line no-console
                location.reload();
            }
        });

        // Because current CSS requires the root tag to have specific stuff
        $('#root').attr('class', 'channel-view');

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

        // Device tracking setup
        var iOS = (/(iPad|iPhone|iPod)/g).test(navigator.userAgent);
        if (iOS) {
            $('body').addClass('ios');
        }

        // if preferences have already been stored in local storage do not wait until preference store change is fired and handled in channel.jsx
        const selectedFont = PreferenceStore.get(Constants.Preferences.CATEGORY_DISPLAY_SETTINGS, 'selected_font', Constants.DEFAULT_FONT);
        Utils.applyFont(selectedFont);

        // Pervent backspace from navigating back a page
        $(window).on('keydown.preventBackspace', (e) => {
            if (e.which === BACKSPACE_CHAR && !$(e.target).is('input, textarea')) {
                e.preventDefault();
            }
        });
    }

    componentWillUnmount() {
        $('#root').attr('class', '');
        clearInterval(this.intervalId);

        Websockets.close();
        UserStore.removeChangeListener(this.onUserChanged);

        $('body').off('click.userpopover');
        $('body').off('mouseenter mouseleave', '.post');
        $('body').off('mouseenter mouseleave', '.post.post--comment.same--root');

        $('.modal').off('show.bs.modal');

        $(window).off('keydown.preventBackspace');
    }

    render() {
        if (!this.isValidState()) {
            return <LoadingScreen/>;
        }

        return React.cloneElement(this.props.children, {
            user: this.state.user
        });
    }
}

LoggedIn.propTypes = {
    children: React.PropTypes.object
};
