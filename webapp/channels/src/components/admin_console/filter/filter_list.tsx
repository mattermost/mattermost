// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {FilterOption, FilterValues} from './filter';
import FilterCheckbox from './filter_checkbox';
import './filter.scss';

type Props = {
    option: FilterOption;
    optionKey: string;
    updateValues: (values: FilterValues, optionKey: string) => void;
}

class FilterList extends React.PureComponent<Props> {
    updateOption = async (value: boolean, key: string) => {
        const values = {
            ...this.props.option.values,
            [key]: {
                ...this.props.option.values[key],
                value,
            },
        };
        await this.props.updateValues(values, this.props.optionKey);
    };

    render() {
        const {option} = this.props;
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
                        updateOption={this.updateOption}
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
    }
}

export default FilterList;
