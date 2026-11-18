// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback, useMemo} from 'react';
import type {ChangeEventHandler} from 'react';

import type {MatrixConfig} from '@mattermost/types/apps';

type Props = {
    id: string;
    label: React.ReactNode;
    helpText?: React.ReactNode;
    matrixConfig: MatrixConfig;
    onChange(name: string, value: string[]): void;
    value?: string[];
    disabled?: boolean;

    /** The row's parts render under it (`${testIdScope}.label--text`, `.help--text`, ...); without it the row keeps its input-id based ids. */
    testIdScope?: string;

    /** The row's key: with it the row's own element is `<testIdScope>:<testKey>--group`. */
    testKey?: string;
};

export function parseMatrixValue(entries: string[]): Map<string, Set<string>> {
    const selection = new Map<string, Set<string>>();
    for (const entry of entries) {
        const colonIndex = entry.indexOf(':');
        if (colonIndex <= 0) {
            continue;
        }
        const rowValue = entry.slice(0, colonIndex);
        const columns = entry.slice(colonIndex + 1).
            split(',').
            map((col) => col.trim()).
            filter(Boolean);
        if (columns.length > 0) {
            selection.set(rowValue, new Set(columns));
        }
    }
    return selection;
}

export function encodeMatrixValue(selection: Map<string, Set<string>>): string[] {
    const entries: string[] = [];
    selection.forEach((columns, rowValue) => {
        if (columns.size > 0) {
            entries.push(`${rowValue}:${Array.from(columns).join(',')}`);
        }
    });
    return entries;
}

const CheckboxMatrixSetting = ({
    id,
    label,
    helpText,
    matrixConfig,
    onChange,
    value,
    disabled,
    testIdScope,
    testKey,
}: Props) => {
    const rows = matrixConfig.rows || [];
    const columns = matrixConfig.columns || [];
    const rowSelection = matrixConfig.row_selection || 'multiple';

    const selection = useMemo(() => parseMatrixValue(value || []), [value]);

    const updateSelection = useCallback((next: Map<string, Set<string>>) => {
        onChange(id, encodeMatrixValue(next));
    }, [id, onChange]);

    const handleCheckboxChange: ChangeEventHandler<HTMLInputElement> = useCallback((e) => {
        const rowValue = e.target.dataset.row || '';
        const columnValue = e.target.value;
        const next = new Map(selection);
        const rowColumns = new Set(next.get(rowValue) || []);
        if (e.target.checked) {
            rowColumns.add(columnValue);
        } else {
            rowColumns.delete(columnValue);
        }
        if (rowColumns.size === 0) {
            next.delete(rowValue);
        } else {
            next.set(rowValue, rowColumns);
        }
        updateSelection(next);
    }, [selection, updateSelection]);

    const handleRadioChange: ChangeEventHandler<HTMLInputElement> = useCallback((e) => {
        const rowValue = e.target.dataset.row || '';
        const columnValue = e.target.value;
        const next = new Map(selection);
        next.set(rowValue, new Set([columnValue]));
        updateSelection(next);
    }, [selection, updateSelection]);

    const handleChange = rowSelection === 'single' ? handleRadioChange : handleCheckboxChange;

    let rootTestId = id;
    if (testIdScope) {
        rootTestId = testKey ? `${testIdScope}:${testKey}--group` : `${testIdScope}--group`;
    }

    return (
        <div
            className='form-group'
            role='group'
            data-testid={rootTestId}
        >
            {label && (
                <label
                    className='control-label'
                    data-testid={testIdScope ? `${testIdScope}.label--text` : id + 'label'}
                >
                    {label}
                </label>
            )}
            <table className='checkbox-matrix'>
                <thead>
                    <tr>
                        <th
                            scope='col'
                            className='checkbox-matrix__corner'
                        />
                        {columns.map((col) => (
                            <th
                                scope='col'
                                key={col.value}
                            >
                                {col.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr
                            key={row.value}
                            data-testid={testIdScope ? `${testIdScope}.row:${row.value}--row` : undefined}
                        >
                            <th scope='row'>{row.label}</th>
                            {columns.map((col) => {
                                const rowColumns = selection.get(row.value);
                                const checked = rowColumns?.has(col.value) || false;
                                let cellTestId;
                                if (testIdScope) {
                                    cellTestId = rowSelection === 'single' ? `${testIdScope}.row.radio_cell:${col.value}--radio` : `${testIdScope}.row.cell:${col.value}--checkbox`;
                                }
                                return (
                                    <td key={col.value}>
                                        <input
                                            type={rowSelection === 'single' ? 'radio' : 'checkbox'}
                                            name={rowSelection === 'single' ? `${id}:${row.value}` : undefined}
                                            value={col.value}
                                            data-row={row.value}
                                            data-testid={cellTestId}
                                            aria-label={`${row.label}, ${col.label}`}
                                            checked={checked}
                                            onChange={handleChange}
                                            disabled={disabled}
                                        />
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
            {helpText && (
                <div
                    className='help-text'
                    data-testid={testIdScope ? `${testIdScope}.help--text` : id + 'help-text'}
                >
                    {helpText}
                </div>
            )}
        </div>
    );
};

export default memo(CheckboxMatrixSetting);
