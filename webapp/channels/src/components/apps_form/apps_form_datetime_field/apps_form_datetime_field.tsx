// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment-timezone';
import React, {useCallback, useMemo} from 'react';
import {useSelector} from 'react-redux';

import type {AppField} from '@mattermost/types/apps';

import {getCurrentTimezone} from 'mattermost-redux/selectors/entities/timezone';

import DateTimeInput, {getNextAvailableTime} from 'components/datetime_input/datetime_input';

import {stringToMoment, momentToString, parseDisabledDays, resolveRelativeDate, stringToDate} from 'utils/date_utils';

// Helper to get timezone abbreviation (e.g., "MST", "EDT")
const getTimezoneAbbreviation = (timezone: string): string => {
    try {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            timeZoneName: 'short',
        });
        const parts = formatter.formatToParts(now);
        const tzPart = parts.find((part) => part.type === 'timeZoneName');
        return tzPart?.value || timezone;
    } catch {
        return timezone;
    }
};

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
    const userTimezone = useSelector(getCurrentTimezone);

    // Use location_timezone if specified, otherwise fall back to user's timezone
    const timezone = field.location_timezone || userTimezone;
    console.log('AppsFormDateTimeField - field.name:', field.name, 'location_timezone:', field.location_timezone, 'userTimezone:', userTimezone, 'final timezone:', timezone);

    // Show timezone indicator when location_timezone is set
    const showTimezoneIndicator = !!field.location_timezone;

    const momentValue = useMemo(() => {
        console.log('momentValue useMemo - value:', value, 'timezone:', timezone);
        if (field.is_range && Array.isArray(value)) {
            const parsedValues = value.map((val) => stringToMoment(val, timezone)).filter(Boolean);
            if (parsedValues.length > 0) {
                return parsedValues;
            }
        } else if (value && !Array.isArray(value)) {
            const parsed = stringToMoment(value, timezone);
            console.log('momentValue useMemo - parsed:', parsed?.format(), 'tz:', parsed?.tz(), 'utcOffset:', parsed?.utcOffset());
            if (parsed) {
                return parsed;
            }
        }

        // No automatic defaults - field starts empty
        // Apps can set a default value using the field.value property
        return field.is_range ? null : null;
    }, [value, timezone, field.is_range]);

    const handleDateTimeChange = useCallback((date: moment.Moment | null) => {
        if (!date) {
            // Clear the value when null is passed (e.g., validation error)
            console.log('handleDateTimeChange - clearing value due to null');
            onChange(field.name, null);
            return;
        }
        console.log('handleDateTimeChange - moment:', date.format(), 'timezone:', date.tz(), 'utcOffset:', date.utcOffset());
        const newValue = momentToString(date, true);
        console.log('handleDateTimeChange - converted to UTC:', newValue);
        onChange(field.name, newValue);
    }, [field.name, onChange]);

    const timePickerInterval = field.time_interval || DEFAULT_TIME_INTERVAL_MINUTES;

    // Parse disabled days from field configuration (combines min_date, max_date, and disabled_days)
    const disabledDays = useMemo(() => {
        console.log('apps_form_datetime_field - field:', field.name, 'disabled_days:', field.disabled_days, 'min_date:', field.min_date, 'max_date:', field.max_date);
        const disabled = [];

        // Handle min_date and max_date (legacy support)
        if (field.min_date) {
            const resolvedMinDate = resolveRelativeDate(field.min_date);
            const minDate = stringToDate(resolvedMinDate);
            if (minDate) {
                disabled.push({before: minDate});
            }
        }

        if (field.max_date) {
            const resolvedMaxDate = resolveRelativeDate(field.max_date);
            const maxDate = stringToDate(resolvedMaxDate);
            if (maxDate) {
                disabled.push({after: maxDate});
            }
        }

        // Parse disabled_days from field (new flexible approach)
        const parsedDisabledDays = parseDisabledDays(field.disabled_days);
        if (parsedDisabledDays) {
            disabled.push(...parsedDisabledDays);
        }

        console.log('apps_form_datetime_field - final disabled array:', disabled);
        return disabled.length > 0 ? disabled : undefined;
    }, [field.min_date, field.max_date, field.disabled_days]);

    const startMoment = Array.isArray(momentValue) && momentValue.length > 0 && momentValue[0] ? momentValue[0] : null;
    const endMoment = Array.isArray(momentValue) && momentValue.length > 1 && momentValue[1] ? momentValue[1] : null;

    // For range calendar, only use actual values, not fallbacks
    const rangeValueForCalendar = Array.isArray(momentValue) && momentValue.length > 0 ? {
        from: momentValue[0] || undefined,
        to: momentValue.length > 1 ? (momentValue[1] || undefined) : undefined,
    } : undefined;

    // Handle range change from START field calendar
    // DateTimeInput will handle the day click logic when a complete range exists
    // This handler just updates times and converts to strings
    const handleStartRangeChange = useCallback((rangeFrom: Date, rangeTo: Date | null) => {
        const currentTime = timezone ? moment.tz(timezone) : moment();
        const timePickerInterval = field.time_interval || DEFAULT_TIME_INTERVAL_MINUTES;
        const defaultTime = getNextAvailableTime(currentTime, timePickerInterval, field.exclude_time, timezone);

        const existingStart = Array.isArray(momentValue) && momentValue[0] ? momentValue[0] : null;
        const existingEnd = Array.isArray(momentValue) && momentValue[1] ? momentValue[1] : null;

        // Convert dates to moments with times
        const startMoment = timezone ? moment(rangeFrom).tz(timezone, true) : moment(rangeFrom);
        const existingStartTime = existingStart || defaultTime;
        startMoment.hour(existingStartTime.hour()).minute(existingStartTime.minute());

        const rangeDates = [momentToString(startMoment, true)];

        // If we have rangeTo, add it with its time
        if (rangeTo) {
            const endMoment = timezone ? moment(rangeTo).tz(timezone, true) : moment(rangeTo);
            const existingEndTime = existingEnd || defaultTime;
            endMoment.hour(existingEndTime.hour()).minute(existingEndTime.minute());
            rangeDates.push(momentToString(endMoment, true));
        }

        const rangeValues = rangeDates.filter((v): v is string => Boolean(v));
        onChange(field.name, rangeValues.length > 0 ? rangeValues : null);
    }, [onChange, field.name, timezone, momentValue, field.time_interval, field.exclude_time]);

    // Handle range change from END field calendar
    // End field calendar should update the end date (keeping start)
    const handleEndRangeChange = useCallback((startDate: Date, endDate: Date | null) => {
        const currentTime = timezone ? moment.tz(timezone) : moment();
        const timePickerInterval = field.time_interval || DEFAULT_TIME_INTERVAL_MINUTES;
        const defaultTime = getNextAvailableTime(currentTime, timePickerInterval, field.exclude_time, timezone);

        // Always keep the existing start date
        const existingStart = Array.isArray(momentValue) && momentValue[0] ? momentValue[0] : (timezone ? moment.tz(timezone) : moment());
        const rangeDates = [momentToString(existingStart, true)];

        // Use the selected end date (could be from or to depending on selection)
        const selectedEndDate = endDate || startDate; // If no explicit end, use the clicked date
        const endMoment = timezone ? moment(selectedEndDate).tz(timezone, true) : moment(selectedEndDate);
        const existingEndTime = Array.isArray(momentValue) && momentValue[1] ? momentValue[1] : defaultTime;
        endMoment.hour(existingEndTime.hour()).minute(existingEndTime.minute());
        rangeDates.push(momentToString(endMoment, true));

        const rangeValues = rangeDates.filter((v): v is string => Boolean(v));
        onChange(field.name, rangeValues.length > 0 ? rangeValues : null);
    }, [onChange, field.name, timezone, momentValue, field.time_interval, field.exclude_time]);

    // Handle start time change
    const handleStartTimeChange = useCallback((newMoment: moment.Moment | null) => {
        if (!newMoment) {
            // Clear the start time when null is passed (e.g., validation error)
            console.log('handleStartTimeChange - clearing start time due to null');
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
            // Only have start or nothing - set just start
            const rangeValues = [startString].filter((v): v is string => Boolean(v));
            onChange(field.name, rangeValues);
        }
    }, [momentValue, onChange, field.name]);

    // Handle end time change
    const handleEndTimeChange = useCallback((newMoment: moment.Moment | null) => {
        if (!newMoment) {
            // Clear the end time when null is passed (e.g., validation error)
            console.log('handleEndTimeChange - clearing end time due to null');
            onChange(field.name, null);
            return;
        }

        if (Array.isArray(momentValue) && momentValue.length > 0) {
            const startString = momentToString(momentValue[0], true);
            const endString = momentToString(newMoment, true);
            const rangeValues = [startString, endString].filter((v): v is string => Boolean(v));
            onChange(field.name, rangeValues);
        } else {
            // If no start time set, create a range with current time as start and new moment as end
            const startString = momentToString(timezone ? moment.tz(timezone) : moment(), true);
            const endString = momentToString(newMoment, true);
            const rangeValues = [startString, endString].filter((v): v is string => Boolean(v));
            onChange(field.name, rangeValues);
        }
    }, [momentValue, onChange, field.name, timezone]);

    if (field.is_range) {
        const isVertical = field.range_layout === 'vertical';
        const containerStyle = isVertical ? {display: 'flex', flexDirection: 'column' as const, gap: '16px'} : {display: 'flex', gap: '16px'};
        const fieldStyle = isVertical ? {} : {flex: 1};

        return (
            <div className='apps-form-datetime-input'>
                {showTimezoneIndicator && (
                    <div style={{fontSize: '11px', color: '#888', marginBottom: '8px', fontStyle: 'italic'}}>
                        🌍 Times in {getTimezoneAbbreviation(timezone)}
                    </div>
                )}
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
                            allowPastDates={true}
                            excludeTime={field.exclude_time}
                            rangeMode={true}
                            rangeValue={rangeValueForCalendar}
                            isStartField={true}
                            onRangeChange={handleStartRangeChange}
                            allowSingleDayRange={field.allow_single_day_range}
                            additionalDisabledDays={disabledDays}
                            allowManualTimeEntry={field.allow_manual_time_entry}
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
                            allowPastDates={true}
                            excludeTime={field.exclude_time}
                            rangeMode={true}
                            rangeValue={rangeValueForCalendar}
                            isStartField={false}
                            allowManualTimeEntry={field.allow_manual_time_entry}
                            onRangeChange={handleEndRangeChange}
                            allowSingleDayRange={field.allow_single_day_range}
                            additionalDisabledDays={disabledDays}
                        />
                    </div>
                </div>
            </div>
        );
    }

    // Handle single datetime (existing functionality)
    const singleValue = Array.isArray(momentValue) ? momentValue[0] : momentValue;

    return (
        <div className='apps-form-datetime-input'>
            {showTimezoneIndicator && (
                <div style={{fontSize: '11px', color: '#888', marginBottom: '8px', fontStyle: 'italic'}}>
                    🌍 Times in {getTimezoneAbbreviation(timezone)}
                </div>
            )}
            <DateTimeInput
                time={singleValue}
                handleChange={handleDateTimeChange}
                timezone={timezone}
                relativeDate={!field.location_timezone}
                timePickerInterval={timePickerInterval}
                allowPastDates={true}
                excludeTime={field.exclude_time}
                additionalDisabledDays={disabledDays}
                allowManualTimeEntry={field.allow_manual_time_entry}
            />
        </div>
    );
};

export default AppsFormDateTimeField;
