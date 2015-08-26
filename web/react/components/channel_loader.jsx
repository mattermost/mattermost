// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

/* This is a special React control with the sole purpose of making all the AsyncClient calls
    to the server on page load. This is to prevent other React controls from spamming
    AsyncClient with requests. */

var AsyncClient = require('../utils/async_client.jsx');
var SocketStore = require('../stores/socket_store.jsx');
var ChannelStore = require('../stores/channel_store.jsx');
var PostStore = require('../stores/post_store.jsx');
var UserStore = require('../stores/user_store.jsx');
var Constants = require('../utils/constants.jsx');

var utils = require('../utils/utils.jsx');

module.exports = React.createClass({
    componentDidMount: function() {

        /* Initial aysnc loads */
        AsyncClient.getMe();
        AsyncClient.getPosts(ChannelStore.getCurrentId());
        AsyncClient.getChannels(true, true);
        AsyncClient.getChannelExtraInfo(true);
        AsyncClient.findTeams();
        AsyncClient.getStatuses();
        AsyncClient.getMyTeam();

        /* Perform pending post clean-up */
        PostStore.clearPendingPosts();

        /* Set up interval functions */
        setInterval(
            function pollStatuses() {
                AsyncClient.getStatuses();
            }, 30000);

        /* Device tracking setup */
        var iOS = (/(iPad|iPhone|iPod)/g).test(navigator.userAgent);
        if (iOS) {
            $('body').addClass('ios');
        }

        /* Set up tracking for whether the window is active */
        window.isActive = true;

        $(window).focus(function windowFocus() {
            AsyncClient.updateLastViewedAt();
            window.isActive = true;
        });

        $(window).blur(function windowBlur() {
            window.isActive = false;
        });

        /* Start global change listeners setup */
        SocketStore.addChangeListener(this.onSocketChange);

        /* Update CSS classes to match user theme */
        var user = UserStore.getCurrentUser();

        if (user.props && user.props.theme) {
            utils.changeCss('div.theme', 'background-color:' + user.props.theme + ';');
            utils.changeCss('.btn.btn-primary', 'background: ' + user.props.theme + ';');
            utils.changeCss('.modal .modal-header', 'background: ' + user.props.theme + ';');
            utils.changeCss('.mention', 'background: ' + user.props.theme + ';');
            utils.changeCss('.mention-link', 'color: ' + user.props.theme + ';');
            utils.changeCss('@media(max-width: 768px){.search-bar__container', 'background: ' + user.props.theme + ';}');
            utils.changeCss('.search-item-container:hover', 'background: ' + utils.changeOpacity(user.props.theme, 0.05) + ';');
        }

        if (user.props.theme !== '#000000' && user.props.theme !== '#585858') {
            utils.changeCss('.btn.btn-primary:hover, .btn.btn-primary:active, .btn.btn-primary:focus', 'background: ' + utils.changeColor(user.props.theme, -10) + ';');
            utils.changeCss('a.theme', 'color:' + user.props.theme + '; fill:' + user.props.theme + '!important;');
        } else if (user.props.theme === '#000000') {
            utils.changeCss('.btn.btn-primary:hover, .btn.btn-primary:active, .btn.btn-primary:focus', 'background: ' + utils.changeColor(user.props.theme, +50) + ';');
            $('.team__header').addClass('theme--black');
        } else if (user.props.theme === '#585858') {
            utils.changeCss('.btn.btn-primary:hover, .btn.btn-primary:active, .btn.btn-primary:focus', 'background: ' + utils.changeColor(user.props.theme, +10) + ';');
            $('.team__header').addClass('theme--gray');
        }
    },
    onSocketChange: function(msg) {
        if (msg && msg.user_id && msg.user_id !== UserStore.getCurrentId()) {
            UserStore.setStatus(msg.user_id, 'online');
        }
    },
    render: function() {
        return <div/>;
    }
});
