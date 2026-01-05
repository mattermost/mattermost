// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DateTime} from 'luxon';
import type {Moment} from 'moment-timezone';
import moment from 'moment-timezone';
import React, {useEffect, useState, useCallback, useRef, useMemo} from 'react';
import type {DayModifiers, DayPickerProps, Matcher} from 'react-day-picker';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import type {ExclusionConfig, DayExclusionRule} from '@mattermost/types/apps';

import {getCurrentLocale} from 'selectors/i18n';
import {isUseMilitaryTime} from 'selectors/preferences';

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
    excludeConfig?: ExclusionConfig,
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

// Function to parse time string input into hours and minutes
// Supports formats: "13:40", "1:40", "1:40 PM", "1:40PM", "1:40pm", "1:40p", "140pm", etc.
export const parseTimeString = (input: string): {hours: number; minutes: number} | null => {
    if (!input || typeof input !== 'string') {
        return null;
    }

    const trimmed = input.trim().toLowerCase();

    // Check for AM/PM
    const hasAM = /am?$/.test(trimmed);
    const hasPM = /pm?$/.test(trimmed);
    const is12Hour = hasAM || hasPM;

    // Remove AM/PM and extra spaces
    const timeStr = trimmed.replace(/[ap]m?$/i, '').trim();

    // Match various time formats
    // HH:MM, H:MM, HMM, HHMM
    const match = timeStr.match(/^(\d{1,2}):?(\d{2})?$/);

    if (!match) {
        return null;
    }

    let hours = parseInt(match[1], 10);
    const minutes = match[2] ? parseInt(match[2], 10) : 0;

    // Validate ranges
    if (minutes < 0 || minutes > 59) {
        return null;
    }

    if (is12Hour) {
        // 12-hour format validation
        if (hours < 1 || hours > 12) {
            return null;
        }

        // Convert to 24-hour
        if (hasAM) {
            if (hours === 12) {
                hours = 0; // 12 AM = 00:00
            }
        } else if (hasPM) {
            if (hours !== 12) {
                hours += 12; // 1 PM = 13:00, but 12 PM stays 12
            }
        }
    } else {
        // 24-hour format validation
        if (hours < 0 || hours > 23) {
            return null;
        }
    }

    return {hours, minutes};
};

// Function to check if a time should be excluded
const isTimeExcluded = (timeDate: Date, excludeConfig: ExclusionConfig | undefined, timezone?: string): boolean => {
    if (!excludeConfig) {
        return false;
    }

    // If no time or day exclusions, nothing to check
    if ((!excludeConfig.excluded_times || excludeConfig.excluded_times.length === 0) &&
        (!excludeConfig.excluded_days || excludeConfig.excluded_days.length === 0)) {
        return false;
    }

    // Convert the exclusion times to the same timezone as the timeDate for comparison
    let timeStr: string;
    let exclusionTimesInLocalTz: Array<{start?: string; end?: string; before?: string; after?: string}>;

    const displayTimezone = timezone || new Intl.DateTimeFormat().resolvedOptions().timeZone;
    const selectedDateTime = moment.tz(timeDate, displayTimezone);

    // Determine the timezone for exclusion rules
    let exclusionTimezone: string;
    if (excludeConfig.timezone_reference === 'local') {
        // "local" means user's display timezone
        exclusionTimezone = displayTimezone;
    } else if (excludeConfig.timezone_reference === 'UTC') {
        // "UTC" is a specific timezone
        exclusionTimezone = 'UTC';
    } else {
        // IANA timezone (e.g., "Asia/Tokyo", "America/Chicago")
        exclusionTimezone = excludeConfig.timezone_reference;
    }

    // Convert the time being checked to the exclusion timezone for comparison
    // This handles day boundary crossings correctly
    const timeInExclusionTz = selectedDateTime.clone().tz(exclusionTimezone);
    timeStr = timeInExclusionTz.format('HH:mm');

    // Exclusion times are already in the exclusion timezone, use directly
    exclusionTimesInLocalTz = excludeConfig.excluded_times || [];

    // First check day-of-week exclusions
    if (excludeConfig.excluded_days) {
        for (const dayRule of excludeConfig.excluded_days) {
            if (dayRule.days_of_week && dayRule.days_of_week.length > 0) {
                const dayOfWeek = timeInExclusionTz.day(); // 0=Sunday, 6=Saturday
                if (dayRule.days_of_week.includes(dayOfWeek)) {
                    console.log('isTimeExcluded - EXCLUDED by day_of_week:', timeInExclusionTz.format('YYYY-MM-DD HH:mm dddd'), 'day:', dayOfWeek, 'excluded days:', dayRule.days_of_week);
                    return true;
                }
            }
        }
    }

    // Then check time exclusions
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

// Icons used by time input components
const clockIcon = (
    <i className='icon-clock-outline'/>
);

// TimeInputManual - Manual text entry for time
type TimeInputManualProps = {
    time: Moment | null;
    timezone?: string;
    isMilitaryTime: boolean;
    timePickerInterval?: number;
    onTimeChange: (time: Moment | null) => void;
    excludeTime?: ExclusionConfig;
    onValidationError?: (hasError: boolean) => void;
}

const TimeInputManual: React.FC<TimeInputManualProps> = ({
    time,
    timezone,
    isMilitaryTime,
    timePickerInterval,
    onTimeChange,
    excludeTime,
    onValidationError,
}) => {
    const {formatMessage} = useIntl();
    const [timeInputValue, setTimeInputValue] = useState<string>('');
    const [timeInputError, setTimeInputError] = useState<boolean>(false);
    const timeInputRef = useRef<HTMLInputElement>(null);

    // Sync input value with time prop changes
    useEffect(() => {
        if (time) {
            const formatted = time.format(isMilitaryTime ? 'HH:mm' : 'h:mm A');
            setTimeInputValue(formatted);
        } else {
            setTimeInputValue('');
        }
    }, [time, isMilitaryTime]);

    const handleTimeInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setTimeInputValue(event.target.value);
        setTimeInputError(false); // Clear error as user types
        onValidationError?.(false); // Clear error state in parent
    }, [onValidationError]);

    const handleTimeInputBlur = useCallback(() => {
        const parsed = parseTimeString(timeInputValue);

        if (!parsed) {
            if (timeInputValue.trim() !== '') {
                setTimeInputError(true);
                onValidationError?.(true); // Notify parent of error
                onTimeChange(null); // Clear the stored value
            }
            return;
        }

        // Create a moment with the parsed time on the selected date
        const baseMoment = time ? time.clone() : getCurrentMomentForTimezone(timezone);
        let targetMoment: Moment;

        if (timezone) {
            targetMoment = moment.tz([
                baseMoment.year(),
                baseMoment.month(),
                baseMoment.date(),
                parsed.hours,
                parsed.minutes,
                0,
                0,
            ], timezone);
        } else {
            baseMoment.hour(parsed.hours);
            baseMoment.minute(parsed.minutes);
            baseMoment.second(0);
            baseMoment.millisecond(0);
            targetMoment = baseMoment;
        }

        // Round the entered time to the timePickerInterval (from parent component)
        const interval = timePickerInterval || 60;
        const roundedMoment = getRoundedTime(targetMoment, interval);

        console.log('Manual time entry - parsed:', targetMoment.format('HH:mm'),
            'rounded to interval', interval, '→', roundedMoment.format('HH:mm'));

        // Check if the rounded time is excluded
        if (excludeTime && isTimeExcluded(roundedMoment.toDate(), excludeTime, timezone)) {
            // Find next valid time using the same interval
            const nextAvailableTime = getNextAvailableTime(roundedMoment, interval, excludeTime, timezone);

            console.log('Manual time entry - rounded time excluded, auto-advancing to', nextAvailableTime.format('HH:mm'));

            // Update the input display to show the adjusted time
            const formatted = nextAvailableTime.format(isMilitaryTime ? 'HH:mm' : 'h:mm A');
            setTimeInputValue(formatted);
            onTimeChange(nextAvailableTime);
            setTimeInputError(false);
            onValidationError?.(false);
            return;
        }

        // Valid time - update the display and save
        const formatted = roundedMoment.format(isMilitaryTime ? 'HH:mm' : 'h:mm A');
        setTimeInputValue(formatted);
        onTimeChange(roundedMoment);
        setTimeInputError(false);
        onValidationError?.(false); // Clear error state in parent
    }, [timeInputValue, time, timezone, onTimeChange, excludeTime, onValidationError, isMilitaryTime, timePickerInterval]);

    const handleTimeInputKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
        if (isKeyPressed(event as any, Constants.KeyCodes.ENTER)) {
            event.preventDefault();
            timeInputRef.current?.blur(); // Trigger validation
        }
    }, []);

    return (
        <div className='date-time-input-manual'>
            <label
                htmlFor='time_input'
                className='date-time-input__label'
            >
                {formatMessage({
                    id: 'datetime.time',
                    defaultMessage: 'Time',
                })}
            </label>
            <input
                ref={timeInputRef}
                id='time_input'
                type='text'
                className={`date-time-input__text-input${timeInputError ? ' error' : ''}`}
                value={timeInputValue}
                onChange={handleTimeInputChange}
                onBlur={handleTimeInputBlur}
                onKeyDown={handleTimeInputKeyDown}
                placeholder={isMilitaryTime ? '13:40' : '1:40 PM'}
                aria-label={formatMessage({
                    id: 'datetime.time',
                    defaultMessage: 'Time',
                })}
            />
        </div>
    );
};

// TimeInputDropdown - Dropdown menu for time selection
type TimeInputDropdownProps = {
    time: Moment | null;
    timezone?: string;
    isMilitaryTime: boolean;
    timeOptions: Moment[];
    isTimeMenuOpen: boolean;
    menuWidth: string;
    onTimeChange: (time: Moment) => void;
    onMenuToggle: (isOpen: boolean) => void;
}

const TimeInputDropdown: React.FC<TimeInputDropdownProps> = ({
    time,
    isMilitaryTime,
    timeOptions,
    isTimeMenuOpen,
    menuWidth,
    onTimeChange,
    onMenuToggle,
}) => {
    const {formatMessage} = useIntl();

    return (
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
                            {time ? (
                                <span>{time.format(isMilitaryTime ? 'HH:mm' : 'LT')}</span>
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
                onToggle: onMenuToggle,
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
                            {option.format(isMilitaryTime ? 'HH:mm' : 'LT')}
                        </span>
                    }
                    onClick={() => onTimeChange(option)}
                />
            ))}
        </Menu.Container>
    );
};

type Props = {
    time: Moment | null;
    handleChange: (date: Moment | null) => void;
    timezone?: string;
    setIsInteracting?: (interacting: boolean) => void;
    relativeDate?: boolean;
    timePickerInterval?: number;
    allowPastDates?: boolean;
    excludeTime?: ExclusionConfig;
    timezoneAwareExcludedDays?: DayExclusionRule[]; // Excluded days to evaluate in excludeTime.timezone_reference
    rangeMode?: boolean;
    rangeValue?: {from?: Moment; to?: Moment};
    isStartField?: boolean;
    onRangeChange?: (start: Date, end: Date | null) => void;
    allowSingleDayRange?: boolean;
    additionalDisabledDays?: Matcher[];
    allowManualTimeEntry?: boolean;
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
    timezoneAwareExcludedDays,
    allowSingleDayRange = false,
    additionalDisabledDays,
    allowManualTimeEntry = false,
}: Props) => {
    const currentTime = getCurrentMomentForTimezone(timezone);
    const displayTime = time; // No automatic default - field stays null until user selects
    const locale = useSelector(getCurrentLocale);
    const isMilitaryTime = useSelector(isUseMilitaryTime);
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

        // Use selectedTime directly - it already has the correct date and time from getTimeInIntervals
        // This includes next-day dates for times after midnight
        const targetMoment = selectedTime.clone().second(0).millisecond(0);
        console.log('handleTimeChange - targetMoment:', targetMoment.format(), 'tz:', targetMoment.tz());
        handleChange(targetMoment);
    }, [handleChange]);

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

        console.log('=== setTimeAndOptions CALLED ===');
        console.log('setTimeAndOptions - time:', time.format());
        console.log('setTimeAndOptions - timezone:', timezone, 'startTime:', startTime.format());

        // For form fields (allowPastDates=true), always start from beginning of day
        // For scheduling (allowPastDates=false), restrict to current time if today
        if (!allowPastDates && currentTime.isSame(time, 'date')) {
            startTime = getRoundedTime(currentTime, timePickerInterval);
        }

        // Generate all time intervals first
        const allIntervals = getTimeInIntervals(startTime, timePickerInterval);
        console.log('setTimeAndOptions - generated intervals:', allIntervals.length, 'first:', allIntervals[0]?.format(), 'last:', allIntervals[allIntervals.length - 1]?.format());
        console.log('setTimeAndOptions - excludeTime:', excludeTime);

        // Filter out excluded times
        const filteredIntervals = allIntervals.filter((timeMoment) => {
            const excluded = isTimeExcluded(timeMoment.toDate(), excludeTime, timezone);
            if (excluded) {
                console.log('setTimeAndOptions - EXCLUDING:', timeMoment.format());
            }
            return !excluded;
        });
        console.log('setTimeAndOptions - after filtering:', filteredIntervals.length, 'first:', filteredIntervals[0]?.format(), 'last:', filteredIntervals[filteredIntervals.length - 1]?.format());

        // Use filtered intervals as-is in chronological order
        // Don't rotate - show times for the selected date only
        setTimeOptions(filteredIntervals);
    };

    useEffect(setTimeAndOptions, [time, excludeTime, allowPastDates, timePickerInterval, timezone]);

    // Set default time to next available slot if no time is set and exclusions exist
    useEffect(() => {
        if (!time) {
            return;
        }

        // Only set default if we have meaningful exclude_time data (not empty object)
        if (excludeTime && excludeTime.excluded_times && excludeTime.excluded_times.length > 0) {
            // When manual time entry is enabled, don't round - preserve exact minutes
            // Otherwise, round to the timePickerInterval for dropdown consistency
            const roundedTime = allowManualTimeEntry ? time : getRoundedTime(time, timePickerInterval);
            const isRoundedTimeExcluded = isTimeExcluded(roundedTime.toDate(), excludeTime, timezone);

            if (isRoundedTimeExcluded) {
                // Use 1-minute intervals for manual entry, timePickerInterval for dropdown
                const interval = allowManualTimeEntry ? 1 : (timePickerInterval || CUSTOM_STATUS_TIME_PICKER_INTERVALS_IN_MINUTES);
                const nextAvailableTime = getNextAvailableTime(roundedTime, interval, excludeTime, timezone);
                handleChange(nextAvailableTime);
            } else if (!allowManualTimeEntry && !time.isSame(roundedTime, 'minute')) {
                // Only auto-round when using dropdown (not manual entry)
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
            // When manual time entry is enabled, preserve exact minutes
            // Otherwise, round to timePickerInterval for dropdown consistency
            const finalTime = allowManualTimeEntry ? baseTime : getRoundedTime(baseTime, timePickerInterval);
            handleChange(finalTime);
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

        // Add timezone-aware day exclusions
        // These rules are evaluated in the exclusion timezone, not display timezone
        if (timezoneAwareExcludedDays && excludeTime?.timezone_reference) {
            const displayTz = timezone || new Intl.DateTimeFormat().resolvedOptions().timeZone;
            const exclusionTz = excludeTime.timezone_reference === 'local' ? displayTz :
                excludeTime.timezone_reference === 'UTC' ? 'UTC' :
                    excludeTime.timezone_reference;

            // Create custom matcher function for timezone-aware day-of-week rules
            timezoneAwareExcludedDays.forEach((rule) => {
                if (rule.days_of_week && rule.days_of_week.length > 0) {
                    // Custom matcher: check if this calendar date would have ANY available times
                    // that fall on non-excluded days in the exclusion timezone
                    disabled.push((date: Date) => {
                        const displayTz = timezone || new Intl.DateTimeFormat().resolvedOptions().timeZone;

                        // Get the time range that would be shown for this date
                        // Use the excluded_times to determine the available times
                        const dateMoment = moment.tz(date, displayTz).startOf('day');

                        // Sample times throughout the day to check what days they fall on in exclusion timezone
                        // Check at intervals matching the time picker interval
                        const sampleInterval = timePickerInterval || 30;
                        const sampleTimes: number[] = []; // Day-of-week values

                        for (let minutes = 0; minutes < 24 * 60; minutes += sampleInterval) {
                            const sampleTime = dateMoment.clone().add(minutes, 'minutes');

                            // Check if this time would be excluded by time rules
                            if (excludeTime?.excluded_times && isTimeExcluded(sampleTime.toDate(), excludeTime, displayTz)) {
                                continue; // Skip excluded times
                            }

                            // Convert to exclusion timezone to get day-of-week
                            const timeInExclusionTz = sampleTime.clone().tz(exclusionTz);
                            const dayOfWeek = timeInExclusionTz.day();
                            sampleTimes.push(dayOfWeek);
                        }

                        // If ANY available time falls on a non-excluded day, enable this calendar date
                        const hasValidTime = sampleTimes.some((day) => !rule.days_of_week!.includes(day));

                        console.log('timezoneAware matcher - date:', moment(date).format('YYYY-MM-DD ddd'),
                            'available days in', exclusionTz, ':', [...new Set(sampleTimes)],
                            'excluded:', rule.days_of_week,
                            'hasValidTime:', hasValidTime,
                            'DISABLED:', !hasValidTime);

                        return !hasValidTime; // Disable if no valid times
                    });
                }
                // TODO: Handle other rule types (before, after, from/to, specific dates) with timezone conversion
            });
        }

        console.log('datetime_input - final disabledDays:', disabled);
        return disabled.length > 0 ? disabled : undefined;
    }, [rangeMode, isStartField, rangeValue, allowPastDates, currentTime, allowSingleDayRange, additionalDisabledDays, timezoneAwareExcludedDays, excludeTime, timezone]);

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
    const momentToLocalDate = (m: Moment | null | undefined): Date | undefined => {
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
                {allowManualTimeEntry ? (
                    <TimeInputManual
                        time={displayTime}
                        timezone={timezone}
                        isMilitaryTime={isMilitaryTime}
                        timePickerInterval={timePickerInterval}
                        onTimeChange={handleTimeChange}
                        excludeTime={excludeTime}
                        onValidationError={setIsInteracting}
                    />
                ) : (
                    <TimeInputDropdown
                        time={displayTime}
                        timezone={timezone}
                        isMilitaryTime={isMilitaryTime}
                        timeOptions={timeOptions}
                        isTimeMenuOpen={isTimeMenuOpen}
                        menuWidth={menuWidth}
                        onTimeChange={handleTimeChange}
                        onMenuToggle={handleTimeMenuToggle}
                    />
                )}
            </div>
        </div>
    );
};

export default DateTimeInputContainer;
