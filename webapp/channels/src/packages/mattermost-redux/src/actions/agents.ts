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
