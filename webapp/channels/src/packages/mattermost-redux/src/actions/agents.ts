// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {bindClientFunc} from './helpers';

import {AgentTypes} from '../action_types';
import {Client4} from '../client';

export function getAgents() {
    return bindClientFunc({
        clientFunc: Client4.getAgents,
        onSuccess: [AgentTypes.RECEIVED_AGENTS],
        onFailure: AgentTypes.AGENTS_FAILURE,
        onRequest: AgentTypes.AGENTS_REQUEST,
    });
}

export function getAgentsStatus() {
    return bindClientFunc({
        clientFunc: Client4.getAgentsStatus,
        onSuccess: [AgentTypes.RECEIVED_AGENTS_STATUS],
        onFailure: AgentTypes.AGENTS_STATUS_FAILURE,
        onRequest: AgentTypes.AGENTS_STATUS_REQUEST,
    });
}

export function getLLMServices() {
    return bindClientFunc({
        clientFunc: Client4.getLLMServices,
        onSuccess: [AgentTypes.RECEIVED_LLM_SERVICES],
        onFailure: AgentTypes.LLM_SERVICES_FAILURE,
        onRequest: AgentTypes.LLM_SERVICES_REQUEST,
    });
}
