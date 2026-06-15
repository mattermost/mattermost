// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PropertyField, PropertyValue} from './properties';

export type Condition = {
    id: string;
    version: number;
    condition_expr: ConditionExprV1;
    playbook_id: string;
    run_id?: string;
    create_at: number;
    update_at: number;
    delete_at: number;
}

export interface ConditionExprV1 {

    // Logical operators (mutually exclusive with comparison operators)
    and?: ConditionExprV1[];
    or?: ConditionExprV1[];

    // Comparison operators (mutually exclusive with logical operators)
    is?: ComparisonCondition;
    isNot?: ComparisonCondition;
}

export interface ComparisonCondition {
    field_id: string;

    // Value can be:
    // - string for text fields (case-insensitive matching)
    // - string[] for select fields ("any of" logic)
    // - string[] for multiselect fields ("any of" logic)
    value: string | string[];
}

// Execute function that matches the Go Evaluate method
export const executeCondition = (
    condition: ConditionExprV1,
    propertyFields: PropertyField[],
    propertyValues: PropertyValue[]
): boolean => {
    // Build field map (fieldID -> PropertyField)
    const fieldMap = new Map(
        propertyFields.map((field) => [field.id, field] as const)
    );

    // Build value map (fieldID -> PropertyValue)
    const valueMap = new Map(
        propertyValues.map((value) => [value.field_id, value] as const)
    );

    return evaluate(condition, fieldMap, valueMap);
};

const evaluate = (
    condition: ConditionExprV1,
    fieldMap: Map<PropertyField['id'], PropertyField>,
    valueMap: Map<PropertyValue['field_id'], PropertyValue>
): boolean => {
    // Handle AND logic
    if (condition.and) {
        return condition.and.every((nested) => evaluate(nested, fieldMap, valueMap));
    }

    // Handle OR logic
    if (condition.or) {
        return condition.or.some((nested) => evaluate(nested, fieldMap, valueMap));
    }

    // Handle IS comparison
    if (condition.is) {
        const field = fieldMap.get(condition.is.field_id);
        if (!field) {
            return false;
        }

        const value = valueMap.get(condition.is.field_id);
        if (!value) {
            return false;
        }

        return is(field, value, condition.is.value);
    }

    if (condition.isNot) {
        const field = fieldMap.get(condition.isNot.field_id);
        if (!field) {
            return true;
        }

        const value = valueMap.get(condition.isNot.field_id);
        if (!value) {
            return true;
        }

        return isNot(field, value, condition.isNot.value);
    }

    return true;
};

const is = (
    propertyField: PropertyField,
    propertyValue: PropertyValue,
    conditionValue: string | string[]
): boolean => {
    if (!propertyValue.value) {
        return false;
    }

    if (isTextValue(propertyField, propertyValue)) {
        if (typeof conditionValue !== 'string') {
            return false;
        }

        return propertyValue.value.toLowerCase() === conditionValue.toLowerCase();
    }

    if (isSelectValue(propertyField, propertyValue)) {
        if (!Array.isArray(conditionValue)) {
            return false;
        }

        return conditionValue.includes(propertyValue.value);
    }

    if (isMultiselectValue(propertyField, propertyValue)) {
        if (!Array.isArray(conditionValue)) {
            return false;
        }

        return conditionValue.some((conditionItem) =>
            propertyValue.value.includes(conditionItem)
        );
    }

    return false;
};

const isNot = (
    propertyField: PropertyField,
    propertyValue: PropertyValue,
    conditionValue: string | string[]
): boolean => {
    return !is(propertyField, propertyValue, conditionValue);
};

const isTextValue = (propertyField: PropertyField, propertyValue: PropertyValue): propertyValue is PropertyValue & { value: string } => {
    return propertyField.type === 'text' && typeof propertyValue.value === 'string';
};

const isSelectValue = (propertyField: PropertyField, propertyValue: PropertyValue): propertyValue is PropertyValue & { value: string } => {
    return propertyField.type === 'select' && typeof propertyValue.value === 'string';
};

const isMultiselectValue = (propertyField: PropertyField, propertyValue: PropertyValue): propertyValue is PropertyValue & { value: string[] } => {
    return propertyField.type === 'multiselect' && Array.isArray(propertyValue.value);
};