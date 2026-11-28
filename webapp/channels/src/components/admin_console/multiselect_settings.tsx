// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback, useMemo} from 'react';
import type {InputProps, MultiValueRemoveProps, OnChangeValue} from 'react-select';
import ReactSelect, {components} from 'react-select';

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

const getOptionLabel = ({text}: {text: string}) => text;

// The setting's parts inside its row (`admin.setting:<key>`): the search box `admin.setting.values--combobox`, and each
// chosen value's remove button `admin.setting.remove:<value>--button`. react-select passes extra props through to its
// <input>; the remove button's styles arrive in innerProps, so its testid goes in there too.
const SettingInput = (props: InputProps<Option, true>) => (
    <components.Input
        {...props}
        data-testid='admin.setting.values--combobox'
    />
);

const SettingMultiValueRemove = (props: MultiValueRemoveProps<Option>) => (
    <components.MultiValueRemove
        {...props}
        innerProps={{...props.innerProps, 'data-testid': `admin.setting.remove:${props.data.value}--button`} as MultiValueRemoveProps<Option>['innerProps']}
    />
);

const selectComponents = {Input: SettingInput, MultiValueRemove: SettingMultiValueRemove};

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

    const handleChange = useCallback((newValue: OnChangeValue<Option, true>) => {
        const updatedValues = newValue ? (newValue as Option[]).map((n) => {
            return n.value;
        }) : [];

        onChange(id, updatedValues);
        setError(false);
    }, [id, onChange]);

    const valuesMap = useMemo(() => {
        return values.reduce((map, v) => {
            map[v.value] = v;
            return map;
        }, {} as Record<string, Option>);
    }, [values]);

    const calculatedValue = useMemo(() => {
        return selected.reduce<Option[]>((result, item) => {
            const found = valuesMap[item];
            if (found) {
                result.push(found);
            }
            return result;
        }, []);
    }, [selected, valuesMap]);

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
                isClearable={false}
                isDisabled={disabled || setByEnv}
                noOptionsMessage={() => noOptionsMessage}
                onChange={handleChange}
                value={calculatedValue}
                components={selectComponents}
            />
            <FormError error={error}/>
        </Setting>
    );
};

export default React.memo(MultiSelectSetting);
