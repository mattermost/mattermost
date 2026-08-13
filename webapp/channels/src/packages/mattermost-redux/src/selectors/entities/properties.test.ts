// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField, PropertyValue} from '@mattermost/types/properties';
import type {GlobalState} from '@mattermost/types/store';
import type {DeepPartial} from '@mattermost/types/utilities';

import deepFreeze from 'mattermost-redux/utils/deep_freeze';

import {
    getPropertyFieldsForObjectTypeAndGroup,
    getPropertyFieldById,
    getPropertyFieldsByIds,
    getPropertyGroupById,
    getPropertyGroupByName,
    getPropertyValuesForTarget,
    getPropertyValueForTargetField,
    getPropertyValuesForTargetByFieldIds,
    getPropertyValuesForField,
    getChannelAttributeFields,
    getChannelLabelFields,
    makeGetResolvedChannelAttributes,
} from './properties';

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

describe('Field selectors', () => {
    describe('getPropertyFieldsForObjectTypeAndGroup', () => {
        test('returns fields for exact match', () => {
            const field1 = makeField({id: 'f1'});
            const field2 = makeField({id: 'f2'});
            const state: DeepPartial<GlobalState> = {
                entities: {
                    properties: {
                        fields: {
                            byObjectType: {
                                post: {
                                    'group-1': {f1: field1, f2: field2},
                                },
                            },
                            byId: {f1: field1, f2: field2},
                        },
                        values: {byTargetId: {}, byFieldId: {}},
                        groups: {byId: {}, byName: {}},
                    },
                },
            };

            const result = getPropertyFieldsForObjectTypeAndGroup(state as GlobalState, 'post', 'group-1');
            expect(result).toHaveLength(2);
            expect(result).toContain(field1);
            expect(result).toContain(field2);
        });

        test('returns empty array for unknown object type', () => {
            const state: DeepPartial<GlobalState> = {
                entities: {
                    properties: {
                        fields: {byObjectType: {}, byId: {}},
                        values: {byTargetId: {}, byFieldId: {}},
                        groups: {byId: {}, byName: {}},
                    },
                },
            };

            expect(getPropertyFieldsForObjectTypeAndGroup(state as GlobalState, 'unknown', 'g1')).toEqual([]);
        });

        test('returns empty array for unknown group', () => {
            const state: DeepPartial<GlobalState> = {
                entities: {
                    properties: {
                        fields: {
                            byObjectType: {post: {}},
                            byId: {},
                        },
                        values: {byTargetId: {}, byFieldId: {}},
                        groups: {byId: {}, byName: {}},
                    },
                },
            };

            expect(getPropertyFieldsForObjectTypeAndGroup(state as GlobalState, 'post', 'unknown')).toEqual([]);
        });
    });

    describe('getPropertyFieldById', () => {
        test('returns the field for a known ID', () => {
            const field = makeField({id: 'f1'});
            const state: DeepPartial<GlobalState> = {
                entities: {
                    properties: {
                        fields: {byObjectType: {}, byId: {f1: field}},
                        values: {byTargetId: {}, byFieldId: {}},
                        groups: {byId: {}, byName: {}},
                    },
                },
            };

            expect(getPropertyFieldById(state as GlobalState, 'f1')).toBe(field);
        });

        test('returns undefined for an unknown ID', () => {
            const state: DeepPartial<GlobalState> = {
                entities: {
                    properties: {
                        fields: {byObjectType: {}, byId: {}},
                        values: {byTargetId: {}, byFieldId: {}},
                        groups: {byId: {}, byName: {}},
                    },
                },
            };

            expect(getPropertyFieldById(state as GlobalState, 'unknown')).toBeUndefined();
        });
    });

    describe('getPropertyFieldsByIds', () => {
        test('returns all matching fields, preserving order', () => {
            const field1 = makeField({id: 'f1'});
            const field2 = makeField({id: 'f2'});
            const field3 = makeField({id: 'f3'});
            const state: DeepPartial<GlobalState> = {
                entities: {
                    properties: {
                        fields: {byObjectType: {}, byId: {f1: field1, f2: field2, f3: field3}},
                        values: {byTargetId: {}, byFieldId: {}},
                        groups: {byId: {}, byName: {}},
                    },
                },
            };

            const result = getPropertyFieldsByIds(state as GlobalState, ['f3', 'f1', 'f2']);
            expect(result).toEqual([field3, field1, field2]);
        });

        test('skips unknown IDs without error', () => {
            const field1 = makeField({id: 'f1'});
            const state: DeepPartial<GlobalState> = {
                entities: {
                    properties: {
                        fields: {byObjectType: {}, byId: {f1: field1}},
                        values: {byTargetId: {}, byFieldId: {}},
                        groups: {byId: {}, byName: {}},
                    },
                },
            };

            const result = getPropertyFieldsByIds(state as GlobalState, ['f1', 'unknown']);
            expect(result).toEqual([field1]);
        });

        test('returns empty array when no IDs match', () => {
            const state: DeepPartial<GlobalState> = {
                entities: {
                    properties: {
                        fields: {byObjectType: {}, byId: {}},
                        values: {byTargetId: {}, byFieldId: {}},
                        groups: {byId: {}, byName: {}},
                    },
                },
            };

            expect(getPropertyFieldsByIds(state as GlobalState, ['a', 'b'])).toEqual([]);
        });
    });
});

describe('Value selectors', () => {
    describe('getPropertyValuesForTarget', () => {
        test('returns all values as an array for a known target', () => {
            const val1 = makeValue({id: 'v1', field_id: 'f1'});
            const val2 = makeValue({id: 'v2', field_id: 'f2'});
            const state: DeepPartial<GlobalState> = {
                entities: {
                    properties: {
                        fields: {byObjectType: {}, byId: {}},
                        values: {
                            byTargetId: {'target-1': {f1: val1, f2: val2}},
                            byFieldId: {},
                        },
                        groups: {byId: {}, byName: {}},
                    },
                },
            };

            const result = getPropertyValuesForTarget(state as GlobalState, 'target-1');
            expect(result).toHaveLength(2);
            expect(result).toContain(val1);
            expect(result).toContain(val2);
        });

        test('returns empty array for unknown target', () => {
            const state: DeepPartial<GlobalState> = {
                entities: {
                    properties: {
                        fields: {byObjectType: {}, byId: {}},
                        values: {byTargetId: {}, byFieldId: {}},
                        groups: {byId: {}, byName: {}},
                    },
                },
            };

            expect(getPropertyValuesForTarget(state as GlobalState, 'unknown')).toEqual([]);
        });
    });

    describe('getPropertyValueForTargetField', () => {
        test('returns value for known target+field', () => {
            const val = makeValue({id: 'v1', target_id: 't1', field_id: 'f1'});
            const state: DeepPartial<GlobalState> = {
                entities: {
                    properties: {
                        fields: {byObjectType: {}, byId: {}},
                        values: {
                            byTargetId: {t1: {f1: val}},
                            byFieldId: {},
                        },
                        groups: {byId: {}, byName: {}},
                    },
                },
            };

            expect(getPropertyValueForTargetField(state as GlobalState, 't1', 'f1')).toBe(val);
        });

        test('returns undefined for unknown target or field', () => {
            const state: DeepPartial<GlobalState> = {
                entities: {
                    properties: {
                        fields: {byObjectType: {}, byId: {}},
                        values: {byTargetId: {}, byFieldId: {}},
                        groups: {byId: {}, byName: {}},
                    },
                },
            };

            expect(getPropertyValueForTargetField(state as GlobalState, 'unknown', 'f1')).toBeUndefined();
            expect(getPropertyValueForTargetField(state as GlobalState, 't1', 'unknown')).toBeUndefined();
        });
    });

    describe('getPropertyValuesForTargetByFieldIds', () => {
        test('returns matching values preserving fieldIds order', () => {
            const val1 = makeValue({id: 'v1', field_id: 'f1'});
            const val2 = makeValue({id: 'v2', field_id: 'f2'});
            const val3 = makeValue({id: 'v3', field_id: 'f3'});
            const state: DeepPartial<GlobalState> = {
                entities: {
                    properties: {
                        fields: {byObjectType: {}, byId: {}},
                        values: {
                            byTargetId: {t1: {f1: val1, f2: val2, f3: val3}},
                            byFieldId: {},
                        },
                        groups: {byId: {}, byName: {}},
                    },
                },
            };

            const result = getPropertyValuesForTargetByFieldIds(state as GlobalState, 't1', ['f3', 'f1']);
            expect(result).toEqual([val3, val1]);
        });

        test('skips unknown fieldIds', () => {
            const val1 = makeValue({id: 'v1', field_id: 'f1'});
            const state: DeepPartial<GlobalState> = {
                entities: {
                    properties: {
                        fields: {byObjectType: {}, byId: {}},
                        values: {
                            byTargetId: {t1: {f1: val1}},
                            byFieldId: {},
                        },
                        groups: {byId: {}, byName: {}},
                    },
                },
            };

            const result = getPropertyValuesForTargetByFieldIds(state as GlobalState, 't1', ['f1', 'unknown']);
            expect(result).toEqual([val1]);
        });

        test('returns empty array for unknown target', () => {
            const state: DeepPartial<GlobalState> = {
                entities: {
                    properties: {
                        fields: {byObjectType: {}, byId: {}},
                        values: {byTargetId: {}, byFieldId: {}},
                        groups: {byId: {}, byName: {}},
                    },
                },
            };

            expect(getPropertyValuesForTargetByFieldIds(state as GlobalState, 'unknown', ['f1'])).toEqual([]);
        });
    });

    describe('getPropertyValuesForField', () => {
        test('returns all values as an array for a known field across all targets', () => {
            const val1 = makeValue({id: 'v1', target_id: 't1'});
            const val2 = makeValue({id: 'v2', target_id: 't2'});
            const state: DeepPartial<GlobalState> = {
                entities: {
                    properties: {
                        fields: {byObjectType: {}, byId: {}},
                        values: {
                            byTargetId: {},
                            byFieldId: {'field-1': {t1: val1, t2: val2}},
                        },
                        groups: {byId: {}, byName: {}},
                    },
                },
            };

            const result = getPropertyValuesForField(state as GlobalState, 'field-1');
            expect(result).toHaveLength(2);
            expect(result).toContain(val1);
            expect(result).toContain(val2);
        });

        test('returns empty array for unknown field', () => {
            const state: DeepPartial<GlobalState> = {
                entities: {
                    properties: {
                        fields: {byObjectType: {}, byId: {}},
                        values: {byTargetId: {}, byFieldId: {}},
                        groups: {byId: {}, byName: {}},
                    },
                },
            };

            expect(getPropertyValuesForField(state as GlobalState, 'unknown')).toEqual([]);
        });
    });
});

describe('Group selectors', () => {
    describe('getPropertyGroupById', () => {
        test('returns group for known ID', () => {
            const group = {id: 'g1', name: 'test'};
            const state: DeepPartial<GlobalState> = {
                entities: {
                    properties: {
                        fields: {byObjectType: {}, byId: {}},
                        values: {byTargetId: {}, byFieldId: {}},
                        groups: {byId: {g1: group}, byName: {test: group}},
                    },
                },
            };

            expect(getPropertyGroupById(state as GlobalState, 'g1')).toBe(group);
        });

        test('returns undefined for unknown ID', () => {
            const state: DeepPartial<GlobalState> = {
                entities: {
                    properties: {
                        fields: {byObjectType: {}, byId: {}},
                        values: {byTargetId: {}, byFieldId: {}},
                        groups: {byId: {}, byName: {}},
                    },
                },
            };

            expect(getPropertyGroupById(state as GlobalState, 'unknown')).toBeUndefined();
        });
    });

    describe('getPropertyGroupByName', () => {
        test('returns group for known name', () => {
            const group = {id: 'g1', name: 'test'};
            const state: DeepPartial<GlobalState> = {
                entities: {
                    properties: {
                        fields: {byObjectType: {}, byId: {}},
                        values: {byTargetId: {}, byFieldId: {}},
                        groups: {byId: {g1: group}, byName: {test: group}},
                    },
                },
            };

            expect(getPropertyGroupByName(state as GlobalState, 'test')).toBe(group);
        });

        test('returns undefined for unknown name', () => {
            const state: DeepPartial<GlobalState> = {
                entities: {
                    properties: {
                        fields: {byObjectType: {}, byId: {}},
                        values: {byTargetId: {}, byFieldId: {}},
                        groups: {byId: {}, byName: {}},
                    },
                },
            };

            expect(getPropertyGroupByName(state as GlobalState, 'unknown')).toBeUndefined();
        });
    });
});

const GROUP_ID = 'group_access_control';
const CHANNEL_ID = 'channel1';

function attrField(overrides: Partial<PropertyField> & {id: string}): PropertyField {
    return {
        group_id: GROUP_ID,
        name: overrides.id,
        type: 'select',
        target_id: '',
        target_type: 'system',
        object_type: 'channel',
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        created_by: '',
        updated_by: '',
        ...overrides,
    };
}

function attrValue(fieldId: string, raw: unknown, targetId = CHANNEL_ID): PropertyValue<unknown> {
    return {
        id: `value_${fieldId}`,
        target_id: targetId,
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

function makeAttrState(fields: PropertyField[], values: Array<PropertyValue<unknown>> = [], groupLoaded = true): GlobalState {
    const byTargetId: Record<string, Record<string, PropertyValue<unknown>>> = {};
    for (const v of values) {
        byTargetId[v.target_id] = {...byTargetId[v.target_id], [v.field_id]: v};
    }

    return deepFreeze({
        entities: {
            properties: {
                groups: groupLoaded ? {
                    byId: {[GROUP_ID]: {id: GROUP_ID, name: 'access_control'}},
                    byName: {access_control: {id: GROUP_ID, name: 'access_control'}},
                } : {byId: {}, byName: {}},
                fields: {
                    byId: Object.fromEntries(fields.map((f) => [f.id, f])),
                    byObjectType: {
                        channel: {
                            [GROUP_ID]: Object.fromEntries(fields.map((f) => [f.id, f])),
                        },
                    },
                },
                values: {byTargetId, byFieldId: {}},
            },
        },
    }) as unknown as GlobalState;
}

describe('getChannelAttributeFields', () => {
    // Reachable in practice, not just in theory: a websocket field event populates
    // byObjectType on its own, and only fetchPropertyFields carries the group name,
    // so the fields can be in the store with nothing able to read them. That is why
    // useChannelAttributes tracks the fetch outcome instead of inferring it here.
    test('returns nothing while the group name has not resolved to an id', () => {
        const state = makeAttrState([attrField({id: 'a'})], [], false);
        expect(getChannelAttributeFields(state)).toEqual([]);
    });

    test('orders by sort_order, unranked fields last', () => {
        const state = makeAttrState([
            attrField({id: 'third', attrs: {sort_order: 30}}),
            attrField({id: 'first', attrs: {sort_order: 10}}),
            attrField({id: 'unranked_b', create_at: 5}),
            attrField({id: 'second', attrs: {sort_order: 20}}),
            attrField({id: 'unranked_a', create_at: 9}),
        ]);

        expect(getChannelAttributeFields(state).map((f) => f.id)).toEqual([
            'first', 'second', 'third', 'unranked_a', 'unranked_b',
        ]);
    });

    // Order is what a viewer is told to read, so it has to be a property of the
    // configuration alone. Breaking ties on create_at would let two servers
    // restored from one export disagree.
    test('breaks sort_order ties on field name, not creation time', () => {
        const state = makeAttrState([
            attrField({id: 'zulu', name: 'zulu', attrs: {sort_order: 10}, create_at: 1}),
            attrField({id: 'alpha', name: 'alpha', attrs: {sort_order: 10}, create_at: 9}),
        ]);

        expect(getChannelAttributeFields(state).map((f) => f.id)).toEqual(['alpha', 'zulu']);
    });

    test('omits a deleted field, which must not be offered for assignment', () => {
        const state = makeAttrState([
            attrField({id: 'live'}),
            attrField({id: 'gone', delete_at: 12345}),
        ]);

        expect(getChannelAttributeFields(state).map((f) => f.id)).toEqual(['live']);
    });
});

describe('getChannelLabelFields', () => {
    test('keeps only fields designated for a label surface', () => {
        const state = makeAttrState([
            attrField({id: 'header', attrs: {actions: ['display_label_header']}}),
            attrField({id: 'info', attrs: {actions: ['display_label_info']}}),
            attrField({id: 'banner_only', attrs: {actions: ['display_banner_top']}}),
            attrField({id: 'no_actions'}),
        ]);

        expect(getChannelLabelFields(state).map((f) => f.id)).toEqual(['header', 'info']);
    });
});

describe('makeGetResolvedChannelAttributes', () => {
    const options = [{id: 'opt_a', name: 'AURORA'}, {id: 'opt_b', name: 'NOFORN'}];

    let getResolvedChannelAttributes: ReturnType<typeof makeGetResolvedChannelAttributes>;

    beforeEach(() => {
        getResolvedChannelAttributes = makeGetResolvedChannelAttributes();
    });

    test('resolves a select value to its option name', () => {
        const state = makeAttrState([attrField({id: 'program', attrs: {options}})], [attrValue('program', 'opt_a')]);

        const [resolved] = getResolvedChannelAttributes(state, CHANNEL_ID);
        expect(resolved.option?.name).toBe('AURORA');
        expect(resolved.displayValue).toBe('AURORA');
    });

    test('treats null and empty string as unset', () => {
        const state = makeAttrState(
            [attrField({id: 'program', attrs: {options}}), attrField({id: 'note', type: 'text'})],
            [attrValue('program', null), attrValue('note', '')],
        );

        expect(getResolvedChannelAttributes(state, CHANNEL_ID).map((a) => a.displayValue)).toEqual(['', '']);
    });

    test('includes fields with no value at all, as unset', () => {
        const state = makeAttrState([attrField({id: 'program', attrs: {options}})]);

        const [resolved] = getResolvedChannelAttributes(state, CHANNEL_ID);
        expect(resolved.value).toBeUndefined();
        expect(resolved.displayValue).toBe('');
    });

    test('joins multiselect values in option order of the stored array', () => {
        const state = makeAttrState([attrField({id: 'caveats', type: 'multiselect', attrs: {options}})], [attrValue('caveats', ['opt_b', 'opt_a'])]);

        expect(getResolvedChannelAttributes(state, CHANNEL_ID)[0].displayValue).toBe('NOFORN, AURORA');
    });

    test('falls back to the raw value when the option no longer exists', () => {
        // A deleted option would otherwise silently drop the marking. Showing the
        // raw id is wrong but visible, which is the safer failure here.
        const state = makeAttrState([attrField({id: 'program', attrs: {options}})], [attrValue('program', 'opt_deleted')]);

        const [resolved] = getResolvedChannelAttributes(state, CHANNEL_ID);
        expect(resolved.option).toBeUndefined();
        expect(resolved.displayValue).toBe('opt_deleted');
    });

    test('multiselect falls back to the raw ID when an option no longer exists', () => {
        const state = makeAttrState([attrField({id: 'caveats', type: 'multiselect', attrs: {options}})], [attrValue('caveats', ['opt_a', 'opt_deleted'])]);

        expect(getResolvedChannelAttributes(state, CHANNEL_ID)[0].displayValue).toBe('AURORA, opt_deleted');
    });

    test('text fields display their stored string directly', () => {
        const state = makeAttrState([attrField({id: 'note', type: 'text'})], [attrValue('note', 'handle with care')]);

        expect(getResolvedChannelAttributes(state, CHANNEL_ID)[0].displayValue).toBe('handle with care');
    });

    test('does not leak another channel value into this channel', () => {
        const state = makeAttrState([attrField({id: 'program', attrs: {options}})], [attrValue('program', 'opt_a', 'other_channel')]);

        expect(getResolvedChannelAttributes(state, CHANNEL_ID)[0].displayValue).toBe('');
    });

    test('each instance memoizes its own channel, so two channels do not evict each other', () => {
        const state = makeAttrState(
            [attrField({id: 'program', attrs: {options}})],
            [attrValue('program', 'opt_a'), attrValue('program', 'opt_b', 'other_channel')],
        );

        const forThis = makeGetResolvedChannelAttributes();
        const forOther = makeGetResolvedChannelAttributes();

        const first = forThis(state, CHANNEL_ID);
        forOther(state, 'other_channel');

        expect(forThis(state, CHANNEL_ID)).toBe(first);
        expect(forOther(state, 'other_channel')[0].displayValue).toBe('NOFORN');
    });
});
