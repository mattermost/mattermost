// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback, useMemo} from 'react';
import type {ReactNode, ChangeEvent} from 'react';

import type {EmailSettings} from '@mattermost/types/config';

import Setting from './setting';

type Props = {
    id: string;
    values: Array<{text: string; value: string}>;
    label: ReactNode;
    value: string;
    onChange: (id: string, value: string | EmailSettings['PushNotificationServerType'] | EmailSettings['PushNotificationServerLocation']) => void;
    disabled?: boolean;
    setByEnv: boolean;
    helpText?: ReactNode;
}

const DropdownSetting = ({
    id,
    values,
    label,
    value,
    onChange,
    disabled = false,
    setByEnv,
    helpText,
}: Props) => {
    const handleChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
        onChange(id, e.target.value);
    }, [onChange, id]);

    const options = useMemo(() =>
        values.map(({value: val, text}) => (
            <option
                value={val}
                key={val}
            >
                {text}
            </option>
        )), [values]);

    return (
        <Setting
            label={label}
            inputId={id}
            helpText={helpText}
            setByEnv={setByEnv}
        >
            <select
                data-testid={id + 'dropdown'}
                className='form-control'
                id={id}
                value={value}
                onChange={handleChange}
                disabled={disabled || setByEnv}
            >
                {options}
            </select>
        </Setting>
    );
};

export default memo(DropdownSetting);
