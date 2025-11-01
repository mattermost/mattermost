// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import type {MMReduxAction} from 'mattermost-redux/action_types';

import {AITypes} from '../../action_types';
import type {AIAgent} from '../../actions/ai';

export interface AIState {
    agents: AIAgent[];
}

function agents(state: AIAgent[] = [], action: MMReduxAction): AIAgent[] {
    switch (action.type) {
    case AITypes.RECEIVED_AI_AGENTS:
        return action.data;
    default:
        return state;
    }
}

export default combineReducers({
    agents,
});

