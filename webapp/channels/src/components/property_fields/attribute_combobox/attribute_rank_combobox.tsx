// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';

import type {PropertyFieldOption} from '@mattermost/types/properties';

import {sortOptionsByRank} from 'mattermost-redux/utils/property_utils';

import RankBadge from 'components/admin_console/system_properties/rank_badge';

import {AttributeCombobox} from './attribute_combobox';
import type {AttributeComboboxProps, AttributeOptionDecoration} from './attribute_combobox';
import {AttributeOptionSwatch} from './attribute_option_swatch';

/** Single-select only, highest rank first. */
export type AttributeRankComboboxProps = Omit<AttributeComboboxProps, 'multiple' | 'decorateOption' | 'onChange'> & {
    onChange: (value: string) => void;
};

function decorateRankOption(option: PropertyFieldOption): AttributeOptionDecoration {
    const {rank} = option;

    let leadingVisual;
    if (option.color) {
        leadingVisual = <AttributeOptionSwatch color={option.color}/>;
    } else if (typeof rank === 'number') {
        leadingVisual = <RankBadge rank={rank}/>;
    }

    return {leadingVisual};
}

export function AttributeRankCombobox({options, onChange, ...rest}: AttributeRankComboboxProps) {
    const sortedOptions = useMemo(() => sortOptionsByRank(options), [options]);

    const handleChange = useCallback((next: string | string[]) => {
        onChange(Array.isArray(next) ? next[0] ?? '' : next);
    }, [onChange]);

    return (
        <AttributeCombobox
            {...rest}
            multiple={false}
            options={sortedOptions}
            decorateOption={decorateRankOption}
            onChange={handleChange}
        />
    );
}
