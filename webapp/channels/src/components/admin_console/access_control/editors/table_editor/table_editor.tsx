// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect, useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {UserPropertyField} from '@mattermost/types/properties';

import {searchUsersForExpression} from 'mattermost-redux/actions/access_control';
import {Client4} from 'mattermost-redux/client';

import AttributeSelectorMenu from './attribute_selector_menu';
import OperatorSelectorMenu from './operator_selector_menu';
import type {TableRow} from './values_editor';
import ValuesEditor from './values_editor';

import CELHelpModal from '../../modals/cel_help/cel_help_modal';
import TestResultsModal from '../../modals/policy_test/test_modal';
import {AddAttributeButton, TestButton, HelpText} from '../shared';

import './table_editor.scss';

interface TableEditorProps {
    value: string;
    onChange: (value: string) => void;
    onValidate?: (isValid: boolean) => void;
    disabled?: boolean;
    userAttributes: UserPropertyField[];
    onParseError: (error: string) => void;
}

// Parses a CEL (Common Expression Language) string into a structured array of TableRow objects.
// This allows the expression to be displayed and edited in a user-friendly table format.
const parseExpression = async (expr: string): Promise<TableRow[]> => {
    const tableRows: TableRow[] = [];

    if (!expr) {
        return tableRows;
    }

    const rawVisualAST = await Client4.expressionToVisualFormat(expr);
    for (const node of rawVisualAST.conditions) {
        let attr;

        // Extracts the attribute name, removing the 'user.attributes.' prefix.
        if (node.attribute.startsWith('user.attributes.')) {
            attr = node.attribute.slice(16); // Length of 'user.attributes.'
        } else {
            throw new Error(`Unknown attribute: ${node.attribute}`);
        }

        let op;

        // Maps CEL operators to human-readable strings for the table editor.
        switch (node.operator) {
        case '==':
            op = 'is';
            break;
        case 'in':
            op = 'in';
            break;
        case '!=':
            op = 'is not';
            break;
        case 'startsWith':
            op = 'starts with';
            break;
        case 'endsWith':
            op = 'ends with';
            break;
        case 'contains':
            op = 'contains';
            break;
        default:
            throw new Error(`Unknown operator: ${node.operator}`);
        }

        let values;
        if (Array.isArray(node.value)) {
            values = node.value;
        } else {
            values = [node.value]; // Ensures values are always an array for consistency.
        }

        tableRows.push({
            attribute: attr,
            operator: op,
            values,
        });
    }

    return tableRows;
};

// TableEditor provides a user-friendly table interface for constructing and editing
// CEL (Common Expression Language) expressions based on user attributes.
// It parses incoming CEL expressions into rows and reconstructs the expression upon changes.
// The biggest limitation is that all expressions are ANDed together, so it's not possible to
// have OR logic.
function TableEditor({
    value,
    onChange,
    onValidate,
    disabled = false,
    userAttributes,
    onParseError,
}: TableEditorProps): JSX.Element {
    const {formatMessage} = useIntl();

    const [rows, setRows] = useState<TableRow[]>([]);
    const [showTestResults, setShowTestResults] = useState(false);
    const [showHelpModal, setShowHelpModal] = useState(false);

    // Effect to parse the incoming CEL expression string (value prop)
    // and update the internal rows state. Handles errors during parsing.
    useEffect(() => {
        parseExpression(value).then((parsedRows) => {
            setRows(parsedRows);
        }).catch((err) => {
            setRows([]);
            if (onValidate) {
                onValidate(false);
            }
            onParseError(err.message);
        });
    }, [value, onValidate, onParseError]);

    // Converts the internal rows state back into a CEL expression string
    // and calls the onChange and onValidate props.
    const updateExpression = useCallback((newRows: TableRow[]) => {
        const validRows = newRows.filter((row) => row.attribute && row.values.length > 0);
        const expr = validRows.map((row) => {
            // Attribute part of the expression
            const attributeExpr = `user.attributes.${row.attribute}`;

            // Handle different operators
            if (row.operator === 'is') {
                return `${attributeExpr} == "${row.values[0]}"`;
            }
            if (row.operator === 'is not') {
                return `${attributeExpr} != "${row.values[0]}"`;
            }
            if (row.operator === 'starts with') {
                return `${attributeExpr}.startsWith("${row.values[0]}")`;
            }
            if (row.operator === 'ends with') {
                return `${attributeExpr}.endsWith("${row.values[0]}")`;
            }
            if (row.operator === 'contains') {
                return `${attributeExpr}.contains("${row.values[0]}")`;
            }

            // Default to 'in' operator for multiple values or if 'in' is explicitly selected
            const valuesStr = row.values.map((val) => `"${val}"`).join(', ');
            return `${attributeExpr} in [${valuesStr}]`;
        }).join(' && ');

        onChange(expr);
        if (onValidate) {
            // Basic validation: if we can build an expression, assume it's valid from table perspective.
            // More complex validation might be needed depending on CEL specifics.
            onValidate(expr === '' || validRows.length > 0);
        }
    }, [onChange, onValidate]);

    // Row Manipulation Handlers
    const addRow = useCallback(() => {
        if (userAttributes.length === 0) {
            return; // Do not add a row if no attributes are available
        }
        setRows((currentRows) => {
            const newRows = [...currentRows, {
                attribute: userAttributes[0]?.name || '', // Default to the first available attribute
                operator: 'is', // Default operator
                values: [],
            }];
            updateExpression(newRows);
            return newRows;
        });
    }, [userAttributes, updateExpression]);

    const removeRow = useCallback((index: number) => {
        setRows((currentRows) => {
            const newRows = currentRows.filter((_, i) => i !== index);
            updateExpression(newRows);
            return newRows;
        });
    }, [updateExpression]);

    const updateRowAttribute = useCallback((index: number, attribute: string) => {
        setRows((currentRows) => {
            const newRows = [...currentRows];
            const oldAttribute = newRows[index].attribute;
            newRows[index] = {...newRows[index], attribute};

            // If attribute changes, we are resetting values.
            if (oldAttribute !== attribute) {
                newRows[index].values = [];
                newRows[index].operator = 'is';
            }
            updateExpression(newRows);
            return newRows;
        });
    }, [updateExpression]);

    const updateRowOperator = useCallback((index: number, operator: string) => {
        setRows((currentRows) => {
            const newRows = [...currentRows];
            const currentRow = {...newRows[index], operator};

            // If operator changes from/to 'in', adjust values accordingly.
            // If not 'in', ensure only one value is present.
            if ((operator !== 'in') && currentRow.values.length > 1) {
                currentRow.values = currentRow.values.length > 0 ? [currentRow.values[0]] : [];
            }
            newRows[index] = currentRow;
            updateExpression(newRows);
            return newRows;
        });
    }, [updateExpression]);

    const updateRowValues = useCallback((index: number, values: string[]) => {
        setRows((currentRows) => {
            const newRows = [...currentRows];
            newRows[index] = {...newRows[index], values};
            updateExpression(newRows);
            return newRows;
        });
    }, [updateExpression]);

    return (
        <div className='table-editor'>
            <div className='table-editor__table'>
                <div className='table-editor__header'>
                    <div className='table-editor__column-header'>
                        <FormattedMessage
                            id='admin.access_control.table_editor.attribute'
                            defaultMessage='Attribute'
                        />
                    </div>
                    <div className='table-editor__column-header'>
                        <FormattedMessage
                            id='admin.access_control.table_editor.operator'
                            defaultMessage='Operator'
                        />
                    </div>
                    <div className='table-editor__column-header'>
                        <FormattedMessage
                            id='admin.access_control.table_editor.values'
                            defaultMessage='Values'
                        />
                    </div>
                    <div className='table-editor__column-header-actions'/> {/* Placeholder for actions column header */}
                </div>

                <div className='table-editor__rows'>
                    {rows.length === 0 ? (
                        <div className='table-editor__blank-state'>
                            <span>
                                {formatMessage({
                                    id: 'admin.access_control.table_editor.blank_state',
                                    defaultMessage: 'Select a user attribute and values to create a rule',
                                })}
                            </span>
                        </div>
                    ) : (
                        rows.map((row, index) => (
                            <div
                                key={index}
                                className='table-editor__row'
                            >
                                <div className='table-editor__cell'>
                                    <AttributeSelectorMenu
                                        currentAttribute={row.attribute}
                                        availableAttributes={userAttributes}
                                        disabled={disabled}
                                        onChange={(attribute) => updateRowAttribute(index, attribute)}
                                    />
                                </div>
                                <div className='table-editor__cell'>
                                    <OperatorSelectorMenu
                                        currentOperator={row.operator}
                                        disabled={disabled}
                                        onChange={(operator) => updateRowOperator(index, operator)}
                                    />
                                </div>
                                <div className='table-editor__cell'>
                                    <ValuesEditor
                                        row={row}
                                        disabled={disabled}
                                        updateValues={(values) => updateRowValues(index, values)}
                                        options={row.attribute ? userAttributes.find((attr) => attr.name === row.attribute)?.attrs?.options || [] : []}
                                    />
                                </div>
                                <div className='table-editor__cell-actions'>
                                    <button
                                        type='button'
                                        className='table-editor__row-remove'
                                        onClick={() => removeRow(index)}
                                        disabled={disabled}
                                        aria-label={formatMessage({id: 'admin.access_control.table_editor.remove_row', defaultMessage: 'Remove row'})}
                                    >
                                        <i className='icon icon-trash-can-outline'/>
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className='table-editor__add-button-container'>
                    <AddAttributeButton
                        onClick={addRow}
                        disabled={disabled || userAttributes.length === 0}
                    />
                </div>
            </div>

            <div className='table-editor__actions-row'>
                <HelpText
                    message={formatMessage({
                        id: 'admin.access_control.table_editor.help_text',
                        defaultMessage: 'Each row is a single condition that must be met for a user to comply with the policy. All rules are combined with logical AND operator (`&&`).',
                    })}
                />
                <TestButton
                    onClick={() => setShowTestResults(true)}
                    disabled={disabled || !value}
                />
            </div>

            {showTestResults && (
                <TestResultsModal
                    onExited={() => setShowTestResults(false)}
                    actions={{
                        openModal: () => {},
                        searchUsers: (term: string, after: string, limit: number) => {
                            return searchUsersForExpression(value, term, after, limit);
                        },
                    }}
                />
            )}
            {showHelpModal && (
                <CELHelpModal
                    onExited={() => setShowHelpModal(false)}
                />
            )}
        </div>
    );
}

export default TableEditor;
