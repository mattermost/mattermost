// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField, PropertyValue} from '@mattermost/types/properties';
import type {DeepPartial} from '@mattermost/types/utilities';

import {renderHookWithContext} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

import useChannelInfoAttributes from './useChannelInfoAttributes';

jest.mock('mattermost-redux/actions/properties', () => ({
    fetchPropertyFields: jest.fn(() => () => Promise.resolve({data: []})),
}));

const GROUP_ID = 'group1';
const CHANNEL_ID = 'channel1';

type FieldOptions = {
    actions?: string[];
    required?: boolean;
    sortOrder?: number;
};

function field(id: string, {actions = ['display_label_info'], required, sortOrder}: FieldOptions = {}): PropertyField {
    return {
        id,
        group_id: GROUP_ID,
        name: id,
        type: 'select',
        target_id: '',
        target_type: 'system',
        object_type: 'channel',
        attrs: {
            actions,
            options: [{id: 'opt', name: id.toUpperCase()}],
            ...(required === undefined ? {} : {required}),
            ...(sortOrder === undefined ? {} : {sort_order: sortOrder}),
        },
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        created_by: '',
        updated_by: '',
    };
}

function value(fieldId: string, raw: unknown): PropertyValue<unknown> {
    return {
        id: `value_${fieldId}`,
        target_id: CHANNEL_ID,
        target_type: 'channel',
        group_id: GROUP_ID,
        field_id: fieldId,
        value: raw,
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        created_by: '',
        updated_by: '',
    };
}

function makeState(fields: PropertyField[], values: Array<PropertyValue<unknown>>, flag = 'true'): DeepPartial<GlobalState> {
    const byTargetId: Record<string, Record<string, PropertyValue<unknown>>> = {};
    for (const v of values) {
        byTargetId[v.target_id] = {...byTargetId[v.target_id], [v.field_id]: v};
    }

    return {
        entities: {
            general: {
                config: {FeatureFlagChannelAttributes: flag},
                license: {IsLicensed: 'true', SkuShortName: 'enterprise'},
            },
            properties: {
                groups: {byId: {[GROUP_ID]: {id: GROUP_ID, name: 'access_control'}}, byName: {access_control: {id: GROUP_ID, name: 'access_control'}}},
                fields: {
                    byId: Object.fromEntries(fields.map((f) => [f.id, f])),
                    byObjectType: {channel: {[GROUP_ID]: Object.fromEntries(fields.map((f) => [f.id, f]))}},
                },
                values: {byTargetId, byFieldId: {}},
            },
        },
    } as DeepPartial<GlobalState>;
}

describe('useChannelInfoAttributes', () => {
    test('lists an attribute that has a value', () => {
        const state = makeState([field('program')], [value('program', 'opt')]);

        const {result} = renderHookWithContext(() => useChannelInfoAttributes(CHANNEL_ID), state);
        expect(result.current.map((a) => a.field.id)).toEqual(['program']);
        expect(result.current[0].displayValue).toBe('PROGRAM');
    });

    test('lists a required attribute with no value, so an incomplete channel is visible', () => {
        const state = makeState([field('program', {required: true})], []);

        const {result} = renderHookWithContext(() => useChannelInfoAttributes(CHANNEL_ID), state);
        expect(result.current.map((a) => a.field.id)).toEqual(['program']);
        expect(result.current[0].displayValue).toBe('');
    });

    test('omits an optional attribute with no value rather than rendering an empty row', () => {
        const state = makeState([field('program')], []);

        const {result} = renderHookWithContext(() => useChannelInfoAttributes(CHANNEL_ID), state);
        expect(result.current).toEqual([]);
    });

    test('omits an attribute not designated for the info surface even when required', () => {
        const state = makeState(
            [field('header_only', {actions: ['display_label_header'], required: true})],
            [value('header_only', 'opt')],
        );

        const {result} = renderHookWithContext(() => useChannelInfoAttributes(CHANNEL_ID), state);
        expect(result.current).toEqual([]);
    });

    test('treats a value cleared to null as unset', () => {
        const state = makeState([field('program')], [value('program', null)]);

        const {result} = renderHookWithContext(() => useChannelInfoAttributes(CHANNEL_ID), state);
        expect(result.current).toEqual([]);
    });

    test('orders by sort_order, breaking ties on field name', () => {
        const state = makeState(
            [
                field('zulu', {sortOrder: 1}),
                field('alpha', {sortOrder: 1}),
                field('first', {sortOrder: 0}),
            ],
            [value('zulu', 'opt'), value('alpha', 'opt'), value('first', 'opt')],
        );

        const {result} = renderHookWithContext(() => useChannelInfoAttributes(CHANNEL_ID), state);
        expect(result.current.map((a) => a.field.id)).toEqual(['first', 'alpha', 'zulu']);
    });

    test('returns nothing when the feature flag is off', () => {
        const state = makeState([field('program', {required: true})], [value('program', 'opt')], 'false');

        const {result} = renderHookWithContext(() => useChannelInfoAttributes(CHANNEL_ID), state);
        expect(result.current).toEqual([]);
    });
});
