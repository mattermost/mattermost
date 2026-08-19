// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as ReactRedux from 'react-redux';

import type {PropertyField, PropertyValue} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';
import {ACCESS_CONTROL_PROPERTY_GROUP} from 'mattermost-redux/constants/properties';

import {
    CLASSIFICATIONS_CHANNEL_FIELD_NAME,
    CLASSIFICATIONS_CHANNEL_OBJECT_TYPE,
    CLASSIFICATIONS_FIELD_TARGET_TYPE,
} from 'components/admin_console/classification_markings/utils';
import type {ClassificationLevel} from 'components/admin_console/classification_markings/utils/presets';

import {renderHookWithContext} from 'tests/react_testing_utils';

import useChannelClassificationBanner from './useChannelClassificationBanner';
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
        group_id: ACCESS_CONTROL_PROPERTY_GROUP,
        name: CLASSIFICATIONS_CHANNEL_FIELD_NAME,
        type: 'select',
        attrs: {},
        target_id: '',
        target_type: CLASSIFICATIONS_FIELD_TARGET_TYPE,
        object_type: CLASSIFICATIONS_CHANNEL_OBJECT_TYPE,
        linked_field_id: 'template1',
        create_at: 1000,
        update_at: 1000,
        delete_at: 0,
        created_by: 'user1',
        updated_by: 'user1',
        ...overrides,
    };
}

function makePropertyValue(value: string | null): PropertyValue<string> {
    return {
        id: 'value1',
        target_id: CHANNEL_ID,
        target_type: CLASSIFICATIONS_CHANNEL_OBJECT_TYPE,
        group_id: ACCESS_CONTROL_PROPERTY_GROUP,
        field_id: FIELD_ID,
        value: value as string,
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

function stateWithValue(
    value: PropertyValue<string> | undefined,
    bannerInfo?: {enabled?: boolean; text?: string; background_color?: string},
): PartialState {
    return {
        entities: {
            channels: {
                channels: {
                    [CHANNEL_ID]: {
                        id: CHANNEL_ID,
                        banner_info: bannerInfo,
                    },
                },
            },
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

    test('maps a valid string classification_id to the matching level banner shape with text from banner_info', () => {
        mockClassification();
        const value = makePropertyValue('lvl2');

        const {result} = renderHookWithContext(
            () => useChannelClassificationBanner(CHANNEL_ID),
            stateWithValue(value, {enabled: true, text: '**SECRET**', background_color: '#C8102E'}),
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

    test('still banners a classification field carrying no display locations', () => {
        // How a field predating any configuration keeps today's behaviour: no actions
        // key at all means the classification fallback still applies.
        mockClassification({channelField: makeChannelField({attrs: {}})});

        const {result} = renderHookWithContext(
            () => useChannelClassificationBanner(CHANNEL_ID),
            stateWithValue(makePropertyValue('lvl2')),
        );

        expect(result.current.hasClassification).toBe(true);
    });

    test('stops bannering once display locations are configured without the banner', () => {
        // An admin who unticked Banner on the attribute page has to get no banner. The
        // fallback would otherwise render one regardless of what they chose.
        mockClassification({channelField: makeChannelField({attrs: {actions: ['display_label_header']}})});

        const {result} = renderHookWithContext(
            () => useChannelClassificationBanner(CHANNEL_ID),
            stateWithValue(makePropertyValue('lvl2')),
        );

        expect(result.current.hasClassification).toBe(false);
    });

    test('falls back to level name when banner_info.text is missing but classification is set', () => {
        mockClassification();
        const value = makePropertyValue('lvl1');

        const {result} = renderHookWithContext(
            () => useChannelClassificationBanner(CHANNEL_ID),
            stateWithValue(value),
        );

        expect(result.current.hasClassification).toBe(true);
        expect(result.current.classificationId).toBe('lvl1');
        expect(result.current.bannerText).toBe('**UNCLASSIFIED**');
        expect(result.current.classificationBanner).toEqual({
            enabled: true,
            text: '**UNCLASSIFIED**',
            background_color: '#007A33',
        });
    });

    test('returns hasClassification=false when the referenced level no longer exists', () => {
        mockClassification();
        const value = makePropertyValue('deleted_lvl');

        const {result} = renderHookWithContext(
            () => useChannelClassificationBanner(CHANNEL_ID),
            stateWithValue(value),
        );

        expect(result.current.hasClassification).toBe(false);
        expect(result.current.classificationBanner).toBeUndefined();
    });

    test('returns hasClassification=false for legacy object-shaped property values', () => {
        mockClassification();

        // Simulate a pre-migration object-shaped value that should be treated as invalid
        const legacyValue = {
            id: 'value1',
            target_id: CHANNEL_ID,
            target_type: CLASSIFICATIONS_CHANNEL_OBJECT_TYPE,
            group_id: ACCESS_CONTROL_PROPERTY_GROUP,
            field_id: FIELD_ID,
            value: {classification_id: 'lvl1', banner_text: 'test'} as unknown as string,
            create_at: 2000,
            update_at: 2000,
            delete_at: 0,
            created_by: 'user1',
            updated_by: 'user1',
        };

        const {result} = renderHookWithContext(
            () => useChannelClassificationBanner(CHANNEL_ID),
            stateWithValue(legacyValue as PropertyValue<string>),
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
        expect(fetchSpy).toHaveBeenCalledWith(ACCESS_CONTROL_PROPERTY_GROUP, CLASSIFICATIONS_CHANNEL_OBJECT_TYPE, CHANNEL_ID);
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

    describe('attribute-designated banner', () => {
        const GROUP_ID = 'group_id_1';
        const DESIGNATED_FIELD_ID = 'designated_field_1';
        const OPTION_ID = 'option_1';

        function designatedState(bannerInfo?: {enabled?: boolean; text?: string; background_color?: string}): PartialState {
            const field: PropertyField = {
                ...makeChannelField(),
                id: DESIGNATED_FIELD_ID,
                group_id: GROUP_ID,
                name: 'marking',
                attrs: {
                    actions: ['display_banner_top'],
                    options: [{id: OPTION_ID, name: 'RESTRICTED', color: '#1E325C'}],
                },
            };

            return {
                entities: {
                    general: {
                        config: {FeatureFlagChannelAttributes: 'true'},
                        license: {IsLicensed: 'true', SkuShortName: 'enterprise'},
                    },
                    channels: {
                        channels: {
                            [CHANNEL_ID]: {id: CHANNEL_ID, banner_info: bannerInfo},
                        },
                    },
                    properties: {
                        groups: {byName: {[ACCESS_CONTROL_PROPERTY_GROUP]: {id: GROUP_ID, name: ACCESS_CONTROL_PROPERTY_GROUP}}},
                        fields: {byObjectType: {channel: {[GROUP_ID]: {[DESIGNATED_FIELD_ID]: field}}}},
                        values: {
                            byTargetId: {
                                [CHANNEL_ID]: {
                                    [DESIGNATED_FIELD_ID]: {
                                        ...makePropertyValue(OPTION_ID),
                                        field_id: DESIGNATED_FIELD_ID,
                                    },
                                },
                            },
                        },
                    },
                },
            } as PartialState;
        }

        test('takes its colour from the selected option when the channel has authored none', () => {
            mockClassification({available: false, channelField: null, levels: []});

            const {result} = renderHookWithContext(
                () => useChannelClassificationBanner(CHANNEL_ID),
                designatedState(),
            );

            expect(result.current.hasClassification).toBe(true);
            expect(result.current.classificationBanner?.background_color).toBe('#1E325C');
            expect(result.current.bannerText).toBe('**RESTRICTED**');
        });

        test('lets a colour authored in Channel Settings win over the option colour', () => {
            mockClassification({available: false, channelField: null, levels: []});

            const {result} = renderHookWithContext(
                () => useChannelClassificationBanner(CHANNEL_ID),
                designatedState({enabled: false, text: '', background_color: '#ED1010'}),
            );

            expect(result.current.classificationBanner?.background_color).toBe('#ED1010');
        });
    });
});
