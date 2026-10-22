// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useIntl} from 'react-intl';

import {SELECTOR_DAY_DESCRIPTORS} from 'components/recaps/day_descriptors';

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
            {SELECTOR_DAY_DESCRIPTORS.map((day) => (
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
                    aria-label={formatMessage(day.fullName)}
                >
                    {formatMessage(day.shortLabel)}
                </button>
            ))}
        </div>
    );
};

export default DayOfWeekSelector;
