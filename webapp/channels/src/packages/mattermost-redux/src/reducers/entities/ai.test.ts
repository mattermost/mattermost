// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {AITypes} from '../../action_types';

import aiReducer from './ai';

import type {AIAgent} from '../../actions/ai';

describe('AI Reducer', () => {
    const mockAgents: AIAgent[] = [
        {
            id: 'bot1',
            displayName: 'Copilot',
            username: 'copilot',
            service_id: 'service1',
            service_type: 'copilot',
        },
        {
            id: 'bot2',
            displayName: 'OpenAI',
            username: 'openai',
            service_id: 'service2',
            service_type: 'openai',
        },
    ];

    test('should return the initial state', () => {
        const initialState = aiReducer(undefined, {type: 'INIT'});
        expect(initialState).toEqual({
            agents: [],
        });
    });

    test('should handle RECEIVED_AI_AGENTS', () => {
        const state = aiReducer(undefined, {
            type: AITypes.RECEIVED_AI_AGENTS,
            data: mockAgents,
        });

        expect(state.agents).toEqual(mockAgents);
    });

    test('should replace existing agents with new agents on RECEIVED_AI_AGENTS', () => {
        const initialState = {
            agents: [
                {
                    id: 'old-bot',
                    displayName: 'Old Bot',
                    username: 'oldbot',
                    service_id: 'old-service',
                    service_type: 'old',
                },
            ],
        };

        const state = aiReducer(initialState, {
            type: AITypes.RECEIVED_AI_AGENTS,
            data: mockAgents,
        });

        expect(state.agents).toEqual(mockAgents);
        expect(state.agents).not.toContain(initialState.agents[0]);
    });

    test('should not modify state for unknown action types', () => {
        const initialState = {
            agents: mockAgents,
        };

        const state = aiReducer(initialState, {
            type: 'UNKNOWN_ACTION',
        });

        expect(state).toEqual(initialState);
    });
});

