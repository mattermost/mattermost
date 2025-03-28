// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from '@mattermost/types/store';

import { AccessControlPolicy } from "@mattermost/types/admin";

export function getAccessControlPolicies(state: GlobalState): AccessControlPolicy[] {
    return state.entities.admin.accessControlPolicies;
}

export function getAccessControlPolicy(state: GlobalState, id: string): AccessControlPolicy | undefined | null {
    const policy = getAccessControlPolicies(state);
    return policy.find((policy) => policy.id === id) || null;
}
