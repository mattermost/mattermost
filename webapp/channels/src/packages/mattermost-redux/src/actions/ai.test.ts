// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getAIAgents} from './ai';

import {AITypes} from '../action_types';
import {Client4} from '../client';

jest.mock('../client');

describe('AI Actions', () => {
    const mockAgents = [
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

    let dispatch: jest.Mock;
    let getState: jest.Mock;

    beforeEach(() => {
        dispatch = jest.fn();
        getState = jest.fn();
        jest.clearAllMocks();
    });

    describe('getAIAgents', () => {
        test('should dispatch AI_AGENTS_REQUEST and RECEIVED_AI_AGENTS on success', async () => {
            const mockResponse = {agents: mockAgents};
            (Client4.getAIAgents as jest.Mock).mockResolvedValue(mockResponse);

            const action = getAIAgents();
            const result = await action(dispatch, getState, undefined);

            expect(dispatch).toHaveBeenCalledWith({
                type: AITypes.AI_AGENTS_REQUEST,
            });

            expect(dispatch).toHaveBeenCalledWith({
                type: AITypes.RECEIVED_AI_AGENTS,
                data: mockAgents,
            });

            expect(result).toEqual({data: mockAgents});
        });

        test('should dispatch AI_AGENTS_FAILURE on error', async () => {
            const error = new Error('Failed to fetch agents');
            (Client4.getAIAgents as jest.Mock).mockRejectedValue(error);

            const action = getAIAgents();
            const result = await action(dispatch, getState, undefined);

            expect(dispatch).toHaveBeenCalledWith({
                type: AITypes.AI_AGENTS_REQUEST,
            });

            expect(dispatch).toHaveBeenCalledWith({
                type: AITypes.AI_AGENTS_FAILURE,
                error,
            });

            expect(result).toEqual({error});
        });

        test('should call Client4.getAIAgents', async () => {
            const mockResponse = {agents: mockAgents};
            (Client4.getAIAgents as jest.Mock).mockResolvedValue(mockResponse);

            const action = getAIAgents();
            await action(dispatch, getState, undefined);

            expect(Client4.getAIAgents).toHaveBeenCalledTimes(1);
        });
    });
});

