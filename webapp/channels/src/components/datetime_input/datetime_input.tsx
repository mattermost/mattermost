// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DateTime} from 'luxon';
import type {Moment} from 'moment-timezone';
import moment from 'moment-timezone';
import React, {useEffect, useState, useCallback, useRef} from 'react';
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
    time: Moment;
    handleChange: (date: Moment) => void;
    timezone?: string;
    setIsInteracting?: (interacting: boolean) => void;
    relativeDate?: boolean;
    timePickerInterval?: number;
}

const DateTimeInputContainer: React.FC<Props> = ({
    time,
    handleChange,
    timezone,
    setIsInteracting,
    relativeDate,
    timePickerInterval,
}: Props) => {
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
        const currentTime = getCurrentMomentForTimezone(timezone);
        let startTime = moment(time).startOf('day');
        if (currentTime.isSame(time, 'date')) {
            startTime = getRoundedTime(currentTime, timePickerInterval);
        }
        setTimeOptions(getTimeInIntervals(startTime, timePickerInterval));
    };

    useEffect(setTimeAndOptions, [time]);

    const handleDayChange = (day: Date, modifiers: DayModifiers) => {
        if (modifiers.today) {
            const baseTime = getCurrentMomentForTimezone(timezone);
            if (isBeforeTime(baseTime, time)) {
                baseTime.hour(time.hours());
                baseTime.minute(time.minutes());
            }
            const roundedTime = getRoundedTime(baseTime, timePickerInterval);
            handleChange(roundedTime);
        } else {
            day.setHours(time.hour(), time.minute());
            const dayWithTimezone = timezone ? moment(day).tz(timezone, true) : moment(day);
            handleChange(dayWithTimezone);
        }
        handlePopperOpenState(false);
    };

    const currentTime = getCurrentMomentForTimezone(timezone).toDate();

    const formatDate = (date: Moment): string => {
        return relativeDate ? relativeFormatDate(date, formatMessage) : DateTime.fromJSDate(date.toDate()).toLocaleString();
    };

    const calendarIcon = (
        <i className='icon-calendar-outline'/>
    );

    const clockIcon = (
        <i className='icon-clock-outline'/>
    );

    const datePickerProps: DayPickerProps = {
        initialFocus: isPopperOpen,
        mode: 'single',
        selected: time.toDate(),
        defaultMonth: time.toDate(),
        onDayClick: handleDayChange,
        disabled: [{
            before: currentTime,
        }],
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
                    value={formatDate(time)}
                >
                    <></>
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
                                    <Timestamp
                                        useRelative={false}
                                        useDate={false}
                                        value={time.toString()}
                                    />
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
