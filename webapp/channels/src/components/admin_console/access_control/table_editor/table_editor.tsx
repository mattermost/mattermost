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
    value: string;
}

// Parse initial value into table rows
const parseExpression = (expr: string): TableRow[] => {
    if (!expr) {
        return [];
    }

    const rows: TableRow[] = [];
    const conditions = expr.split('&&').map((c) => c.trim());

    for (const condition of conditions) {
        const match = condition.match(/user\.attributes\.(\w+)\s*==\s*['"]([^'"]+)['"]/);
        if (match) {
            rows.push({
                attribute: match[1],
                value: match[2],
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

    // Get available attributes (excluding ones already used)
    const getAvailableAttributes = () => {
        const usedAttributes = new Set(rows.map((row) => row.attribute));
        return userAttributes.filter((attr) => !usedAttributes.has(attr.attribute));
    };

    // Check if expression is simple enough for table mode
    useEffect(() => {
        const isSimpleExpression = !value || value.split('&&').every((condition) => {
            return condition.trim().match(/^user\.attributes\.\w+\s*==\s*['"][^'"]+['"]$/);
        });
        setIsTableMode(isSimpleExpression);
    }, [value]);

    // Update the CEL expression when table changes
    const updateExpression = (newRows: TableRow[]) => {
        const validRows = newRows.filter((row) => row.attribute && row.value);
        const expr = validRows.
            map((row) => `user.attributes.${row.attribute} == "${row.value}"`).
            join(' && ');
        onChange(expr);
        if (onValidate) {
            onValidate(true);
        }
    };

    const addCondition = (attribute: string, value: string) => {
        const newRows = [...rows, {attribute, value}];
        setRows(newRows);
        updateExpression(newRows);
        setShowAttributeDropdown(false);
    };

    const removeCondition = (index: number) => {
        const newRows = rows.filter((_, i) => i !== index);
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

    if (!isTableMode) {
        return (
            <div className='table-editor__disabled-message'>
                <i className='icon icon-alert-outline'/>
                <FormattedMessage
                    id='admin.access_control.table_editor.complex_expression'
                    defaultMessage='Complex expression detected. Simple expressions editor is not available at the moment.'
                />
            </div>
        );
    }

    return (
        <div className='table-editor'>
            <div className='table-editor__conditions'>
                {rows.map((row, index) => (
                    <div
                        key={index}
                        className='table-editor__condition'
                    >
                        <div className='table-editor__condition-attribute'>
                            {row.attribute}
                        </div>
                        <div className='table-editor__condition-equals'>{'='}</div>
                        <div className='table-editor__condition-value'>
                            {row.value}
                            <button
                                className='table-editor__condition-remove'
                                onClick={() => removeCondition(index)}
                                disabled={disabled}
                            >
                                <i className='icon icon-close'/>
                            </button>
                        </div>
                    </div>
                ))}
                {!disabled && getAvailableAttributes().length > 0 && (
                    <div className='table-editor__add-condition'>
                        {showAttributeDropdown ? (
                            <div className='table-editor__dropdown-container'>
                                <div className='table-editor__dropdown'>
                                    {getAvailableAttributes().map((attr) => (
                                        <div
                                            key={attr.attribute}
                                            className='table-editor__dropdown-section'
                                        >
                                            <div className='table-editor__dropdown-attribute'>
                                                {attr.attribute}
                                            </div>
                                            <div className='table-editor__dropdown-values'>
                                                {attr.values.map((value) => (
                                                    <button
                                                        key={value}
                                                        className='table-editor__dropdown-value'
                                                        onClick={() => addCondition(attr.attribute, value)}
                                                    >
                                                        {value}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <button
                                className='table-editor__add-button'
                                onClick={() => setShowAttributeDropdown(true)}
                            >
                                <i className='icon icon-plus'/>
                                <FormattedMessage
                                    id='admin.access_control.table_editor.add_condition'
                                    defaultMessage='Add condition'
                                />
                            </button>
                        )}
                    </div>
                )}
            </div>
            {serverError && (
                <span className='EditPolicy__error'>
                    <i className='icon icon-alert-outline'/>
                    <FormattedMessage
                        id='admin.access_control.edit_policy.serverError'
                        defaultMessage='There are errors in the form above'
                    />
                </span>
            )}
            <div className='table-editor__footer'>
                <div className='table-editor__footer-right'>
                    <button
                        className='table-editor__button table-editor__button--test'
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
            </div>
            <div className='table-editor__help-text'>
                <Markdown
                    message={'Add rules to combine user attributes to restrict channel membership. This is a simple expression editor and does not support complex expressions.'}
                    options={{mentionHighlight: false}}
                />
                <a
                    href='#'
                    className='cel-editor__learn-more'
                >
                    <FormattedMessage
                        id='admin.access_control.cel.learnMore'
                        defaultMessage='Learn more about creating access expressions with examples.'
                    />
                </a>
            </div>
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
