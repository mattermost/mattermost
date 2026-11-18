// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyField, PropertyValue} from '@mattermost/types/properties';

import {resolveOptionChipColors} from 'utils/property_option_colors';
import {resolveOptionChips} from 'utils/property_options';

import './option_property_renderer.scss';

type Props = {
    field: PropertyField;
    value: PropertyValue<unknown>;
    maxItems?: number;

    testIdScope?: string;
};

/**
 * The chip renderer for every option-bearing field: `select`, `rank` and
 * `multiselect`. One `.SelectProperty` chip per resolved option.
 */
export default function OptionPropertyRenderer({field, value, maxItems, testIdScope}: Props) {
    const chips = resolveOptionChips(field, value.value);

    // Cap after resolving, not before. `resolveOptionChips` has already dropped the
    // entries that cannot render, and the row's budget counted that same list, so
    // slicing the raw value first would spend a slot on nothing.
    const shown = maxItems === undefined ? chips : chips.slice(0, Math.max(0, maxItems));

    return (
        <>
            {shown.map((chip, index) => {
                const {backgroundColor, color} = resolveOptionChipColors(chip.color);
                const key = `${index}:${chip.key}`;

                return (
                    <div
                        key={key}
                        className='SelectProperty'
                        data-testid={testIdScope ? `${testIdScope}.select--text` : undefined}
                        style={{backgroundColor, color}}
                    >
                        {chip.label}
                    </div>
                );
            })}
        </>
    );
}
