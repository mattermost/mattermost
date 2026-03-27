// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField, PropertyValue} from '@mattermost/types/properties';
import type {GlobalState} from '@mattermost/types/store';
import type {DeepPartial} from '@mattermost/types/utilities';

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
