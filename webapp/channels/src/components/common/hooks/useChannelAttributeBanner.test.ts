// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as ReactRedux from 'react-redux';

import type {PropertyField, PropertyValue} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';

import {renderHookWithContext} from 'tests/react_testing_utils';

import useChannelClassificationBanner from './useChannelClassificationBanner';
import * as ClassificationHook from './useClassificationMarkings';

jest.mock('react-redux', () => ({
    __esModule: true,
    ...jest.requireActual('react-redux'),
}));

const CHANNEL_ID = 'channel1';
const GROUP_ID = 'group_access_control';

function designatedField(id: string, action: string, options: Array<{id: string; name: string; color?: string}>, sortOrder?: number): PropertyField {
    return {
        id,
        group_id: GROUP_ID,
        name: id,
        type: 'select',
        target_id: '',
        target_type: 'system',
        object_type: 'channel',
        attrs: {
            actions: [action],
            options,
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

type PartialState = Parameters<typeof renderHookWithContext>[1];

function makeState(
    fields: PropertyField[],
    values: Array<PropertyValue<unknown>>,
    bannerInfo?: {enabled?: boolean; text?: string; background_color?: string},
    flag = 'true',
): PartialState {
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
            channels: {
                channels: {[CHANNEL_ID]: {id: CHANNEL_ID, banner_info: bannerInfo}},
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
    } as PartialState;
}

// Classification is deliberately unavailable in these tests: the point is that a
// designated attribute drives the banner on its own, with no classification
// definition involved.
function mockNoClassification() {
    return jest.spyOn(ClassificationHook, 'default').mockReturnValue({
        available: false,
        loading: false,
        channelField: null,
        levels: [],
    });
}

describe('useChannelClassificationBanner — generic designated attributes', () => {
    const dispatchMock = jest.fn();

    beforeEach(() => {
        dispatchMock.mockClear();
        jest.spyOn(ReactRedux, 'useDispatch').mockImplementation(() => dispatchMock);
        jest.spyOn(Client4, 'getPropertyValues').mockResolvedValue([]);
        mockNoClassification();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('resolves a banner from an attribute that is not classification', () => {
        const field = designatedField('program', 'display_banner_top', [{id: 'opt1', name: 'AURORA', color: '#1e325c'}]);

        const {result} = renderHookWithContext(
            () => useChannelClassificationBanner(CHANNEL_ID),
            makeState([field], [value('program', 'opt1')]),
        );

        expect(result.current.hasClassification).toBe(true);
        expect(result.current.bannerText).toBe('**AURORA**');
        expect(result.current.classificationBanner).toEqual({
            enabled: true,
            text: '**AURORA**',
            background_color: '#1e325c',
        });
    });

    test('a per-channel manual banner text overrides the resolved value name', () => {
        const field = designatedField('program', 'display_banner_top', [{id: 'opt1', name: 'AURORA', color: '#1e325c'}]);

        const {result} = renderHookWithContext(
            () => useChannelClassificationBanner(CHANNEL_ID),
            makeState([field], [value('program', 'opt1')], {enabled: true, text: 'Operation Aurora — handle with care'}),
        );

        expect(result.current.bannerText).toBe('Operation Aurora — handle with care');
    });

    // The composer previewed the resolved text while every member saw the raw
    // template, because rendering happened only in the preview.
    test('resolves attribute tokens in the manual banner text', () => {
        const marking = designatedField('marking', 'display_banner_top', [{id: 'opt1', name: 'RESTRICTED'}], 0);
        const program = designatedField('program', 'display_label_info', [{id: 'opt2', name: 'AURORA'}], 1);

        const {result} = renderHookWithContext(
            () => useChannelClassificationBanner(CHANNEL_ID),
            makeState(
                [marking, program],
                [value('marking', 'opt1'), value('program', 'opt2')],
                {enabled: true, text: '{{marking}} · {{program}}'},
            ),
        );

        expect(result.current.bannerText).toBe('RESTRICTED · AURORA');
    });

    test('leaves a manual banner text with no tokens byte-identical', () => {
        const marking = designatedField('marking', 'display_banner_top', [{id: 'opt1', name: 'RESTRICTED'}]);

        const {result} = renderHookWithContext(
            () => useChannelClassificationBanner(CHANNEL_ID),
            makeState([marking], [value('marking', 'opt1')], {enabled: true, text: '**TOP SECRET**'}),
        );

        expect(result.current.bannerText).toBe('**TOP SECRET**');
    });

    test('reports the designated position', () => {
        const bottom = designatedField('program', 'display_banner_bottom', [{id: 'opt1', name: 'AURORA'}]);

        const {result} = renderHookWithContext(
            () => useChannelClassificationBanner(CHANNEL_ID),
            makeState([bottom], [value('program', 'opt1')]),
        );

        expect(result.current.position).toBe('display_banner_bottom');
    });

    test('defaults to the top position when nothing is designated', () => {
        const {result} = renderHookWithContext(
            () => useChannelClassificationBanner(CHANNEL_ID),
            makeState([], []),
        );

        expect(result.current.position).toBe('display_banner_top');
    });

    test('picks the lowest sort_order when two attributes designate a banner', () => {
        const second = designatedField('zulu', 'display_banner_top', [{id: 'opt_z', name: 'ZULU'}], 2);
        const first = designatedField('alpha', 'display_banner_bottom', [{id: 'opt_a', name: 'ALPHA'}], 1);

        const {result} = renderHookWithContext(
            () => useChannelClassificationBanner(CHANNEL_ID),
            makeState([second, first], [value('zulu', 'opt_z'), value('alpha', 'opt_a')]),
        );

        expect(result.current.bannerText).toBe('**ALPHA**');
        expect(result.current.position).toBe('display_banner_bottom');
    });

    test('renders no banner when the stored option no longer exists', () => {
        const field = designatedField('program', 'display_banner_top', [{id: 'opt1', name: 'AURORA'}]);

        const {result} = renderHookWithContext(
            () => useChannelClassificationBanner(CHANNEL_ID),
            makeState([field], [value('program', 'deleted_option')]),
        );

        expect(result.current.hasClassification).toBe(false);
        expect(result.current.classificationBanner).toBeUndefined();
    });

    test('ignores an attribute with a value but no banner designation', () => {
        const labelOnly = designatedField('program', 'display_label_header', [{id: 'opt1', name: 'AURORA'}]);

        const {result} = renderHookWithContext(
            () => useChannelClassificationBanner(CHANNEL_ID),
            makeState([labelOnly], [value('program', 'opt1')]),
        );

        expect(result.current.hasClassification).toBe(false);
    });

    test('resolves nothing when the channel attributes flag is off', () => {
        const field = designatedField('program', 'display_banner_top', [{id: 'opt1', name: 'AURORA'}]);

        const {result} = renderHookWithContext(
            () => useChannelClassificationBanner(CHANNEL_ID),
            makeState([field], [value('program', 'opt1')], undefined, 'false'),
        );

        expect(result.current.hasClassification).toBe(false);
    });

    test('loads channel values even with classification unavailable, so labels are populated', async () => {
        const field = designatedField('program', 'display_banner_top', [{id: 'opt1', name: 'AURORA'}]);
        const fetchSpy = jest.spyOn(Client4, 'getPropertyValues').mockResolvedValue([]);

        renderHookWithContext(
            () => useChannelClassificationBanner(CHANNEL_ID),
            makeState([field], []),
        );

        await Promise.resolve();
        expect(fetchSpy).toHaveBeenCalledWith('access_control', 'channel', CHANNEL_ID);
    });
});
