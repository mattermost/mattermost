// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AIAgent} from '@mattermost/types/ai';
import type {GlobalState} from '@mattermost/types/store';

export function getAIAgents(state: GlobalState): AIAgent[] {
    return state.entities.ai?.agents;
}

export function getAIAgent(state: GlobalState, agentId: string): AIAgent | undefined {
    const agents = getAIAgents(state);
    return agents.find((agent) => agent.id === agentId);
}
