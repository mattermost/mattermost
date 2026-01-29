// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment-timezone';
import React, {useCallback, useMemo} from 'react';
import {useSelector} from 'react-redux';

import type {AppField} from '@mattermost/types/apps';

import {getCurrentTimezone} from 'mattermost-redux/selectors/entities/timezone';

import DateTimeInput, {getRoundedTime} from 'components/datetime_input/datetime_input';

import {stringToMoment, momentToString, resolveRelativeDate} from 'utils/date_utils';

// Default time interval for DateTime fields in minutes
const DEFAULT_TIME_INTERVAL_MINUTES = 60;

type Props = {
    field: AppField;
    value: string | string[] | null;
    onChange: (name: string, value: string | string[] | null) => void;
};

const AppsFormDateTimeField: React.FC<Props> = ({
    field,
    value,
    onChange,
}) => {
    const timezone = useSelector(getCurrentTimezone);

    // Extract datetime config with fallback to top-level fields
    const config = field.datetime_config || {};
    const timePickerInterval = config.time_interval ?? field.time_interval ?? DEFAULT_TIME_INTERVAL_MINUTES;
    const isRange = config.is_range ?? false;
    const allowSingleDayRange = config.allow_single_day_range ?? false;
    const rangeLayout = config.range_layout;

    const momentValue = useMemo(() => {
        if (isRange && Array.isArray(value)) {
            const parsedValues = value.map((val) => stringToMoment(val, timezone)).filter(Boolean);
            if (parsedValues.length > 0) {
                return parsedValues;
            }
        } else if (value && !Array.isArray(value)) {
            const parsed = stringToMoment(value, timezone);
            if (parsed) {
                return parsed;
            }
        }

        // No automatic defaults - field starts empty
        return null;
    }, [value, timezone, isRange]);

    const handleDateTimeChange = useCallback((date: moment.Moment | null) => {
        if (!date) {
            onChange(field.name, null);
            return;
        }
        const newValue = momentToString(date, true);
        onChange(field.name, newValue);
    }, [field.name, onChange]);

    const allowPastDates = useMemo(() => {
        if (field.min_date) {
            const resolvedMinDate = resolveRelativeDate(field.min_date);
            const minMoment = stringToMoment(resolvedMinDate, timezone);
            const currentMoment = timezone ? moment.tz(timezone) : moment();

            return !minMoment || minMoment.isBefore(currentMoment, 'day');
        }

        return true;
    }, [field.min_date, timezone]);

    // For range mode, we need start and end values
    const startMoment = Array.isArray(momentValue) && momentValue.length > 0 && momentValue[0] ? momentValue[0] : null;
    const endMoment = Array.isArray(momentValue) && momentValue.length > 1 && momentValue[1] ? momentValue[1] : null;

    // Handle start time change in range mode
    const handleStartTimeChange = useCallback((newMoment: moment.Moment | null) => {
        if (!newMoment) {
            onChange(field.name, null);
            return;
        }

        const startString = momentToString(newMoment, true);

        if (Array.isArray(momentValue) && momentValue.length > 1) {
            // Have both start and end - update start, keep end
            const endString = momentToString(momentValue[1], true);
            const rangeValues = [startString, endString].filter((v): v is string => Boolean(v));
            onChange(field.name, rangeValues);
        } else {
            // Only have start - set as array
            onChange(field.name, startString ? [startString] : null);
        }
    }, [onChange, field.name, momentValue]);

    // Handle end time change in range mode
    const handleEndTimeChange = useCallback((newMoment: moment.Moment | null) => {
        if (!newMoment) {
            onChange(field.name, null);
            return;
        }

        if (Array.isArray(momentValue) && momentValue.length > 0) {
            const startString = momentToString(momentValue[0], true);
            const endString = momentToString(newMoment, true);
            const rangeValues = [startString, endString].filter((v): v is string => Boolean(v));
            onChange(field.name, rangeValues);
        } else {
            // No start yet - can't set end without start
            onChange(field.name, null);
        }
    }, [onChange, field.name, momentValue]);

    // Handle range change from START field calendar
    const handleStartRangeChange = useCallback((rangeFrom: Date, rangeTo: Date | null) => {
        const currentTime = timezone ? moment.tz(timezone) : moment();
        const defaultTime = getRoundedTime(currentTime, timePickerInterval || 60);

        const existingStart = Array.isArray(momentValue) && momentValue[0] ? momentValue[0] : null;
        const existingEnd = Array.isArray(momentValue) && momentValue[1] ? momentValue[1] : null;

        // Convert new start date to moment
        const newStartMoment = timezone ? moment(rangeFrom).tz(timezone, true) : moment(rangeFrom);
        const existingStartTime = existingStart || defaultTime;
        newStartMoment.hour(existingStartTime.hour()).minute(existingStartTime.minute());

        // Check if new start is on or after existing end - if so, start fresh range
        if (existingEnd && newStartMoment.isSameOrAfter(existingEnd, 'day')) {
            // Start new range from this date only
            onChange(field.name, [momentToString(newStartMoment, true)!]);
            return;
        }

        // Otherwise, update start and keep existing end (or use rangeTo if dragging)
        const rangeDates = [momentToString(newStartMoment, true)];

        if (rangeTo) {
            // User dragged to select range
            const endMoment = timezone ? moment(rangeTo).tz(timezone, true) : moment(rangeTo);
            const existingEndTime = existingEnd || defaultTime;
            endMoment.hour(existingEndTime.hour()).minute(existingEndTime.minute());
            rangeDates.push(momentToString(endMoment, true));
        } else if (existingEnd) {
            // Keep existing end
            rangeDates.push(momentToString(existingEnd, true));
        }

        const rangeValues = rangeDates.filter((v): v is string => Boolean(v));
        onChange(field.name, rangeValues.length > 0 ? rangeValues : null);
    }, [onChange, field.name, timezone, momentValue, timePickerInterval]);

    // Handle range change from END field calendar
    const handleEndRangeChange = useCallback((startDate: Date, endDate: Date | null) => {
        const currentTime = timezone ? moment.tz(timezone) : moment();
        const defaultTime = getRoundedTime(currentTime, timePickerInterval || 60);

        // Always keep the existing start date
        let existingStart = Array.isArray(momentValue) && momentValue[0] ? momentValue[0] : null;
        if (!existingStart) {
            existingStart = timezone ? moment.tz(timezone) : moment();
        }
        const rangeDates = [momentToString(existingStart, true)];

        // Use the selected end date
        const selectedEndDate = endDate || startDate;
        const endMoment = timezone ? moment(selectedEndDate).tz(timezone, true) : moment(selectedEndDate);
        const existingEndTime = Array.isArray(momentValue) && momentValue[1] ? momentValue[1] : defaultTime;
        endMoment.hour(existingEndTime.hour()).minute(existingEndTime.minute());
        rangeDates.push(momentToString(endMoment, true));

        const rangeValues = rangeDates.filter((v): v is string => Boolean(v));
        onChange(field.name, rangeValues.length > 0 ? rangeValues : null);
    }, [onChange, field.name, timezone, momentValue, timePickerInterval]);

    if (isRange) {
        const isVertical = rangeLayout === 'vertical';
        const containerStyle = isVertical ? {display: 'flex', flexDirection: 'column' as const, gap: '16px'} : {display: 'flex', gap: '16px'};
        const fieldStyle = isVertical ? {} : {flex: 1};

        return (
            <div className='apps-form-datetime-input'>
                <div style={containerStyle}>
                    <div style={fieldStyle}>
                        <label style={{fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px', fontWeight: '500'}}>
                            {'Start Date & Time'}
                        </label>
                        <DateTimeInput
                            time={startMoment}
                            handleChange={handleStartTimeChange}
                            timezone={timezone}
                            relativeDate={false}
                            timePickerInterval={timePickerInterval}
                            allowPastDates={allowPastDates}
                            rangeMode={true}
                            rangeValue={{from: startMoment, to: endMoment}}
                            isStartField={true}
                            onRangeChange={handleStartRangeChange}
                            allowSingleDayRange={allowSingleDayRange}
                        />
                    </div>
                    <div style={fieldStyle}>
                        <label style={{fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px', fontWeight: '500'}}>
                            {'End Date & Time'}
                        </label>
                        <DateTimeInput
                            time={endMoment}
                            handleChange={handleEndTimeChange}
                            timezone={timezone}
                            relativeDate={false}
                            timePickerInterval={timePickerInterval}
                            allowPastDates={allowPastDates}
                            rangeMode={true}
                            rangeValue={{from: startMoment, to: endMoment}}
                            isStartField={false}
                            onRangeChange={handleEndRangeChange}
                            allowSingleDayRange={allowSingleDayRange}
                        />
                    </div>
                </div>
            </div>
        );
    }

    // Single datetime (non-range mode)
    const singleValue = Array.isArray(momentValue) ? (momentValue[0] || null) : momentValue;

    return (
        <div className='apps-form-datetime-input'>
            <DateTimeInput
                time={singleValue}
                handleChange={handleDateTimeChange}
                timezone={timezone}
                relativeDate={true}
                timePickerInterval={timePickerInterval}
                allowPastDates={allowPastDates}
            />
        </div>
    );
};

export default AppsFormDateTimeField;
