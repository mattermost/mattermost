// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DateTime} from 'luxon';
import type {Moment} from 'moment-timezone';
import moment from 'moment-timezone';
import React, {useEffect, useState, useCallback, useRef, useMemo} from 'react';
import type {DayModifiers, DayPickerProps} from 'react-day-picker';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

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

export const getTimeInIntervals = (startTime: Moment, interval = CUSTOM_STATUS_TIME_PICKER_INTERVALS_IN_MINUTES): Date[] => {
    let time = moment(startTime);
    const nextDay = moment(startTime).add(1, 'days').startOf('day');

    const intervals: Date[] = [];
    while (time.isBefore(nextDay)) {
        intervals.push(time.toDate());
        const utcOffset = time.utcOffset();
        time = time.add(interval, 'minutes').seconds(0).milliseconds(0);

        // Account for DST end if needed to avoid displaying duplicates
        if (utcOffset > time.utcOffset()) {
            time = time.add(utcOffset - time.utcOffset(), 'minutes').seconds(0).milliseconds(0);
        }
    }

    return intervals;
};

type Props = {
    time: Moment | null;
    handleChange: (date: Moment | null) => void;
    timezone?: string;
    setIsInteracting?: (interacting: boolean) => void;
    relativeDate?: boolean;
    timePickerInterval?: number;
    allowPastDates?: boolean;
    rangeMode?: boolean;
    rangeValue?: {from?: Moment | null; to?: Moment | null};
    isStartField?: boolean;
    onRangeChange?: (start: Date, end: Date | null) => void;
    allowSingleDayRange?: boolean;
}

const DateTimeInputContainer: React.FC<Props> = ({
    time,
    handleChange,
    timezone,
    setIsInteracting,
    relativeDate,
    timePickerInterval,
    allowPastDates = false,
    rangeMode = false,
    rangeValue,
    isStartField = false,
    onRangeChange,
    allowSingleDayRange = false,
}: Props) => {
    const currentTime = getCurrentMomentForTimezone(timezone);
    const displayTime = time; // No automatic default - field stays null until user selects
    const locale = useSelector(getCurrentLocale);
    const [timeOptions, setTimeOptions] = useState<Date[]>([]);
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

    const handleTimeChange = useCallback((time: Date) => {
        handleChange(timezone ? moment.tz(time, timezone) : moment(time));
    }, [handleChange, timezone]);

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
        if (!displayTime) {
            return;
        }

        let startTime = moment(displayTime).startOf('day');

        // For form fields (allowPastDates=true), always start from beginning of day
        // For scheduling (allowPastDates=false), restrict to current time if today
        if (!allowPastDates && currentTime.isSame(displayTime, 'date')) {
            startTime = getRoundedTime(currentTime, timePickerInterval);
        }

        setTimeOptions(getTimeInIntervals(startTime, timePickerInterval));
    };

    useEffect(setTimeAndOptions, [displayTime, timePickerInterval, allowPastDates, timezone]);

    const handleDayChange = (day: Date, modifiers: DayModifiers) => {
        // Use existing time if available, otherwise use next available time from now
        let effectiveTime = displayTime;
        if (!effectiveTime) {
            const now = getCurrentMomentForTimezone(timezone);
            effectiveTime = getRoundedTime(now, timePickerInterval || 60);
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
            day.setHours(effectiveTime.hour(), effectiveTime.minute());
            const dayWithTimezone = timezone ? moment(day).tz(timezone, true) : moment(day);
            handleChange(dayWithTimezone);
        }
        handlePopperOpenState(false);
    };

    // Handle range selection
    const handleRangeSelect = useCallback((range: any) => {
        if (!range || !range.from) {
            return;
        }

        const existingFrom = rangeValue?.from?.toDate();
        const existingTo = rangeValue?.to?.toDate();

        // Only use handleRangeSelect when we DON'T have a complete range
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

            if (fromYear === toYear && fromMonth === toMonth && fromDay === toDay) {
                validTo = null;
            }
        }

        if (onRangeChange) {
            onRangeChange(range.from, validTo || null);
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

    // Compute disabled days for range mode
    const disabledDays = useMemo(() => {
        const disabled = [];

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
            disabled.push({before: currentTime.toDate()});
        }

        return disabled.length > 0 ? disabled : undefined;
    }, [rangeMode, isStartField, rangeValue, allowPastDates, currentTime, allowSingleDayRange]);

    const formatDate = (date: Moment): string => {
        return relativeDate ? relativeFormatDate(date, formatMessage) : DateTime.fromJSDate(date.toDate()).toLocaleString();
    };

    const calendarIcon = (
        <i className='icon-calendar-outline'/>
    );

    const clockIcon = (
        <i className='icon-clock-outline'/>
    );

    // Helper to convert moment to Date for react-day-picker
    const momentToLocalDate = (m: Moment | null | undefined): Date | undefined => {
        if (!m) {
            return undefined;
        }
        const year = m.year();
        const month = m.month();
        const date = m.date();
        return new Date(year, month, date);
    };

    const datePickerProps: DayPickerProps = rangeMode ? {
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
    } : {
        initialFocus: isPopperOpen,
        mode: 'single',
        selected: momentToLocalDate(displayTime),
        defaultMonth: momentToLocalDate(displayTime) || new Date(),
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
                            defaultMessage: 'Select date',
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
                                        <Timestamp
                                            useRelative={false}
                                            useDate={false}
                                            value={displayTime.toString()}
                                        />
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
                                    <Timestamp
                                        useRelative={false}
                                        useDate={false}
                                        value={option}
                                    />
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
