// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from '@mattermost/types/store';

import type {AIAgent} from '../../actions/ai';

export function getAIAgents(state: GlobalState): AIAgent[] {
    return state.entities.ai.agents || [];
}

export function getAIAgent(state: GlobalState, agentId: string): AIAgent | null {
    const agents = getAIAgents(state);
    return agents.find((agent) => agent.id === agentId) || null;
}

