// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ConditionExprV1, executeCondition} from './conditions';
import {PropertyField, PropertyValue} from './properties';

// Test data helpers
const createTextField = (id: string): PropertyField => ({
    id,
    group_id: 'group1',
    name: `Text Field ${id}`,
    type: 'text',
    target_id: 'target1',
    target_type: 'playbook',
    create_at: 123456789,
    update_at: 123456789,
    delete_at: 0,
    attrs: {
        visibility: 'when_set',
        sort_order: 0,
        options: null,
        parent_id: '',
    },
});

const createSelectField = (id: string): PropertyField => ({
    id,
    group_id: 'group1',
    name: `Select Field ${id}`,
    type: 'select',
    target_id: 'target1',
    target_type: 'playbook',
    create_at: 123456789,
    update_at: 123456789,
    delete_at: 0,
    attrs: {
        visibility: 'when_set',
        sort_order: 0,
        options: [
            {id: 'option1', name: 'Option 1'},
            {id: 'option2', name: 'Option 2'},
            {id: 'critical_id', name: 'Critical'},
            {id: 'low_id', name: 'Low'},
        ],
        parent_id: '',
    },
});

const createMultiselectField = (id: string): PropertyField => ({
    id,
    group_id: 'group1',
    name: `Multiselect Field ${id}`,
    type: 'multiselect',
    target_id: 'target1',
    target_type: 'playbook',
    create_at: 123456789,
    update_at: 123456789,
    delete_at: 0,
    attrs: {
        visibility: 'when_set',
        sort_order: 0,
        options: [
            {id: 'cat_a', name: 'Category A'},
            {id: 'cat_b', name: 'Category B'},
            {id: 'cat_c', name: 'Category C'},
        ],
        parent_id: '',
    },
});

const createTextValue = (fieldId: string, value: string): PropertyValue => ({
    id: `value_${fieldId}`,
    target_id: 'target1',
    target_type: 'playbook',
    group_id: 'group1',
    field_id: fieldId,
    value,
    create_at: 123456789,
    update_at: 123456789,
    delete_at: 0,
});

const createSelectValue = (fieldId: string, value: string): PropertyValue => ({
    id: `value_${fieldId}`,
    target_id: 'target1',
    target_type: 'playbook',
    group_id: 'group1',
    field_id: fieldId,
    value,
    create_at: 123456789,
    update_at: 123456789,
    delete_at: 0,
});

const createMultiselectValue = (fieldId: string, value: string[]): PropertyValue => ({
    id: `value_${fieldId}`,
    target_id: 'target1',
    target_type: 'playbook',
    group_id: 'group1',
    field_id: fieldId,
    value,
    create_at: 123456789,
    update_at: 123456789,
    delete_at: 0,
});

describe('conditions', () => {
    describe('executeCondition', () => {
        const textField = createTextField('text1');
        const selectField = createSelectField('select1');
        const multiselectField = createMultiselectField('multi1');

        const textValue = createTextValue('text1', 'Hello World');
        const selectValue = createSelectValue('select1', 'option1');
        const multiselectValue = createMultiselectValue('multi1', ['cat_a', 'cat_b']);

        const propertyFields = [textField, selectField, multiselectField];
        const propertyValues = [textValue, selectValue, multiselectValue];

        describe('text field conditions', () => {
            it('should match case-insensitive text', () => {
                const condition: ConditionExprV1 = {
                    is: {
                        field_id: 'text1',
                        value: 'hello world',
                    },
                };

                const result = executeCondition(condition, propertyFields, propertyValues);
                expect(result).toBe(true);
            });

            it('should match mixed case text', () => {
                const condition: ConditionExprV1 = {
                    is: {
                        field_id: 'text1',
                        value: 'HeLLo WoRLd',
                    },
                };

                const result = executeCondition(condition, propertyFields, propertyValues);
                expect(result).toBe(true);
            });

            it('should not match different text', () => {
                const condition: ConditionExprV1 = {
                    is: {
                        field_id: 'text1',
                        value: 'Goodbye',
                    },
                };

                const result = executeCondition(condition, propertyFields, propertyValues);
                expect(result).toBe(false);
            });

            it('should handle isNot for text fields', () => {
                const condition: ConditionExprV1 = {
                    isNot: {
                        field_id: 'text1',
                        value: 'goodbye',
                    },
                };

                const result = executeCondition(condition, propertyFields, propertyValues);
                expect(result).toBe(true);
            });

            it('should reject array values for text fields', () => {
                const condition: ConditionExprV1 = {
                    is: {
                        field_id: 'text1',
                        value: ['hello', 'world'],
                    },
                };

                const result = executeCondition(condition, propertyFields, propertyValues);
                expect(result).toBe(false);
            });
        });

        describe('select field conditions', () => {
            it('should match exact select value', () => {
                const condition: ConditionExprV1 = {
                    is: {
                        field_id: 'select1',
                        value: ['option1'],
                    },
                };

                const result = executeCondition(condition, propertyFields, propertyValues);
                expect(result).toBe(true);
            });

            it('should not match case-insensitive select value', () => {
                const condition: ConditionExprV1 = {
                    is: {
                        field_id: 'select1',
                        value: ['OPTION1'],
                    },
                };

                const result = executeCondition(condition, propertyFields, propertyValues);
                expect(result).toBe(false);
            });

            it('should handle isNot for select fields', () => {
                const condition: ConditionExprV1 = {
                    isNot: {
                        field_id: 'select1',
                        value: ['option2'],
                    },
                };

                const result = executeCondition(condition, propertyFields, propertyValues);
                expect(result).toBe(true);
            });

            it('should reject string values for select fields', () => {
                const condition: ConditionExprV1 = {
                    is: {
                        field_id: 'select1',
                        value: 'option1',
                    },
                };

                const result = executeCondition(condition, propertyFields, propertyValues);
                expect(result).toBe(false);
            });
        });

        describe('multiselect field conditions', () => {
            it('should match when condition value is in property array (any of logic)', () => {
                const condition: ConditionExprV1 = {
                    is: {
                        field_id: 'multi1',
                        value: ['cat_a'],
                    },
                };

                const result = executeCondition(condition, propertyFields, propertyValues);
                expect(result).toBe(true);
            });

            it('should match when multiple condition values match', () => {
                const condition: ConditionExprV1 = {
                    is: {
                        field_id: 'multi1',
                        value: ['cat_a', 'cat_c'],
                    },
                };

                const result = executeCondition(condition, propertyFields, propertyValues);
                expect(result).toBe(true);
            });

            it('should not match when no condition values are in property array', () => {
                const condition: ConditionExprV1 = {
                    is: {
                        field_id: 'multi1',
                        value: ['cat_z'],
                    },
                };

                const result = executeCondition(condition, propertyFields, propertyValues);
                expect(result).toBe(false);
            });

            it('should handle isNot for multiselect fields', () => {
                const condition: ConditionExprV1 = {
                    isNot: {
                        field_id: 'multi1',
                        value: ['cat_z'],
                    },
                };

                const result = executeCondition(condition, propertyFields, propertyValues);
                expect(result).toBe(true);
            });

            it('should reject string values for multiselect fields', () => {
                const condition: ConditionExprV1 = {
                    is: {
                        field_id: 'multi1',
                        value: 'cat_a',
                    },
                };

                const result = executeCondition(condition, propertyFields, propertyValues);
                expect(result).toBe(false);
            });
        });

        describe('logical operators', () => {
            it('should handle AND with all true conditions', () => {
                const condition: ConditionExprV1 = {
                    and: [
                        {
                            is: {
                                field_id: 'text1',
                                value: 'hello world',
                            },
                        },
                        {
                            is: {
                                field_id: 'select1',
                                value: ['option1'],
                            },
                        },
                    ],
                };

                const result = executeCondition(condition, propertyFields, propertyValues);
                expect(result).toBe(true);
            });

            it('should handle AND with one false condition', () => {
                const condition: ConditionExprV1 = {
                    and: [
                        {
                            is: {
                                field_id: 'text1',
                                value: 'hello world',
                            },
                        },
                        {
                            is: {
                                field_id: 'select1',
                                value: ['option2'],
                            },
                        },
                    ],
                };

                const result = executeCondition(condition, propertyFields, propertyValues);
                expect(result).toBe(false);
            });

            it('should handle OR with one true condition', () => {
                const condition: ConditionExprV1 = {
                    or: [
                        {
                            is: {
                                field_id: 'text1',
                                value: 'goodbye',
                            },
                        },
                        {
                            is: {
                                field_id: 'select1',
                                value: ['option1'],
                            },
                        },
                    ],
                };

                const result = executeCondition(condition, propertyFields, propertyValues);
                expect(result).toBe(true);
            });

            it('should handle OR with all false conditions', () => {
                const condition: ConditionExprV1 = {
                    or: [
                        {
                            is: {
                                field_id: 'text1',
                                value: 'goodbye',
                            },
                        },
                        {
                            is: {
                                field_id: 'select1',
                                value: ['option2'],
                            },
                        },
                    ],
                };

                const result = executeCondition(condition, propertyFields, propertyValues);
                expect(result).toBe(false);
            });

            it('should handle nested conditions', () => {
                const condition: ConditionExprV1 = {
                    and: [
                        {
                            is: {
                                field_id: 'text1',
                                value: 'hello world',
                            },
                        },
                        {
                            or: [
                                {
                                    is: {
                                        field_id: 'select1',
                                        value: 'option2',
                                    },
                                },
                                {
                                    is: {
                                        field_id: 'multi1',
                                        value: ['cat_a'],
                                    },
                                },
                            ],
                        },
                    ],
                };

                const result = executeCondition(condition, propertyFields, propertyValues);
                expect(result).toBe(true);
            });
        });

        describe('edge cases', () => {
            it('should return false for non-existent field', () => {
                const condition: ConditionExprV1 = {
                    is: {
                        field_id: 'nonexistent',
                        value: 'anything',
                    },
                };

                const result = executeCondition(condition, propertyFields, propertyValues);
                expect(result).toBe(false);
            });

            it('should return true for isNot with non-existent field', () => {
                const condition: ConditionExprV1 = {
                    isNot: {
                        field_id: 'nonexistent',
                        value: 'anything',
                    },
                };

                const result = executeCondition(condition, propertyFields, propertyValues);
                expect(result).toBe(true);
            });

            it('should return false for field without value', () => {
                const fieldWithoutValue = createTextField('empty');
                const condition: ConditionExprV1 = {
                    is: {
                        field_id: 'empty',
                        value: 'anything',
                    },
                };

                const result = executeCondition(condition, [fieldWithoutValue, ...propertyFields], propertyValues);
                expect(result).toBe(false);
            });

            it('should return true for empty condition', () => {
                const condition: ConditionExprV1 = {};

                const result = executeCondition(condition, propertyFields, propertyValues);
                expect(result).toBe(true);
            });

            it('should return false for empty property value', () => {
                const emptyValue = createTextValue('text1', '');
                const condition: ConditionExprV1 = {
                    is: {
                        field_id: 'text1',
                        value: 'anything',
                    },
                };

                const result = executeCondition(condition, propertyFields, [emptyValue]);
                expect(result).toBe(false);
            });
        });
    });
});