// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';
import {FormattedMessage} from 'react-intl';

import type {AccessControlTestResult} from '@mattermost/types/admin';

import {Client4} from 'mattermost-redux/client';
import type {ActionResult} from 'mattermost-redux/types/actions';

import Markdown from 'components/markdown';

import TestResultsModal from '../test_modal/test_modal';

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
    const [isTableMode, setIsTableMode] = useState(true);
    const [showTestResults, setShowTestResults] = useState(false);
    const [testResults, setTestResults] = useState<AccessControlTestResult | null>(null);
    const [showAttributeDropdown, setShowAttributeDropdown] = useState(false);
    const [serverError, setServerError] = useState(false);
    const [newValue, setNewValue] = useState('');
    const [activeInputRowIndex, setActiveInputRowIndex] = useState<number | null>(null);
    const [showValueModal, setShowValueModal] = useState(false);

    // Check if expression is simple enough for table mode
    useEffect(() => {
        const isSimpleExpression = !value || value.split('&&').every((condition) => {
            const trimmed = condition.trim();
            return trimmed.match(/^user\.attributes\.\w+\s*==\s*['"][^'"]+['"]$/) ||
                   trimmed.match(/^user\.attributes\.\w+\s+in\s+\[.*?\]$/);
        });
        setIsTableMode(isSimpleExpression);
        
        if (isSimpleExpression) {
            // Update rows when value changes externally
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
        } else {
            // Only add if not already in the array
            if (!newRows[index].values.includes(value)) {
                newRows[index].values.push(value);
            }
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

    return (
        <div className='table-editor'>
            <div className='table-editor__content'>
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
                
                <div className='table-editor__rows'>
                    {rows.map((row, rowIndex) => (
                        <div
                            key={rowIndex}
                            className='table-editor__row'
                        >
                            <div className='table-editor__cell table-editor__attribute'>
                                {row.attribute}
                            </div>
                            <div className='table-editor__cell table-editor__operator'>
                                <select
                                    value={row.operator}
                                    onChange={(e) => updateRowOperator(rowIndex, e.target.value as 'is' | 'in')}
                                    disabled={disabled}
                                >
                                    <option value='is'>is</option>
                                    <option value='in'>in</option>
                                </select>
                            </div>
                            <div className='table-editor__cell table-editor__values'>
                                <div className='table-editor__values-container'>
                                    {row.values.map((value, valueIndex) => (
                                        <div key={valueIndex} className='table-editor__value-tag'>
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
                                    
                                    {/* Only show add button if operator is 'in' or no values exist for 'is' */}
                                    {(!disabled && (row.operator === 'in' || row.values.length === 0)) && (
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
                        </div>
                    ))}
                </div>
            </div>
            
            <div className='table-editor__actions-row'>
                <div className='table-editor__select-attribute-container'>
                    <button
                        className='table-editor__select-attribute-button'
                        onClick={() => setShowAttributeDropdown(true)}
                        disabled={disabled || getAvailableAttributes().length === 0}
                    >
                        <i className='icon icon-plus'/>
                        <FormattedMessage
                            id='admin.access_control.table_editor.select_user_attribute'
                            defaultMessage='Select user attribute'
                        />
                    </button>
                    {!disabled && showAttributeDropdown && getAvailableAttributes().length > 0 && (
                        <div className='table-editor__attribute-dropdown'>
                            {getAvailableAttributes().map((attr) => (
                                <button
                                    key={attr.attribute}
                                    className='table-editor__attribute-option'
                                    onClick={() => addRow(attr.attribute)}
                                >
                                    {attr.attribute}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                
                <button
                    className='table-editor__test-btn'
                    onClick={testAccessRule}
                    disabled={disabled || !value}
                >
                    <i className='icon icon-lock-outline'/>
                    <FormattedMessage
                        id='admin.access_control.table_editor.test_access_rule'
                        defaultMessage='Test access rule'
                    />
                </button>
            </div>
            
            <div className='table-editor__help-text'>
                <Markdown
                    message={'Add rules to combine user attributes to restrict channel membership. This is a simple expression editor for attribute-based access control.'}
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
            
            {/* Value input modal */}
            {showValueModal && activeInputRowIndex !== null && (
                <div className='table-editor__value-modal-backdrop'>
                    <div className='table-editor__value-modal'>
                        <div className='table-editor__value-modal-header'>
                            <FormattedMessage
                                id='admin.access_control.table_editor.add_value'
                                defaultMessage='Add value'
                            />
                            <button
                                className='table-editor__value-modal-close'
                                onClick={handleModalClose}
                            >
                                <i className='icon icon-close'/>
                            </button>
                        </div>
                        <div className='table-editor__value-modal-content'>
                            <input
                                type='text'
                                value={newValue}
                                onChange={(e) => setNewValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && newValue) {
                                        addValueToRow(activeInputRowIndex, newValue);
                                    }
                                }}
                                placeholder='Type and press Enter'
                                autoFocus={true}
                            />
                            <div className='table-editor__value-modal-actions'>
                                <button
                                    className='table-editor__value-modal-cancel'
                                    onClick={handleModalClose}
                                >
                                    <FormattedMessage
                                        id='admin.access_control.table_editor.cancel'
                                        defaultMessage='Cancel'
                                    />
                                </button>
                                <button
                                    className='table-editor__value-modal-add'
                                    onClick={() => addValueToRow(activeInputRowIndex, newValue)}
                                    disabled={!newValue}
                                >
                                    <FormattedMessage
                                        id='admin.access_control.table_editor.add'
                                        defaultMessage='Add'
                                    />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {serverError && (
                <span className='EditPolicy__error'>
                    <i className='icon icon-alert-outline'/>
                    <FormattedMessage
                        id='admin.access_control.edit_policy.serverError'
                        defaultMessage='There are errors in the form above'
                    />
                </span>
            )}
            
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
