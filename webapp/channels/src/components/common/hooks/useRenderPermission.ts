// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useMemo} from 'react';
import {useSelector} from 'react-redux';

import type {RenderDecisionIdentifier, RenderPermissionEntry} from '@mattermost/types/render_permissions';

import {fetchRenderActionsForResourceBatched} from 'mattermost-redux/actions/render_permissions';
import {isPermissionPoliciesEnabled} from 'mattermost-redux/selectors/entities/general';
import {getRenderDecision} from 'mattermost-redux/selectors/entities/render_permissions';

import {makeUseEntity} from './useEntity';

// This layer must return the decision entry, never its boolean: useEntity treats a falsy entity as
// not-loaded, so a legitimate deny would refetch on every render forever.
const useRenderDecision = makeUseEntity<RenderPermissionEntry, RenderDecisionIdentifier>({
    name: 'useRenderDecision',
    fetch: fetchRenderActionsForResourceBatched,
    selector: getRenderDecision,
});

// useRenderPermission returns a non-authoritative, render-time ABAC decision for the current user
// on a resource/action, falling back to defaultAllowed while no decision is cached. Fetches are
// batched per resource and race-safe: each carries a monotonic generation and the reducer ignores
// stale completions (see actions/render_permissions). Server enforcement remains the source of
// truth — never gate a real action on this.
//
// defaultAllowed is required rather than defaulted: silently failing open on a permissions
// affordance is exactly the mistake worth making impossible.
export function useRenderPermission({resourceType, resourceId, action}: RenderDecisionIdentifier, defaultAllowed: boolean): boolean {
    const enabled = useSelector(isPermissionPoliciesEnabled);

    // A surface with no channel — the editor is exported to plugins, which can render it without
    // one — has no channel policy to apply, so there is nothing to fetch or to decide. useEntity
    // keys its fetch effect on the identifier, so it also has to be stable across renders.
    const identifier = useMemo(
        () => (enabled && resourceId ? {resourceType, resourceId, action} : undefined),
        [enabled, resourceType, resourceId, action],
    );

    // useEntity neither selects nor fetches for a falsy identifier, which is how the
    // nothing-to-decide case above stays a no-op.
    const decision = useRenderDecision(identifier as RenderDecisionIdentifier);

    if (!identifier || !decision?.evaluated) {
        return defaultAllowed;
    }

    return decision.allowed;
}
