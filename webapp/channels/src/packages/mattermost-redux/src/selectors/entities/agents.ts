// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Agent} from '@mattermost/types/agents';
import type {GlobalState} from '@mattermost/types/store';

export function getAgents(state: GlobalState): Agent[] {
    return state.entities.agents?.agents;
}

export function getAgent(state: GlobalState, agentId: string): Agent | undefined {
    const agents = getAgents(state);
    return agents.find((agent) => agent.id === agentId);
}
