// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import classNames from 'classnames';

import {DaysOfWeek} from '@mattermost/types/recaps';

const {Sunday, Monday, Tuesday, Wednesday, Thursday, Friday, Saturday} = DaysOfWeek;

type DayInfo = {
    bit: number;
    labelKey: string;
    shortLabel: string;
};

// Order: Monday first (more intuitive for work schedules)
const DAYS: DayInfo[] = [
    {bit: Monday, labelKey: 'recaps.days.monday', shortLabel: 'M'},
    {bit: Tuesday, labelKey: 'recaps.days.tuesday', shortLabel: 'T'},
    {bit: Wednesday, labelKey: 'recaps.days.wednesday', shortLabel: 'W'},
    {bit: Thursday, labelKey: 'recaps.days.thursday', shortLabel: 'Th'},
    {bit: Friday, labelKey: 'recaps.days.friday', shortLabel: 'F'},
    {bit: Saturday, labelKey: 'recaps.days.saturday', shortLabel: 'Sa'},
    {bit: Sunday, labelKey: 'recaps.days.sunday', shortLabel: 'Su'},
];

type Props = {
    value: number; // Bitmask of selected days
    onChange: (value: number) => void;
    disabled?: boolean;
    error?: boolean;
};

const DayOfWeekSelector = ({value, onChange, disabled, error}: Props) => {
    const {formatMessage} = useIntl();

    const toggleDay = (dayBit: number) => {
        if (disabled) {
            return;
        }
        // XOR to toggle the bit
        onChange(value ^ dayBit);
    };

    const isDaySelected = (dayBit: number): boolean => {
        return (value & dayBit) !== 0;
    };

    return (
        <div className={classNames('day-of-week-selector', {error})}>
            {DAYS.map((day) => (
                <button
                    key={day.bit}
                    type='button'
                    className={classNames('day-button', {
                        selected: isDaySelected(day.bit),
                        disabled,
                    })}
                    onClick={() => toggleDay(day.bit)}
                    disabled={disabled}
                    aria-pressed={isDaySelected(day.bit)}
                    aria-label={formatMessage({id: day.labelKey, defaultMessage: day.shortLabel})}
                >
                    {day.shortLabel}
                </button>
            ))}
        </div>
    );
};

export default DayOfWeekSelector;
