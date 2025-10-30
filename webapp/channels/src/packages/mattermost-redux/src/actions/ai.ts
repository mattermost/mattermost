// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {AITypes} from '../action_types';
import {Client4} from '../client';
import type {ActionFunc} from '../types/actions';

export interface AIAgent {
    id: string;
    displayName: string;
    username: string;
    service_id: string;
    service_type: string;
}

export function getAIAgents(): ActionFunc<AIAgent[]> {
    return async (dispatch) => {
        dispatch({
            type: AITypes.AI_AGENTS_REQUEST,
        });

        try {
            const response = await Client4.getAIAgents();

            dispatch({
                type: AITypes.RECEIVED_AI_AGENTS,
                data: response.agents,
            });

            return {data: response.agents};
        } catch (error) {
            dispatch({
                type: AITypes.AI_AGENTS_FAILURE,
                error,
            });

            return {error: error as Error};
        }
    };
}

