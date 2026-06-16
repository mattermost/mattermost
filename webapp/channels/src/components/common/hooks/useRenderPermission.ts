// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {GlobalState} from '@mattermost/types/store';

import {fetchRenderActionsForResource} from 'mattermost-redux/actions/render_permissions';
import {isPermissionPoliciesEnabled} from 'mattermost-redux/selectors/entities/general';
import {getRenderDecision} from 'mattermost-redux/selectors/entities/render_permissions';

type Args = {
    resourceType: string;
    resourceId: string;
    action: string;
};

export type RenderPermissionResult = {
    allowed: boolean | undefined;
    evaluated: boolean;
    loading: boolean;
    reason?: string;
};

// useRenderPermission returns a non-authoritative, render-time ABAC decision for
// the current user on a resource/action. It fetches lazily on cache miss and is
// race-safe by construction: each fetch carries a monotonic generation, and the
// reducer ignores stale completions (see actions/render_permissions). Server
// enforcement remains the source of truth — never gate a real action on this.
//
// When permission policies are not enabled, it returns allowed/evaluated so
// consumers can use a single rendering path.
export function useRenderPermission({resourceType, resourceId, action}: Args): RenderPermissionResult {
    const dispatch = useDispatch();
    const enabled = useSelector(isPermissionPoliciesEnabled);
    const decision = useSelector((state: GlobalState) => getRenderDecision(state, resourceType, resourceId, action));

    const missing = decision === undefined;

    useEffect(() => {
        if (enabled && resourceId && missing) {
            dispatch(fetchRenderActionsForResource(resourceType, resourceId, [action]));
        }
    }, [dispatch, enabled, resourceType, resourceId, action, missing]);

    if (!enabled) {
        return {allowed: true, evaluated: true, loading: false};
    }

    return {
        allowed: decision?.allowed,
        evaluated: decision?.evaluated ?? false,
        loading: Boolean(resourceId) && missing,
        reason: decision?.reason,
    };
}
