// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {HealthFinding, HealthFindingFilter} from '@mattermost/types/health';

import {HealthTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import type {ActionFuncAsync} from 'mattermost-redux/types/actions';

import {bindClientFunc} from './helpers';

export function getHealthFindings(filter: HealthFindingFilter = {}): ActionFuncAsync<HealthFinding[]> {
    return bindClientFunc({
        clientFunc: Client4.getHealthFindings,
        onSuccess: HealthTypes.RECEIVED_HEALTH_FINDINGS,
        params: [filter],
    });
}
