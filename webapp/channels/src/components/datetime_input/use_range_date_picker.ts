// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Moment} from 'moment-timezone';
import {useCallback} from 'react';
import type {DateRange, DayPickerProps} from 'react-day-picker';

import {isSameDay, momentToLocalDate} from 'utils/date_utils';

export type RangeConfig = {
    rangeValue: {from?: Moment | null; to?: Moment | null};
    onRangeChange: (start: Date, end: Date | null) => void;
    allowSingleDayRange: boolean;
};

type UseRangeDatePickerArgs = {
    rangeConfig?: RangeConfig;
    displayTime: Moment | null;
    isPopperOpen: boolean;
    handlePopperOpenState: (isOpen: boolean) => void;
};

type UseRangeDatePickerResult = {
    rangeDatePickerProps: DayPickerProps | null;
};

export function useRangeDatePicker({
    rangeConfig,
    displayTime,
    isPopperOpen,
    handlePopperOpenState,
}: UseRangeDatePickerArgs): UseRangeDatePickerResult {
    const rangeValue = rangeConfig?.rangeValue;
    const onRangeChange = rangeConfig?.onRangeChange;
    const allowSingleDayRange = rangeConfig?.allowSingleDayRange ?? false;
    const rangeMode = Boolean(rangeConfig);

    // Handle range selection via react-day-picker's onSelect callback.
    // When the range is already complete (both from and to exist), we no-op here
    // and let handleRangeDayClick (bound to onDayClick) handle the reset instead.
    // onDayClick fires before onSelect, so the reset happens first, then this
    // callback sees the now-incomplete range on the next interaction.
    const handleRangeSelect = useCallback((range: DateRange | undefined) => {
        if (!range || !range.from) {
            return;
        }

        const existingFrom = rangeValue?.from?.toDate();
        const existingTo = rangeValue?.to?.toDate();

        if (existingFrom && existingTo) {
            return;
        }

        // Validate range.to based on allowSingleDayRange
        let validTo = range.to;
        if (range.to && !allowSingleDayRange && isSameDay(range.from, range.to)) {
            validTo = undefined;
        }

        if (onRangeChange) {
            onRangeChange(range.from, validTo ?? null);
        }

        if (validTo) {
            handlePopperOpenState(false);
        }
    }, [onRangeChange, handlePopperOpenState, rangeValue, allowSingleDayRange]);

    // Handle individual day clicks in range mode (for resetting range)
    const handleRangeDayClick = useCallback((day: Date) => {
        if (!onRangeChange) {
            return;
        }

        const existingFrom = rangeValue?.from?.toDate();
        const existingTo = rangeValue?.to?.toDate();

        // If we have a complete range, clicking any day resets to that day as new start
        if (existingFrom && existingTo) {
            onRangeChange(day, null);
        }
    }, [rangeValue, onRangeChange]);

    // Build range-mode datePickerProps (null when not in range mode)
    const rangeDatePickerProps: DayPickerProps | null = rangeMode ? {
        initialFocus: isPopperOpen,
        mode: 'range',
        selected: rangeValue ? {
            from: momentToLocalDate(rangeValue.from),
            to: momentToLocalDate(rangeValue.to),
        } : undefined,
        defaultMonth: momentToLocalDate(displayTime) || new Date(),
        onSelect: handleRangeSelect,
        onDayClick: handleRangeDayClick,
        showOutsideDays: true,
    } : null;

    return {rangeDatePickerProps};
}
