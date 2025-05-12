// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {searchUsersForExpression} from 'mattermost-redux/actions/access_control';
import {Client4} from 'mattermost-redux/client';

import AttributeSelectorMenu from './attribute_selector_menu';
import OperatorSelectorMenu from './operator_selector_menu';
import type {TableRow} from './table_row';
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
    userAttributes: Array<{
        attribute: string;
        values: string[];
    }>;
}

// Parse CEL expression into table rows
const parseExpression = async (expr: string): Promise<TableRow[]> => {
    const tableRows: TableRow[] = [];

    if (!expr) {
        return tableRows;
    }

    const rawVisualAST = await Client4.expressionToVisualFormat(expr);
    for (const node of rawVisualAST.conditions) {
        let attr;

        if (node.attribute.startsWith('user.attributes.')) {
            attr = node.attribute.slice(16); // wow, there is no trim-prefix
        } else {
            throw new Error(`Unknown attribute: ${node.attribute}`);
        }

        let op;

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
            values = [node.value];
        }

        tableRows.push({
            attribute: attr,
            operator: op,
            values,
        });
    }

    return tableRows;
};

function TableEditor({
    value,
    onChange,
    onValidate,
    disabled = false,
    userAttributes,
}: TableEditorProps): JSX.Element {
    const {formatMessage} = useIntl();
    const [rows, setRows] = useState<TableRow[]>([]);
    const [showTestResults, setShowTestResults] = useState(false);
    const [showHelpModal, setShowHelpModal] = useState(false);

    // Update rows when value changes externally
    useEffect(() => {
        parseExpression(value).then((rows) => {
            setRows(rows);
        });
    }, [value]);

    // Update the CEL expression when table changes
    const updateExpression = (newRows: TableRow[]) => {
        const validRows = newRows.filter((row) => row.attribute && row.values.length > 0);
        const expr = validRows.map((row) => {
            if (row.operator === 'is') {
                return `user.attributes.${row.attribute} == "${row.values[0]}"`;
            }

            if (row.operator === 'is not') {
                return `user.attributes.${row.attribute} != "${row.values[0]}"`;
            }

            if (row.operator === 'starts with') {
                return `user.attributes.${row.attribute}.startsWith("${row.values[0]}")`;
            }

            if (row.operator === 'ends with') {
                return `user.attributes.${row.attribute}.endsWith("${row.values[0]}")`;
            }

            if (row.operator === 'contains') {
                return `user.attributes.${row.attribute}.contains("${row.values[0]}")`;
            }

            const valuesStr = row.values.map((val) => `"${val}"`).join(', ');
            return `user.attributes.${row.attribute} in [${valuesStr}]`;
        }).join(' && ');

        onChange(expr);
        if (onValidate) {
            onValidate(true);
        }
    };

    const addRow = () => {
        // Find first available attribute
        const availableAttrs = getAvailableAttributes();
        if (availableAttrs.length === 0) {
            return;
        }

        const newRows = [...rows, {
            attribute: availableAttrs[0].attribute,
            operator: 'is',
            values: [],
        }];

        setRows(newRows);
        updateExpression(newRows);
    };

    const removeRow = (index: number) => {
        const newRows = rows.filter((_, i) => i !== index);
        setRows(newRows);
        updateExpression(newRows);
    };

    const updateRowAttribute = (index: number, attribute: string) => {
        const newRows = [...rows];
        newRows[index].attribute = attribute;
        setRows(newRows);
        updateExpression(newRows);
    };

    const updateRowOperator = (index: number, operator: string) => {
        const newRows = [...rows];
        newRows[index].operator = operator;

        if ((operator !== 'in') && newRows[index].values.length > 1) {
            newRows[index].values = newRows[index].values.length > 0 ? [newRows[index].values[0]] : [];
        }

        setRows(newRows);
        updateExpression(newRows);
    };

    const updateRowValues = (index: number, values: string[]) => {
        const newRows = [...rows];
        newRows[index].values = values;
        setRows(newRows);
        updateExpression(newRows);
    };

    // Get available attributes (excluding ones already used)
    const getAvailableAttributes = () => {
        const usedAttributes = new Set(rows.map((row) => row.attribute));
        return userAttributes.filter((attr) => !usedAttributes.has(attr.attribute));
    };

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
                    <div className='table-editor__column-header-actions'/>
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
                                        availableAttributes={getAvailableAttributes().concat(
                                            row.attribute ? [{attribute: row.attribute, values: []}] : [],
                                        )}
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
                                    />
                                </div>
                                <div className='table-editor__cell-actions'>
                                    <button
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
                        disabled={disabled || getAvailableAttributes().length === 0}
                    />
                </div>
            </div>

            <div className='table-editor__actions-row'>
                <HelpText
                    message={'Each row is a single condition that must be met for a user to comply with the policy. All rules are combined with logical AND operator (`&&`).'}
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
