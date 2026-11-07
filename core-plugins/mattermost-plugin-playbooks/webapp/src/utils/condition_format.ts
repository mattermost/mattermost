// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ConditionExprV1} from 'src/types/conditions';
import {PropertyField} from 'src/types/properties';

// Helper to extract conditions from expr (handles both simple and compound conditions)
export const extractConditions = (expr: ConditionExprV1): Array<{operator: 'is' | 'isNot'; fieldId: string; value: string | string[]}> => {
    const conditions: Array<{operator: 'is' | 'isNot'; fieldId: string; value: string | string[]}> = [];

    // Check if it's a compound condition (and/or)
    const nestedExprs = expr.and || expr.or || [];
    if (nestedExprs.length > 0) {
        nestedExprs.forEach((nested) => {
            if (nested.is) {
                conditions.push({operator: 'is', fieldId: nested.is.field_id, value: nested.is.value});
            } else if (nested.isNot) {
                conditions.push({operator: 'isNot', fieldId: nested.isNot.field_id, value: nested.isNot.value});
            }
        });
    } else if (expr.is) {
        // Simple condition
        conditions.push({operator: 'is', fieldId: expr.is.field_id, value: expr.is.value});
    } else if (expr.isNot) {
        // Simple condition
        conditions.push({operator: 'isNot', fieldId: expr.isNot.field_id, value: expr.isNot.value});
    }

    return conditions;
};

// Format a single condition for display
export const formatCondition = (
    cond: {operator: 'is' | 'isNot'; fieldId: string; value: string | string[]},
    propertyFields: PropertyField[],
    operatorIs: string = 'is',
    operatorIsNot: string = 'is not'
) => {
    const field = propertyFields.find((f) => f.id === cond.fieldId);
    const fieldName = field?.name || 'Unknown field';

    // Use different operator labels for multiselect fields
    let operator: string;
    if (field?.type === 'multiselect') {
        operator = cond.operator === 'is' ? 'contains' : 'does not contain';
    } else {
        operator = cond.operator === 'is' ? operatorIs : operatorIsNot;
    }

    let valueNames: string[] = [];
    switch (field?.type) {
    case 'select':
    case 'multiselect':
        {
            const valueArray = Array.isArray(cond.value) ? cond.value : [cond.value];
            valueNames = valueArray.map((valueId) => {
                const option = field.attrs.options?.find((opt) => opt.id === valueId);
                return option?.name || valueId;
            });
        }
        break;
    case 'text':
        {
            const textValue = Array.isArray(cond.value) ? cond.value[0] || '' : cond.value;
            if (textValue === '') {
                valueNames = ['empty'];
            } else {
                valueNames = [`"${textValue}"`];
            }
        }
        break;
    }

    return {fieldName, operator, valueNames};
};

// Format condition expression for compact text display
export const formatConditionExpr = (
    expr: ConditionExprV1,
    propertyFields: PropertyField[],
    operatorIs: string = 'is',
    operatorIsNot: string = 'is not',
    logicalAnd: string = 'AND',
    logicalOr: string = 'OR'
): string => {
    const conditions = extractConditions(expr);
    const logicalOperator = expr.and ? logicalAnd : logicalOr;

    const formattedConditions = conditions.map((cond) => {
        const {fieldName, operator, valueNames} = formatCondition(cond, propertyFields, operatorIs, operatorIsNot);
        return `"${fieldName}" ${operator} ${valueNames.join(', ')}`;
    });

    if (formattedConditions.length === 1) {
        return formattedConditions[0];
    }

    return formattedConditions.join(` ${logicalOperator} `);
};
