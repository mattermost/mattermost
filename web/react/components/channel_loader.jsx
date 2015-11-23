// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

/* This is a special React control with the sole purpose of making all the AsyncClient calls
    to the server on page load. This is to prevent other React controls from spamming
    AsyncClient with requests. */

import * as AsyncClient from '../utils/async_client.jsx';
import SocketStore from '../stores/socket_store.jsx';
import ChannelStore from '../stores/channel_store.jsx';
import PostStore from '../stores/post_store.jsx';
import UserStore from '../stores/user_store.jsx';

import * as Utils from '../utils/utils.jsx';
import Constants from '../utils/constants.jsx';

export default class ChannelLoader extends React.Component {
    constructor(props) {
        super(props);

        this.intervalId = null;

        this.onSocketChange = this.onSocketChange.bind(this);

        this.state = {};
    }
    componentDidMount() {
        /* Initial aysnc loads */
        AsyncClient.getPosts(ChannelStore.getCurrentId());
        AsyncClient.getChannels();
        AsyncClient.getChannelExtraInfo();
        AsyncClient.findTeams();
        AsyncClient.getMyTeam();
        setTimeout(() => AsyncClient.getStatuses(), 3000); // temporary until statuses are reworked a bit

        /* Perform pending post clean-up */
        PostStore.clearPendingPosts();

        /* Set up interval functions */
        this.intervalId = setInterval(() => AsyncClient.getStatuses(), 30000);

        /* Device tracking setup */
        var iOS = (/(iPad|iPhone|iPod)/g).test(navigator.userAgent);
        if (iOS) {
            $('body').addClass('ios');
        }

        /* Set up tracking for whether the window is active */
        window.isActive = true;

        $(window).on('focus', function windowFocus() {
            AsyncClient.updateLastViewedAt();
            window.isActive = true;
        });

        $(window).on('blur', function windowBlur() {
            window.isActive = false;
        });

        /* Start global change listeners setup */
        SocketStore.addChangeListener(this.onSocketChange);

        /* Update CSS classes to match user theme */
        var user = UserStore.getCurrentUser();

        if ($.isPlainObject(user.theme_props) && !$.isEmptyObject(user.theme_props)) {
            Utils.applyTheme(user.theme_props);
        } else {
            Utils.applyTheme(Constants.THEMES.default);
        }

        $('body').on('mouseenter mouseleave', '.post', function mouseOver(ev) {
            if (ev.type === 'mouseenter') {
                $(this).parent('div').prev('.date-separator, .new-separator').addClass('hovered--after');
                $(this).parent('div').next('.date-separator, .new-separator').addClass('hovered--before');
            } else {
                $(this).parent('div').prev('.date-separator, .new-separator').removeClass('hovered--after');
                $(this).parent('div').next('.date-separator, .new-separator').removeClass('hovered--before');
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

        /* Prevent backspace from navigating back a page */
        $(window).on('keydown.preventBackspace', (e) => {
            if (e.which === 8 && !$(e.target).is('input, textarea')) {
                e.preventDefault();
            }
        });
    }
    componentWillUnmount() {
        clearInterval(this.intervalId);

        $(window).off('focus');
        $(window).off('blur');

        SocketStore.removeChangeListener(this.onSocketChange);

        $('body').off('click.userpopover');
        $('body').off('mouseenter mouseleave', '.post');
        $('body').off('mouseenter mouseleave', '.post.post--comment.same--root');

        $('.modal').off('show.bs.modal');

        $(window).off('keydown.preventBackspace');
    }
    onSocketChange(msg) {
        if (msg && msg.user_id && msg.user_id !== UserStore.getCurrentId()) {
            UserStore.setStatus(msg.user_id, 'online');
        }
    }
    render() {
        return <div/>;
    }
}
