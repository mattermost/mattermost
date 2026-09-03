// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';

import type {PropertyField} from '@mattermost/types/properties';
import type {GlobalState} from '@mattermost/types/store';

import {fetchPropertyFields, patchPropertyField} from 'mattermost-redux/actions/properties';
import {Client4} from 'mattermost-redux/client';

import TestHelper from 'packages/mattermost-redux/test/test_helper';
import configureStore from 'packages/mattermost-redux/test/test_store';

const GROUP = 'session_attributes';
const OBJECT_TYPE = 'session';

function makeField(id: string, attrs: Record<string, unknown>): PropertyField {
    return {
        id,
        name: id,
        type: 'text',
        group_id: GROUP,
        create_at: 1736541716295,
        update_at: 0,
        delete_at: 0,
        object_type: OBJECT_TYPE,
        attrs,
    } as unknown as PropertyField;
}

describe('Actions.patchPropertyField', () => {
    const store = configureStore();

    beforeAll(() => {
        TestHelper.initBasic(Client4);
    });

    afterAll(() => {
        TestHelper.tearDown();
    });

    it('patches the field and upserts the response into the store', async () => {
        const updated = makeField('field-1', {enabled: true, ttl_seconds: 3600, grace_period_seconds: 60});

        nock(Client4.getBaseRoute()).
            patch(`/properties/groups/${GROUP}/${OBJECT_TYPE}/fields/field-1`).
            reply(200, updated);

        const result = await store.dispatch(patchPropertyField(GROUP, OBJECT_TYPE, 'field-1', {attrs: {ttl_seconds: 3600}}));

        expect(result.data).toEqual(updated);

        const state = store.getState() as GlobalState;
        expect(state.entities.properties.fields.byId['field-1']).toEqual(updated);
    });

    it('returns an error and does not upsert when the patch fails', async () => {
        nock(Client4.getBaseRoute()).
            patch(`/properties/groups/${GROUP}/${OBJECT_TYPE}/fields/field-missing`).
            reply(403, {message: 'forbidden'});

        const result = await store.dispatch(patchPropertyField(GROUP, OBJECT_TYPE, 'field-missing', {attrs: {enabled: false}}));

        expect(result.error).toBeDefined();

        const state = store.getState() as GlobalState;
        expect(state.entities.properties.fields.byId['field-missing']).toBeUndefined();
    });
});

describe('Actions.fetchPropertyFields', () => {
    const TARGET_TYPE = 'system';

    // The server keys fields under a real group UUID that differs from the group
    // NAME the caller passes; the action exposes the name -> group mapping so
    // consumers can resolve that id.
    const GROUP_UUID = 'realgroupuuid000000000001x';

    const getPropertyFields = jest.spyOn(Client4, 'getPropertyFields');

    beforeEach(() => {
        getPropertyFields.mockReset();
    });

    afterAll(() => {
        getPropertyFields.mockRestore();
    });

    it('dispatches the group name -> uuid mapping keyed off the fetched fields', async () => {
        const store = configureStore();
        const field = makeField('field-1', {enabled: true});
        field.group_id = GROUP_UUID;

        getPropertyFields.mockResolvedValueOnce([field]).mockResolvedValue([]);

        const result = await store.dispatch(fetchPropertyFields(GROUP, OBJECT_TYPE, TARGET_TYPE));

        expect(result.data).toEqual([field]);

        const state = store.getState() as GlobalState;
        expect(state.entities.properties.groups.byName[GROUP]).toEqual({id: GROUP_UUID, name: GROUP});
        expect(state.entities.properties.groups.byId[GROUP_UUID]).toEqual({id: GROUP_UUID, name: GROUP});
    });

    it('does not dispatch a group mapping when no fields are returned', async () => {
        const store = configureStore();
        getPropertyFields.mockResolvedValue([]);

        await store.dispatch(fetchPropertyFields(GROUP, OBJECT_TYPE, TARGET_TYPE));

        const state = store.getState() as GlobalState;
        expect(state.entities.properties.groups.byName[GROUP]).toBeUndefined();
    });

    it('clears a previously-cached scope when a subsequent fetch returns nothing', async () => {
        const store = configureStore();
        const field = makeField('field-1', {enabled: true});
        field.group_id = GROUP_UUID;

        getPropertyFields.mockResolvedValueOnce([field]).mockResolvedValueOnce([]);
        await store.dispatch(fetchPropertyFields(GROUP, OBJECT_TYPE, TARGET_TYPE));

        let state = store.getState() as GlobalState;
        expect(state.entities.properties.fields.byObjectType[OBJECT_TYPE]?.[GROUP_UUID]?.['field-1']).toEqual(field);

        // The field was deleted server-side; a directory-mode refetch no longer returns it.
        getPropertyFields.mockResolvedValue([]);
        await store.dispatch(fetchPropertyFields(GROUP, OBJECT_TYPE, TARGET_TYPE));

        state = store.getState() as GlobalState;
        expect(state.entities.properties.fields.byObjectType[OBJECT_TYPE]?.[GROUP_UUID]).toBeUndefined();
        expect(state.entities.properties.fields.byId['field-1']).toBeUndefined();
    });

    it('ignores a stale scope-replace dispatch from an older, out-of-order fetch', async () => {
        const store = configureStore();
        const field = makeField('field-1', {enabled: true});
        field.group_id = GROUP_UUID;

        // Seed the store as if an earlier fetch already cached this field for the scope.
        getPropertyFields.mockResolvedValueOnce([field]).mockResolvedValueOnce([]);
        await store.dispatch(fetchPropertyFields(GROUP, OBJECT_TYPE, TARGET_TYPE));

        let resolveOlderPage: (fields: PropertyField[]) => void = () => {};

        getPropertyFields.
            mockImplementationOnce(() => new Promise((resolve) => {
                resolveOlderPage = resolve;
            })).
            mockResolvedValueOnce([]). // newer fetch's only page: the field is gone
            mockResolvedValueOnce([]); // older fetch's terminating (empty) page

        // Start an older fetch (still in flight) before a newer one for the same scope.
        const olderFetch = store.dispatch(fetchPropertyFields(GROUP, OBJECT_TYPE, TARGET_TYPE));
        const newerFetch = store.dispatch(fetchPropertyFields(GROUP, OBJECT_TYPE, TARGET_TYPE));

        // The newer fetch resolves first, discovering the field was deleted server-side.
        await newerFetch;

        let state = store.getState() as GlobalState;
        expect(state.entities.properties.fields.byObjectType[OBJECT_TYPE]?.[GROUP_UUID]).toBeUndefined();

        // The older fetch resolves after, with its stale (pre-deletion) result. Its
        // scope-replace must be ignored, not resurrect the field the newer fetch cleared.
        resolveOlderPage([field]);
        await olderFetch;

        state = store.getState() as GlobalState;
        expect(state.entities.properties.fields.byObjectType[OBJECT_TYPE]?.[GROUP_UUID]).toBeUndefined();
    });
});
