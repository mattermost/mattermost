// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DateTime} from 'luxon';
import moment from 'moment-timezone';
import React, {useEffect, useState, useCallback, useRef} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import IconButton from '@mattermost/compass-components/components/icon-button'; // eslint-disable-line no-restricted-imports

import {getTheme} from 'mattermost-redux/selectors/entities/preferences';

import {getCurrentLocale} from 'selectors/i18n';

import CompassThemeProvider from 'components/compass_theme_provider/compass_theme_provider';
import DatePicker from 'components/date_picker';
import Timestamp from 'components/timestamp';
import Input from 'components/widgets/inputs/input/input';
import Menu from 'components/widgets/menu/menu';
import MenuWrapper from 'components/widgets/menu/menu_wrapper';

import Constants, {A11yCustomEventTypes} from 'utils/constants';
import {isKeyPressed} from 'utils/keyboard';
import {getCurrentMomentForTimezone} from 'utils/timezone';
import {localizeMessage} from 'utils/utils';

import type {Moment} from 'moment-timezone';
import type {DayModifiers, DayPickerProps} from 'react-day-picker';
import type {A11yFocusEventDetail} from 'utils/constants';

const CUSTOM_STATUS_TIME_PICKER_INTERVALS_IN_MINUTES = 30;

export function getRoundedTime(value: Moment) {
    const roundedTo = CUSTOM_STATUS_TIME_PICKER_INTERVALS_IN_MINUTES;
    const start = moment(value);
    const diff = start.minute() % roundedTo;
    if (diff === 0) {
        return value;
    }
    const remainder = roundedTo - diff;
    return start.add(remainder, 'm').seconds(0).milliseconds(0);
}

const getTimeInIntervals = (startTime: Moment): Date[] => {
    const interval = CUSTOM_STATUS_TIME_PICKER_INTERVALS_IN_MINUTES;
    let time = moment(startTime);
    const nextDay = moment(startTime).add(1, 'days').startOf('day');
    const intervals: Date[] = [];
    while (time.isBefore(nextDay)) {
        intervals.push(time.toDate());
        time = time.add(interval, 'minutes').seconds(0).milliseconds(0);
    }

    return intervals;
};

type Props = {
    time: Moment;
    handleChange: (date: Moment) => void;
    timezone?: string;
    setIsDatePickerOpen?: (isDatePickerOpen: boolean) => void;
}

const DateTimeInputContainer: React.FC<Props> = (props: Props) => {
    const locale = useSelector(getCurrentLocale);
    const {time, handleChange, timezone} = props;
    const [timeOptions, setTimeOptions] = useState<Date[]>([]);
    const [isPopperOpen, setIsPopperOpen] = useState(false);
    const {formatMessage} = useIntl();
    const timeButtonRef = useRef<HTMLButtonElement>(null);
    const theme = useSelector(getTheme);

    const handlePopperOpenState = useCallback((isOpen: boolean) => {
        setIsPopperOpen(isOpen);
        props.setIsDatePickerOpen?.(isOpen);
    }, []);

    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        if (isKeyPressed(event, Constants.KeyCodes.ESCAPE) && isPopperOpen) {
            handlePopperOpenState(false);
        }
    }, [isPopperOpen, handlePopperOpenState]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown]);

    const setTimeAndOptions = () => {
        const currentTime = getCurrentMomentForTimezone(timezone);
        let startTime = moment(time).startOf('day');
        if (time.date() === currentTime.date()) {
            startTime = getRoundedTime(currentTime);
        }
        setTimeOptions(getTimeInIntervals(startTime));
    };

    useEffect(setTimeAndOptions, [time]);

    const handleDayChange = (day: Date, modifiers: DayModifiers) => {
        if (modifiers.today) {
            const currentTime = getCurrentMomentForTimezone(timezone);
            const roundedTime = getRoundedTime(currentTime);
            handleChange(roundedTime);
        } else {
            const dayWithTimezone = timezone ? moment.tz(day, timezone) : moment(day);
            handleChange(dayWithTimezone.startOf('day'));
        }
        handlePopperOpenState(false);
    };

    const handleTimeChange = useCallback((time: Date, e: React.MouseEvent) => {
        e.preventDefault();
        handleChange(moment(time));
        focusTimeButton();
    }, [handleChange]);

    const currentTime = getCurrentMomentForTimezone(timezone).toDate();

    const focusTimeButton = useCallback(() => {
        document.dispatchEvent(new CustomEvent<A11yFocusEventDetail>(
            A11yCustomEventTypes.FOCUS, {
                detail: {
                    target: timeButtonRef.current,
                    keyboardOnly: true,
                },
            },
        ));
    }, []);

    const formatDate = (date: Date): string => {
        return DateTime.fromJSDate(date).toFormat('yyyy-MM-dd');
    };

    const inputIcon = (
        <IconButton
            onClick={() => handlePopperOpenState(true)}
            icon={'calendar-outline'}
            className='dateTime__calendar-icon'
            size={'sm'}
            aria-haspopup='grid'
        />
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
        <CompassThemeProvider theme={theme}>
            <div className='dateTime'>
                <div className='dateTime__date'>
                    <DatePicker
                        isPopperOpen={isPopperOpen}
                        handlePopperOpenState={handlePopperOpenState}
                        locale={locale}
                        datePickerProps={datePickerProps}
                    >
                        <Input
                            value={formatDate(time.toDate())}
                            id='customStatus__calendar-input'
                            readOnly={true}
                            className='dateTime__calendar-input'
                            label={localizeMessage('dnd_custom_time_picker_modal.date', 'Date')}
                            onClick={() => handlePopperOpenState(true)}
                            tabIndex={-1}
                            inputPrefix={inputIcon}
                        />
                    </DatePicker>
                </div>
                <div className='dateTime__time'>
                    <MenuWrapper
                        className='dateTime__time-menu'
                    >
                        <button
                            className='style--none'
                            ref={timeButtonRef}
                        >
                            <span className='dateTime__input-title'>{formatMessage({id: 'custom_status.expiry.time_picker.title', defaultMessage: 'Time'})}</span>
                            <span className='dateTime__time-icon'>
                                <i className='icon-clock-outline'/>
                            </span>
                            <div
                                className='dateTime__input'
                            >
                                <Timestamp
                                    useRelative={false}
                                    useDate={false}
                                    value={time.toString()}
                                />
                            </div>
                        </button>
                        <Menu
                            ariaLabel={formatMessage({id: 'time_dropdown.choose_time', defaultMessage: 'Choose a time'})}
                            id='expiryTimeMenu'
                        >
                            <Menu.Group>
                                {Array.isArray(timeOptions) && timeOptions.map((option, index) => (
                                    <Menu.ItemAction
                                        onClick={handleTimeChange.bind(this, option)}
                                        key={index}
                                        text={
                                            <Timestamp
                                                useRelative={false}
                                                useDate={false}
                                                value={option}
                                            />
                                        }
                                    />
                                ))}
                            </Menu.Group>
                        </Menu>
                    </MenuWrapper>
                </div>
            </div>
        </CompassThemeProvider>
    );
};

export default DateTimeInputContainer;
