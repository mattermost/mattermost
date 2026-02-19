// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Moment} from 'moment-timezone';
import {useCallback, useMemo} from 'react';
import type {DateRange, DayPickerProps, Matcher} from 'react-day-picker';

export type RangeConfig = {
    rangeValue: {from?: Moment | null; to?: Moment | null};
    isStartField: boolean;
    onRangeChange: (start: Date, end: Date | null) => void;
    allowSingleDayRange: boolean;
};

type UseRangeDatePickerArgs = {
    rangeConfig?: RangeConfig;
    allowPastDates: boolean;
    currentTime: Moment;
    displayTime: Moment | null;
    isPopperOpen: boolean;
    handlePopperOpenState: (isOpen: boolean) => void;
};

type UseRangeDatePickerResult = {
    rangeDatePickerProps: DayPickerProps | null;
    disabledDays: Matcher[] | undefined;
};

// Convert moment to local Date for react-day-picker (preserves year/month/day without UTC shift)
function momentToLocalDate(m: Moment | null | undefined): Date | undefined {
    if (!m) {
        return undefined;
    }
    return new Date(m.year(), m.month(), m.date());
}

export function useRangeDatePicker({
    rangeConfig,
    allowPastDates,
    currentTime,
    displayTime,
    isPopperOpen,
    handlePopperOpenState,
}: UseRangeDatePickerArgs): UseRangeDatePickerResult {
    const rangeValue = rangeConfig?.rangeValue;
    const isStartField = rangeConfig?.isStartField ?? false;
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
        if (range.to && !allowSingleDayRange) {
            const fromDate = range.from;
            const toDate = range.to;

            if (
                fromDate.getFullYear() === toDate.getFullYear() &&
                fromDate.getMonth() === toDate.getMonth() &&
                fromDate.getDate() === toDate.getDate()
            ) {
                validTo = undefined;
            }
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

    // Stable "today" value — only changes when the calendar date changes,
    // not on every render like currentTime (which is a new moment object each render).
    const todayDateString = currentTime.format('YYYY-MM-DD');

    // Compute disabled days (unified for both range and single modes)
    const disabledDays = useMemo(() => {
        const disabled: Matcher[] = [];

        if (rangeMode && !isStartField && rangeValue?.from) {
            // End field: disable dates before start
            const startDate = rangeValue.from.toDate();
            const startYear = startDate.getFullYear();
            const startMonth = startDate.getMonth();
            const startDay = startDate.getDate();
            const startOfDay = new Date(startYear, startMonth, startDay);

            if (allowSingleDayRange) {
                disabled.push({before: startOfDay});
            } else {
                const dayAfterStart = new Date(startYear, startMonth, startDay + 1);
                disabled.push({before: dayAfterStart});
            }
        }

        if (!allowPastDates) {
            const [year, month, day] = todayDateString.split('-').map(Number);
            disabled.push({before: new Date(year, month - 1, day)});
        }

        return disabled.length > 0 ? disabled : undefined;
    }, [rangeMode, isStartField, rangeValue, allowPastDates, todayDateString, allowSingleDayRange]);

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
        disabled: disabledDays,
        showOutsideDays: true,
    } : null;

    return {rangeDatePickerProps, disabledDays};
}
