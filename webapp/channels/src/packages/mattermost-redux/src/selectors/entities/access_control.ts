// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from '@mattermost/types/store';

import { AccessControlPolicy } from "@mattermost/types/admin";

export function getAccessControlPolicies(state: GlobalState): AccessControlPolicy[] {
    return Array.isArray(state.entities.admin.accessControlPolicies) 
        ? state.entities.admin.accessControlPolicies 
        : [];
}

export function getAccessControlPolicy(state: GlobalState, id: string): AccessControlPolicy | undefined | null {
    const policies = getAccessControlPolicies(state);
    return policies.find((policy) => policy.id === id) || null;
}
