// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act} from '@testing-library/react';

import {SESSION_ATTRIBUTES_GROUP_ID, SESSION_ATTRIBUTES_OBJECT_TYPE} from '@mattermost/types/properties_user';
import type {UserPropertyField} from '@mattermost/types/properties_user';

import {Client4} from 'mattermost-redux/client';

import {renderHookWithContext} from 'tests/react_testing_utils';

import {useSessionAttributeEdits} from './use_session_attribute_edits';
import type {SessionAttributeField} from './utils';

function makeField(name: string, extra: Record<string, unknown> = {}): SessionAttributeField {
    return {
        id: `field-${name}`,
        name,
        type: 'text',
        group_id: 'session_attributes',
        create_at: 1736541716295,
        update_at: 0,
        delete_at: 0,
        created_by: '',
        updated_by: '',
        target_id: '',
        target_type: 'system',
        object_type: 'session',
        attrs: {
            sort_order: 0,
            visibility: 'when_set',
            value_type: '',
            ...extra,
        },
    } as UserPropertyField;
}

const fieldA = makeField('ip_address', {enabled: true, ttl_seconds: 300, grace_period_seconds: 60});
const fieldB = makeField('vpn_active', {enabled: false, ttl_seconds: 30, grace_period_seconds: 30});
const serverFields = [fieldA, fieldB];

describe('useSessionAttributeEdits', () => {
    const patchPropertyField = jest.spyOn(Client4, 'patchPropertyField');

    beforeEach(() => {
        patchPropertyField.mockReset();
    });

    it('stages a change and flags hasChanges', () => {
        const {result} = renderHookWithContext(() => useSessionAttributeEdits(serverFields));

        act(() => result.current.stage(fieldA.id, {ttl_seconds: 3600}));

        expect(result.current.hasChanges).toBe(true);
    });

    it('self-clears when a staged value returns to the server value', () => {
        const {result} = renderHookWithContext(() => useSessionAttributeEdits(serverFields));

        act(() => result.current.stage(fieldA.id, {ttl_seconds: 3600}));
        expect(result.current.hasChanges).toBe(true);

        act(() => result.current.stage(fieldA.id, {ttl_seconds: 300}));
        expect(result.current.hasChanges).toBe(false);
    });

    it('merges pending attrs over the matching server field only', () => {
        const {result} = renderHookWithContext(() => useSessionAttributeEdits(serverFields));

        act(() => result.current.stage(fieldA.id, {ttl_seconds: 3600}));

        const mergedA = result.current.merged.find((f) => f.id === fieldA.id);
        const mergedB = result.current.merged.find((f) => f.id === fieldB.id);
        expect(mergedA?.attrs.ttl_seconds).toBe(3600);
        expect(mergedB?.attrs.ttl_seconds).toBe(30);
    });

    it('cancel reverts all pending edits', () => {
        const {result} = renderHookWithContext(() => useSessionAttributeEdits(serverFields));

        act(() => result.current.stage(fieldA.id, {ttl_seconds: 3600}));
        act(() => result.current.stage(fieldB.id, {enabled: true}));
        expect(result.current.hasChanges).toBe(true);

        act(() => result.current.cancel());
        expect(result.current.hasChanges).toBe(false);
        expect(result.current.merged.find((f) => f.id === fieldA.id)?.attrs.ttl_seconds).toBe(300);
    });

    it('patches once per changed field with only the changed keys', async () => {
        patchPropertyField.mockImplementation((_g, _o, fieldId) => Promise.resolve(makeField(fieldId)));

        const {result} = renderHookWithContext(() => useSessionAttributeEdits(serverFields));

        act(() => result.current.stage(fieldA.id, {ttl_seconds: 3600}));
        act(() => result.current.stage(fieldB.id, {enabled: true}));

        await act(async () => {
            await result.current.save();
        });

        expect(patchPropertyField).toHaveBeenCalledTimes(2);
        expect(patchPropertyField).toHaveBeenCalledWith(SESSION_ATTRIBUTES_GROUP_ID, SESSION_ATTRIBUTES_OBJECT_TYPE, fieldA.id, {attrs: {ttl_seconds: 3600}});
        expect(patchPropertyField).toHaveBeenCalledWith(SESSION_ATTRIBUTES_GROUP_ID, SESSION_ATTRIBUTES_OBJECT_TYPE, fieldB.id, {attrs: {enabled: true}});

        expect(result.current.hasChanges).toBe(false);
        expect(result.current.serverError).toBeNull();
    });

    it('keeps failed fields staged and surfaces an error on partial failure', async () => {
        patchPropertyField.mockImplementation((_g, _o, fieldId) => {
            if (fieldId === fieldB.id) {
                return Promise.reject(new Error('boom'));
            }
            return Promise.resolve(makeField(fieldId));
        });

        const {result} = renderHookWithContext(() => useSessionAttributeEdits(serverFields));

        act(() => result.current.stage(fieldA.id, {ttl_seconds: 3600}));
        act(() => result.current.stage(fieldB.id, {enabled: true}));

        await act(async () => {
            await result.current.save();
        });

        expect(result.current.serverError).toBe('error');
        expect(result.current.hasChanges).toBe(true);

        const stillStaged = result.current.merged.find((f) => f.id === fieldB.id);
        expect(stillStaged?.attrs.enabled).toBe(true);

        // The successful field cleared from pending, so its merged value falls back to the server value.
        const cleared = result.current.merged.find((f) => f.id === fieldA.id);
        expect(cleared?.attrs.ttl_seconds).toBe(300);
    });

    it('preserves an edit staged while a save is in flight', async () => {
        let resolvePatch: () => void = () => {};
        patchPropertyField.mockImplementation((_g, _o, fieldId) => new Promise((resolve) => {
            resolvePatch = () => resolve(makeField(fieldId));
        }));

        const {result} = renderHookWithContext(() => useSessionAttributeEdits(serverFields));

        act(() => result.current.stage(fieldA.id, {ttl_seconds: 3600}));

        let savePromise: Promise<void> = Promise.resolve();
        act(() => {
            savePromise = result.current.save();
        });

        // Stage a new edit mid-flight, before the PATCH resolves.
        act(() => result.current.stage(fieldB.id, {enabled: true}));

        await act(async () => {
            resolvePatch();
            await savePromise;
        });

        // The in-flight edit must survive the save-completion reconcile.
        expect(result.current.hasChanges).toBe(true);
        expect(result.current.merged.find((f) => f.id === fieldB.id)?.attrs.enabled).toBe(true);

        // The saved field cleared from pending.
        expect(result.current.merged.find((f) => f.id === fieldA.id)?.attrs.ttl_seconds).toBe(300);
    });
});
