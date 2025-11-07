// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import type {Agent} from '@mattermost/types/agents';

import type {MMReduxAction} from 'mattermost-redux/action_types';

import {AgentTypes} from '../../action_types';

export interface AgentsState {
    agents: Agent[];
}

function agents(state: Agent[] = [], action: MMReduxAction): Agent[] {
    switch (action.type) {
    case AgentTypes.RECEIVED_AGENTS:
        return action.data || [];
    default:
        return state;
    }
}

export default combineReducers({
    agents,
});
