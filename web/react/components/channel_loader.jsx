// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

/* This is a special React control with the sole purpose of making all the AsyncClient calls
    to the server on page load. This is to prevent other React controls from spamming
    AsyncClient with requests. */

var BrowserStore = require('../stores/browser_store.jsx');
var AsyncClient = require('../utils/async_client.jsx');
var SocketStore = require('../stores/socket_store.jsx');
var ChannelStore = require('../stores/channel_store.jsx');
var PostStore = require('../stores/post_store.jsx');
var Constants = require('../utils/constants.jsx');

module.exports = React.createClass({
    componentDidMount: function() {

        /* Start initial aysnc loads */
        AsyncClient.getMe();
        AsyncClient.getPosts(true, ChannelStore.getCurrentId(), Constants.POST_CHUNK_SIZE);
        AsyncClient.getChannels(true, true);
        AsyncClient.getChannelExtraInfo(true);
        AsyncClient.findTeams();
        AsyncClient.getStatuses();
        AsyncClient.getMyTeam();
        /* End of async loads */

        /* Perform pending post clean-up */
        PostStore.clearPendingPosts();
        /* End pending post clean-up */

        /* Start interval functions */
        setInterval(
            function pollStatuses() {
                AsyncClient.getStatuses();
            }, 30000);
        /* End interval functions */

        /* Start device tracking setup */
        var iOS = (/(iPad|iPhone|iPod)/g).test(navigator.userAgent);
        if (iOS) {
            $('body').addClass('ios');
        }
        /* End device tracking setup */

        /* Start window active tracking setup */
        window.isActive = true;

        $(window).focus(function() {
            AsyncClient.updateLastViewedAt();
            window.isActive = true;
        });

        $(window).blur(function() {
            window.isActive = false;
        });
        /* End window active tracking setup */

        /* Start global change listeners setup */
        SocketStore.addChangeListener(this._onSocketChange);
        /* End global change listeners setup */
    },
    _onSocketChange: function(msg) {
        if (msg && msg.user_id) {
            UserStore.setStatus(msg.user_id, 'online');
        }
    },
    render: function() {
        return <div/>;
    }
});
