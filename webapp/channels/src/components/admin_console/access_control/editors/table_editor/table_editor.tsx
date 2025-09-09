// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect, useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {AccessControlVisualAST} from '@mattermost/types/access_control';
import type {UserPropertyField} from '@mattermost/types/properties';

import {searchUsersForExpression} from 'mattermost-redux/actions/access_control';
import type {ActionResult} from 'mattermost-redux/types/actions';

import AttributeSelectorMenu from './attribute_selector_menu';
import OperatorSelectorMenu from './operator_selector_menu';
import type {TableRow} from './value_selector_menu';
import ValueSelectorMenu from './value_selector_menu';

import CELHelpModal from '../../modals/cel_help/cel_help_modal';
import TestResultsModal from '../../modals/policy_test/test_modal';
import {AddAttributeButton, TestButton, HelpText, OPERATOR_CONFIG, OPERATOR_LABELS, OperatorLabel} from '../shared';

import './table_editor.scss';

interface TableEditorProps {
    value: string;
    onChange: (value: string) => void;
    onValidate?: (isValid: boolean) => void;
    disabled?: boolean;
    userAttributes: UserPropertyField[];
    enableUserManagedAttributes: boolean;
    onParseError: (error: string) => void;
    actions: {
        getVisualAST: (expr: string) => Promise<ActionResult>;
    };
}

// Finds the first available (non-disabled) attribute from a list of user attributes.
// An attribute is considered available if it doesn't have spaces in its name (CEL incompatible)
// and is considered "safe" (synced from LDAP/SAML OR enableUserManagedAttributes is true).
export const findFirstAvailableAttributeFromList = (
    userAttributes: UserPropertyField[],
    enableUserManagedAttributes: boolean,
): UserPropertyField | undefined => {
    return userAttributes.find((attr) => {
        const hasSpaces = attr.name.includes(' ');
        const isSynced = attr.attrs?.ldap || attr.attrs?.saml;
        const allowed = isSynced || enableUserManagedAttributes;
        return !hasSpaces && allowed;
    });
};

// Parses a CEL (Common Expression Language) string into a structured array of TableRow objects.
// This allows the expression to be displayed and edited in a user-friendly table format.
export const parseExpression = (visualAST: AccessControlVisualAST): TableRow[] => {
    const tableRows: TableRow[] = [];

    if (!visualAST) {
        return tableRows;
    }

    for (const node of visualAST.conditions) {
        let attr;

        // Extracts the attribute name, removing the 'user.attributes.' prefix.
        if (node.attribute.startsWith('user.attributes.')) {
            attr = node.attribute.slice(16); // Length of 'user.attributes.'
        } else {
            throw new Error(`Unknown attribute: ${node.attribute}`);
        }

        let op = OPERATOR_LABELS[node.operator];
        if (!op) {
            // Fallback for unknown operators, defaulting to 'is' logic
            op = OperatorLabel.IS;
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
            attribute_type: node.attribute_type,
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
    enableUserManagedAttributes,
    onParseError,
    actions,
}: TableEditorProps): JSX.Element {
    const {formatMessage} = useIntl();

    const [rows, setRows] = useState<TableRow[]>([]);
    const [showTestResults, setShowTestResults] = useState(false);
    const [showHelpModal, setShowHelpModal] = useState(false);
    const [autoOpenAttributeMenuForRow, setAutoOpenAttributeMenuForRow] = useState<number | null>(null);

    // Effect to parse the incoming CEL expression string (value prop)
    // and update the internal rows state. Handles errors during parsing.
    useEffect(() => {
        actions.getVisualAST(value).then((result) => {
            if (result.error) {
                setRows([]);
                onParseError(result.error.message);
                return;
            }

            setRows(parseExpression(result.data));
        }).catch((err) => {
            setRows([]);
            if (onValidate) {
                onValidate(false);
            }
            onParseError(err.message);
        });
    }, [value]);

    // Converts the internal rows state back into a CEL expression string
    // and calls the onChange and onValidate props.
    const updateExpression = useCallback((newRows: TableRow[]) => {
        const rowsThatCanFormExpressions = newRows.filter((row) => row.attribute); // Only include rows that have an attribute selected

        const expr = rowsThatCanFormExpressions.map((row) => {
            const attributeExpr = `user.attributes.${row.attribute}`;
            const config = OPERATOR_CONFIG[row.operator];

            // Find the attribute object to check its type
            const attributeObj = userAttributes.find((attr) => attr.name === row.attribute);

            if (!config) {
                // Fallback for unknown operators, defaulting to 'in' logic
                // This handles cases where row.operator might be an unexpected string.
                const valuesStr = row.values.map((val: string) => `"${val}"`).join(', ');

                // For multiselect, reverse the order since multiselect attributes can contain multiple values
                if (attributeObj?.type === 'multiselect') {
                    return `[${valuesStr}] in ${attributeExpr}`;
                }
                return `${attributeExpr} in [${valuesStr}]`;
            }

            if (config.type === 'list') { // Handles 'in'
                const valuesStr = row.values.map((val: string) => `"${val}"`).join(', ');

                // For multiselect, reverse the order since multiselect attributes can contain multiple values
                if (attributeObj?.type === 'multiselect') {
                    return `[${valuesStr}] ${config.celOp} ${attributeExpr}`;
                }
                return `${attributeExpr} ${config.celOp} [${valuesStr}]`;
            }

            // For 'comparison' and 'method' types, they operate on a single value.
            const value = row.values.length > 0 ? row.values[0] : '';

            if (config.type === 'comparison') {
                return `${attributeExpr} ${config.celOp} "${value}"`;
            }

            // config.type must be 'method'
            return `${attributeExpr}.${config.celOp}("${value}")`;
        }).join(' && ');

        onChange(expr);
        if (onValidate) {
            // Basic validation: if we can build an expression, or if the expression is empty
            // (e.g. no rows, or rows without attributes yet), it's valid from table perspective.
            onValidate(expr === '' || rowsThatCanFormExpressions.length > 0);
        }
    }, [onChange, onValidate, userAttributes]);

    // Helper function to find the first available (non-disabled) attribute
    const findFirstAvailableAttribute = useCallback(() => {
        return findFirstAvailableAttributeFromList(userAttributes, enableUserManagedAttributes);
    }, [userAttributes, enableUserManagedAttributes]);

    // Row Manipulation Handlers
    const addRow = useCallback(() => {
        if (userAttributes.length === 0) {
            return; // Do not add a row if no attributes are available
        }

        const firstAvailableAttribute = findFirstAvailableAttribute();
        if (!firstAvailableAttribute) {
            return; // Do not add a row if no attributes are available
        }

        setRows((currentRows) => {
            const newRow = {
                attribute: firstAvailableAttribute.name, // Default to the first available attribute
                operator: OperatorLabel.IS, // Default operator
                values: [],
                attribute_type: userAttributes[0]?.type || '',
            };
            const newRows = [...currentRows, newRow];
            updateExpression(newRows); // Ensure expression is updated immediately
            setAutoOpenAttributeMenuForRow(newRows.length - 1); // Set for the new row
            return newRows;
        });
    }, [userAttributes, updateExpression, findFirstAvailableAttribute]);

    const removeRow = useCallback((index: number) => {
        setRows((currentRows) => {
            const newRows = currentRows.toSpliced(index, 1);
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
                newRows[index].operator = OperatorLabel.IS;
            }
            updateExpression(newRows);
            return newRows;
        });
    }, [updateExpression]);

    const updateRowOperator = useCallback((index: number, newOperator: string) => {
        setRows((currentRows) => {
            const oldOperator = currentRows[index].operator;
            let newValues = [...currentRows[index].values]; // Start with a copy of current values

            if (newOperator === OperatorLabel.IN && oldOperator !== OperatorLabel.IN) {
                // Transitioning TO 'in' FROM a non-'in' (likely single-value) operator:
                // Trim each value and then filter out any that become empty strings.
                newValues = newValues.map((v) => v.trim()).filter((v) => v !== '');
            } else if (newOperator !== OperatorLabel.IN) {
                // Transitioning TO a non-'in' (single-value) operator (or staying as one):
                // If there are multiple values (e.g., coming from 'in'), take only the first one.
                if (newValues.length > 1) {
                    newValues = [newValues[0]];
                }
            }

            const newRows = [...currentRows];
            newRows[index] = {
                ...currentRows[index],
                operator: newOperator,
                values: newValues,
            };

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
            <table className='table-editor__table'>
                <thead>
                    <tr className='table-editor__header-row'>
                        <th className='table-editor__column-header'>
                            <FormattedMessage
                                id='admin.access_control.table_editor.attribute'
                                defaultMessage='Attribute'
                            />
                        </th>
                        <th className='table-editor__column-header'>
                            <FormattedMessage
                                id='admin.access_control.table_editor.operator'
                                defaultMessage='Operator'
                            />
                        </th>
                        <th className='table-editor__column-header'>
                            <span className='table-editor__column-header-value'>
                                <FormattedMessage
                                    id='admin.access_control.table_editor.values'
                                    defaultMessage='Values'
                                />
                            </span>
                        </th>
                        <th className='table-editor__column-header-actions'/>
                    </tr>
                </thead>
                <tbody>
                    {rows.length === 0 ? (
                        <tr>
                            <td
                                colSpan={4}
                                className='table-editor__blank-state'
                            >
                                <span>
                                    {formatMessage({
                                        id: 'admin.access_control.table_editor.blank_state',
                                        defaultMessage: 'Select a user attribute and values to create a rule',
                                    })}
                                </span>
                            </td>
                        </tr>
                    ) : (
                        rows.map((row, index) => (
                            <tr
                                key={index}
                                className='table-editor__row'
                            >
                                <td className='table-editor__cell'>
                                    <AttributeSelectorMenu
                                        currentAttribute={row.attribute}
                                        availableAttributes={userAttributes}
                                        disabled={disabled}
                                        onChange={(attribute) => updateRowAttribute(index, attribute)}
                                        menuId={`attribute-selector-menu-${index}`}
                                        buttonId={`attribute-selector-button-${index}`}
                                        autoOpen={index === autoOpenAttributeMenuForRow}
                                        onMenuOpened={() => setAutoOpenAttributeMenuForRow(null)}
                                        enableUserManagedAttributes={enableUserManagedAttributes}
                                    />
                                </td>
                                <td className='table-editor__cell'>
                                    <OperatorSelectorMenu
                                        currentOperator={row.operator}
                                        disabled={disabled}
                                        onChange={(operator) => updateRowOperator(index, operator)}
                                    />
                                </td>
                                <td className='table-editor__cell'>
                                    <ValueSelectorMenu
                                        row={row}
                                        disabled={disabled}
                                        updateValues={(values: string[]) => updateRowValues(index, values)}
                                        options={row.attribute ? userAttributes.find((attr) => attr.name === row.attribute)?.attrs?.options || [] : []}
                                    />
                                </td>
                                <td className='table-editor__cell-actions'>
                                    <button
                                        type='button'
                                        className='table-editor__row-remove'
                                        onClick={() => removeRow(index)}
                                        disabled={disabled}
                                        aria-label={formatMessage({id: 'admin.access_control.table_editor.remove_row', defaultMessage: 'Remove row'})}
                                    >
                                        <i className='icon icon-trash-can-outline'/>
                                    </button>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
                <tfoot>
                    <tr>
                        <td
                            colSpan={4}
                            className='table-editor__add-button-container'
                        >
                            <AddAttributeButton
                                onClick={addRow}
                                disabled={disabled || userAttributes.length === 0}
                            />
                        </td>
                    </tr>
                </tfoot>
            </table>

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
