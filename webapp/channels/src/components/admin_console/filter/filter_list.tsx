// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback} from 'react';

import type {FilterOption, FilterValues} from './filter';
import FilterCheckbox from './filter_checkbox';

import './filter.scss';

type Props = {
    option: FilterOption;
    optionKey: string;
    updateValues: (values: FilterValues, optionKey: string) => void;
}

const FilterList = ({
    option,
    optionKey,
    updateValues,
}: Props) => {
    const updateOption = useCallback(async (value: boolean, key: string) => {
        const values = {
            ...option.values,
            [key]: {
                ...option.values[key],
                value,
            },
        };
        await updateValues(values, optionKey);
    }, [option.values, optionKey, updateValues]);

    const valuesToRender = option.keys.map((optionKey: string, index: number) => {
        const currentValue = option.values[optionKey];
        const {value, name} = currentValue;
        const FilterItem = option.type || FilterCheckbox;

        return (
            <div
                key={index}
                className='FilterList_item'
            >
                <FilterItem
                    key={index}
                    name={optionKey}
                    checked={value}
                    label={name}
                    updateOption={updateOption}
                />
            </div>
        );
    });

    return (
        <div className='FilterList'>
            <div className='FilterList_name'>
                {option.name}
            </div>

            {valuesToRender}
        </div>
    );
};

export default memo(FilterList);
