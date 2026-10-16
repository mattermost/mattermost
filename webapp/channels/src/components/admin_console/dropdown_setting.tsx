// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback, useMemo} from 'react';
import type {ReactNode} from 'react';

import type {EmailSettings} from '@mattermost/types/config';
import {Select} from '@mattermost/compass-ui/components/select';

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
};

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
    const handleChange = useCallback((selectedValue: string) => {
        onChange(id, selectedValue);
    }, [onChange, id]);

    const options = useMemo(() =>
        values.map(({value: val, text}) => ({
            value: val,
            label: text,
        })), [values]);

    return (
        <Setting
            label={label}
            inputId={id}
            helpText={helpText}
            setByEnv={setByEnv}
        >
            <Select
                id={id}
                options={options}
                value={value}
                onChange={handleChange}
                disabled={disabled || setByEnv}
            />
        </Setting>
    );
};

export default memo(DropdownSetting);
