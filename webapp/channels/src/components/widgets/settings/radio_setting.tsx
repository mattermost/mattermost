// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo, useCallback} from 'react';
import type {ChangeEventHandler} from 'react';
import {FormattedMessage} from 'react-intl';

import {Radio} from '@mattermost/compass-ui/components/radio';
import {Button} from '@mattermost/shared/components/button';

import Setting from './setting';

type Props = {
    id: string;
    options?: Array<{text: string; value: string}>;
    label: React.ReactNode;
    onChange(name: string, value: any): void;
    value?: string | null;
    labelClassName?: string;
    inputClassName?: string;
    helpText?: React.ReactNode;
    labelPosition?: 'before' | 'after';
    isOptional?: boolean;
    disabled?: boolean;
};

const RadioSetting = ({
    labelClassName = '',
    inputClassName = '',
    options = [],
    onChange,
    id,
    label,
    helpText,
    value,
    labelPosition = 'after',
    isOptional = false,
    disabled,
}: Props) => {
    const handleChange: ChangeEventHandler<HTMLInputElement> = useCallback((e) => {
        onChange(id, e.target.value);
    }, [onChange, id]);

    const handleClear = useCallback(() => {
        onChange(id, null);
    }, [onChange, id]);

    const selectedValue = value ?? '';
    const showClear = isOptional && selectedValue !== '';

    return (
        <Setting
            label={label}
            labelClassName={labelClassName}
            inputClassName={`inline-choice-setting ${inputClassName}`.trim()}
            helpText={helpText}
            inputId={id}
        >
            {
                options.map(({value: option, text}) => {
                    const radioClassName = classNames({
                        'inline-choice-setting__radio--label-before': labelPosition === 'before',
                    });

                    return (
                        <div
                            className='radio'
                            key={option}
                        >
                            <Radio
                                className={radioClassName}
                                value={option}
                                name={id}
                                checked={option === selectedValue}
                                onChange={handleChange}
                                disabled={disabled}
                            >
                                <span className='inline-choice-setting__text'>{text}</span>
                            </Radio>
                        </div>
                    );
                })
            }
            {showClear && (
                <Button
                    type='button'
                    emphasis='quaternary'
                    size='sm'
                    className='radio-setting__clear'
                    onClick={handleClear}
                >
                    <FormattedMessage
                        id='interactive_dialog.radio.clear'
                        defaultMessage='Clear selection'
                    />
                </Button>
            )}
        </Setting>
    );
};

export default memo(RadioSetting);
