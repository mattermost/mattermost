// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from '@mattermost/types/store';

import {getAIAgents, getAIAgent} from './ai';

import type {AIAgent} from '../../actions/ai';

describe('AI Selectors', () => {
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
        {
            id: 'bot3',
            displayName: 'Azure OpenAI',
            username: 'azureopenai',
            service_id: 'service3',
            service_type: 'azure',
        },
    ];

    const mockState: Partial<GlobalState> = {
        entities: {
            ai: {
                agents: mockAgents,
            },
        } as any,
    };

    describe('getAIAgents', () => {
        test('should return all AI agents', () => {
            const agents = getAIAgents(mockState as GlobalState);
            expect(agents).toEqual(mockAgents);
        });

        test('should return empty array when no agents exist', () => {
            const emptyState: Partial<GlobalState> = {
                entities: {
                    ai: {
                        agents: [],
                    },
                } as any,
            };

            const agents = getAIAgents(emptyState as GlobalState);
            expect(agents).toEqual([]);
        });

        test('should return empty array when ai state is undefined', () => {
            const undefinedState: Partial<GlobalState> = {
                entities: {
                    ai: undefined,
                } as any,
            };

            const agents = getAIAgents(undefinedState as GlobalState);
            expect(agents).toEqual([]);
        });
    });

    describe('getAIAgent', () => {
        test('should return the correct agent by id', () => {
            const agent = getAIAgent(mockState as GlobalState, 'bot2');
            expect(agent).toEqual(mockAgents[1]);
        });

        test('should return null when agent is not found', () => {
            const agent = getAIAgent(mockState as GlobalState, 'nonexistent-bot');
            expect(agent).toBeNull();
        });

        test('should return null when agents array is empty', () => {
            const emptyState: Partial<GlobalState> = {
                entities: {
                    ai: {
                        agents: [],
                    },
                } as any,
            };

            const agent = getAIAgent(emptyState as GlobalState, 'bot1');
            expect(agent).toBeNull();
        });
    });
});

