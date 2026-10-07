// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback, useMemo} from 'react';

import {Combobox} from '@mattermost/compass-ui/components/combobox';
import type {ComboboxOption} from '@mattermost/compass-ui/components/combobox';

import FormError from 'components/form_error';

import Setting from './setting';

interface Option {
    value: string;
    text: string;
}

interface Props {
    id: string;
    values: Option[];
    label: React.ReactNode;
    selected: string[];
    onChange: (id: string, values: string[]) => void;
    disabled?: boolean;
    setByEnv: boolean;
    helpText?: React.ReactNode;
    noOptionsMessage?: React.ReactNode;
}

const MultiSelectSetting: React.FC<Props> = ({
    id,
    values,
    label,
    selected,
    onChange,
    disabled = false,
    setByEnv,
    helpText,
    noOptionsMessage,
}) => {
    const [error, setError] = useState(false);

    const options: ComboboxOption[] = useMemo(() => {
        return values.map((v) => ({
            value: v.value,
            label: v.text,
        }));
    }, [values]);

    const handleChange = useCallback((newValue: string | string[] | null) => {
        const updatedValues = Array.isArray(newValue) ? newValue : [];
        onChange(id, updatedValues);
        setError(false);
    }, [id, onChange]);

    return (
        <Setting
            label={label}
            inputId={id}
            helpText={helpText}
            setByEnv={setByEnv}
        >
            <Combobox
                id={id}
                multiple={true}
                options={options}
                value={selected}
                onChange={handleChange}
                disabled={disabled || setByEnv}
                emptyMessage={noOptionsMessage}
            />
            <FormError error={error}/>
        </Setting>
    );
};

export default React.memo(MultiSelectSetting);
