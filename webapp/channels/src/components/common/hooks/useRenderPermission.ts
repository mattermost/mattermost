// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useMemo} from 'react';
import {useSelector} from 'react-redux';

import type {RenderDecisionIdentifier, RenderPermissionEntry} from '@mattermost/types/render_permissions';

import {fetchRenderActionsForResourceBatched} from 'mattermost-redux/actions/render_permissions';
import {isPermissionPoliciesEnabled} from 'mattermost-redux/selectors/entities/general';
import {getRenderDecision} from 'mattermost-redux/selectors/entities/render_permissions';

import {makeUseEntity} from './useEntity';

// Returns the entry, never its boolean: useEntity reads a falsy entity as not-loaded, so a deny
// would refetch on every render forever.
const useRenderDecision = makeUseEntity<RenderPermissionEntry, RenderDecisionIdentifier>({
    name: 'useRenderDecision',
    fetch: fetchRenderActionsForResourceBatched,
    selector: getRenderDecision,
});

// Advisory only — the server re-evaluates on every request, so never gate a real action on this.
//
// defaultAllowed is required rather than defaulted: silently failing open on a permissions
// affordance is the mistake worth making impossible.
export function useRenderPermission({resourceType, resourceId, action}: RenderDecisionIdentifier, defaultAllowed: boolean): boolean {
    const enabled = useSelector(isPermissionPoliciesEnabled);

    // Undefined identifier means nothing to decide, and useEntity then neither selects nor fetches.
    // A channel-less surface is real: the editor is exported to plugins, which can render it
    // without one. Memoized because useEntity keys its fetch effect on the identifier.
    const identifier = useMemo(
        () => (enabled && resourceId ? {resourceType, resourceId, action} : undefined),
        [enabled, resourceType, resourceId, action],
    );

    const decision = useRenderDecision(identifier as RenderDecisionIdentifier);

    if (!identifier || !decision?.evaluated) {
        return defaultAllowed;
    }

    return decision.allowed;
}
