// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {browserHistory} from 'react-router';

import TeamStore from 'stores/team_store.jsx';
import Client from 'utils/web_client.jsx';

export function goToChannel(channel) {
    browserHistory.push(TeamStore.getCurrentTeamRelativeUrl() + '/channels/' + channel.name);
}

export function executeCommand(channelId, message, suggest, success, error) {
    Client.executeCommand(channelId, message, suggest, success, error);
}
