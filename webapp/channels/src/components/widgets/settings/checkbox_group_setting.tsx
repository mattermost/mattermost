// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback} from 'react';
import type {ChangeEventHandler} from 'react';

import Setting from './setting';

type Props = {
    id: string;
    options?: Array<{text: string; value: string}>;
    label: React.ReactNode;
    onChange(name: string, value: string[]): void;
    value?: string[];
    labelClassName?: string;
    inputClassName?: string;
    helpText?: React.ReactNode;
    labelPosition?: 'before' | 'after';
    disabled?: boolean;
};

const CheckboxGroupSetting = ({
    labelClassName = '',
    inputClassName = '',
    options = [],
    onChange,
    id,
    label,
    helpText,
    value,
    labelPosition = 'after',
    disabled,
}: Props) => {
    const selected = value || [];

    const handleChange: ChangeEventHandler<HTMLInputElement> = useCallback((e) => {
        const optionValue = e.target.value;
        const checked = e.target.checked;

        // Read the current selection from `value` inside the callback rather than
        // depending on the derived `selected` array, which is a fresh `value || []`
        // on every render and would defeat the memoization (a new callback each
        // render). Depending on `value` keeps the callback stable across renders.
        const current = value || [];
        const next = checked ?
            [...current, optionValue] :
            current.filter((v) => v !== optionValue);
        onChange(id, next);
    }, [onChange, id, value]);

    return (
        <Setting
            label={label}
            labelClassName={labelClassName}
            inputClassName={`inline-choice-setting ${inputClassName}`.trim()}
            helpText={helpText}
            inputId={id}
        >
            <fieldset>
                <legend className='form-legend hidden-label'>{label}</legend>
                {
                    options.map(({value: optionValue, text}) => (
                        <div
                            className='checkbox'
                            key={optionValue}
                        >
                            <label>
                                {labelPosition === 'before' && (
                                    <span className='inline-choice-setting__text'>{text}</span>
                                )}
                                <input
                                    type='checkbox'
                                    value={optionValue}
                                    name={id}
                                    checked={selected.includes(optionValue)}
                                    onChange={handleChange}
                                    disabled={disabled}
                                />
                                {labelPosition === 'after' && (
                                    <span className='inline-choice-setting__text'>{text}</span>
                                )}
                            </label>
                        </div>
                    ))
                }
            </fieldset>
        </Setting>
    );
};

export default memo(CheckboxGroupSetting);
