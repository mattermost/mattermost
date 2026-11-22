// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';
import type {DeepPartial} from '@mattermost/types/utilities';

import {Client4} from 'mattermost-redux/client';

import {renderHookWithContext, waitFor} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

import useChannelAttributes from './useChannelAttributes';
import useClassificationMarkings from './useClassificationMarkings';
import useRequiredChannelAttributesToAsk from './useRequiredChannelAttributesToAsk';

jest.mock('./useChannelAttributes');
jest.mock('./useClassificationMarkings');
jest.mock('mattermost-redux/client', () => ({
    Client4: {
        getPropertyValues: jest.fn(),
    },
}));

let mockChannelPermissions: Record<string, boolean> = {};
jest.mock('mattermost-redux/selectors/entities/roles', () => ({
    ...jest.requireActual('mattermost-redux/selectors/entities/roles'),
    haveIChannelPermission: jest.fn().mockImplementation((_state, _teamId, _channelId, permission) => (
        mockChannelPermissions[permission] ?? false
    )),
}));

const mockUseChannelAttributes = jest.mocked(useChannelAttributes);
const mockUseClassificationMarkings = jest.mocked(useClassificationMarkings);
const mockGetPropertyValues = jest.mocked(Client4.getPropertyValues);

const CHANNEL_ID = 'channel1';
const TEAM_ID = 'team1';

function field(id: string, overrides: Partial<PropertyField> = {}): PropertyField {
    return {
        id,
        group_id: 'group1',
        name: id,
        type: 'select',
        target_id: '',
        target_type: 'system',
        object_type: 'channel',
        permission_values: 'admin',
        attrs: {required: true, display_name: id, options: [{id: 'o1', name: 'One'}]},
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        created_by: '',
        updated_by: '',
        ...overrides,
    };
}

function makeState({isSystemAdmin = false, requiredFlag = 'true'} = {}): DeepPartial<GlobalState> {
    return {
        entities: {
            general: {
                config: {
                    FeatureFlagChannelAttributes: 'true',
                    FeatureFlagChannelAttributesRequired: requiredFlag,
                },
            },
            channels: {
                channels: {[CHANNEL_ID]: {id: CHANNEL_ID, team_id: TEAM_ID, type: 'O', delete_at: 0}},
            },
            users: {
                currentUserId: 'user1',
                profiles: {user1: {id: 'user1', roles: isSystemAdmin ? 'system_admin' : 'system_user'}},
            },
            properties: {
                values: {byTargetId: {}, byFieldId: {}},
                loadedValueTargets: {[CHANNEL_ID]: true},
            },
        },
    } as DeepPartial<GlobalState>;
}

function useFields(fields: PropertyField[], enabled = true) {
    mockUseChannelAttributes.mockReturnValue({enabled, loading: false, failed: false, fields: enabled ? fields : []});
}

function useClassification(available: boolean, fieldId = 'classification') {
    mockUseClassificationMarkings.mockReturnValue({
        available,
        loading: false,
        channelField: available ? field(fieldId) : null,
        levels: [],
    } as unknown as ReturnType<typeof useClassificationMarkings>);
}

describe('useRequiredChannelAttributesToAsk', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockChannelPermissions = {read_channel: true, manage_channel_roles: true};
        useClassification(false);
        useFields([field('program')]);
    });

    describe('without a channel', () => {
        const render = (state = makeState()) => renderHookWithContext(() => useRequiredChannelAttributesToAsk({teamId: TEAM_ID}), state);

        test('asks for every required field and makes no value request', () => {
            useFields([field('program'), field('optional', {attrs: {required: false, options: []}})]);
            const {result} = render();

            expect(result.current.fields.map((f) => f.id)).toEqual(['program']);
            expect(result.current.cannotSet).toEqual([]);
            expect(result.current.enabled).toBe(true);
            expect(mockGetPropertyValues).not.toHaveBeenCalled();
        });

        test('leaves out none-level, unset-level and unsupported field types', () => {
            useFields([
                field('none', {permission_values: 'none'}),
                field('unset', {permission_values: undefined}),
                field('joined', {type: 'date'}),
                field('program'),
            ]);
            const {result} = render();

            expect(result.current.fields.map((f) => f.id)).toEqual(['program']);
        });

        test('a sysadmin-level field is asked of system admins only', () => {
            useFields([field('program', {permission_values: 'sysadmin'})]);

            expect(render().result.current.fields).toEqual([]);
            expect(render(makeState({isSystemAdmin: true})).result.current.fields.map((f) => f.id)).toEqual(['program']);
        });

        test('asks nothing while the Required flag is off', () => {
            const {result} = render(makeState({requiredFlag: 'false'}));

            expect(result.current.fields).toEqual([]);
            expect(result.current.enabled).toBe(true);
        });

        test('classification stays offered, as optional, while the Required flag is off', () => {
            useClassification(true);
            useFields([field('classification'), field('program')]);
            const {result} = render(makeState({requiredFlag: 'false'}));

            expect(result.current.fields.map((f) => f.id)).toEqual(['classification']);
            expect(result.current.fields[0].attrs?.required).toBe(false);
        });

        test('reports the attribute feature as unavailable with nothing to ask', () => {
            useFields([field('program')], false);
            const {result} = render();

            expect(result.current).toMatchObject({fields: [], cannotSet: [], enabled: false});
        });

        test('passes loading through', () => {
            mockUseChannelAttributes.mockReturnValue({enabled: true, loading: true, failed: false, fields: []});

            expect(render().result.current.loading).toBe(true);
        });
    });

    describe('with a channel', () => {
        beforeEach(() => {
            mockGetPropertyValues.mockResolvedValue([] as never);
        });

        const render = (state = makeState()) => renderHookWithContext(() => useRequiredChannelAttributesToAsk({teamId: TEAM_ID, channelId: CHANNEL_ID}), state);

        test('asks for the missing fields the person can set', async () => {
            useFields([field('program'), field('other')]);
            const {result} = render();
            await waitFor(() => expect(mockGetPropertyValues).toHaveBeenCalled());
            await waitFor(() => expect(result.current.loading).toBe(false));

            expect(result.current.fields.map((f) => f.id)).toEqual(['program', 'other']);
            expect(result.current.cannotSet).toEqual([]);
            expect(result.current.enabled).toBe(true);
        });

        test('a field that already has a value is not asked', async () => {
            useFields([field('program'), field('other')]);
            mockGetPropertyValues.mockResolvedValue([{id: 'v1', field_id: 'program', target_id: CHANNEL_ID, value: 'o1'}] as never);
            const {result} = render();
            await waitFor(() => expect(mockGetPropertyValues).toHaveBeenCalled());
            await waitFor(() => expect(result.current.loading).toBe(false));

            expect(result.current.fields.map((f) => f.id)).toEqual(['other']);
        });

        test('a field the person cannot set goes to cannotSet', async () => {
            useFields([field('program', {permission_values: 'sysadmin'}), field('other')]);
            const {result} = render();
            await waitFor(() => expect(mockGetPropertyValues).toHaveBeenCalled());
            await waitFor(() => expect(result.current.loading).toBe(false));

            expect(result.current.fields.map((f) => f.id)).toEqual(['other']);
            expect(result.current.cannotSet.map((f) => f.id)).toEqual(['program']);
        });

        test('a field with no editor goes to cannotSet even for a system admin', async () => {
            useFields([field('joined', {type: 'date'}), field('program')]);
            const {result} = render(makeState({isSystemAdmin: true}));
            await waitFor(() => expect(mockGetPropertyValues).toHaveBeenCalled());
            await waitFor(() => expect(result.current.loading).toBe(false));

            expect(result.current.fields.map((f) => f.id)).toEqual(['program']);
            expect(result.current.cannotSet.map((f) => f.id)).toEqual(['joined']);
        });

        test('a plain member can set nothing', async () => {
            mockChannelPermissions = {read_channel: true, manage_channel_roles: false};
            const {result} = render();
            await waitFor(() => expect(mockGetPropertyValues).toHaveBeenCalled());
            await waitFor(() => expect(result.current.loading).toBe(false));

            expect(result.current.fields).toEqual([]);
            expect(result.current.cannotSet.map((f) => f.id)).toEqual(['program']);
        });

        test('always fetches the channel values fresh, ignoring a cached copy', async () => {
            const state = makeState();
            state.entities!.properties!.values = {
                byTargetId: {[CHANNEL_ID]: {program: {id: 'v1', field_id: 'program', target_id: CHANNEL_ID, value: 'o1'}}},
                byFieldId: {},
            } as never;
            mockGetPropertyValues.mockResolvedValue([] as never);
            const {result} = render(state);
            await waitFor(() => expect(mockGetPropertyValues).toHaveBeenCalled());
            await waitFor(() => expect(result.current.loading).toBe(false));

            expect(mockGetPropertyValues).toHaveBeenCalled();
            expect(result.current.fields.map((f) => f.id)).toEqual(['program']);
        });

        test('asks nothing while the Required flag is off, classification included', () => {
            useClassification(true);
            useFields([field('classification'), field('program')]);
            const {result} = render(makeState({requiredFlag: 'false'}));

            expect(result.current).toMatchObject({fields: [], cannotSet: [], enabled: false});
            expect(mockGetPropertyValues).not.toHaveBeenCalled();
        });

        test('asks nothing without the attribute feature or license', () => {
            useFields([field('program')], false);
            const {result} = render();

            expect(result.current).toMatchObject({fields: [], cannotSet: [], enabled: false});
            expect(mockGetPropertyValues).not.toHaveBeenCalled();
        });
    });

    describe('requiredOnly', () => {
        const renderRequiredOnly = (channelId?: string, state = makeState({requiredFlag: 'false'})) => renderHookWithContext(
            () => useRequiredChannelAttributesToAsk({teamId: TEAM_ID, channelId}, {requiredOnly: true}),
            state,
        );

        test.each([[undefined], [CHANNEL_ID]])('sends no field request and never loads while the Required flag is off (channelId %s)', (channelId) => {
            useClassification(true);
            mockUseChannelAttributes.mockReturnValue({enabled: false, loading: false, failed: false, fields: []});
            const {result} = renderRequiredOnly(channelId);

            expect(mockUseChannelAttributes).toHaveBeenCalledWith({skip: true});
            expect(mockUseClassificationMarkings).toHaveBeenCalledWith({skipFetch: true});
            expect(mockGetPropertyValues).not.toHaveBeenCalled();
            expect(result.current).toMatchObject({fields: [], cannotSet: [], loading: false});
        });

        test('loads the fields as usual while the Required flag is on', () => {
            renderRequiredOnly(undefined, makeState());

            expect(mockUseChannelAttributes).toHaveBeenCalledWith({skip: false});
        });

        test('the default mode keeps loading the fields while the Required flag is off', () => {
            renderHookWithContext(() => useRequiredChannelAttributesToAsk({teamId: TEAM_ID}), makeState({requiredFlag: 'false'}));

            expect(mockUseChannelAttributes).toHaveBeenCalledWith({skip: false});
        });
    });

    describe('skip', () => {
        test('fetches and asks nothing for a closed dialog, even with the Required flag on', () => {
            useClassification(true);
            mockUseChannelAttributes.mockReturnValue({enabled: false, loading: false, failed: false, fields: []});
            const {result} = renderHookWithContext(
                () => useRequiredChannelAttributesToAsk({teamId: TEAM_ID, channelId: CHANNEL_ID}, {requiredOnly: true, skip: true}),
                makeState(),
            );

            expect(mockUseChannelAttributes).toHaveBeenCalledWith({skip: true});
            expect(mockUseClassificationMarkings).toHaveBeenCalledWith({skipFetch: true});
            expect(mockGetPropertyValues).not.toHaveBeenCalled();
            expect(result.current).toMatchObject({fields: [], cannotSet: [], loading: false});
        });
    });
});
