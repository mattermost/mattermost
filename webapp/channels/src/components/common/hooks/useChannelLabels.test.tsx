// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField, PropertyValue} from '@mattermost/types/properties';
import type {DeepPartial} from '@mattermost/types/utilities';

import {clearPropertyFieldOptionWalks, pageAllAccessControlFieldOptions} from 'components/property_fields/graph/page_all_access_control_field_options';
import {clearGraphOptionNameCache, commitGraphOptionNames} from 'components/property_fields/graph/use_graph_option_names';

import {renderHookWithContext} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

import useChannelLabels from './useChannelLabels';

jest.mock('mattermost-redux/actions/properties', () => ({
    fetchPropertyFields: jest.fn(() => () => Promise.resolve({data: []})),
}));

jest.mock('components/property_fields/graph/page_all_access_control_field_options', () => ({
    ...jest.requireActual('components/property_fields/graph/page_all_access_control_field_options'),
    pageAllAccessControlFieldOptions: jest.fn(),
}));

const mockPageAll = jest.mocked(pageAllAccessControlFieldOptions);

const GROUP_ID = 'group1';
const CHANNEL_ID = 'channel1';

function field(id: string, actions: string[], type: PropertyField['type'] = 'select'): PropertyField {
    return {
        id,
        group_id: GROUP_ID,
        name: id,
        type,
        target_id: '',
        target_type: 'system',
        object_type: 'channel',
        attrs: {actions, options: [{id: 'opt', name: id.toUpperCase()}]},
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
                license: {IsLicensed: 'true', SkuShortName: 'advanced'},
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

describe('useChannelLabels', () => {
    beforeEach(() => {
        clearPropertyFieldOptionWalks();
        clearGraphOptionNameCache();
        mockPageAll.mockRejectedValue(new Error('no walk expected'));
    });

    test('returns only fields designated for the requested surface', () => {
        const state = makeState(
            [field('header_only', ['display_label_header']), field('info_only', ['display_label_info'])],
            [value('header_only', 'opt'), value('info_only', 'opt')],
        );

        const header = renderHookWithContext(() => useChannelLabels(CHANNEL_ID, 'header'), state);
        expect(header.result.current.map((a) => a.field.id)).toEqual(['header_only']);

        const info = renderHookWithContext(() => useChannelLabels(CHANNEL_ID, 'info'), state);
        expect(info.result.current.map((a) => a.field.id)).toEqual(['info_only']);
    });

    test('omits a designated attribute that has no value on this channel', () => {
        // A chip with nothing in it says nothing, so an unset attribute is not
        // rendered even though it is designated system-wide.
        const state = makeState([field('program', ['display_label_header'])], []);

        const {result} = renderHookWithContext(() => useChannelLabels(CHANNEL_ID, 'header'), state);
        expect(result.current).toEqual([]);
    });

    test('omits an attribute whose value was cleared to null', () => {
        const state = makeState([field('program', ['display_label_header'])], [value('program', null)]);

        const {result} = renderHookWithContext(() => useChannelLabels(CHANNEL_ID, 'header'), state);
        expect(result.current).toEqual([]);
    });

    test('returns fields from every requested surface, once, in display order', () => {
        const state = makeState(
            [
                field('info_only', ['display_label_info']),
                field('both', ['display_label_header', 'display_label_info']),
                field('header_only', ['display_label_header']),
            ],
            [value('info_only', 'opt'), value('both', 'opt'), value('header_only', 'opt')],
        );

        const {result} = renderHookWithContext(() => useChannelLabels(CHANNEL_ID, ['info', 'header']), state);
        expect(result.current.map((a) => a.field.id)).toEqual(['both', 'header_only', 'info_only']);
    });

    test('returns nothing when the feature flag is off', () => {
        const state = makeState([field('program', ['display_label_header'])], [value('program', 'opt')], 'false');

        const {result} = renderHookWithContext(() => useChannelLabels(CHANNEL_ID, 'header'), state);
        expect(result.current).toEqual([]);
    });

    test('a graph attribute shows committed option names, one per value', () => {
        commitGraphOptionNames('dept', {a: 'Alpha', b: 'Beta'});
        const state = makeState(
            [field('dept', ['display_label_header'], 'graph')],
            [value('dept', ['a', 'b'])],
        );

        const {result} = renderHookWithContext(() => useChannelLabels(CHANNEL_ID, 'header'), state);
        expect(result.current[0].displayValues).toEqual(['Alpha', 'Beta']);
        expect(result.current[0].displayValue).toBe('Alpha, Beta');
    });

    test('a graph attribute with no names yet keeps its raw ids and stays a label', () => {
        const state = makeState(
            [field('dept', ['display_label_header'], 'graph')],
            [value('dept', ['a', 'b'])],
        );

        const {result} = renderHookWithContext(() => useChannelLabels(CHANNEL_ID, 'header'), state);
        expect(result.current[0].displayValue).toBe('a, b');
    });
});
