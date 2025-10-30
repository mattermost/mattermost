// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import type {GenericAction} from 'mattermost-redux/types/actions';

import {AITypes} from '../../action_types';
import type {AIAgent} from '../../actions/ai';

export interface AIState {
    agents: AIAgent[];
}

function agents(state: AIAgent[] = [], action: GenericAction): AIAgent[] {
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

