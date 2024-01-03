// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback} from 'react';
import type {ChangeEventHandler} from 'react';

import Setting from './setting';

type Props = {
    id: string;
    options?: Array<{text: string; value: string}>;
    label: React.ReactNode;
    onChange(name: string, value: any): void;
    value?: string;
    labelClassName?: string;
    inputClassName?: string;
    helpText?: React.ReactNode;

}

const RadioSetting = ({
    labelClassName = '',
    inputClassName = '',
    options = [],
    onChange,
    id,
    label,
    helpText,
    value,
}: Props) => {
    const handleChange: ChangeEventHandler<HTMLInputElement> = useCallback((e) => {
        onChange(id, e.target.value);
    }, [onChange, id]);

    return (
        <Setting
            label={label}
            labelClassName={labelClassName}
            inputClassName={inputClassName}
            helpText={helpText}
            inputId={id}
        >
            {
                options.map(({value: option, text}) => {
                    return (
                        <div
                            className='radio'
                            key={option}
                        >
                            <label>
                                <input
                                    type='radio'
                                    value={option}
                                    name={id}
                                    checked={option === value}
                                    onChange={handleChange}
                                />
                                {text}
                            </label>
                        </div>
                    );
                })
            }
        </Setting>
    );
};

export default memo(RadioSetting);
