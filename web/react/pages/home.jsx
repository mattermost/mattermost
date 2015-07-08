// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var ChannelStore = require('../stores/channel_store.jsx');
var TeamStore = require('../stores/team_store.jsx');
var Constants = require('../utils/constants.jsx');

global.window.setup_home_page = function(teamURL) {
    var last = ChannelStore.getLastVisitedName();
    if (last == null || last.length === 0) {
        window.location = teamURL + "/channels/" + Constants.DEFAULT_CHANNEL;
    } else {
        window.location = teamURL + "/channels/" + last;
    }
}
