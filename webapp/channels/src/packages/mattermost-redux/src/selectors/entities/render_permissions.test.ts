// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from '@mattermost/types/store';

import {
    canReadDmGm,
    canStartDmGm,
    canWriteDmGm,
    hasDeniedSessionDecision,
    isDmGmReadDenied,
    isDmGmStartDenied,
    isDmGmWriteDenied,
} from './render_permissions';

describe('Selectors.RenderPermissions DM/GM session decisions', () => {
    function makeState(decisions: Record<string, {allowed: boolean; evaluated: boolean}>, permissionPolicies = 'true') {
        const entries = Object.fromEntries(Object.entries(decisions).map(([action, decision]) => [action, {...decision, generation: 1}]));

        return {
            entities: {
                general: {config: {FeatureFlagPermissionPolicies: permissionPolicies}},
                renderPermissions: {
                    byResource: {permission: {'': entries}},
                    invalidatedAt: 0,
                    invalidatedAtByResource: {},
                },
            },
        } as unknown as GlobalState;
    }

    const denied = {allowed: false, evaluated: true};
    const allowed = {allowed: true, evaluated: true};

    it('treats unknown decisions as allowed', () => {
        const state = makeState({});

        expect(isDmGmStartDenied(state)).toBe(false);
        expect(isDmGmReadDenied(state)).toBe(false);
        expect(isDmGmWriteDenied(state)).toBe(false);
        expect(canStartDmGm(state)).toBe(true);
        expect(canReadDmGm(state)).toBe(true);
        expect(canWriteDmGm(state)).toBe(true);
        expect(hasDeniedSessionDecision(state)).toBe(false);
    });

    it('reports each denial on its own', () => {
        const state = makeState({dm_gm_write_access: denied, dm_gm_read_access: allowed});

        expect(isDmGmWriteDenied(state)).toBe(true);
        expect(canWriteDmGm(state)).toBe(false);
        expect(canReadDmGm(state)).toBe(true);
        expect(isDmGmStartDenied(state)).toBe(false);
        expect(hasDeniedSessionDecision(state)).toBe(true);
    });

    it('treats denials as allowed while permission policies are off', () => {
        const state = makeState({dm_gm_start: denied, dm_gm_read_access: denied, dm_gm_write_access: denied}, 'false');

        expect(canStartDmGm(state)).toBe(true);
        expect(canReadDmGm(state)).toBe(true);
        expect(canWriteDmGm(state)).toBe(true);
        expect(hasDeniedSessionDecision(state)).toBe(false);
    });

    it('allows starting a conversation only when Start and Read are both allowed', () => {
        expect(canStartDmGm(makeState({dm_gm_start: allowed, dm_gm_read_access: allowed}))).toBe(true);
        expect(canStartDmGm(makeState({dm_gm_start: denied, dm_gm_read_access: allowed}))).toBe(false);
        expect(canStartDmGm(makeState({dm_gm_start: allowed, dm_gm_read_access: denied}))).toBe(false);
    });
});
