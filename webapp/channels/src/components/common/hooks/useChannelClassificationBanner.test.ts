// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as ReactRedux from 'react-redux';

import type {PropertyField, PropertyValue} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';

import {
    CHANNEL_LINKED_FIELD_NAME,
    CHANNEL_LINKED_OBJECT_TYPE,
    GROUP_NAME,
    TARGET_TYPE,
} from 'components/admin_console/classification_markings/utils';
import type {ClassificationLevel} from 'components/admin_console/classification_markings/utils/presets';

import {renderHookWithContext} from 'tests/react_testing_utils';

import useChannelClassificationBanner, {type ChannelClassificationValue} from './useChannelClassificationBanner';
import * as ClassificationHook from './useClassificationMarkings';

jest.mock('react-redux', () => ({
    __esModule: true,
    ...jest.requireActual('react-redux'),
}));

const CHANNEL_ID = 'channel_id_1';
const FIELD_ID = 'channel_field_1';

function makeChannelField(overrides: Partial<PropertyField> = {}): PropertyField {
    return {
        id: FIELD_ID,
        group_id: GROUP_NAME,
        name: CHANNEL_LINKED_FIELD_NAME,
        type: 'select',
        attrs: {},
        target_id: '',
        target_type: TARGET_TYPE,
        object_type: CHANNEL_LINKED_OBJECT_TYPE,
        linked_field_id: 'template1',
        create_at: 1000,
        update_at: 1000,
        delete_at: 0,
        created_by: 'user1',
        updated_by: 'user1',
        ...overrides,
    };
}

function makePropertyValue(value: ChannelClassificationValue | null): PropertyValue<ChannelClassificationValue> {
    return {
        id: 'value1',
        target_id: CHANNEL_ID,
        target_type: CHANNEL_LINKED_OBJECT_TYPE,
        group_id: GROUP_NAME,
        field_id: FIELD_ID,
        value: value as ChannelClassificationValue,
        create_at: 2000,
        update_at: 2000,
        delete_at: 0,
        created_by: 'user1',
        updated_by: 'user1',
    };
}

const SAMPLE_LEVELS: ClassificationLevel[] = [
    {id: 'lvl1', name: 'UNCLASSIFIED', color: '#007A33', rank: 1},
    {id: 'lvl2', name: 'SECRET', color: '#C8102E', rank: 2},
];

type PartialState = Parameters<typeof renderHookWithContext>[1];

function stateWithValue(value: PropertyValue<ChannelClassificationValue> | undefined): PartialState {
    return {
        entities: {
            properties: {
                values: {
                    byTargetId: value ? {[CHANNEL_ID]: {[FIELD_ID]: value}} : {},
                },
            },
        },
    } as PartialState;
}

function mockClassification(overrides: Partial<ClassificationHook.ClassificationMarkingsState> = {}) {
    return jest.spyOn(ClassificationHook, 'default').mockReturnValue({
        available: true,
        loading: false,
        templateField: null,
        channelField: makeChannelField(),
        levels: SAMPLE_LEVELS,
        ...overrides,
    });
}

describe('useChannelClassificationBanner', () => {
    const dispatchMock = jest.fn();

    beforeAll(() => {
        jest.spyOn(ReactRedux, 'useDispatch').mockImplementation(() => dispatchMock);
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    beforeEach(() => {
        dispatchMock.mockClear();
        jest.spyOn(Client4, 'getPropertyValues').mockResolvedValue([]);
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.spyOn(ReactRedux, 'useDispatch').mockImplementation(() => dispatchMock);
    });

    test('returns hasClassification=false when no property value exists for the channel', () => {
        mockClassification();

        const {result} = renderHookWithContext(
            () => useChannelClassificationBanner(CHANNEL_ID),
            stateWithValue(undefined),
        );

        expect(result.current.hasClassification).toBe(false);
        expect(result.current.classificationBanner).toBeUndefined();
        expect(result.current.classificationId).toBeUndefined();
        expect(result.current.bannerText).toBeUndefined();
    });

    test('returns hasClassification=false when property value contains null value', () => {
        mockClassification();
        const value = makePropertyValue(null);

        const {result} = renderHookWithContext(
            () => useChannelClassificationBanner(CHANNEL_ID),
            stateWithValue(value),
        );

        expect(result.current.hasClassification).toBe(false);
        expect(result.current.classificationBanner).toBeUndefined();
    });

    test('maps a valid property value to the matching level banner shape', () => {
        mockClassification();
        const value = makePropertyValue({classification_id: 'lvl2', banner_text: '**SECRET**'});

        const {result} = renderHookWithContext(
            () => useChannelClassificationBanner(CHANNEL_ID),
            stateWithValue(value),
        );

        expect(result.current.hasClassification).toBe(true);
        expect(result.current.classificationId).toBe('lvl2');
        expect(result.current.bannerText).toBe('**SECRET**');
        expect(result.current.classificationBanner).toEqual({
            enabled: true,
            text: '**SECRET**',
            background_color: '#C8102E',
        });
    });

    test('returns hasClassification=false when the referenced level no longer exists', () => {
        mockClassification();
        const value = makePropertyValue({classification_id: 'deleted_lvl', banner_text: 'stale'});

        const {result} = renderHookWithContext(
            () => useChannelClassificationBanner(CHANNEL_ID),
            stateWithValue(value),
        );

        expect(result.current.hasClassification).toBe(false);
        expect(result.current.classificationBanner).toBeUndefined();
    });

    test('returns empty state and skips fetching when channelField is missing', () => {
        mockClassification({channelField: null, available: false});

        const fetchSpy = jest.spyOn(Client4, 'getPropertyValues');

        const {result} = renderHookWithContext(
            () => useChannelClassificationBanner(CHANNEL_ID),
            stateWithValue(undefined),
        );

        expect(result.current.hasClassification).toBe(false);
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    test('returns empty state when classification is unavailable (feature flag/license off)', () => {
        mockClassification({available: false, channelField: makeChannelField(), levels: []});

        const fetchSpy = jest.spyOn(Client4, 'getPropertyValues');

        const {result} = renderHookWithContext(
            () => useChannelClassificationBanner(CHANNEL_ID),
            stateWithValue(undefined),
        );

        expect(result.current.hasClassification).toBe(false);
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    test('does not attempt to fetch when channelId is empty', () => {
        mockClassification();
        const fetchSpy = jest.spyOn(Client4, 'getPropertyValues');

        const {result} = renderHookWithContext(
            () => useChannelClassificationBanner(''),
            stateWithValue(undefined),
        );

        expect(result.current.hasClassification).toBe(false);
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    test('fetches property values when none exist and classification is available', async () => {
        mockClassification();
        const fetchSpy = jest.spyOn(Client4, 'getPropertyValues').mockResolvedValue([]);

        renderHookWithContext(
            () => useChannelClassificationBanner(CHANNEL_ID),
            stateWithValue(undefined),
        );

        await Promise.resolve();
        expect(fetchSpy).toHaveBeenCalledWith(GROUP_NAME, CHANNEL_LINKED_OBJECT_TYPE, CHANNEL_ID);
    });

    test('silently ignores fetch errors (channel may not have classification set)', async () => {
        mockClassification();
        jest.spyOn(Client4, 'getPropertyValues').mockRejectedValue(new Error('404'));

        const {result} = renderHookWithContext(
            () => useChannelClassificationBanner(CHANNEL_ID),
            stateWithValue(undefined),
        );

        await Promise.resolve();
        expect(result.current.hasClassification).toBe(false);
    });
});
