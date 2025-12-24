// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import type {Agent, LLMService} from '@mattermost/types/agents';

import type {MMReduxAction} from 'mattermost-redux/action_types';

import {AgentTypes} from '../../action_types';

export interface AgentsState {
    agents: Agent[];
    agentsStatus: {available: boolean; reason?: string};
    llmServices: LLMService[];
}

function agents(state: Agent[] = [], action: MMReduxAction): Agent[] {
    switch (action.type) {
    case AgentTypes.RECEIVED_AGENTS:
        return action.data || [];
    case AgentTypes.AGENTS_FAILURE:
        return [];
    default:
        return state;
    }
}

function agentsStatus(state: {available: boolean; reason?: string} = {available: false}, action: MMReduxAction): {available: boolean; reason?: string} {
    switch (action.type) {
    case AgentTypes.RECEIVED_AGENTS_STATUS:
        return action.data || {available: false};
    case AgentTypes.AGENTS_STATUS_FAILURE:
        return {available: false};
    default:
        return state;
    }
}

function llmServices(state: LLMService[] = [], action: MMReduxAction): LLMService[] {
    switch (action.type) {
    case AgentTypes.RECEIVED_LLM_SERVICES:
        return action.data || [];
    case AgentTypes.LLM_SERVICES_FAILURE:
        return [];
    default:
        return state;
    }
}

export default combineReducers({
    agents,
    agentsStatus,
    llmServices,
});
