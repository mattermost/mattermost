// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import UserStore from 'stores/user_store.jsx';

import Constants from 'utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;

import * as AsyncClient from 'utils/async_client.jsx';
import Client from 'client/web_client.jsx';
import AppDispatcher from 'dispatcher/app_dispatcher.jsx';

import {browserHistory} from 'react-router/es6';

export function checkIfTeamExists(teamName, onSuccess, onError) {
    Client.findTeamByName(teamName, onSuccess, onError);
}

export function createTeam(team, onSuccess, onError) {
    Client.createTeam(team,
        (rteam) => {
            AsyncClient.getDirectProfiles();

            AppDispatcher.handleServerAction({
                type: ActionTypes.CREATED_TEAM,
                team: rteam,
                member: {team_id: rteam.id, user_id: UserStore.getCurrentId(), roles: 'admin'}
            });

            browserHistory.push('/' + rteam.name + '/channels/town-square');

            if (onSuccess) {
                onSuccess(rteam);
            }
        },
        onError
    );
}
