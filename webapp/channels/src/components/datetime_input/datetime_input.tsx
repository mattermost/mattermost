// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DateTime} from 'luxon';
import type {Moment} from 'moment-timezone';
import moment from 'moment-timezone';
import React, {useEffect, useState, useCallback, useRef, useMemo} from 'react';
import type {DayModifiers, DayPickerProps, Matcher} from 'react-day-picker';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import type {TimeExcludeConfig} from '@mattermost/types/apps';

import {getCurrentLocale} from 'selectors/i18n';

import DatePicker from 'components/date_picker';
import * as Menu from 'components/menu';
import Timestamp from 'components/timestamp';

import Constants from 'utils/constants';
import {relativeFormatDate} from 'utils/datetime';
import {isKeyPressed} from 'utils/keyboard';
import {getCurrentMomentForTimezone, isBeforeTime} from 'utils/timezone';

const CUSTOM_STATUS_TIME_PICKER_INTERVALS_IN_MINUTES = 30;

export function getRoundedTime(value: Moment, roundedTo = CUSTOM_STATUS_TIME_PICKER_INTERVALS_IN_MINUTES) {
    const start = moment(value);
    const diff = start.minute() % roundedTo;
    if (diff === 0) {
        return value;
    }
    const remainder = roundedTo - diff;
    return start.add(remainder, 'm').seconds(0).milliseconds(0);
}

export function getNextAvailableTime(
    startTime: Moment,
    interval: number,
    excludeConfig?: TimeExcludeConfig,
    timezone?: string,
): Moment {
    let candidateTime = getRoundedTime(startTime, interval);

    // If no exclusions, return the rounded time
    if (!excludeConfig) {
        return candidateTime;
    }

    // Keep advancing by the interval until we find a non-excluded time
    // Limit to 24 hours to avoid infinite loops
    const maxAttempts = (24 * 60) / interval;
    let attempts = 0;

    while (attempts < maxAttempts) {
        if (!isTimeExcluded(candidateTime.toDate(), excludeConfig, timezone)) {
            return candidateTime;
        }
        candidateTime = candidateTime.clone().add(interval, 'minutes');
        attempts++;
    }

    // Fallback to the original rounded time if no available time found
    return getRoundedTime(startTime, interval);
}

export const getTimeInIntervals = (startTime: Moment, interval = CUSTOM_STATUS_TIME_PICKER_INTERVALS_IN_MINUTES): Moment[] => {
    let time = moment(startTime);
    const nextDay = moment(startTime).add(1, 'days').startOf('day');

    const intervals: Moment[] = [];
    while (time.isBefore(nextDay)) {
        intervals.push(time.clone());
        const utcOffset = time.utcOffset();
        time = time.add(interval, 'minutes').seconds(0).milliseconds(0);

        // Account for DST end if needed to avoid displaying duplicates
        if (utcOffset > time.utcOffset()) {
            time = time.add(utcOffset - time.utcOffset(), 'minutes').seconds(0).milliseconds(0);
        }
    }

    return intervals;
};

// Function to check if a time should be excluded
const isTimeExcluded = (timeDate: Date, excludeConfig: TimeExcludeConfig | undefined, timezone?: string): boolean => {
    if (!excludeConfig || !excludeConfig.exclusions || excludeConfig.exclusions.length === 0) {
        return false;
    }

    // Convert the exclusion times to the same timezone as the timeDate for comparison
    let timeStr: string;
    let exclusionTimesInLocalTz: Array<{start?: string; end?: string; before?: string; after?: string}>;

    if (excludeConfig.timezone_reference === 'UTC') {
        // Exclusion times are in UTC, convert them to local timezone for comparison
        // If timezone is undefined, use the browser's actual timezone
        const actualTimezone = timezone || new Intl.DateTimeFormat().resolvedOptions().timeZone;
        const selectedDateTime = moment.tz(timeDate, actualTimezone);
        timeStr = selectedDateTime.format('HH:mm');

        // Convert exclusion times from UTC to local timezone
        // IMPORTANT: Use the actual date from selectedDateTime to get the correct UTC offset for that specific date
        // This ensures DST transitions are handled correctly
        exclusionTimesInLocalTz = excludeConfig.exclusions.map((exclusion) => {
            const converted: {start?: string; end?: string; before?: string; after?: string} = {};
            if (exclusion.start) {
                // Create UTC time on the same date as selectedDateTime to get correct DST offset
                const utcTime = moment.utc([selectedDateTime.year(), selectedDateTime.month(), selectedDateTime.date()]).add(moment.duration(exclusion.start));
                const convertedTime = utcTime.clone().tz(actualTimezone);
                converted.start = convertedTime.format('HH:mm');
            }
            if (exclusion.end) {
                const utcTime = moment.utc([selectedDateTime.year(), selectedDateTime.month(), selectedDateTime.date()]).add(moment.duration(exclusion.end));
                const convertedTime = utcTime.clone().tz(actualTimezone);
                converted.end = convertedTime.format('HH:mm');
            }
            if (exclusion.before) {
                const utcTime = moment.utc([selectedDateTime.year(), selectedDateTime.month(), selectedDateTime.date()]).add(moment.duration(exclusion.before));
                const convertedTime = utcTime.clone().tz(actualTimezone);
                converted.before = convertedTime.format('HH:mm');
            }
            if (exclusion.after) {
                const utcTime = moment.utc([selectedDateTime.year(), selectedDateTime.month(), selectedDateTime.date()]).add(moment.duration(exclusion.after));
                const convertedTime = utcTime.clone().tz(actualTimezone);
                converted.after = convertedTime.format('HH:mm');
            }
            return converted;
        });
    } else {
        // Exclusion times are in local timezone, use directly
        const selectedDateTime = timezone ? moment.tz(timeDate, timezone) : moment(timeDate);
        timeStr = selectedDateTime.format('HH:mm');
        exclusionTimesInLocalTz = excludeConfig.exclusions;
    }

    for (const exclusion of exclusionTimesInLocalTz) {
        // Both start and end: exclude times from start (inclusive) to end (exclusive)
        if (exclusion.start && exclusion.end) {
            if (timeStr >= exclusion.start && timeStr < exclusion.end) {
                console.log('isTimeExcluded - EXCLUDED by start/end range:', timeStr, 'range:', exclusion.start, '-', exclusion.end);
                return true;
            }
        }

        // Before: exclude all times before this time
        if (exclusion.before) {
            if (timeStr < exclusion.before) {
                console.log('isTimeExcluded - EXCLUDED by before:', timeStr, '< before:', exclusion.before);
                return true;
            }
        }

        // After: exclude all times at and after this time (inclusive - the time itself is excluded)
        if (exclusion.after) {
            if (timeStr >= exclusion.after) {
                console.log('isTimeExcluded - EXCLUDED by after:', timeStr, '>= after:', exclusion.after);
                return true;
            }
        }
    }

    return false;
};

type Props = {
    time: Moment | null;
    handleChange: (date: Moment) => void;
    timezone?: string;
    setIsInteracting?: (interacting: boolean) => void;
    relativeDate?: boolean;
    timePickerInterval?: number;
    allowPastDates?: boolean;
    excludeTime?: TimeExcludeConfig;
    rangeMode?: boolean;
    rangeValue?: {from?: Moment; to?: Moment};
    isStartField?: boolean;
    onRangeChange?: (start: Date, end: Date | null) => void;
    allowSingleDayRange?: boolean;
    additionalDisabledDays?: Matcher[];
}

const DateTimeInputContainer: React.FC<Props> = ({
    time,
    handleChange,
    rangeMode = false,
    rangeValue,
    isStartField = true,
    onRangeChange,
    timezone,
    setIsInteracting,
    relativeDate,
    timePickerInterval,
    allowPastDates = false,
    excludeTime,
    allowSingleDayRange = false,
    additionalDisabledDays,
}: Props) => {
    const currentTime = getCurrentMomentForTimezone(timezone);
    const displayTime = time; // No automatic default - field stays null until user selects
    const locale = useSelector(getCurrentLocale);
    const [timeOptions, setTimeOptions] = useState<Moment[]>([]);
    const [isPopperOpen, setIsPopperOpen] = useState(false);
    const [isTimeMenuOpen, setIsTimeMenuOpen] = useState(false);
    const [menuWidth, setMenuWidth] = useState<string>('200px');
    const {formatMessage} = useIntl();
    const timeContainerRef = useRef<HTMLDivElement>(null);

    const handlePopperOpenState = useCallback((isOpen: boolean) => {
        setIsPopperOpen(isOpen);
        setIsInteracting?.(isOpen);
    }, [setIsInteracting]);

    const handleTimeMenuToggle = useCallback((isOpen: boolean) => {
        setIsTimeMenuOpen(isOpen);
        setIsInteracting?.(isOpen);

        // Measure and set menu width when opening
        if (isOpen && timeContainerRef.current) {
            const button = timeContainerRef.current.querySelector('button');
            if (button) {
                const buttonWidth = button.getBoundingClientRect().width;
                setMenuWidth(`${Math.max(buttonWidth, 200)}px`); // Ensure minimum width of 200px
            }
        }
    }, [setIsInteracting]);

    const handleTimeChange = useCallback((selectedTime: Moment) => {
        console.log('handleTimeChange called - selectedTime:', selectedTime.format(), 'hours:', selectedTime.hour(), 'minutes:', selectedTime.minute());
        console.log('handleTimeChange - timezone:', timezone);

        // The selectedTime moment already has the correct timezone and time values
        // We just need to apply it to the current date (or keep the selected time's date)
        const baseMoment = time ? time.clone() : getCurrentMomentForTimezone(timezone);
        console.log('handleTimeChange - baseMoment:', baseMoment.format());

        // Update the time portion while keeping the date
        if (timezone) {
            const targetMoment = moment.tz([
                baseMoment.year(),
                baseMoment.month(),
                baseMoment.date(),
                selectedTime.hour(),
                selectedTime.minute(),
                0,
                0,
            ], timezone);
            console.log('handleTimeChange - targetMoment:', targetMoment.format(), 'tz:', targetMoment.tz());
            handleChange(targetMoment);
        } else {
            baseMoment.hour(selectedTime.hour());
            baseMoment.minute(selectedTime.minute());
            baseMoment.second(0);
            baseMoment.millisecond(0);
            handleChange(baseMoment);
        }
    }, [handleChange, timezone, time]);

    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        // Handle escape key for date picker when time menu is not open
        if (isKeyPressed(event, Constants.KeyCodes.ESCAPE)) {
            if (isPopperOpen && !isTimeMenuOpen) {
                handlePopperOpenState(false);
            }
        }
    }, [isPopperOpen, isTimeMenuOpen, handlePopperOpenState]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown]);

    const setTimeAndOptions = () => {
        if (!time) {
            return;
        }

        const currentTime = getCurrentMomentForTimezone(timezone);
        let startTime = moment(time).startOf('day');

        console.log('setTimeAndOptions - timezone:', timezone, 'startTime:', startTime.format());

        // For form fields (allowPastDates=true), always start from beginning of day
        // For scheduling (allowPastDates=false), restrict to current time if today
        if (!allowPastDates && currentTime.isSame(time, 'date')) {
            startTime = getRoundedTime(currentTime, timePickerInterval);
        }

        // Generate all time intervals first
        const allIntervals = getTimeInIntervals(startTime, timePickerInterval);
        console.log('setTimeAndOptions - generated intervals:', allIntervals.length, 'first:', allIntervals[0]?.format(), 'last:', allIntervals[allIntervals.length - 1]?.format());

        // Filter out excluded times
        const filteredIntervals = allIntervals.filter((timeMoment) => !isTimeExcluded(timeMoment.toDate(), excludeTime, timezone));
        console.log('setTimeAndOptions - after filtering:', filteredIntervals.length, 'first:', filteredIntervals[0]?.format(), 'last:', filteredIntervals[filteredIntervals.length - 1]?.format());

        // If we have filtered intervals and they don't start at midnight, it means there's a gap at the beginning
        // Check if times wrap around midnight by seeing if there's a gap between consecutive intervals
        // If so, rotate the array to put the largest contiguous block first
        if (filteredIntervals.length > 1) {
            // Find the largest gap between consecutive intervals
            let largestGapIndex = -1;
            let largestGapMinutes = 0;

            for (let i = 0; i < filteredIntervals.length; i++) {
                const current = filteredIntervals[i];
                const next = filteredIntervals[(i + 1) % filteredIntervals.length];

                // Calculate gap in minutes
                let gapMinutes: number;
                if (i === filteredIntervals.length - 1) {
                    // Gap from last interval to first interval (wrapping around midnight)
                    const endOfDay = current.clone().endOf('day');
                    const startOfNextDay = next.clone().startOf('day');
                    gapMinutes = next.diff(startOfNextDay, 'minutes') + endOfDay.diff(current, 'minutes');
                } else {
                    gapMinutes = next.diff(current, 'minutes');
                }

                if (gapMinutes > largestGapMinutes) {
                    largestGapMinutes = gapMinutes;
                    largestGapIndex = i;
                }
            }

            // If we found a significant gap (more than 2x the interval), rotate the array
            // so the times after the gap come first
            if (largestGapIndex >= 0 && largestGapMinutes > timePickerInterval * 2) {
                const rotatedIntervals = [
                    ...filteredIntervals.slice(largestGapIndex + 1),
                    ...filteredIntervals.slice(0, largestGapIndex + 1),
                ];
                console.log('setTimeAndOptions - rotated intervals, new first:', rotatedIntervals[0]?.format(), 'new last:', rotatedIntervals[rotatedIntervals.length - 1]?.format());
                setTimeOptions(rotatedIntervals);
                return;
            }
        }

        setTimeOptions(filteredIntervals);
    };

    useEffect(setTimeAndOptions, [time, excludeTime, allowPastDates, timePickerInterval, timezone]);

    // Set default time to next available slot if no time is set and exclusions exist
    useEffect(() => {
        if (!time) {
            return;
        }

        // Only set default if we have meaningful exclude_time data (not empty object)
        if (excludeTime && excludeTime.exclusions && excludeTime.exclusions.length > 0) {
            // Always start with a properly rounded time
            const roundedTime = getRoundedTime(time, timePickerInterval);
            const isRoundedTimeExcluded = isTimeExcluded(roundedTime.toDate(), excludeTime, timezone);

            if (isRoundedTimeExcluded) {
                const nextAvailableTime = getNextAvailableTime(roundedTime, timePickerInterval || CUSTOM_STATUS_TIME_PICKER_INTERVALS_IN_MINUTES, excludeTime, timezone);
                handleChange(nextAvailableTime);
            } else if (!time.isSame(roundedTime, 'minute')) {
                handleChange(roundedTime);
            }
        }
    }, [excludeTime, timePickerInterval, timezone, handleChange, time]); // Include 'time' but check carefully

    const handleDayChange = (day: Date, modifiers: DayModifiers) => {
        // Use existing time if available, otherwise use next available time from now
        let effectiveTime = time;
        if (!effectiveTime) {
            effectiveTime = getNextAvailableTime(currentTime, timePickerInterval || 60, excludeTime, timezone);
        }

        if (modifiers.today) {
            const baseTime = getCurrentMomentForTimezone(timezone);
            if (!allowPastDates && isBeforeTime(baseTime, effectiveTime)) {
                baseTime.hour(effectiveTime.hours());
                baseTime.minute(effectiveTime.minutes());
            }
            const roundedTime = getRoundedTime(baseTime, timePickerInterval);
            handleChange(roundedTime);
        } else {
            // Create moment in the target timezone with the selected date and current time
            if (timezone) {
                // day is a JavaScript Date from react-day-picker (midnight in local timezone)
                // We want to preserve the calendar date (year/month/day) in the target timezone
                // Use moment.tz with keepLocalTime=true to preserve the date components
                console.log('handleDayChange - day from calendar:', day, 'timezone:', timezone);
                const localDate = moment(day).startOf('day'); // Get date at midnight local
                console.log('handleDayChange - localDate:', localDate.format(), 'tz:', localDate.tz());
                const targetDate = localDate.clone().tz(timezone, true); // Keep the same date in target timezone
                console.log('handleDayChange - targetDate after tz conversion:', targetDate.format(), 'tz:', targetDate.tz());

                // Now set the time from effectiveTime
                targetDate.hour(effectiveTime.hour());
                targetDate.minute(effectiveTime.minute());
                targetDate.second(0);
                targetDate.millisecond(0);
                console.log('handleDayChange - targetDate with time:', targetDate.format(), 'tz:', targetDate.tz());

                handleChange(targetDate);
            } else {
                day.setHours(effectiveTime.hour(), effectiveTime.minute());
                handleChange(moment(day));
            }
        }
        handlePopperOpenState(false);
    };

    const formatDate = (date: Moment): string => {
        console.log('formatDate called - date:', date.format(), 'tz:', date.tz(), 'timezone prop:', timezone, 'relativeDate:', relativeDate);

        if (relativeDate) {
            return relativeFormatDate(date, formatMessage);
        }

        // If we have a timezone, format using moment's built-in formatting to preserve timezone
        // Don't convert to JS Date as that loses timezone information
        if (timezone && date.tz()) {
            // Format in the moment's timezone
            const formatted = date.format('MMM D, YYYY');
            console.log('formatDate - with timezone - formatted:', formatted);
            return formatted;
        }

        const jsDate = date.toDate();
        const formatted = DateTime.fromJSDate(jsDate).toLocaleString();
        console.log('formatDate - no timezone - jsDate:', jsDate, 'formatted:', formatted);
        return formatted;
    };

    const calendarIcon = (
        <i className='icon-calendar-outline'/>
    );

    const clockIcon = (
        <i className='icon-clock-outline'/>
    );

    const handleRangeDayClick = useCallback((day: Date) => {
        const existingFrom = rangeValue?.from?.toDate();
        const existingTo = rangeValue?.to?.toDate();

        // Only handle day click when we have a complete range
        // Let handleRangeSelect handle initial range selection
        if (!existingFrom || !existingTo) {
            return;
        }

        // Have complete range - clicking updates based on which field we're in
        if (isStartField) {
            // Start field: clicked date becomes new start
            if (onRangeChange) {
                // Normalize dates to day level for comparison
                const toYear = existingTo.getFullYear();
                const toMonth = existingTo.getMonth();
                const toDay = existingTo.getDate();
                const toDayStart = new Date(toYear, toMonth, toDay);

                const dayYear = day.getFullYear();
                const dayMonth = day.getMonth();
                const dayDay = day.getDate();
                const dayStart = new Date(dayYear, dayMonth, dayDay);

                // Determine max allowed start date based on allowSingleDayRange
                const maxStartDate = allowSingleDayRange ? toDayStart : new Date(toYear, toMonth, toDay - 1);

                if (dayStart <= maxStartDate) {
                    // Valid start date - update start, keep end
                    onRangeChange(day, existingTo);
                    handlePopperOpenState(false);
                } else {
                    // Clicked after valid start range - reset to just start
                    onRangeChange(day, null);
                }
            }
        } else {
            // End field: clicking sets new end date (if valid)
            // Normalize dates to day level for comparison (ignore time)
            const fromYear = existingFrom.getFullYear();
            const fromMonth = existingFrom.getMonth();
            const fromDay = existingFrom.getDate();
            const fromDayStart = new Date(fromYear, fromMonth, fromDay);

            const dayYear = day.getFullYear();
            const dayMonth = day.getMonth();
            const dayDay = day.getDate();
            const dayStart = new Date(dayYear, dayMonth, dayDay);

            const minEndDate = allowSingleDayRange ? fromDayStart : new Date(fromYear, fromMonth, fromDay + 1);

            if (dayStart >= minEndDate) {
                if (onRangeChange) {
                    onRangeChange(existingFrom, day);
                }
                handlePopperOpenState(false);
            }
            // If invalid (before minimum end date), do nothing
        }
    }, [rangeValue, isStartField, onRangeChange, handlePopperOpenState, allowSingleDayRange]);

    const disabledDays = useMemo(() => {
        console.log('datetime_input - additionalDisabledDays:', additionalDisabledDays);
        const disabled = [];

        if (rangeMode && !isStartField && rangeValue?.from) {
            // End field: disable dates based on allowSingleDayRange
            // Get the start date and normalize to midnight local time
            const startDate = rangeValue.from.toDate();
            const startYear = startDate.getFullYear();
            const startMonth = startDate.getMonth();
            const startDay = startDate.getDate();

            // Create a new date at midnight for proper day comparison
            const startOfDay = new Date(startYear, startMonth, startDay);

            if (allowSingleDayRange) {
                // Allow same day - disable dates before start (but not start itself)
                disabled.push({before: startOfDay});
            } else {
                // Don't allow same day - disable start date and all before it
                // Allow start+1 day and after
                const dayAfterStart = new Date(startYear, startMonth, startDay + 1);
                disabled.push({before: dayAfterStart});
            }
        }

        if (!allowPastDates) {
            disabled.push({before: currentTime.toDate()});
        }

        // Add additional disabled days from field configuration
        if (additionalDisabledDays) {
            disabled.push(...additionalDisabledDays);
        }

        console.log('datetime_input - final disabledDays:', disabled);
        return disabled.length > 0 ? disabled : undefined;
    }, [rangeMode, isStartField, rangeValue, allowPastDates, currentTime, allowSingleDayRange, additionalDisabledDays]);

    const handleRangeSelect = useCallback((range: any) => {
        if (!range || !range.from) {
            return;
        }

        const existingFrom = rangeValue?.from?.toDate();
        const existingTo = rangeValue?.to?.toDate();

        // Only use handleRangeSelect when we DON'T have a complete range
        // If we have a complete range, handleRangeDayClick will take over
        if (existingFrom && existingTo) {
            return;
        }

        // Validate range.to based on allowSingleDayRange
        let validTo = range.to;
        if (range.to && !allowSingleDayRange) {
            // Check if from and to are the same day
            const fromYear = range.from.getFullYear();
            const fromMonth = range.from.getMonth();
            const fromDay = range.from.getDate();

            const toYear = range.to.getFullYear();
            const toMonth = range.to.getMonth();
            const toDay = range.to.getDate();

            // If same day and not allowed, ignore the 'to' value (keep it incomplete)
            if (fromYear === toYear && fromMonth === toMonth && fromDay === toDay) {
                validTo = null;
            }
        }

        if (onRangeChange) {
            onRangeChange(range.from, validTo || null);
        }

        // Only close when we have both dates
        if (validTo) {
            handlePopperOpenState(false);
        }
    }, [onRangeChange, handlePopperOpenState, rangeValue, allowSingleDayRange]);

    // Helper to convert a moment to a Date at midnight local time with the same calendar date
    // This is needed because react-day-picker expects Dates in local timezone
    const momentToLocalDate = (m: Moment | undefined): Date | undefined => {
        if (!m) {
            return undefined;
        }
        // Get the year/month/day from the moment (in its timezone)
        // and create a Date at midnight local time with that calendar date
        const year = m.year();
        const month = m.month();
        const date = m.date();
        const localDate = new Date(year, month, date);
        console.log('momentToLocalDate - input moment:', m.format(), 'tz:', m.tz(), 'year:', year, 'month:', month, 'date:', date, 'output:', localDate);
        return localDate;
    };

    const datePickerProps: DayPickerProps = rangeMode ? {
        initialFocus: isPopperOpen,
        mode: 'range',
        selected: rangeValue ? {
            from: momentToLocalDate(rangeValue.from),
            to: momentToLocalDate(rangeValue.to),
        } : undefined,
        defaultMonth: momentToLocalDate(displayTime),
        onSelect: handleRangeSelect,
        onDayClick: handleRangeDayClick,
        disabled: disabledDays,
        showOutsideDays: true,
    } : {
        initialFocus: isPopperOpen,
        mode: 'single',
        selected: momentToLocalDate(displayTime),
        defaultMonth: momentToLocalDate(displayTime),
        onDayClick: handleDayChange,
        disabled: disabledDays,
        showOutsideDays: true,
    };

    return (
        <div className='dateTime'>
            <div className='dateTime__date'>
                <DatePicker
                    isPopperOpen={isPopperOpen}
                    handlePopperOpenState={handlePopperOpenState}
                    locale={locale}
                    datePickerProps={datePickerProps}
                    label={formatMessage({
                        id: 'datetime.date',
                        defaultMessage: 'Date',
                    })}
                    icon={calendarIcon}
                    value={displayTime ? formatDate(displayTime) : ''}
                >
                    <span className='date-time-input__placeholder'>
                        {formatMessage({
                            id: 'datetime.select_date',
                            defaultMessage: 'Select a date',
                        })}
                    </span>
                </DatePicker>
            </div>
            <div
                className='dateTime__time'
                ref={timeContainerRef}
            >
                <Menu.Container
                    menuButton={{
                        id: 'time_button',
                        dataTestId: 'time_button',
                        'aria-label': formatMessage({
                            id: 'datetime.time',
                            defaultMessage: 'Time',
                        }),
                        class: isTimeMenuOpen ? 'date-time-input date-time-input--open' : 'date-time-input',
                        children: (
                            <>
                                <span className='date-time-input__label'>{formatMessage({
                                    id: 'datetime.time',
                                    defaultMessage: 'Time',
                                })}</span>
                                <span className='date-time-input__icon'>{clockIcon}</span>
                                <span className='date-time-input__value'>
                                    {displayTime ? (
                                        <span>{displayTime.format('LT')}</span>
                                    ) : (
                                        <span>{'--:--'}</span>
                                    )}
                                </span>
                            </>
                        ),
                    }}
                    menu={{
                        id: 'expiryTimeMenu',
                        'aria-label': formatMessage({id: 'time_dropdown.choose_time', defaultMessage: 'Choose a time'}),
                        onToggle: handleTimeMenuToggle,
                        width: menuWidth,
                        className: 'time-menu-scrollable',
                    }}
                >
                    {timeOptions.map((option, index) => (
                        <Menu.Item
                            key={index}
                            id={`time_option_${index}`}
                            data-testid={`time_option_${index}`}
                            labels={
                                <span>
                                    {option.format('LT')}
                                </span>
                            }
                            onClick={() => handleTimeChange(option)}
                        />
                    ))}
                </Menu.Container>
            </div>
        </div>
    );
};

export default DateTimeInputContainer;
