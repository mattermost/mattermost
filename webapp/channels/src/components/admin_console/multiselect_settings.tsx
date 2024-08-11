// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback} from 'react';
import ReactSelect, {ValueType}  from 'react-select';

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
    noResultText?: React.ReactNode;
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
    noResultText,
}) => {
    const [error, setError] = useState(false);

    const handleChange = useCallback((newValue: ValueType<Option>) => {
        const updatedValues = newValue ? (newValue as Option[]).map((n) => 
        n.value) : [];

        onChange(id, updatedValues);
        setError(false);
    }, [id, onChange]);

   const calculateValue = useCallback(() => {
        return selected.reduce<Option[]>((result, item) => {
            const found = values.find((e) => e.value === item);
            if (found) {
                result.push(found);
            }
            return result;
        }, []);
    }, [selected, values]);

    const getOptionLabel = useCallback(({text}: { text: string}) => text, []);

    return (
        <Setting
            label={label}
            inputId={id}
            helpText={helpText}
            setByEnv={setByEnv}
        >
            <ReactSelect
                id={id}
                isMulti={true}
                getOptionLabel={getOptionLabel}
                options={values}
                delimiter={','}
                clearable={false}
                isDisabled={disabled || setByEnv}
                noResultsText={noResultText}
                onChange={handleChange}
                value={calculateValue()}
            />
            <FormError error={error}/>
        </Setting>
    );
}

export default React.memo(MultiSelectSetting);
