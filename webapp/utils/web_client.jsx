// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Client from '../client/client.jsx';
import {browserHistory} from 'react-router';
import TeamStore from '../stores/team_store.jsx';

const HTTP_UNAUTHORIZED = 401;

class WebClientClass extends Client {
    constructor() {
        super();
        this.logErrorsToConsole();
        TeamStore.addChangeListener(this.onTeamStoreChanged);
    }

    onTeamStoreChanged = () => {
        this.setTeamId(TeamStore.getCurrentId());
    }

    track = (category, action, label, property, value) => {
        if (global.window && global.window.analytics) {
            global.window.analytics.track(action, {category, label, property, value});
        }
    }

    trackPage = () => {
        if (global.window && global.window.analytics) {
            global.window.analytics.page();
        }
    }

    handleError = (err, res) => {
        if (err.status === HTTP_UNAUTHORIZED) {
            const team = window.location.pathname.split('/')[1];
            browserHistory.push('/' + team + '/login?extra=expired');
        }
    }
}

var WebClient = new WebClientClass();
export default WebClient;
