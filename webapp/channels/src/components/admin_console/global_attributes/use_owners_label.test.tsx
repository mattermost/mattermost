// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyFieldOwner} from '@mattermost/types/properties_user';

import {renderHookWithContext} from 'tests/react_testing_utils';

import {getFieldOwners, useOwnersLabel} from './use_owners_label';

const owner = (id: string, type: PropertyFieldOwner['type'] = 'plugin'): PropertyFieldOwner => ({id, type, scopes: []});

describe('useOwnersLabel', () => {
    const label = (owners: PropertyFieldOwner[], state = {}) => {
        return renderHookWithContext(() => useOwnersLabel(owners), state).result.current;
    };

    it('uses the webapp manifest name for a plugin owner', () => {
        const state = {plugins: {plugins: {scim: {name: 'SCIM'}}}};
        expect(label([owner('scim')], state)).toBe('SCIM');
    });

    it('uses the admin plugin status name for a server-only plugin owner', () => {
        const state = {entities: {admin: {pluginStatuses: {scim: {name: 'SCIM Sync'}}}}};
        expect(label([owner('scim')], state)).toBe('SCIM Sync');
    });

    it('falls back to the plugin ID when no name is known', () => {
        expect(label([owner('scim')])).toBe('scim');
    });

    it.each(['service', 'role', 'user'] as const)('uses the ID of a %s owner', (type) => {
        expect(label([owner('svc-sync', type)])).toBe('svc-sync');
    });

    it('lists every owner in stored order', () => {
        const state = {plugins: {plugins: {scim: {name: 'SCIM'}}}};
        expect(label([owner('scim'), owner('svc-sync', 'service')], state)).toBe('SCIM and svc-sync');
    });

    it('is empty without owners', () => {
        expect(label([])).toBe('');
    });
});

describe('getFieldOwners', () => {
    it('returns an empty list when attrs or owners are missing or empty', () => {
        expect(getFieldOwners({attrs: undefined})).toEqual([]);
        expect(getFieldOwners({attrs: {}})).toEqual([]);
        expect(getFieldOwners({attrs: {owners: []}})).toEqual([]);
    });

    it('returns the same empty array each time', () => {
        expect(getFieldOwners({attrs: {}})).toBe(getFieldOwners({attrs: {owners: []}}));
    });

    it('returns the owners when present', () => {
        const owners = [owner('scim')];
        expect(getFieldOwners({attrs: {owners}})).toBe(owners);
    });
});
