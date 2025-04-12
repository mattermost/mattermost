import React, {useState, useEffect} from 'react';
import {FormattedMessage} from 'react-intl';
import {Client4} from 'mattermost-redux/client';

import './table_editor.scss';
import TestResultsModal from '../test_modal/test_modal';

import type {AccessControlTestResult} from '@mattermost/types/admin';
import type {ActionResult} from 'mattermost-redux/types/actions';
import Markdown from 'components/markdown';

interface TableEditorProps {
    value: string;
    onChange: (value: string) => void;
    onValidate?: (isValid: boolean) => void;
    disabled?: boolean;
}

interface TableRow {
    attribute: string;
    value: string;
}

// Parse initial value into table rows
const parseExpression = (expr: string): TableRow[] => {
    if (!expr) {
        return [{attribute: '', value: ''}];
    }

    const rows: TableRow[] = [];
    const conditions = expr.split('&&').map(c => c.trim());
    
    for (const condition of conditions) {
        const match = condition.match(/user\.attributes\.(\w+)\s*==\s*['"]([^'"]+)['"]/);
        if (match) {
            rows.push({
                attribute: match[1],
                value: match[2],
            });
        }
    }

    return rows.length ? rows : [{attribute: '', value: ''}];
};

const TableEditor: React.FC<TableEditorProps> = ({
    value,
    onChange,
    onValidate,
    disabled = false,
}) => {
    const [rows, setRows] = useState<TableRow[]>(parseExpression(value));
    const [isTableMode, setIsTableMode] = useState(true);
    const [showTestResults, setShowTestResults] = useState(false);
    const [testResults, setTestResults] = useState<AccessControlTestResult | null>(null);

    // Check if expression is simple enough for table mode
    useEffect(() => {
        const isSimpleExpression = !value || value.split('&&').every(condition => {
            return condition.trim().match(/^user\.attributes\.\w+\s*==\s*['"][^'"]+['"]$/);
        });
        setIsTableMode(isSimpleExpression);
    }, [value]);

    // Update the CEL expression when table changes
    const updateExpression = (newRows: TableRow[]) => {
        const validRows = newRows.filter(row => row.attribute && row.value);
        const expr = validRows
            .map(row => `user.attributes.${row.attribute} == "${row.value}"`)
            .join(' && ');
        onChange(expr);
        if (onValidate) {
            onValidate(true);
        }
    };

    const handleRowChange = (index: number, field: 'attribute' | 'value', newValue: string) => {
        const newRows = [...rows];
        newRows[index] = {...newRows[index], [field]: newValue};
        setRows(newRows);
        updateExpression(newRows);
    };

    const addRow = () => {
        setRows([...rows, {attribute: '', value: ''}]);
    };

    const removeRow = (index: number) => {
        const newRows = rows.filter((_, i) => i !== index);
        if (newRows.length === 0) {
            newRows.push({attribute: '', value: ''});
        }
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
            console.error('Error testing access rule:', error);
        }
    };

    if (!isTableMode) {
        return (
            <div className="table-editor__disabled-message">
                <i className="icon icon-alert-outline"/>
                <FormattedMessage
                    id="admin.access_control.table_editor.complex_expression"
                    defaultMessage="Complex expression detected. Table editor is only available for simple attribute comparisons."
                />
            </div>
        );
    }

    return (
        <div className="table-editor">
            <table className="table-editor__table">
                <thead>
                    <tr>
                        <th>
                            <FormattedMessage
                                id="admin.access_control.table_editor.attribute"
                                defaultMessage="Attribute"
                            />
                        </th>
                        <th>
                            <FormattedMessage
                                id="admin.access_control.table_editor.value"
                                defaultMessage="Value"
                            />
                        </th>
                        <th className="table-editor__actions">
                            <FormattedMessage
                                id="admin.access_control.table_editor.actions"
                                defaultMessage="Actions"
                            />
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, index) => (
                        <tr key={index}>
                            <td>
                                <input
                                    type="text"
                                    value={row.attribute}
                                    onChange={(e) => handleRowChange(index, 'attribute', e.target.value)}
                                    placeholder="Enter attribute"
                                    disabled={disabled}
                                    className="table-editor__input"
                                />
                            </td>
                            <td>
                                <input
                                    type="text"
                                    value={row.value}
                                    onChange={(e) => handleRowChange(index, 'value', e.target.value)}
                                    placeholder="Enter value"
                                    disabled={disabled}
                                    className="table-editor__input"
                                />
                            </td>
                            <td className="table-editor__actions">
                                <button
                                    className="table-editor__button table-editor__button--delete"
                                    onClick={() => removeRow(index)}
                                    disabled={disabled || rows.length === 1}
                                >
                                    <i className="icon icon-trash-can-outline"/>
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <div className="table-editor__footer">
                <div className="table-editor__footer-left">
                    <button
                        className="table-editor__button table-editor__button--add"
                        onClick={addRow}
                        disabled={disabled}
                    >
                        <i className="icon icon-plus"/>
                        <FormattedMessage
                            id="admin.access_control.table_editor.add_row"
                            defaultMessage="Add Row"
                        />
                    </button>
                </div>
                <div className="table-editor__footer-right">
                    <button
                        className="table-editor__button table-editor__button--test"
                        onClick={testAccessRule}
                        disabled={disabled || !value}
                    >
                        <i className="icon icon-lock-outline"/>
                        <FormattedMessage
                            id="admin.access_control.table_editor.test_access_rule"
                            defaultMessage="Test access rule"
                        />
                    </button>
                </div>
            </div>
            <div className="table-editor__help-text">
                <Markdown
                    message={"Add rules to each row and users must have all of the attributes above to access this channel."}
                    options={{mentionHighlight: false}}
                />
                <a href="#" className="cel-editor__learn-more">
                    <FormattedMessage
                        id="admin.access_control.cel.learnMore"
                        defaultMessage="Learn more about creating access expressions with examples."
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