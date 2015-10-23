// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var ChannelStore = require('../stores/channel_store.jsx');
var TeamStore = require('../stores/team_store.jsx');
var Constants = require('../utils/constants.jsx');

function setupHomePage() {
    var last = ChannelStore.getLastVisitedName();
    if (last == null || last.length === 0) {
        window.location = TeamStore.getCurrentTeamUrl() + '/channels/' + Constants.DEFAULT_CHANNEL;
    } else {
        window.location = TeamStore.getCurrentTeamUrl() + '/channels/' + last;
    }
}

global.window.setup_home_page = setupHomePage;
