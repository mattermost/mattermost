// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as ReactRedux from 'react-redux';

import type {PropertyField} from '@mattermost/types/properties';
import type {GlobalState} from '@mattermost/types/store';

import {
    CLASSIFICATIONS_CHANNEL_FIELD_NAME,
    CLASSIFICATIONS_CHANNEL_OBJECT_TYPE,
    CLASSIFICATIONS_FIELD_TARGET_TYPE,
    CLASSIFICATIONS_GROUP_NAME,
    CLASSIFICATIONS_TEMPLATE_FIELD_NAME,
    CLASSIFICATIONS_TEMPLATE_OBJECT_TYPE,
} from 'components/admin_console/classification_markings/utils';

import {renderHookWithContext} from 'tests/react_testing_utils';

import useClassificationMarkings, {selectClassificationTemplateField} from './useClassificationMarkings';

type PartialState = Parameters<typeof renderHookWithContext>[1];

jest.mock('react-redux', () => ({
    __esModule: true,
    ...jest.requireActual('react-redux'),
}));

function makeTemplateField(overrides: Partial<PropertyField> = {}): PropertyField {
    return {
        id: 'template1',
        group_id: CLASSIFICATIONS_GROUP_NAME,
        name: CLASSIFICATIONS_TEMPLATE_FIELD_NAME,
        type: 'select',
        attrs: {options: [{id: 'lvl1', name: 'UNCLASSIFIED', color: '#007A33', rank: 1}]},
        target_id: '',
        target_type: CLASSIFICATIONS_FIELD_TARGET_TYPE,
        object_type: CLASSIFICATIONS_TEMPLATE_OBJECT_TYPE,
        create_at: 1000,
        update_at: 1000,
        delete_at: 0,
        created_by: 'user1',
        updated_by: 'user1',
        ...overrides,
    };
}

function makeChannelField(overrides: Partial<PropertyField> = {}): PropertyField {
    return {
        id: 'channel1',
        group_id: CLASSIFICATIONS_GROUP_NAME,
        name: CLASSIFICATIONS_CHANNEL_FIELD_NAME,
        type: 'select',
        attrs: {},
        target_id: '',
        target_type: CLASSIFICATIONS_FIELD_TARGET_TYPE,
        object_type: CLASSIFICATIONS_CHANNEL_OBJECT_TYPE,
        linked_field_id: 'template1',
        create_at: 2000,
        update_at: 2000,
        delete_at: 0,
        created_by: 'user1',
        updated_by: 'user1',
        ...overrides,
    };
}

const ENTERPRISE_LICENSE = {IsLicensed: 'true', SkuShortName: 'enterprise'};
const STARTER_LICENSE = {IsLicensed: 'true', SkuShortName: 'starter'};

function stateWith({featureFlag, license, fields = {}}: {
    featureFlag?: string;
    license?: typeof ENTERPRISE_LICENSE | typeof STARTER_LICENSE | Record<string, never>;
    fields?: Record<string, PropertyField>;
}): PartialState {
    return {
        entities: {
            general: {
                config: featureFlag === undefined ? {} : {FeatureFlagClassificationMarkings: featureFlag},
                license: license ?? {},
            },
            properties: {
                fields: {byId: fields},
            },
        },
    } as PartialState;
}

describe('useClassificationMarkings', () => {
    const dispatchMock = jest.fn();

    beforeAll(() => {
        jest.spyOn(ReactRedux, 'useDispatch').mockImplementation(() => dispatchMock);
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    beforeEach(() => {
        dispatchMock.mockClear();
    });

    test('returns available=false when feature flag is disabled', () => {
        const {result} = renderHookWithContext(
            () => useClassificationMarkings(),
            stateWith({featureFlag: 'false', license: ENTERPRISE_LICENSE}),
        );

        expect(result.current.available).toBe(false);
        expect(result.current.loading).toBe(false);
        expect(result.current.levels).toEqual([]);
        expect(dispatchMock).not.toHaveBeenCalled();
    });

    test('returns available=false when feature flag is missing from config', () => {
        const {result} = renderHookWithContext(
            () => useClassificationMarkings(),
            stateWith({license: ENTERPRISE_LICENSE}),
        );

        expect(result.current.available).toBe(false);
        expect(result.current.loading).toBe(false);
        expect(dispatchMock).not.toHaveBeenCalled();
    });

    test('returns available=false when license is not Enterprise', () => {
        const {result} = renderHookWithContext(
            () => useClassificationMarkings(),
            stateWith({featureFlag: 'true', license: STARTER_LICENSE}),
        );

        expect(result.current.available).toBe(false);
        expect(result.current.loading).toBe(false);
        expect(dispatchMock).not.toHaveBeenCalled();
    });

    test('returns available=false when license is missing entirely', () => {
        const {result} = renderHookWithContext(
            () => useClassificationMarkings(),
            stateWith({featureFlag: 'true', license: {}}),
        );

        expect(result.current.available).toBe(false);
        expect(dispatchMock).not.toHaveBeenCalled();
    });

    test('returns loading=true and dispatches fetches when flag and license are on but no fields are loaded', () => {
        const {result} = renderHookWithContext(
            () => useClassificationMarkings(),
            stateWith({featureFlag: 'true', license: ENTERPRISE_LICENSE}),
        );

        expect(result.current.loading).toBe(true);
        expect(result.current.available).toBe(false);
        expect(result.current.templateField).toBeNull();
        expect(result.current.channelField).toBeNull();
        expect(result.current.levels).toEqual([]);

        // The hook dispatches one fetch for the template field and one for the channel field.
        expect(dispatchMock).toHaveBeenCalledTimes(2);
    });

    test('returns available=true and derives levels when template field is loaded', () => {
        const template = makeTemplateField({
            attrs: {
                options: [
                    {id: 'lvl2', name: 'SECRET', color: '#C8102E', rank: 2},
                    {id: 'lvl1', name: 'UNCLASSIFIED', color: '#007A33', rank: 1},
                ],
            },
        });

        const {result} = renderHookWithContext(
            () => useClassificationMarkings(),
            stateWith({featureFlag: 'true', license: ENTERPRISE_LICENSE, fields: {template1: template}}),
        );

        expect(result.current.available).toBe(true);
        expect(result.current.loading).toBe(false);
        expect(result.current.templateField).toBe(template);
        expect(result.current.levels).toHaveLength(2);

        // Levels are sorted by rank ascending.
        expect(result.current.levels[0].name).toBe('UNCLASSIFIED');
        expect(result.current.levels[1].name).toBe('SECRET');
    });

    test('returns available=false when template field exists but has no levels', () => {
        const template = makeTemplateField({attrs: {options: []}});

        const {result} = renderHookWithContext(
            () => useClassificationMarkings(),
            stateWith({featureFlag: 'true', license: ENTERPRISE_LICENSE, fields: {template1: template}}),
        );

        expect(result.current.available).toBe(false);
        expect(result.current.loading).toBe(false);
        expect(result.current.templateField).toBe(template);
        expect(result.current.levels).toEqual([]);
    });

    test('exposes channelField when it exists in the store', () => {
        const template = makeTemplateField();
        const channel = makeChannelField();

        const {result} = renderHookWithContext(
            () => useClassificationMarkings(),
            stateWith({
                featureFlag: 'true',
                license: ENTERPRISE_LICENSE,
                fields: {template1: template, channel1: channel},
            }),
        );

        expect(result.current.channelField).toBe(channel);
        expect(result.current.templateField).toBe(template);
    });

    test('returns channelField=null when channel-linked field is missing linked_field_id', () => {
        const template = makeTemplateField();
        const orphan = makeChannelField({id: 'orphan', linked_field_id: ''});

        const {result} = renderHookWithContext(
            () => useClassificationMarkings(),
            stateWith({
                featureFlag: 'true',
                license: ENTERPRISE_LICENSE,
                fields: {template1: template, orphan},
            }),
        );

        expect(result.current.channelField).toBeNull();
    });

    test('returns channelField=null when channel-linked field is soft-deleted', () => {
        const template = makeTemplateField();
        const deleted = makeChannelField({delete_at: 9999});

        const {result} = renderHookWithContext(
            () => useClassificationMarkings(),
            stateWith({
                featureFlag: 'true',
                license: ENTERPRISE_LICENSE,
                fields: {template1: template, channel1: deleted},
            }),
        );

        expect(result.current.channelField).toBeNull();
    });

    test('does not dispatch fetch when both fields are already in the store', () => {
        const template = makeTemplateField();
        const channel = makeChannelField();

        renderHookWithContext(
            () => useClassificationMarkings(),
            stateWith({
                featureFlag: 'true',
                license: ENTERPRISE_LICENSE,
                fields: {template1: template, channel1: channel},
            }),
        );

        expect(dispatchMock).not.toHaveBeenCalled();
    });
});

describe('selectClassificationTemplateField', () => {
    function fullState(fields: Record<string, PropertyField> = {}): GlobalState {
        return stateWith({fields}) as unknown as GlobalState;
    }

    test('returns undefined when properties store is empty', () => {
        expect(selectClassificationTemplateField(fullState())).toBeUndefined();
    });

    test('returns undefined when properties.fields.byId is missing', () => {
        const state = {entities: {properties: {fields: {}}}} as unknown as GlobalState;
        expect(selectClassificationTemplateField(state)).toBeUndefined();
    });

    test('returns the matching template field by name and object_type', () => {
        const template = makeTemplateField();
        expect(selectClassificationTemplateField(fullState({template1: template}))).toBe(template);
    });

    test('ignores soft-deleted template fields', () => {
        const deleted = makeTemplateField({delete_at: 9999});
        expect(selectClassificationTemplateField(fullState({template1: deleted}))).toBeUndefined();
    });

    test('ignores fields with different object_type or name', () => {
        const wrongName = makeTemplateField({name: 'something_else'});
        const wrongType = makeTemplateField({id: 'other', object_type: 'system'});
        expect(selectClassificationTemplateField(fullState({wrongName, wrongType}))).toBeUndefined();
    });
});
