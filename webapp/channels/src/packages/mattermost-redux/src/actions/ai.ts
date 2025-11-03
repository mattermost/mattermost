// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {bindClientFunc} from './helpers';

import {AITypes} from '../action_types';
import {Client4} from '../client';

export function getAIAgents() {
    return bindClientFunc({
        clientFunc: Client4.getAIAgents,
        onSuccess: [AITypes.RECEIVED_AI_AGENTS],
        onFailure: AITypes.AI_AGENTS_FAILURE,
        onRequest: AITypes.AI_AGENTS_REQUEST,
    });
}
