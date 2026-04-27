// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';

import type {PropertyField, PropertyValue} from '@mattermost/types/properties';

import * as Actions from 'mattermost-redux/actions/properties';
import {Client4} from 'mattermost-redux/client';
import {ChannelPostPropertyGroupName} from 'mattermost-redux/constants/properties';

import TestHelper from 'packages/mattermost-redux/test/test_helper';
import configureStore from 'packages/mattermost-redux/test/test_store';

const channelId = 'channel_id_xxxxxxxxxxxxxxxxxx';
const postId = 'post_id_xxxxxxxxxxxxxxxxxxxxxx';
const groupId = 'group_id_xxxxxxxxxxxxxxxxxxxxx';

const mockField = (overrides: Partial<PropertyField> = {}): PropertyField => ({
    id: overrides.id || 'field_id_xxxxxxxxxxxxxxxxxxxx',
    group_id: groupId,
    name: 'Status',
    type: 'text',
    target_id: channelId,
    target_type: 'channel',
    object_type: 'post',
    create_at: 1,
    update_at: 1,
    delete_at: 0,
    created_by: 'someone',
    updated_by: 'someone',
    ...overrides,
});

const mockValue = (overrides: Partial<PropertyValue<unknown>> = {}): PropertyValue<unknown> => ({
    id: overrides.id || 'value_id_xxxxxxxxxxxxxxxxxxxx',
    target_id: postId,
    target_type: 'post',
    group_id: groupId,
    field_id: 'field_id_xxxxxxxxxxxxxxxxxxxx',
    value: 'open',
    create_at: 1,
    update_at: 1,
    delete_at: 0,
    created_by: 'someone',
    updated_by: 'someone',
    ...overrides,
});

describe('Actions.properties', () => {
    beforeAll(() => {
        TestHelper.initBasic(Client4);
    });

    afterAll(() => {
        TestHelper.tearDown();
    });

    afterEach(() => {
        nock.cleanAll();
    });

    describe('loadChannelPostPropertyFields', () => {
        it('fetches with channel target scope, hydrates fields and group', async () => {
            const store = configureStore();
            const field = mockField();

            nock(Client4.getBaseRoute()).
                get(`/properties/groups/${ChannelPostPropertyGroupName}/post/fields`).
                query({target_type: 'channel', target_id: channelId}).
                reply(200, [field]);

            const result = await store.dispatch(Actions.loadChannelPostPropertyFields(channelId));
            expect(result.data).toEqual([field]);

            const state = store.getState();
            expect(state.entities.properties.fields.byId[field.id]).toEqual(field);
            expect(state.entities.properties.groups.byName[ChannelPostPropertyGroupName]).toEqual({
                id: groupId,
                name: ChannelPostPropertyGroupName,
            });
        });

        it('returns an empty array without registering a group', async () => {
            const store = configureStore();

            nock(Client4.getBaseRoute()).
                get(`/properties/groups/${ChannelPostPropertyGroupName}/post/fields`).
                query({target_type: 'channel', target_id: channelId}).
                reply(200, []);

            const result = await store.dispatch(Actions.loadChannelPostPropertyFields(channelId));
            expect(result.data).toEqual([]);

            const state = store.getState();
            expect(state.entities.properties.groups.byName[ChannelPostPropertyGroupName]).toBeUndefined();
        });
    });

    describe('loadPostPropertyValues', () => {
        it('hydrates values for the target post', async () => {
            const store = configureStore();
            const value = mockValue();

            nock(Client4.getBaseRoute()).
                get(`/properties/groups/${ChannelPostPropertyGroupName}/post/values/${postId}`).
                reply(200, [value]);

            const result = await store.dispatch(Actions.loadPostPropertyValues(postId));
            expect(result.data).toEqual([value]);
            expect(store.getState().entities.properties.values.byTargetId[postId][value.field_id]).toEqual(value);
        });
    });

    describe('createChannelPostPropertyField', () => {
        it('POSTs and merges the field into state with channel target', async () => {
            const store = configureStore();
            const created = mockField({name: 'Priority', type: 'select'});

            nock(Client4.getBaseRoute()).
                post(`/properties/groups/${ChannelPostPropertyGroupName}/post/fields`, (body: any) => {
                    return body.target_type === 'channel' &&
                        body.target_id === channelId &&
                        body.name === 'Priority';
                }).
                reply(201, created);

            const result = await store.dispatch(Actions.createChannelPostPropertyField(channelId, {
                name: 'Priority',
                type: 'select',
            }));
            expect(result.data).toEqual(created);
            expect(store.getState().entities.properties.fields.byId[created.id]).toEqual(created);
        });
    });

    describe('patchChannelPostPropertyField', () => {
        it('PATCHes and upserts the result', async () => {
            const store = configureStore();
            const updated = mockField({name: 'Renamed'});

            nock(Client4.getBaseRoute()).
                patch(`/properties/groups/${ChannelPostPropertyGroupName}/post/fields/${updated.id}`, {name: 'Renamed'}).
                reply(200, updated);

            const result = await store.dispatch(Actions.patchChannelPostPropertyField(updated.id, {name: 'Renamed'}));
            expect(result.data).toEqual(updated);
            expect(store.getState().entities.properties.fields.byId[updated.id].name).toBe('Renamed');
        });
    });

    describe('deleteChannelPostPropertyField', () => {
        it('DELETEs and removes the field from state', async () => {
            const store = configureStore();
            const existing = mockField();

            // Seed state with a field so we can verify the delete reducer runs.
            await store.dispatch({
                type: 'RECEIVED_PROPERTY_FIELDS',
                data: {fields: [existing]},
            });
            expect(store.getState().entities.properties.fields.byId[existing.id]).toBeDefined();

            nock(Client4.getBaseRoute()).
                delete(`/properties/groups/${ChannelPostPropertyGroupName}/post/fields/${existing.id}`).
                reply(200, {status: 'OK'});

            const result = await store.dispatch(Actions.deleteChannelPostPropertyField(existing.id));
            expect(result.data).toBe(true);
            expect(store.getState().entities.properties.fields.byId[existing.id]).toBeUndefined();
        });
    });

    describe('patchPostPropertyValues', () => {
        it('PATCHes and stores the returned values', async () => {
            const store = configureStore();
            const value = mockValue({value: 'in-progress'});
            const items = [{field_id: value.field_id, value: 'in-progress'}];

            nock(Client4.getBaseRoute()).
                patch(`/properties/groups/${ChannelPostPropertyGroupName}/post/values/${postId}`, items).
                reply(200, [value]);

            const result = await store.dispatch(Actions.patchPostPropertyValues(postId, items));
            expect(result.data).toEqual([value]);
            expect(store.getState().entities.properties.values.byTargetId[postId][value.field_id]).toEqual(value);
        });
    });
});
