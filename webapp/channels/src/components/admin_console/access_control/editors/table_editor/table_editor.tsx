// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';
import {FormattedMessage} from 'react-intl';

import type {AccessControlTestResult} from '@mattermost/types/admin';

import {Client4} from 'mattermost-redux/client';
import type {ActionResult} from 'mattermost-redux/types/actions';

import Markdown from 'components/markdown';

import ValueModal from './value_modal';

import TestResultsModal from '../../modals/policy_test/test_modal';

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

interface TableRow {
    attribute: string;
    operator: 'is' | 'in';
    values: string[];
}

interface AttributeDropdownProps {
    isOpen: boolean;
    disabled: boolean;
    availableAttributes: Array<{attribute: string; values: string[]}>;
    onSelect: (attribute: string) => void;
    onToggle: () => void;
}

interface TestButtonProps {
    onClick: () => void;
    disabled: boolean;
}

interface ErrorMessageProps {
    error: any;
}

interface HelpTextProps {
    message: string;
}

const HelpText: React.FC<HelpTextProps> = ({message}) => {
    return (
        <div className='table-editor__help-text'>
            <Markdown
                message={message}
                options={{mentionHighlight: false}}
            />
            <a
                href='#'
                className='table-editor__learn-more'
            >
                <FormattedMessage
                    id='admin.access_control.cel.learnMore'
                    defaultMessage='Learn more about creating access expressions with examples.'
                />
            </a>
        </div>
    );
};

const ErrorMessage: React.FC<ErrorMessageProps> = ({error}) => {
    if (!error) {
        return null;
    }

    return (
        <span className='EditPolicy__error'>
            <i className='icon icon-alert-outline'/>
            <FormattedMessage
                id='admin.access_control.edit_policy.serverError'
                defaultMessage='There are errors in the form above'
            />
        </span>
    );
};

const TestButton: React.FC<TestButtonProps> = ({onClick, disabled}) => {
    return (
        <button
            className='table-editor__test-btn'
            onClick={onClick}
            disabled={disabled}
        >
            <i className='icon icon-lock-outline'/>
            <FormattedMessage
                id='admin.access_control.table_editor.test_access_rule'
                defaultMessage='Test access rule'
            />
        </button>
    );
};

const AttributeDropdown: React.FC<AttributeDropdownProps> = ({
    isOpen,
    disabled,
    availableAttributes,
    onSelect,
    onToggle,
}) => {
    return (
        <div className='table-editor__select-attribute-container'>
            <button
                className='table-editor__select-attribute-button'
                onClick={onToggle}
                disabled={disabled || availableAttributes.length === 0}
            >
                <i className='icon icon-plus'/>
                <FormattedMessage
                    id='admin.access_control.table_editor.select_user_attribute'
                    defaultMessage='Select user attribute'
                />
            </button>
            {!disabled && isOpen && availableAttributes.length > 0 && (
                <div className='table-editor__attribute-dropdown'>
                    {availableAttributes.map((attr) => (
                        <button
                            key={attr.attribute}
                            className='table-editor__attribute-option'
                            onClick={() => onSelect(attr.attribute)}
                        >
                            {attr.attribute}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// Parse CEL expression into table rows
const parseExpression = (expr: string): TableRow[] => {
    if (!expr) {
        return [];
    }

    const rows: TableRow[] = [];
    const conditions = expr.split('&&').map((c) => c.trim());

    for (const condition of conditions) {
        // Handle "is" operator (==)
        const isMatch = condition.match(/user\.attributes\.(\w+)\s*==\s*['"]([^'"]+)['"]/);
        if (isMatch) {
            rows.push({
                attribute: isMatch[1],
                operator: 'is',
                values: [isMatch[2]],
            });
            continue;
        }

        // Handle "in" operator
        const inMatch = condition.match(/user\.attributes\.(\w+)\s+in\s+\[(.*?)\]/);
        if (inMatch) {
            const attribute = inMatch[1];
            const valuesStr = inMatch[2];

            // Extract values from array notation
            const values = valuesStr.split(',').map((v) => {
                return v.trim().replace(/^["']|["']$/g, '');
            });

            rows.push({
                attribute,
                operator: 'in',
                values,
            });
        }
    }

    return rows;
};

const TableEditor: React.FC<TableEditorProps> = ({
    value,
    onChange,
    onValidate,
    disabled = false,
    userAttributes,
}) => {
    const [rows, setRows] = useState<TableRow[]>(parseExpression(value));
    const [showTestResults, setShowTestResults] = useState(false);
    const [testResults, setTestResults] = useState<AccessControlTestResult | null>(null);
    const [showAttributeDropdown, setShowAttributeDropdown] = useState(false);
    const [serverError, setServerError] = useState(false);
    const [newValue, setNewValue] = useState('');
    const [activeInputRowIndex, setActiveInputRowIndex] = useState<number | null>(null);
    const [showValueModal, setShowValueModal] = useState(false);

    // Update rows when value changes externally
    useEffect(() => {
        const isSimpleExpression = !value || value.split('&&').every((condition) => {
            const trimmed = condition.trim();
            return trimmed.match(/^user\.attributes\.\w+\s*==\s*['"][^'"]+['"]$/) ||
                   trimmed.match(/^user\.attributes\.\w+\s+in\s+\[.*?\]$/);
        });

        if (isSimpleExpression) {
            setRows(parseExpression(value));
        }
    }, [value]);

    // Update the CEL expression when table changes
    const updateExpression = (newRows: TableRow[]) => {
        const validRows = newRows.filter((row) => row.attribute && row.values.length > 0);
        const expr = validRows.map((row) => {
            if (row.operator === 'is') {
                return `user.attributes.${row.attribute} == "${row.values[0]}"`;
            }

            const valuesStr = row.values.map((val) => `"${val}"`).join(', ');
            return `user.attributes.${row.attribute} in [${valuesStr}]`;
        }).join(' && ');

        onChange(expr);
        if (onValidate) {
            onValidate(true);
        }
    };

    const addRow = (attribute: string) => {
        const newRows = [...rows, {attribute, operator: 'is' as const, values: []}];
        setRows(newRows);
        updateExpression(newRows);
        setShowAttributeDropdown(false);
    };

    const removeRow = (index: number) => {
        const newRows = rows.filter((_, i) => i !== index);
        setRows(newRows);
        updateExpression(newRows);
    };

    const updateRowOperator = (index: number, newOperator: 'is' | 'in') => {
        const newRows = [...rows];
        newRows[index].operator = newOperator;

        // If changing from 'in' to 'is', keep only the first value
        if (newOperator === 'is' && newRows[index].values.length > 1) {
            newRows[index].values = [newRows[index].values[0]];
        }

        setRows(newRows);
        updateExpression(newRows);
    };

    const addValueToRow = (index: number, value: string) => {
        if (!value.trim()) {
            return;
        }

        const newRows = [...rows];

        // For 'is' operator, replace the value; for 'in', add to the array
        if (newRows[index].operator === 'is') {
            newRows[index].values = [value];
        } else if (!newRows[index].values.includes(value)) {
            // Only add if not already in the array
            newRows[index].values.push(value);
        }

        setRows(newRows);
        updateExpression(newRows);
        setNewValue('');
        setShowValueModal(false);
        setActiveInputRowIndex(null);
    };

    const removeValueFromRow = (rowIndex: number, valueIndex: number) => {
        const newRows = [...rows];
        newRows[rowIndex].values = newRows[rowIndex].values.filter((_, i) => i !== valueIndex);
        setRows(newRows);
        updateExpression(newRows);
    };

    const testAccessRule = async () => {
        try {
            const result = await Client4.testAccessControlExpression(value);
            setTestResults({
                attributes: result.attributes || {},
                users: result.users || [],
            });
            setShowTestResults(true);
        } catch (error) {
            setServerError(error);
        }
    };

    // Get available attributes (excluding ones already used)
    const getAvailableAttributes = () => {
        const usedAttributes = new Set(rows.map((row) => row.attribute));
        return userAttributes.filter((attr) => !usedAttributes.has(attr.attribute));
    };

    const handleAddButtonClick = (rowIndex: number) => {
        setActiveInputRowIndex(rowIndex);
        setNewValue('');
        setShowValueModal(true);
    };

    const handleModalClose = () => {
        setShowValueModal(false);
        setNewValue('');
        setActiveInputRowIndex(null);
    };

    const handleAddValue = (value: string) => {
        if (activeInputRowIndex !== null) {
            addValueToRow(activeInputRowIndex, value);
        }
    };

    const renderAttribute = (attribute: string) => (
        <div className='table-editor__cell table-editor__attribute'>
            {attribute}
        </div>
    );

    const renderOperator = (rowIndex: number, operator: 'is' | 'in') => (
        <div className='table-editor__cell table-editor__operator'>
            <select
                value={operator}
                onChange={(e) => updateRowOperator(rowIndex, e.target.value as 'is' | 'in')}
                disabled={disabled}
            >
                <option value='is'>{'is'}</option>
                <option value='in'>{'in'}</option>
            </select>
        </div>
    );

    const renderValues = (rowIndex: number, rowValues: string[], rowOperator: 'is' | 'in') => (
        <div className='table-editor__cell table-editor__values'>
            <div className='table-editor__values-container'>
                {rowValues.map((value, valueIndex) => (
                    <div
                        key={valueIndex}
                        className='table-editor__value-tag'
                    >
                        {value}
                        <button
                            className='table-editor__value-remove'
                            onClick={() => removeValueFromRow(rowIndex, valueIndex)}
                            disabled={disabled}
                        >
                            <i className='icon icon-close'/>
                        </button>
                    </div>
                ))}

                {(!disabled && (rowOperator === 'in' || rowValues.length === 0)) && (
                    <button
                        className='table-editor__value-add-button'
                        onClick={() => handleAddButtonClick(rowIndex)}
                        disabled={disabled}
                    >
                        <i className='icon icon-plus'/>
                    </button>
                )}
            </div>

            <button
                className='table-editor__row-remove'
                onClick={() => removeRow(rowIndex)}
                disabled={disabled}
            >
                <i className='icon icon-trash-can-outline'/>
            </button>
        </div>
    );

    interface TableRowElement {
        attribute: React.ReactNode;
        operator: React.ReactNode;
        values: React.ReactNode;
    }

    const getRows = (): TableRowElement[] => {
        if (!rows.length) {
            return [];
        }

        return rows.map((row, rowIndex) => {
            return {
                attribute: renderAttribute(row.attribute),
                operator: renderOperator(rowIndex, row.operator),
                values: renderValues(rowIndex, row.values, row.operator),
            };
        });
    };

    const getRowElements = () => {
        const tableRows = getRows();
        return tableRows.map((row, rowIndex) => (
            <div
                key={rowIndex}
                className='table-editor__row'
            >
                {row.attribute}
                {row.operator}
                {row.values}
            </div>
        ));
    };

    const renderTableHeader = () => (
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
        </div>
    );

    return (
        <div className='table-editor'>
            <div className='table-editor__content'>
                {renderTableHeader()}
                <div className='table-editor__rows'>
                    {getRowElements()}
                </div>
            </div>

            <div className='table-editor__actions-row'>
                <AttributeDropdown
                    isOpen={showAttributeDropdown}
                    disabled={disabled}
                    availableAttributes={getAvailableAttributes()}
                    onSelect={(attribute) => {
                        addRow(attribute);
                        setShowAttributeDropdown(false);
                    }}
                    onToggle={() => setShowAttributeDropdown(!showAttributeDropdown)}
                />

                <TestButton
                    onClick={testAccessRule}
                    disabled={disabled || !value}
                />
            </div>

            <HelpText message={'Add rules to combine user attributes to restrict channel membership. This is a simple expression editor for attribute-based access control.'}/>

            {showValueModal && activeInputRowIndex !== null && (
                <ValueModal
                    onClose={handleModalClose}
                    onAdd={handleAddValue}
                    newValue={newValue}
                    setNewValue={setNewValue}
                />
            )}

            <ErrorMessage error={serverError}/>

            {showTestResults && (
                <TestResultsModal
                    testResults={testResults}
                    onExited={() => setShowTestResults(false)}
                    actions={{
                        openModal: () => {},
                        setModalSearchTerm: (term: string): ActionResult => ({data: term}),
                    }}
                />
            )}
        </div>
    );
};

export default TableEditor;
