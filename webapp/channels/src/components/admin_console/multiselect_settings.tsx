// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import ReactSelect, {ValueType} from 'react-select';

import FormError from 'components/form_error';

import Setting from './setting';

type Props = {
    id: string;
    values: Array<{ text: string; value: string }>;
    label: React.ReactNode;
    selected: string[];
    onChange(id: string, value: any): void;
    disabled?: boolean;
    setByEnv: boolean;
    helpText?: React.ReactNode;
    noResultText?: React.ReactNode;
}
const MultiSelectSetting = ({
    id,
    values,
    label,
    selected,
    onChange,
    disabled = false,
    setByEnv,
    helpText,
    noResultText,
}: Props) => {
    const [hasError, setHasError] = useState(false);

    const handleChange = (
        newValues: ValueType<{
            text: string;
            value: string;
        }> | undefined | null,
    ) => {
        if (!newValues) {
            return;
        }

        // const values = newValues.map((n) => {
        //     return n.value;
        // });

        // eslint-disable-next-line no-console
        console.log({
            newValues,
        });

        /**
            NEED TO VALIDATE THIS BEHAVIOR MORE
        */

        onChange(id, newValues);
        setHasError(false);
    };

    const calculateValue = (): ValueType<{text: string; value: string}> => {
        return selected.filter((item) => {
            return values.find((e) => {
                return e.value === item;
            });
        }).map((item) => ({value: item, text: item}));

        // return selected.reduce((values, item) => {
        //     const found = values.find((e) => {
        //         return e.value === item;
        //     });
        //     if (found !== null) {
        //         values.push(found);
        //     }
        //     return values;
        // }, []);
    };

    const getOptionLabel = ({text}: {text: string}) => text;

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
                onChange={(item) => handleChange(item)}
                value={calculateValue()}
            />
            <FormError error={hasError}/>
        </Setting>
    );
};

export default MultiSelectSetting;
