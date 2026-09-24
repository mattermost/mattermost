// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {WebSocketMessage, WebSocketMessages} from '@mattermost/client';
import {WebSocketEvents} from '@mattermost/client';
import type {PropertyField} from '@mattermost/types/properties';
import type {UserPropertyField} from '@mattermost/types/properties_user';
import type {GlobalState} from '@mattermost/types/store';
import type {DeepPartial} from '@mattermost/types/utilities';

import {PropertyTypes} from 'mattermost-redux/action_types';
import {getCustomProfileAttributeFields} from 'mattermost-redux/actions/general';
import {fetchPropertyFields} from 'mattermost-redux/actions/properties';
import {getCustomProfileAttributes} from 'mattermost-redux/selectors/entities/general';
import {getPropertyFieldById} from 'mattermost-redux/selectors/entities/properties';

import {handlePropertyFieldCreatedOrUpdated, handlePropertyFieldDeleted} from 'actions/websocket_actions';
import realConfigureStore from 'store';

import {clearGraphOptionNameCache, commitGraphOptionNames, getGraphOptionNames} from 'components/property_fields/graph/use_graph_option_names';

import mockStore from 'tests/test_store';

jest.mock('mattermost-redux/actions/properties', () => ({
    fetchPropertyFields: jest.fn(() => ({type: ''})),
}));

jest.mock('mattermost-redux/actions/general', () => ({
    ...jest.requireActual('mattermost-redux/actions/general'),
    getCustomProfileAttributeFields: jest.fn(() => ({type: ''})),
}));

const CHANNEL_ID = 'channel_id_1';
const FIELD_ID = 'field_id_1';
const GROUP_ID = 'group_id_1';
const GROUP_NAME = 'group_name_1';

const CACHED_OPTIONS = [{id: 'option_id_1', name: 'AURORA'}];

function storedField(overrides: Record<string, unknown> = {}): PropertyField {
    return {
        id: FIELD_ID,
        group_id: GROUP_ID,
        name: 'Classification',
        type: 'select',
        attrs: {options: CACHED_OPTIONS, options_count: 1},
        target_id: CHANNEL_ID,
        target_type: 'channel',
        object_type: 'channel',
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        created_by: '',
        updated_by: '',
        ...overrides,
    } as PropertyField;
}

function dispatchEvent(field: Record<string, unknown>, {cachedField, cachedGroup = true}: {cachedField?: PropertyField; cachedGroup?: boolean} = {}) {
    const store = mockStore({
        entities: {
            general: {config: {}, license: {}},
            properties: {
                fields: {
                    byId: cachedField ? {[FIELD_ID]: cachedField} : {},
                    byObjectType: {},
                },
                values: {byTargetId: {}, byFieldId: {}},
                groups: {
                    byId: cachedGroup ? {[GROUP_ID]: {id: GROUP_ID, name: GROUP_NAME}} : {},
                    byName: {},
                },
            },
            channelCategories: {byId: {}, orderByTeam: {}},
        },
    });

    const msg = {
        event: 'property_field_updated',
        data: {property_field: JSON.stringify(field), object_type: 'channel'},
        broadcast: {omit_users: null, user_id: '', channel_id: CHANNEL_ID, team_id: ''},
        seq: 1,
    };

    store.dispatch(handlePropertyFieldCreatedOrUpdated(msg as any) as any);
    return store.getActions().flatMap((action: any) => (Array.isArray(action) ? action : [action]));
}

function receivedField(actions: any[]): any {
    return actions.find((a) => a.type === PropertyTypes.RECEIVED_PROPERTY_FIELDS)?.data.fields[0];
}

describe('property_field_updated withheld option lists', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('a withheld field keeps the cached options and triggers a refetch', () => {
        const eventField = storedField({attrs: {options_omitted: true}});
        const actions = dispatchEvent(eventField, {cachedField: storedField()});

        expect(receivedField(actions).attrs.options).toEqual(CACHED_OPTIONS);
        expect(receivedField(actions).attrs.options_count).toBe(1);
        expect(fetchPropertyFields).toHaveBeenCalledWith(GROUP_NAME, 'channel', 'channel', CHANNEL_ID);
    });

    test('an unmarked field is stored as received and triggers no refetch', () => {
        // No options_omitted marker: a genuinely option-less field is
        // indistinguishable from a withheld one without it, so the handler
        // keys on the marker alone.
        const eventField = storedField({attrs: {}});
        const actions = dispatchEvent(eventField, {cachedField: storedField()});

        expect(receivedField(actions).attrs.options).toBeUndefined();
        expect(fetchPropertyFields).not.toHaveBeenCalled();
    });

    test('a withheld field with nothing cached is stored as received, refetch still fires', () => {
        const eventField = storedField({attrs: {options_omitted: true}});
        const actions = dispatchEvent(eventField);

        expect(receivedField(actions).attrs.options).toBeUndefined();
        expect(fetchPropertyFields).toHaveBeenCalledWith(GROUP_NAME, 'channel', 'channel', CHANNEL_ID);
    });

    test('a withheld field whose group is unknown triggers no refetch', () => {
        const eventField = storedField({attrs: {options_omitted: true}});
        const actions = dispatchEvent(eventField, {cachedField: storedField(), cachedGroup: false});

        expect(receivedField(actions).attrs.options).toEqual(CACHED_OPTIONS);
        expect(fetchPropertyFields).not.toHaveBeenCalled();
    });

    test("a withheld field still applies the event's other changes", () => {
        const eventField = storedField({name: 'Renamed', attrs: {options_omitted: true}});
        const actions = dispatchEvent(eventField, {cachedField: storedField()});

        expect(receivedField(actions).name).toBe('Renamed');
        expect(receivedField(actions).attrs.options).toEqual(CACHED_OPTIONS);
    });
});

describe('property_field_updated graph option names', () => {
    beforeEach(() => {
        clearGraphOptionNameCache();
    });

    test('a graph field carrying options replaces the cached names', () => {
        commitGraphOptionNames(FIELD_ID, {option_id_1: 'AURORA', option_id_gone: 'REMOVED'});

        const eventField = storedField({
            type: 'graph',
            attrs: {options: [{id: 'option_id_1', name: 'BOREALIS'}, {id: 'option_id_2', name: 'CIRRUS'}]},
        });
        dispatchEvent(eventField);

        expect(getGraphOptionNames(FIELD_ID)).toEqual({
            names: {option_id_1: 'BOREALIS', option_id_2: 'CIRRUS'},
            didResolve: true,
        });
    });

    test('a graph field with a withheld option list leaves the field unresolved', () => {
        commitGraphOptionNames(FIELD_ID, {option_id_1: 'AURORA'});

        const eventField = storedField({type: 'graph', attrs: {options_omitted: true}});
        dispatchEvent(eventField, {cachedField: storedField({type: 'graph'})});

        expect(getGraphOptionNames(FIELD_ID)).toEqual({names: {}, didResolve: false});
    });

    test('a non-graph field leaves the cached names untouched', () => {
        commitGraphOptionNames(FIELD_ID, {option_id_1: 'AURORA'});

        dispatchEvent(storedField());

        expect(getGraphOptionNames(FIELD_ID)).toEqual({
            names: {option_id_1: 'AURORA'},
            didResolve: true,
        });
    });
});

// Attribute Management saves user attributes through the generic property-fields
// API, so these events are the only notice User Management and the profile
// surfaces get that a definition changed. Those surfaces read the custom profile
// attribute slice, which is what these assert on.
describe('property_field events for user attributes', () => {
    // Real fields carry the group's UUID; UserPropertyField still types group_id
    // as the legacy group names, so these stay widened to plain strings.
    const CPA_GROUP_ID: string = 'access_control_group_id';
    const OTHER_GROUP_ID: string = 'plugin_group_id';

    function wsMessage<T extends WebSocketMessage>(msg: DeepPartial<T>): T {
        return msg as unknown as T;
    }

    function userAttribute({attrs, ...overrides}: Record<string, unknown> & {attrs?: Record<string, unknown>} = {}): UserPropertyField {
        return {
            id: 'clearance_field_id',
            group_id: CPA_GROUP_ID,
            name: 'clearance',
            type: 'text',
            attrs: {
                display_name: 'Clearance Level',
                visibility: 'when_set',
                sort_order: 0,
                value_type: '',
                ...attrs,
            },
            target_id: '',
            target_type: 'system',
            object_type: 'user',
            create_at: 1,
            update_at: 1,
            delete_at: 0,
            created_by: '',
            updated_by: '',
            ...overrides,
        } as UserPropertyField;
    }

    function makeStore(
        customProfileAttributes: Record<string, UserPropertyField>,
        {groupCachedByName = false, cachedPropertyFields = [] as PropertyField[], licensed = true} = {},
    ) {
        return realConfigureStore({
            entities: {
                general: {
                    customProfileAttributes,

                    // property_field_* events fan out to every client; the CPA
                    // slice only exists under an Enterprise license, so the
                    // handler ignores these events without one.
                    license: licensed ? {IsLicensed: 'true', SkuShortName: 'enterprise'} : {},
                },
                properties: {
                    fields: {
                        byId: Object.fromEntries(cachedPropertyFields.map((field) => [field.id, field])),
                        byObjectType: {},
                    },
                    groups: groupCachedByName ? {
                        byId: {[CPA_GROUP_ID]: {id: CPA_GROUP_ID, name: 'access_control'}},
                        byName: {access_control: {id: CPA_GROUP_ID, name: 'access_control'}},
                    } : {byId: {}, byName: {}},
                },
            },
        });
    }

    function createdEvent(field: PropertyField) {
        return wsMessage<WebSocketMessages.PropertyFieldCreated>({
            event: WebSocketEvents.PropertyFieldCreated,
            data: {property_field: JSON.stringify(field), object_type: field.object_type},
        });
    }

    function updatedEvent(field: PropertyField) {
        return wsMessage<WebSocketMessages.PropertyFieldUpdated>({
            event: WebSocketEvents.PropertyFieldUpdated,
            data: {property_field: JSON.stringify(field), object_type: field.object_type},
        });
    }

    function deletedEvent(fieldId: string, objectType: string) {
        return wsMessage<WebSocketMessages.PropertyFieldDeleted>({
            event: WebSocketEvents.PropertyFieldDeleted,
            data: {field_id: fieldId, object_type: objectType},
        });
    }

    function attributeNames(state: GlobalState): string[] {
        return getCustomProfileAttributes(state).map((field) => field.name);
    }

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('a newly created user attribute joins the existing ones in sort order', () => {
        const existing = userAttribute({attrs: {sort_order: 1}});
        const store = makeStore({[existing.id]: existing});

        const created = userAttribute({
            id: 'duty_station_field_id',
            name: 'duty_station',
            attrs: {sort_order: 0},
        });
        store.dispatch(handlePropertyFieldCreatedOrUpdated(createdEvent(created)));

        expect(attributeNames(store.getState())).toEqual(['duty_station', 'clearance']);
        expect(getCustomProfileAttributeFields).not.toHaveBeenCalled();

        // The generic slice still gets the field, as every other consumer relies on.
        expect(getPropertyFieldById(store.getState(), created.id)).toMatchObject({id: created.id});
    });

    test('an updated user attribute replaces the cached definition rather than merging into it', () => {
        const existing = userAttribute({attrs: {sort_order: 0, ldap: 'department'}});
        const store = makeStore({[existing.id]: existing});

        const adminManaged = userAttribute({attrs: {sort_order: 0, managed: 'admin'}});
        store.dispatch(handlePropertyFieldCreatedOrUpdated(updatedEvent(adminManaged)));

        const fields = getCustomProfileAttributes(store.getState());
        expect(fields).toHaveLength(1);
        expect(fields[0].attrs.managed).toBe('admin');
        expect(fields[0].attrs.ldap).toBeUndefined();
    });

    test('a deleted user attribute disappears from both slices', () => {
        const existing = userAttribute();
        const store = makeStore({[existing.id]: existing}, {cachedPropertyFields: [existing]});

        store.dispatch(handlePropertyFieldDeleted(deletedEvent(existing.id, 'user')));

        expect(getCustomProfileAttributes(store.getState())).toEqual([]);
        expect(getPropertyFieldById(store.getState(), existing.id)).toBeUndefined();
    });

    test('the first user attribute is picked up from the cached access_control group', () => {
        const store = makeStore({}, {groupCachedByName: true});

        store.dispatch(handlePropertyFieldCreatedOrUpdated(createdEvent(userAttribute())));

        expect(attributeNames(store.getState())).toEqual(['clearance']);
        expect(getCustomProfileAttributeFields).not.toHaveBeenCalled();
    });

    test('a user attribute is ignored while the access_control group is unknown', () => {
        // Nothing has resolved access_control to its UUID yet, so a user-object
        // field cannot be told apart from one in some other group. Ignore it
        // rather than refetch on every such event -- the mount and reconnect
        // fetches pick up anything missed.
        const store = makeStore({});

        store.dispatch(handlePropertyFieldCreatedOrUpdated(createdEvent(userAttribute())));

        expect(getCustomProfileAttributeFields).not.toHaveBeenCalled();
        expect(getCustomProfileAttributes(store.getState())).toEqual([]);
    });

    test('an unlicensed server ignores user-object field events', () => {
        // The group is resolvable here, so only the license gate keeps the field
        // out of the slice.
        const store = makeStore({}, {groupCachedByName: true, licensed: false});

        store.dispatch(handlePropertyFieldCreatedOrUpdated(createdEvent(userAttribute())));

        expect(attributeNames(store.getState())).toEqual([]);
        expect(getCustomProfileAttributeFields).not.toHaveBeenCalled();
    });

    test('a channel attribute from the same group is not a user attribute', () => {
        const existing = userAttribute();
        const store = makeStore({[existing.id]: existing});

        const channelField = userAttribute({
            id: 'channel_field_id',
            name: 'classification',
            object_type: 'channel',
        });
        store.dispatch(handlePropertyFieldCreatedOrUpdated(createdEvent(channelField)));

        expect(attributeNames(store.getState())).toEqual(['clearance']);
    });

    test.each([
        ['resolved from a cached user attribute', false],
        ['resolved from the cached access_control group', true],
    ])('a user-object field from another group is not a user attribute (%s)', (_label, groupCachedByName) => {
        const existing = userAttribute();
        const store = makeStore({[existing.id]: existing}, {groupCachedByName});

        const pluginField = userAttribute({
            id: 'plugin_field_id',
            name: 'plugin_owned',
            group_id: OTHER_GROUP_ID,
        });
        store.dispatch(handlePropertyFieldCreatedOrUpdated(createdEvent(pluginField)));

        expect(attributeNames(store.getState())).toEqual(['clearance']);
        expect(getCustomProfileAttributeFields).not.toHaveBeenCalled();
    });

    test('a user-object field from another group is ignored while the access_control group is unknown', () => {
        // The plugin field must not land in the CPA slice, and with nothing to
        // tell the groups apart yet the event is simply dropped.
        const store = makeStore({});

        const pluginField = userAttribute({
            id: 'plugin_field_id',
            name: 'plugin_owned',
            group_id: OTHER_GROUP_ID,
        });
        store.dispatch(handlePropertyFieldCreatedOrUpdated(createdEvent(pluginField)));

        expect(getCustomProfileAttributeFields).not.toHaveBeenCalled();
        expect(getCustomProfileAttributes(store.getState())).toEqual([]);
    });

    test('deleting an unrelated field removes it without touching the user attributes', () => {
        const existing = userAttribute();
        const channelField = userAttribute({id: 'channel_field_id', object_type: 'channel'});
        const store = makeStore({[existing.id]: existing}, {cachedPropertyFields: [existing, channelField]});

        store.dispatch(handlePropertyFieldDeleted(deletedEvent(channelField.id, 'channel')));

        expect(attributeNames(store.getState())).toEqual(['clearance']);
        expect(getPropertyFieldById(store.getState(), channelField.id)).toBeUndefined();
    });

    // The generic scope refetch only fires when the group name is resolvable, so
    // it varies with the cache while the user attribute options restore does not.
    test.each([
        ['the access_control group is not cached', false, 0],
        ['the access_control group is cached', true, 1],
    ])('a user attribute whose options were withheld is restored from the cached definition, when %s', (_label, groupCachedByName, scopeRefetches) => {
        const existing = userAttribute({
            type: 'select',
            attrs: {options: [{id: 'option_id_1', name: 'AURORA'}]},
        });
        const store = makeStore({[existing.id]: existing}, {groupCachedByName});

        const withheld = userAttribute({type: 'select', attrs: {options_omitted: true}});
        store.dispatch(handlePropertyFieldCreatedOrUpdated(updatedEvent(withheld)));

        // Patched in place from the field's own cached entry rather than dropping
        // the whole map and reloading it.
        expect(getCustomProfileAttributes(store.getState())[0].attrs.options).toEqual([{id: 'option_id_1', name: 'AURORA'}]);
        expect(getCustomProfileAttributeFields).not.toHaveBeenCalled();
        expect(fetchPropertyFields).toHaveBeenCalledTimes(scopeRefetches);
    });

    test('a user attribute whose options were withheld with nothing cached is read back from the server', () => {
        // No prior entry to restore the options from, so a stripped definition
        // would blank them for every reader -- read the authoritative list back.
        const store = makeStore({}, {groupCachedByName: true});

        const withheld = userAttribute({type: 'select', attrs: {options_omitted: true}});
        store.dispatch(handlePropertyFieldCreatedOrUpdated(updatedEvent(withheld)));

        expect(getCustomProfileAttributeFields).toHaveBeenCalledTimes(1);
    });
});
