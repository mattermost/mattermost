// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {waitFor} from '@testing-library/react';

import {ClientError} from '@mattermost/client';
import type {PropertyField} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';
import {ACCESS_CONTROL_PROPERTY_GROUP} from 'mattermost-redux/constants/properties';

import {
    CLASSIFICATIONS_CHANNEL_FIELD_NAME,
    CLASSIFICATIONS_CHANNEL_OBJECT_TYPE,
    CLASSIFICATIONS_FIELD_TARGET_ID,
    CLASSIFICATIONS_FIELD_TARGET_TYPE,
} from 'components/admin_console/classification_markings/utils';

import {renderHookWithContext} from 'tests/react_testing_utils';

import useClassificationMarkings from './useClassificationMarkings';

type PartialState = Parameters<typeof renderHookWithContext>[1];

function makeChannelField(overrides: Partial<PropertyField> = {}): PropertyField {
    return {
        id: 'channel1',
        group_id: GROUP_ID,
        name: CLASSIFICATIONS_CHANNEL_FIELD_NAME,
        type: 'select',
        attrs: {options: [{id: 'lvl1', name: 'UNCLASSIFIED', color: '#007A33', rank: 1}]},
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

const GROUP_ID = 'group_access_control';

const ADVANCED_LICENSE = {IsLicensed: 'true', SkuShortName: 'advanced'};
const ENTRY_LICENSE = {IsLicensed: 'true', SkuShortName: 'entry'};
const ENTERPRISE_LICENSE = {IsLicensed: 'true', SkuShortName: 'enterprise'};
const STARTER_LICENSE = {IsLicensed: 'true', SkuShortName: 'starter'};

function stateWith({featureFlag, license, fields = {}}: {
    featureFlag?: string;
    license?: typeof ADVANCED_LICENSE | Record<string, never>;
    fields?: Record<string, PropertyField>;
}): PartialState {
    // Fields are looked up through the group-scoped map, which the fetch action
    // populates together with the name -> id mapping, so both are set here.
    return {
        entities: {
            general: {
                config: featureFlag === undefined ? {} : {FeatureFlagClassificationMarkings: featureFlag},
                license: license ?? {},
            },
            properties: {
                groups: {
                    byId: {[GROUP_ID]: {id: GROUP_ID, name: ACCESS_CONTROL_PROPERTY_GROUP}},
                    byName: {[ACCESS_CONTROL_PROPERTY_GROUP]: {id: GROUP_ID, name: ACCESS_CONTROL_PROPERTY_GROUP}},
                },
                fields: {
                    byId: fields,
                    byObjectType: {[CLASSIFICATIONS_CHANNEL_OBJECT_TYPE]: {[GROUP_ID]: fields}},
                },
                values: {byTargetId: {}, byFieldId: {}},
            },
        },
    } as PartialState;
}

function captureUnhandledRejections() {
    const seen: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
        seen.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);
    return {
        seen,
        stop: () => process.off('unhandledRejection', onUnhandled),
    };
}

function macrotask() {
    return new Promise((resolve) => {
        setTimeout(resolve, 0);
    });
}

describe('useClassificationMarkings', () => {
    let getPropertyFields: jest.SpyInstance;

    beforeEach(() => {
        getPropertyFields = jest.spyOn(Client4, 'getPropertyFields').mockResolvedValue([]);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('returns available=false when feature flag is disabled', () => {
        const {result} = renderHookWithContext(
            () => useClassificationMarkings(),
            stateWith({featureFlag: 'false', license: ADVANCED_LICENSE}),
        );

        expect(result.current.available).toBe(false);
        expect(result.current.loading).toBe(false);
        expect(result.current.levels).toEqual([]);
        expect(getPropertyFields).not.toHaveBeenCalled();
    });

    test('returns available=false when feature flag is missing from config', () => {
        const {result} = renderHookWithContext(
            () => useClassificationMarkings(),
            stateWith({license: ADVANCED_LICENSE}),
        );

        expect(result.current.available).toBe(false);
        expect(result.current.loading).toBe(false);
        expect(getPropertyFields).not.toHaveBeenCalled();
    });

    // The server refuses channel-scoped access_control fields below Enterprise
    // Advanced with a 501, so asking for them on Enterprise only produces an error.
    test('does not request the channel field on an Enterprise license', () => {
        const {result} = renderHookWithContext(
            () => useClassificationMarkings(),
            stateWith({featureFlag: 'true', license: ENTERPRISE_LICENSE}),
        );

        expect(result.current.available).toBe(false);
        expect(result.current.loading).toBe(false);
        expect(getPropertyFields).not.toHaveBeenCalled();
    });

    test('returns available=false when license is below Enterprise', () => {
        const {result} = renderHookWithContext(
            () => useClassificationMarkings(),
            stateWith({featureFlag: 'true', license: STARTER_LICENSE}),
        );

        expect(result.current.available).toBe(false);
        expect(result.current.loading).toBe(false);
        expect(getPropertyFields).not.toHaveBeenCalled();
    });

    test('returns available=false when license is missing entirely', () => {
        const {result} = renderHookWithContext(
            () => useClassificationMarkings(),
            stateWith({featureFlag: 'true', license: {}}),
        );

        expect(result.current.available).toBe(false);
        expect(getPropertyFields).not.toHaveBeenCalled();
    });

    test.each([
        ['Enterprise Advanced', ADVANCED_LICENSE],
        ['Entry', ENTRY_LICENSE],
    ])('requests the channel field and reports loading on an %s license', (_name, license) => {
        const {result} = renderHookWithContext(
            () => useClassificationMarkings(),
            stateWith({featureFlag: 'true', license}),
        );

        expect(result.current.loading).toBe(true);
        expect(result.current.available).toBe(false);
        expect(result.current.channelField).toBeNull();
        expect(result.current.levels).toEqual([]);

        expect(getPropertyFields).toHaveBeenCalledTimes(1);
        expect(getPropertyFields).toHaveBeenCalledWith(
            ACCESS_CONTROL_PROPERTY_GROUP,
            CLASSIFICATIONS_CHANNEL_OBJECT_TYPE,
            expect.objectContaining({targetType: CLASSIFICATIONS_FIELD_TARGET_TYPE, targetId: CLASSIFICATIONS_FIELD_TARGET_ID}),
        );
    });

    test('becomes available once the fetched channel field lands in the store', async () => {
        getPropertyFields.
            mockResolvedValueOnce([makeChannelField()]).
            mockResolvedValue([]);

        const {result} = renderHookWithContext(
            () => useClassificationMarkings(),
            stateWith({featureFlag: 'true', license: ADVANCED_LICENSE}),
        );

        await waitFor(() => expect(result.current.available).toBe(true));
        expect(result.current.loading).toBe(false);
        expect(result.current.channelField?.id).toBe('channel1');
        expect(result.current.levels.map((l) => l.name)).toEqual(['UNCLASSIFIED']);
    });

    test('a failed channel field request does not surface as an unhandled rejection', async () => {
        getPropertyFields.mockRejectedValue(new ClientError(Client4.getUrl(), {
            message: 'Channel attributes require an Enterprise Advanced license.',
            server_error_id: 'api.property.channel_attributes.license.app_error',
            status_code: 501,
            url: '/api/v4/properties/groups/access_control/channel/fields',
        }));
        const rejections = captureUnhandledRejections();

        try {
            const {result} = renderHookWithContext(
                () => useClassificationMarkings(),
                stateWith({featureFlag: 'true', license: ADVANCED_LICENSE}),
            );

            await waitFor(() => expect(getPropertyFields).toHaveBeenCalledTimes(1));
            await macrotask();

            expect(rejections.seen).toEqual([]);
            expect(getPropertyFields).toHaveBeenCalledTimes(1);
            expect(result.current.available).toBe(false);
            expect(result.current.channelField).toBeNull();
        } finally {
            rejections.stop();
        }
    });

    test('returns available=true and derives levels from channel field options', () => {
        const channel = makeChannelField({
            attrs: {
                options: [
                    {id: 'lvl2', name: 'SECRET', color: '#C8102E', rank: 2},
                    {id: 'lvl1', name: 'UNCLASSIFIED', color: '#007A33', rank: 1},
                ],
            },
        });

        const {result} = renderHookWithContext(
            () => useClassificationMarkings(),
            stateWith({featureFlag: 'true', license: ADVANCED_LICENSE, fields: {channel1: channel}}),
        );

        expect(result.current.available).toBe(true);
        expect(result.current.loading).toBe(false);
        expect(result.current.channelField).toBe(channel);
        expect(result.current.levels).toHaveLength(2);

        // Levels are sorted by rank ascending.
        expect(result.current.levels[0].name).toBe('UNCLASSIFIED');
        expect(result.current.levels[1].name).toBe('SECRET');
    });

    test('returns available=false when channel field exists but has no options', () => {
        const channel = makeChannelField({attrs: {options: []}});

        const {result} = renderHookWithContext(
            () => useClassificationMarkings(),
            stateWith({featureFlag: 'true', license: ADVANCED_LICENSE, fields: {channel1: channel}}),
        );

        expect(result.current.available).toBe(false);
        expect(result.current.loading).toBe(false);
        expect(result.current.channelField).toBe(channel);
        expect(result.current.levels).toEqual([]);
    });

    test('returns channelField=null when channel-linked field is missing linked_field_id', () => {
        const orphan = makeChannelField({id: 'orphan', linked_field_id: ''});

        const {result} = renderHookWithContext(
            () => useClassificationMarkings(),
            stateWith({
                featureFlag: 'true',
                license: ADVANCED_LICENSE,
                fields: {orphan},
            }),
        );

        expect(result.current.channelField).toBeNull();
    });

    test('returns channelField=null when channel-linked field is soft-deleted', () => {
        const deleted = makeChannelField({delete_at: 9999});

        const {result} = renderHookWithContext(
            () => useClassificationMarkings(),
            stateWith({
                featureFlag: 'true',
                license: ADVANCED_LICENSE,
                fields: {channel1: deleted},
            }),
        );

        expect(result.current.channelField).toBeNull();
    });

    test('does not request the channel field when it is already in the store', () => {
        const channel = makeChannelField();

        renderHookWithContext(
            () => useClassificationMarkings(),
            stateWith({
                featureFlag: 'true',
                license: ADVANCED_LICENSE,
                fields: {channel1: channel},
            }),
        );

        expect(getPropertyFields).not.toHaveBeenCalled();
    });
});
