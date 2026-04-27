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
import {AddAttributeButton, TestButton, HelpText, OPERATOR_CONFIG, OPERATOR_LABELS, OperatorLabel, isMultiValueOperator} from '../shared';

import './table_editor.scss';

export function celStringLiteral(val: string): string {
    return '"' + val.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

export function rowToCEL(row: TableRow): string {
    const attributeExpr = `user.attributes.${row.attribute}`;
    const config = OPERATOR_CONFIG[row.operator];

    if (!config) {
        if (row.attribute_type === 'multiselect') {
            return row.values.map((val: string) => `${celStringLiteral(val)} in ${attributeExpr}`).join(' && ');
        }
        const valuesStr = row.values.map((val: string) => celStringLiteral(val)).join(', ');
        return `${attributeExpr} in [${valuesStr}]`;
    }

    if (config.type === 'list') {
        if (row.operator === OperatorLabel.HAS_ANY_OF) {
            const parts = row.values.map((val: string) => `${celStringLiteral(val)} ${config.celOp} ${attributeExpr}`);
            const orExpr = parts.join(' || ');
            return parts.length > 1 ? `(${orExpr})` : orExpr;
        }
        if (row.operator === OperatorLabel.HAS_ALL_OF) {
            return row.values.map((val: string) => `${celStringLiteral(val)} ${config.celOp} ${attributeExpr}`).join(' && ');
        }

        if (row.attribute_type === 'multiselect') {
            return row.values.map((val: string) => `${celStringLiteral(val)} ${config.celOp} ${attributeExpr}`).join(' && ');
        }
        const valuesStr = row.values.map((val: string) => celStringLiteral(val)).join(', ');
        return `${attributeExpr} ${config.celOp} [${valuesStr}]`;
    }

    const value = row.values.length > 0 ? row.values[0] : '';

    if (config.type === 'comparison') {
        return `${attributeExpr} ${config.celOp} ${celStringLiteral(value)}`;
    }

    return `${attributeExpr}.${config.celOp}(${celStringLiteral(value)})`;
}

interface TableEditorProps {
    value: string;
    onChange: (value: string) => void;
    onValidate?: (isValid: boolean) => void;
    disabled?: boolean;
    userAttributes: UserPropertyField[];
    enableUserManagedAttributes: boolean;
    onParseError: (error: string) => void;
    channelId?: string;
    teamId?: string;
    actions: {
        getVisualAST: (expr: string) => Promise<ActionResult>;
    };

    // Props for user self-exclusion detection
    isSystemAdmin?: boolean;
    validateExpressionAgainstRequester?: (expression: string) => Promise<ActionResult<{requester_matches: boolean}>>;
}

// Finds the first available (non-disabled) attribute from a list of user attributes.
// An attribute is considered available if it doesn't have spaces in its name (CEL incompatible)
// and is considered "safe" (synced from LDAP/SAML, admin-managed, plugin-managed (protected), OR enableUserManagedAttributes is true).
export const findFirstAvailableAttributeFromList = (
    userAttributes: UserPropertyField[],
    enableUserManagedAttributes: boolean,
): UserPropertyField | undefined => {
    return userAttributes.find((attr) => {
        const hasSpaces = attr.name.includes(' ');
        const isSynced = attr.attrs?.ldap || attr.attrs?.saml;
        const isAdminManaged = attr.attrs?.managed === 'admin';
        const isProtected = attr.attrs?.protected;
        const allowed = isSynced || isAdminManaged || isProtected || enableUserManagedAttributes;
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
    channelId,
    teamId,
    actions,
    isSystemAdmin = false,
    validateExpressionAgainstRequester,
}: TableEditorProps): JSX.Element {
    const {formatMessage} = useIntl();

    const [rows, setRows] = useState<TableRow[]>([]);
    const [showTestResults, setShowTestResults] = useState(false);
    const [showHelpModal, setShowHelpModal] = useState(false);
    const [autoOpenAttributeMenuForRow, setAutoOpenAttributeMenuForRow] = useState<number | null>(null);

    // State for user self-exclusion detection (only applies to non-system-admins)
    const [userWouldBeExcluded, setUserWouldBeExcluded] = useState(false);

    // Effect to parse the incoming CEL expression string (value prop)
    // and update the internal rows state. Handles errors during parsing.
    useEffect(() => {
        // Skip parsing if no expression to avoid unnecessary API calls
        if (!value || value.trim() === '') {
            setRows([]);
            return;
        }

        actions.getVisualAST(value).then((result) => {
            if (result.error) {
                setRows([]);

                // Only call onParseError for actual parsing errors, not permission errors
                if (!result.error.message?.includes('403') && !result.error.message?.includes('Forbidden')) {
                    onParseError(result.error.message);
                }
                return;
            }

            setRows(parseExpression(result.data));
        }).catch((err) => {
            setRows([]);
            if (onValidate) {
                onValidate(false);
            }

            // Only call onParseError for actual parsing errors, not permission errors
            if (!err.message?.includes('403') && !err.message?.includes('Forbidden')) {
                onParseError(err.message);
            }
        });
    }, [value]);

    // Effect to check if user would be excluded by their own rules
    useEffect(() => {
        const checkUserSelfExclusion = async () => {
            // Only check for non-system admins when there's an expression and validation function
            if (isSystemAdmin || !value.trim() || !validateExpressionAgainstRequester) {
                setUserWouldBeExcluded(false);
                return;
            }

            try {
                const result = await validateExpressionAgainstRequester(value);
                setUserWouldBeExcluded(!result.data?.requester_matches);
            } catch (error) {
                // If validation fails, assume they would not be excluded (to allow testing)
                setUserWouldBeExcluded(false);
            }
        };

        checkUserSelfExclusion();
    }, [value, isSystemAdmin, validateExpressionAgainstRequester]);

    // Converts the internal rows state back into a CEL expression string
    // and calls the onChange and onValidate props.
    const updateExpression = useCallback((newRows: TableRow[]) => {
        const rowsThatCanFormExpressions = newRows.filter((row) => row.attribute && row.values.length > 0);

        const expr = rowsThatCanFormExpressions.map((row) => rowToCEL(row)).join(' && ');

        onChange(expr);
        if (onValidate) {
            onValidate(expr === '' || rowsThatCanFormExpressions.length > 0);
        }
    }, [onChange, onValidate]);

    // Helper function to find the first available (non-disabled) attribute
    const findFirstAvailableAttribute = useCallback(() => {
        return findFirstAvailableAttributeFromList(userAttributes, enableUserManagedAttributes);
    }, [userAttributes, enableUserManagedAttributes]);

    // Row Manipulation Handlers
    const addRow = useCallback(() => {
        if (userAttributes.length === 0) {
            // Show a helpful message instead of silently failing
            onParseError('No user attributes available. Please ensure ABAC is properly configured and you have the necessary permissions.');
            return;
        }

        const firstAvailableAttribute = findFirstAvailableAttribute();
        if (!firstAvailableAttribute) {
            onParseError('No available user attributes found for rule creation.');
            return;
        }

        setRows((currentRows) => {
            const newRow = {
                attribute: firstAvailableAttribute.name,
                operator: firstAvailableAttribute.type === 'multiselect' ? OperatorLabel.HAS_ANY_OF : OperatorLabel.IS,
                values: [],
                attribute_type: firstAvailableAttribute.type || '',
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

            if (oldAttribute !== attribute) {
                newRows[index].values = [];

                const newAttributeObj = userAttributes.find((attr) => attr.name === attribute);
                newRows[index].attribute_type = newAttributeObj?.type || '';

                const isMultiselect = newAttributeObj?.type === 'multiselect';
                const wasMultiselect = currentRows[index].attribute_type === 'multiselect';
                if (isMultiselect && !wasMultiselect) {
                    newRows[index].operator = OperatorLabel.HAS_ANY_OF;
                } else if (!isMultiselect && wasMultiselect) {
                    newRows[index].operator = OperatorLabel.IS;
                }

                // Values were cleared — row is in an intermediate editing state.
                // Don't regenerate the expression now; it will be updated when
                // the user selects new values via updateRowValues.
                return newRows;
            }
            updateExpression(newRows);
            return newRows;
        });
    }, [updateExpression, userAttributes]);

    const updateRowOperator = useCallback((index: number, newOperator: string) => {
        setRows((currentRows) => {
            const oldOperator = currentRows[index].operator;
            let newValues = [...currentRows[index].values];

            const wasMulti = isMultiValueOperator(oldOperator);
            const isMulti = isMultiValueOperator(newOperator);

            if (isMulti && !wasMulti) {
                // Transitioning TO a multi-value operator FROM a single-value operator:
                newValues = newValues.map((v) => v.trim()).filter((v) => v !== '');
            } else if (!isMulti && wasMulti) {
                // Transitioning TO a single-value operator FROM a multi-value operator:
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
                                        attributeType={userAttributes.find((attr) => attr.name === row.attribute)?.type}
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
                    disabled={disabled || !value || userWouldBeExcluded}
                    disabledTooltip={
                        userWouldBeExcluded ?
                            formatMessage({
                                id: 'admin.access_control.table_editor.user_excluded_tooltip',
                                defaultMessage: 'You cannot test access rules that would exclude you from the channel',
                            }) :
                            undefined
                    }
                />
            </div>

            {showTestResults && (
                <TestResultsModal
                    onExited={() => setShowTestResults(false)}
                    isStacked={true}
                    actions={{
                        openModal: () => {},
                        searchUsers: (term: string, after: string, limit: number) => {
                            // Return the action for the modal to dispatch
                            return searchUsersForExpression(value, term, after, limit, channelId, teamId);
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
