// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField, PropertyValue} from '@mattermost/types/properties';

import {PropertyTypes, UserTypes} from 'mattermost-redux/action_types';

import propertiesReducer from './properties';

function makeField(overrides: Partial<PropertyField> = {}): PropertyField {
    return {
        id: 'field-1',
        group_id: 'group-1',
        name: 'test',
        type: 'text',
        target_id: '',
        target_type: '',
        object_type: 'post',
        create_at: 1000,
        update_at: 1000,
        delete_at: 0,
        created_by: 'user-1',
        updated_by: 'user-1',
        ...overrides,
    };
}

function makeValue(overrides: Partial<PropertyValue<unknown>> = {}): PropertyValue<unknown> {
    return {
        id: 'value-1',
        target_id: 'target-1',
        target_type: 'post',
        group_id: 'group-1',
        field_id: 'field-1',
        value: 'test',
        create_at: 1000,
        update_at: 1000,
        delete_at: 0,
        created_by: 'user-1',
        updated_by: 'user-1',
        ...overrides,
    };
}

describe('propertiesReducer', () => {
    const initialState = propertiesReducer(undefined, {type: 'INIT'});

    describe('fieldsReducer', () => {
        test('RECEIVED_PROPERTY_FIELDS merges fields into correct byObjectType buckets and byId', () => {
            const field1 = makeField({id: 'f1', object_type: 'post', group_id: 'g1'});
            const field2 = makeField({id: 'f2', object_type: 'post', group_id: 'g1'});

            const state = propertiesReducer(initialState, {
                type: PropertyTypes.RECEIVED_PROPERTY_FIELDS,
                data: {fields: [field1, field2]},
            });

            expect(state.fields.byObjectType.post.g1.f1).toBe(field1);
            expect(state.fields.byObjectType.post.g1.f2).toBe(field2);
            expect(state.fields.byId.f1).toBe(field1);
            expect(state.fields.byId.f2).toBe(field2);
        });

        test('RECEIVED_PROPERTY_FIELDS does not affect other objectType/groupId combinations', () => {
            const existingField = makeField({id: 'f0', object_type: 'user', group_id: 'g0'});
            const stateWithExisting = propertiesReducer(initialState, {
                type: PropertyTypes.RECEIVED_PROPERTY_FIELDS,
                data: {fields: [existingField]},
            });

            const newField = makeField({id: 'f1', object_type: 'post', group_id: 'g1'});
            const state = propertiesReducer(stateWithExisting, {
                type: PropertyTypes.RECEIVED_PROPERTY_FIELDS,
                data: {fields: [newField]},
            });

            expect(state.fields.byObjectType.user.g0.f0).toBe(existingField);
            expect(state.fields.byObjectType.post.g1.f1).toBe(newField);
        });

        test('RECEIVED_PROPERTY_FIELDS merges with existing fields (does not replace)', () => {
            const field1 = makeField({id: 'f1', object_type: 'post', group_id: 'g1'});
            const state1 = propertiesReducer(initialState, {
                type: PropertyTypes.RECEIVED_PROPERTY_FIELDS,
                data: {fields: [field1]},
            });

            const field2 = makeField({id: 'f2', object_type: 'post', group_id: 'g1'});
            const state2 = propertiesReducer(state1, {
                type: PropertyTypes.RECEIVED_PROPERTY_FIELDS,
                data: {fields: [field2]},
            });

            expect(state2.fields.byObjectType.post.g1.f1).toBe(field1);
            expect(state2.fields.byObjectType.post.g1.f2).toBe(field2);
        });

        test('RECEIVED_PROPERTY_FIELDS skips PSA v1 fields but keeps valid ones', () => {
            const validField = makeField({id: 'f1', object_type: 'post'});
            const v1Field = makeField({id: 'f2', object_type: ''});

            const state = propertiesReducer(initialState, {
                type: PropertyTypes.RECEIVED_PROPERTY_FIELDS,
                data: {fields: [validField, v1Field]},
            });

            expect(state.fields.byId.f1).toBe(validField);
            expect(state.fields.byId.f2).toBeUndefined();
        });

        test('RECEIVED_PROPERTY_FIELDS skips soft-deleted fields but keeps valid ones', () => {
            const validField = makeField({id: 'f1', object_type: 'post'});
            const deletedField = makeField({id: 'f2', object_type: 'post', delete_at: 999});

            const state = propertiesReducer(initialState, {
                type: PropertyTypes.RECEIVED_PROPERTY_FIELDS,
                data: {fields: [validField, deletedField]},
            });

            expect(state.fields.byId.f1).toBe(validField);
            expect(state.fields.byId.f2).toBeUndefined();
        });

        test('RECEIVED_PROPERTY_FIELDS returns same state ref when all fields are invalid', () => {
            const v1Field = makeField({id: 'f1', object_type: ''});

            const state = propertiesReducer(initialState, {
                type: PropertyTypes.RECEIVED_PROPERTY_FIELDS,
                data: {fields: [v1Field]},
            });

            expect(state.fields).toBe(initialState.fields);
        });

        test('RECEIVED_PROPERTY_FIELDS for brand-new objectType creates nested structure', () => {
            const field = makeField({id: 'f1', object_type: 'channel', group_id: 'g1'});
            const state = propertiesReducer(initialState, {
                type: PropertyTypes.RECEIVED_PROPERTY_FIELDS,
                data: {fields: [field]},
            });

            expect(state.fields.byObjectType.channel).toBeDefined();
            expect(state.fields.byObjectType.channel.g1.f1).toBe(field);
        });

        test('RECEIVED_PROPERTY_FIELDS for existing objectType but new groupId creates group bucket', () => {
            const field1 = makeField({id: 'f1', object_type: 'post', group_id: 'g1'});
            const state1 = propertiesReducer(initialState, {
                type: PropertyTypes.RECEIVED_PROPERTY_FIELDS,
                data: {fields: [field1]},
            });

            const field2 = makeField({id: 'f2', object_type: 'post', group_id: 'g2'});
            const state2 = propertiesReducer(state1, {
                type: PropertyTypes.RECEIVED_PROPERTY_FIELDS,
                data: {fields: [field2]},
            });

            expect(state2.fields.byObjectType.post.g1.f1).toBe(field1);
            expect(state2.fields.byObjectType.post.g2.f2).toBe(field2);
        });

        test('RECEIVED_PROPERTY_FIELDS returns same state ref when fields array is empty', () => {
            const state = propertiesReducer(initialState, {
                type: PropertyTypes.RECEIVED_PROPERTY_FIELDS,
                data: {fields: []},
            });

            expect(state.fields).toBe(initialState.fields);
        });

        test('RECEIVED_PROPERTY_FIELDS with single field adds it to correct byObjectType bucket and byId', () => {
            const field = makeField({id: 'f1', object_type: 'post', group_id: 'g1'});
            const state = propertiesReducer(initialState, {
                type: PropertyTypes.RECEIVED_PROPERTY_FIELDS,
                data: {fields: [field]},
            });

            expect(state.fields.byObjectType.post.g1.f1).toBe(field);
            expect(state.fields.byId.f1).toBe(field);
        });

        test('RECEIVED_PROPERTY_FIELDS updates an existing field in both indices', () => {
            const field = makeField({id: 'f1', object_type: 'post', group_id: 'g1', name: 'original'});
            const state1 = propertiesReducer(initialState, {
                type: PropertyTypes.RECEIVED_PROPERTY_FIELDS,
                data: {fields: [field]},
            });

            const updatedField = makeField({id: 'f1', object_type: 'post', group_id: 'g1', name: 'updated'});
            const state2 = propertiesReducer(state1, {
                type: PropertyTypes.RECEIVED_PROPERTY_FIELDS,
                data: {fields: [updatedField]},
            });

            expect(state2.fields.byObjectType.post.g1.f1.name).toBe('updated');
            expect(state2.fields.byId.f1.name).toBe('updated');
        });

        test('RECEIVED_PROPERTY_FIELDS creates nested structure when objectType/groupId do not exist yet', () => {
            const field = makeField({id: 'f1', object_type: 'channel', group_id: 'gx'});
            const state = propertiesReducer(initialState, {
                type: PropertyTypes.RECEIVED_PROPERTY_FIELDS,
                data: {fields: [field]},
            });

            expect(state.fields.byObjectType.channel.gx.f1).toBe(field);
        });

        test('PROPERTY_FIELD_DELETED removes field from both byObjectType and byId', () => {
            const field = makeField({id: 'f1', object_type: 'post', group_id: 'g1'});
            const state1 = propertiesReducer(initialState, {
                type: PropertyTypes.RECEIVED_PROPERTY_FIELDS,
                data: {fields: [field]},
            });

            const state2 = propertiesReducer(state1, {
                type: PropertyTypes.PROPERTY_FIELD_DELETED,
                data: {fieldId: 'f1'},
            });

            expect(state2.fields.byId.f1).toBeUndefined();
            expect(state2.fields.byObjectType.post).toBeUndefined();
        });

        test('PROPERTY_FIELD_DELETED cleans up empty group bucket and empty objectType bucket', () => {
            const field1 = makeField({id: 'f1', object_type: 'post', group_id: 'g1'});
            const field2 = makeField({id: 'f2', object_type: 'post', group_id: 'g2'});
            const state1 = propertiesReducer(initialState, {
                type: PropertyTypes.RECEIVED_PROPERTY_FIELDS,
                data: {fields: [field1, field2]},
            });

            // Delete field from g1 — should remove g1 but keep g2
            const state2 = propertiesReducer(state1, {
                type: PropertyTypes.PROPERTY_FIELD_DELETED,
                data: {fieldId: 'f1'},
            });

            expect(state2.fields.byObjectType.post.g1).toBeUndefined();
            expect(state2.fields.byObjectType.post.g2.f2).toBe(field2);

            // Delete field from g2 — should remove entire post objectType
            const state3 = propertiesReducer(state2, {
                type: PropertyTypes.PROPERTY_FIELD_DELETED,
                data: {fieldId: 'f2'},
            });

            expect(state3.fields.byObjectType.post).toBeUndefined();
        });

        test('PROPERTY_FIELD_DELETED is no-op when fieldId does not exist in byId', () => {
            const state = propertiesReducer(initialState, {
                type: PropertyTypes.PROPERTY_FIELD_DELETED,
                data: {fieldId: 'nonexistent'},
            });

            expect(state.fields).toBe(initialState.fields);
        });

        test('LOGOUT_SUCCESS resets both byObjectType and byId to {}', () => {
            const field = makeField({id: 'f1', object_type: 'post', group_id: 'g1'});
            const state1 = propertiesReducer(initialState, {
                type: PropertyTypes.RECEIVED_PROPERTY_FIELDS,
                data: {fields: [field]},
            });

            const state2 = propertiesReducer(state1, {
                type: UserTypes.LOGOUT_SUCCESS,
            });

            expect(state2.fields.byObjectType).toEqual({});
            expect(state2.fields.byId).toEqual({});
        });
    });

    describe('valuesReducer', () => {
        test('RECEIVED_PROPERTY_VALUES merges values for a single target into both indices', () => {
            const val1 = makeValue({id: 'v1', target_id: 't1', field_id: 'f1'});
            const val2 = makeValue({id: 'v2', target_id: 't1', field_id: 'f2'});

            const state = propertiesReducer(initialState, {
                type: PropertyTypes.RECEIVED_PROPERTY_VALUES,
                data: {values: [val1, val2]},
            });

            expect(state.values.byTargetId.t1.f1).toBe(val1);
            expect(state.values.byTargetId.t1.f2).toBe(val2);
            expect(state.values.byFieldId.f1.t1).toBe(val1);
            expect(state.values.byFieldId.f2.t1).toBe(val2);
        });

        test('RECEIVED_PROPERTY_VALUES merges values for multiple targets into both indices', () => {
            const val1 = makeValue({id: 'v1', target_id: 't1', field_id: 'f1'});
            const val2 = makeValue({id: 'v2', target_id: 't2', field_id: 'f1'});

            const state = propertiesReducer(initialState, {
                type: PropertyTypes.RECEIVED_PROPERTY_VALUES,
                data: {values: [val1, val2]},
            });

            expect(state.values.byTargetId.t1.f1).toBe(val1);
            expect(state.values.byTargetId.t2.f1).toBe(val2);
            expect(state.values.byFieldId.f1.t1).toBe(val1);
            expect(state.values.byFieldId.f1.t2).toBe(val2);
        });

        test('RECEIVED_PROPERTY_VALUES merges with existing values (does not replace)', () => {
            const val1 = makeValue({id: 'v1', target_id: 't1', field_id: 'f1'});
            const state1 = propertiesReducer(initialState, {
                type: PropertyTypes.RECEIVED_PROPERTY_VALUES,
                data: {values: [val1]},
            });

            const val2 = makeValue({id: 'v2', target_id: 't1', field_id: 'f2'});
            const state2 = propertiesReducer(state1, {
                type: PropertyTypes.RECEIVED_PROPERTY_VALUES,
                data: {values: [val2]},
            });

            expect(state2.values.byTargetId.t1.f1).toBe(val1);
            expect(state2.values.byTargetId.t1.f2).toBe(val2);
        });

        test('RECEIVED_PROPERTY_VALUES overwrites existing value for same targetId+fieldId (upsert)', () => {
            const val1 = makeValue({id: 'v1', target_id: 't1', field_id: 'f1', value: 'old'});
            const state1 = propertiesReducer(initialState, {
                type: PropertyTypes.RECEIVED_PROPERTY_VALUES,
                data: {values: [val1]},
            });

            const val2 = makeValue({id: 'v1', target_id: 't1', field_id: 'f1', value: 'new'});
            const state2 = propertiesReducer(state1, {
                type: PropertyTypes.RECEIVED_PROPERTY_VALUES,
                data: {values: [val2]},
            });

            expect(state2.values.byTargetId.t1.f1.value).toBe('new');
            expect(state2.values.byFieldId.f1.t1.value).toBe('new');
        });

        test('RECEIVED_PROPERTY_VALUES returns same state ref when values array is empty', () => {
            const state = propertiesReducer(initialState, {
                type: PropertyTypes.RECEIVED_PROPERTY_VALUES,
                data: {values: []},
            });

            expect(state.values).toBe(initialState.values);
        });

        test('RECEIVED_PROPERTY_VALUES creates nested structure when target does not exist', () => {
            const val = makeValue({id: 'v1', target_id: 'new-target', field_id: 'f1'});
            const state = propertiesReducer(initialState, {
                type: PropertyTypes.RECEIVED_PROPERTY_VALUES,
                data: {values: [val]},
            });

            expect(state.values.byTargetId['new-target'].f1).toBe(val);
            expect(state.values.byFieldId.f1['new-target']).toBe(val);
        });

        test('RECEIVED_PROPERTY_VALUES with single value adds it to both indices', () => {
            const val = makeValue({id: 'v1', target_id: 't1', field_id: 'f1'});
            const state = propertiesReducer(initialState, {
                type: PropertyTypes.RECEIVED_PROPERTY_VALUES,
                data: {values: [val]},
            });

            expect(state.values.byTargetId.t1.f1).toBe(val);
            expect(state.values.byFieldId.f1.t1).toBe(val);
        });

        test('RECEIVED_PROPERTY_VALUES with single value updates an existing value in both indices', () => {
            const val1 = makeValue({id: 'v1', target_id: 't1', field_id: 'f1', value: 'old'});
            const state1 = propertiesReducer(initialState, {
                type: PropertyTypes.RECEIVED_PROPERTY_VALUES,
                data: {values: [val1]},
            });

            const val2 = makeValue({id: 'v1', target_id: 't1', field_id: 'f1', value: 'new'});
            const state2 = propertiesReducer(state1, {
                type: PropertyTypes.RECEIVED_PROPERTY_VALUES,
                data: {values: [val2]},
            });

            expect(state2.values.byTargetId.t1.f1.value).toBe('new');
            expect(state2.values.byFieldId.f1.t1.value).toBe('new');
        });

        test('PROPERTY_VALUE_DELETED removes a single value from both indices', () => {
            const val = makeValue({id: 'v1', target_id: 't1', field_id: 'f1'});
            const state1 = propertiesReducer(initialState, {
                type: PropertyTypes.RECEIVED_PROPERTY_VALUES,
                data: {values: [val]},
            });

            const state2 = propertiesReducer(state1, {
                type: PropertyTypes.PROPERTY_VALUE_DELETED,
                data: {targetId: 't1', fieldId: 'f1'},
            });

            expect(state2.values.byTargetId.t1).toBeUndefined();
            expect(state2.values.byFieldId.f1).toBeUndefined();
        });

        test('PROPERTY_VALUE_DELETED cleans up empty target entry in byTargetId and empty field entry in byFieldId', () => {
            const val1 = makeValue({id: 'v1', target_id: 't1', field_id: 'f1'});
            const val2 = makeValue({id: 'v2', target_id: 't1', field_id: 'f2'});
            const state1 = propertiesReducer(initialState, {
                type: PropertyTypes.RECEIVED_PROPERTY_VALUES,
                data: {values: [val1, val2]},
            });

            const state2 = propertiesReducer(state1, {
                type: PropertyTypes.PROPERTY_VALUE_DELETED,
                data: {targetId: 't1', fieldId: 'f1'},
            });

            // t1 still has f2, so it should not be deleted
            expect(state2.values.byTargetId.t1).toBeDefined();
            expect(state2.values.byTargetId.t1.f1).toBeUndefined();
            expect(state2.values.byTargetId.t1.f2).toBe(val2);

            // f1 no longer has any targets
            expect(state2.values.byFieldId.f1).toBeUndefined();
        });

        test('PROPERTY_VALUE_DELETED is no-op when target/field does not exist', () => {
            const state = propertiesReducer(initialState, {
                type: PropertyTypes.PROPERTY_VALUE_DELETED,
                data: {targetId: 'nonexistent', fieldId: 'nonexistent'},
            });

            expect(state.values).toBe(initialState.values);
        });

        test('PROPERTY_FIELD_DELETED cascades: removes values from byTargetId and byFieldId', () => {
            const val1 = makeValue({id: 'v1', target_id: 't1', field_id: 'f1'});
            const val2 = makeValue({id: 'v2', target_id: 't2', field_id: 'f1'});
            const val3 = makeValue({id: 'v3', target_id: 't1', field_id: 'f2'});
            const state1 = propertiesReducer(initialState, {
                type: PropertyTypes.RECEIVED_PROPERTY_VALUES,
                data: {values: [val1, val2, val3]},
            });

            const state2 = propertiesReducer(state1, {
                type: PropertyTypes.PROPERTY_FIELD_DELETED,
                data: {fieldId: 'f1'},
            });

            // f1 values removed from both targets
            expect(state2.values.byFieldId.f1).toBeUndefined();
            expect(state2.values.byTargetId.t1.f1).toBeUndefined();

            // t2 only had f1, so it should be cleaned up
            expect(state2.values.byTargetId.t2).toBeUndefined();

            // t1 still has f2
            expect(state2.values.byTargetId.t1.f2).toBe(val3);
        });

        test('PROPERTY_FIELD_DELETED cascades: cleans up empty target entries in byTargetId', () => {
            const val = makeValue({id: 'v1', target_id: 't1', field_id: 'f1'});
            const state1 = propertiesReducer(initialState, {
                type: PropertyTypes.RECEIVED_PROPERTY_VALUES,
                data: {values: [val]},
            });

            const state2 = propertiesReducer(state1, {
                type: PropertyTypes.PROPERTY_FIELD_DELETED,
                data: {fieldId: 'f1'},
            });

            expect(state2.values.byTargetId.t1).toBeUndefined();
        });

        test('PROPERTY_FIELD_DELETED cascades: is no-op on values when no targets have that field', () => {
            const val = makeValue({id: 'v1', target_id: 't1', field_id: 'f2'});
            const state1 = propertiesReducer(initialState, {
                type: PropertyTypes.RECEIVED_PROPERTY_VALUES,
                data: {values: [val]},
            });

            const state2 = propertiesReducer(state1, {
                type: PropertyTypes.PROPERTY_FIELD_DELETED,
                data: {fieldId: 'f1'},
            });

            expect(state2.values).toBe(state1.values);
        });

        test('PROPERTY_VALUES_DELETED_FOR_FIELD removes all values for a field across all targets', () => {
            const val1 = makeValue({id: 'v1', target_id: 't1', field_id: 'f1'});
            const val2 = makeValue({id: 'v2', target_id: 't2', field_id: 'f1'});
            const val3 = makeValue({id: 'v3', target_id: 't1', field_id: 'f2'});
            const state1 = propertiesReducer(initialState, {
                type: PropertyTypes.RECEIVED_PROPERTY_VALUES,
                data: {values: [val1, val2, val3]},
            });

            const state2 = propertiesReducer(state1, {
                type: PropertyTypes.PROPERTY_VALUES_DELETED_FOR_FIELD,
                data: {fieldId: 'f1'},
            });

            expect(state2.values.byFieldId.f1).toBeUndefined();
            expect(state2.values.byTargetId.t1.f1).toBeUndefined();
            expect(state2.values.byTargetId.t2).toBeUndefined();
            expect(state2.values.byTargetId.t1.f2).toBe(val3);
        });

        test('PROPERTY_VALUES_DELETED_FOR_FIELD cleans up empty target entries in byTargetId', () => {
            const val = makeValue({id: 'v1', target_id: 't1', field_id: 'f1'});
            const state1 = propertiesReducer(initialState, {
                type: PropertyTypes.RECEIVED_PROPERTY_VALUES,
                data: {values: [val]},
            });

            const state2 = propertiesReducer(state1, {
                type: PropertyTypes.PROPERTY_VALUES_DELETED_FOR_FIELD,
                data: {fieldId: 'f1'},
            });

            expect(state2.values.byTargetId.t1).toBeUndefined();
        });

        test('PROPERTY_VALUES_DELETED_FOR_FIELD is no-op when no targets have that field', () => {
            const state = propertiesReducer(initialState, {
                type: PropertyTypes.PROPERTY_VALUES_DELETED_FOR_FIELD,
                data: {fieldId: 'nonexistent'},
            });

            expect(state.values).toBe(initialState.values);
        });

        test('PROPERTY_VALUES_DELETED_FOR_TARGET removes all values for a target', () => {
            const val1 = makeValue({id: 'v1', target_id: 't1', field_id: 'f1'});
            const val2 = makeValue({id: 'v2', target_id: 't1', field_id: 'f2'});
            const val3 = makeValue({id: 'v3', target_id: 't2', field_id: 'f1'});
            const state1 = propertiesReducer(initialState, {
                type: PropertyTypes.RECEIVED_PROPERTY_VALUES,
                data: {values: [val1, val2, val3]},
            });

            const state2 = propertiesReducer(state1, {
                type: PropertyTypes.PROPERTY_VALUES_DELETED_FOR_TARGET,
                data: {targetId: 't1'},
            });

            expect(state2.values.byTargetId.t1).toBeUndefined();

            // f1 still has t2
            expect(state2.values.byFieldId.f1.t2).toBe(val3);

            // f2 no longer has any targets
            expect(state2.values.byFieldId.f2).toBeUndefined();
        });

        test('PROPERTY_VALUES_DELETED_FOR_TARGET cleans up empty field entries in byFieldId', () => {
            const val = makeValue({id: 'v1', target_id: 't1', field_id: 'f1'});
            const state1 = propertiesReducer(initialState, {
                type: PropertyTypes.RECEIVED_PROPERTY_VALUES,
                data: {values: [val]},
            });

            const state2 = propertiesReducer(state1, {
                type: PropertyTypes.PROPERTY_VALUES_DELETED_FOR_TARGET,
                data: {targetId: 't1'},
            });

            expect(state2.values.byFieldId.f1).toBeUndefined();
        });

        test('PROPERTY_VALUES_DELETED_FOR_TARGET is no-op when target does not exist', () => {
            const state = propertiesReducer(initialState, {
                type: PropertyTypes.PROPERTY_VALUES_DELETED_FOR_TARGET,
                data: {targetId: 'nonexistent'},
            });

            expect(state.values).toBe(initialState.values);
        });

        test('LOGOUT_SUCCESS resets both byTargetId and byFieldId to {}', () => {
            const val = makeValue({id: 'v1', target_id: 't1', field_id: 'f1'});
            const state1 = propertiesReducer(initialState, {
                type: PropertyTypes.RECEIVED_PROPERTY_VALUES,
                data: {values: [val]},
            });

            const state2 = propertiesReducer(state1, {
                type: UserTypes.LOGOUT_SUCCESS,
            });

            expect(state2.values.byTargetId).toEqual({});
            expect(state2.values.byFieldId).toEqual({});
        });
    });

    describe('groupsReducer', () => {
        test('RECEIVED_PROPERTY_GROUP adds group to both byId and byName indices', () => {
            const group = {id: 'g1', name: 'test_group'};
            const state = propertiesReducer(initialState, {
                type: PropertyTypes.RECEIVED_PROPERTY_GROUP,
                data: group,
            });

            expect(state.groups.byId.g1).toBe(group);
            expect(state.groups.byName.test_group).toBe(group);
        });

        test('RECEIVED_PROPERTY_GROUP is no-op when receiving already-known group (same data)', () => {
            const group = {id: 'g1', name: 'test_group'};
            const state1 = propertiesReducer(initialState, {
                type: PropertyTypes.RECEIVED_PROPERTY_GROUP,
                data: group,
            });

            const state2 = propertiesReducer(state1, {
                type: PropertyTypes.RECEIVED_PROPERTY_GROUP,
                data: group,
            });

            // Note: the reducer does create new references; the test verifies data correctness
            expect(state2.groups.byId.g1).toBe(group);
            expect(state2.groups.byName.test_group).toBe(group);
        });

        test('LOGOUT_SUCCESS resets both byId and byName to {}', () => {
            const group = {id: 'g1', name: 'test_group'};
            const state1 = propertiesReducer(initialState, {
                type: PropertyTypes.RECEIVED_PROPERTY_GROUP,
                data: group,
            });

            const state2 = propertiesReducer(state1, {
                type: UserTypes.LOGOUT_SUCCESS,
            });

            expect(state2.groups.byId).toEqual({});
            expect(state2.groups.byName).toEqual({});
        });
    });
});
