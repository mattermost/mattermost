// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment-timezone';
import React, {useCallback, useMemo} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import type {AppField, DateTimeRangeValue, AppFormValue} from '@mattermost/types/apps';
import {isDateTimeRangeValue} from '@mattermost/types/apps';

import {getCurrentTimezone} from 'mattermost-redux/selectors/entities/timezone';

import DateTimeInput from 'components/datetime_input/datetime_input';

import {stringToMoment, momentToString, resolveRelativeDate, getRoundedTime} from 'utils/date_utils';

// Default time interval for DateTime fields in minutes
const DEFAULT_TIME_INTERVAL_MINUTES = 60;

type Props = {
    field: AppField;
    value: string | DateTimeRangeValue | null;
    onChange: (name: string, value: AppFormValue) => void;
    setIsInteracting?: (isInteracting: boolean) => void;
};

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

const AppsFormDateTimeField: React.FC<Props> = ({
    field,
    value,
    onChange,
    setIsInteracting,
}) => {
    const {formatMessage} = useIntl();
    const userTimezone = useSelector(getCurrentTimezone);

    // Extract datetime config with fallback to top-level fields
    const config = field.datetime_config || {};
    const locationTimezone = config.location_timezone;
    const timePickerInterval = config.time_interval ?? field.time_interval ?? DEFAULT_TIME_INTERVAL_MINUTES;
    const allowManualTimeEntry = config.allow_manual_time_entry ?? false;
    const isRange = config.is_range ?? false;
    const allowSingleDayRange = config.allow_single_day_range ?? false;
    const rangeLayout = config.range_layout;

    // Use location_timezone if specified, otherwise fall back to user's timezone
    const timezone = locationTimezone || userTimezone;

    // Show timezone indicator when location_timezone is set
    const showTimezoneIndicator = Boolean(locationTimezone);

    // Parse value into moment(s). For ranges, returns {start, end} with Moment values.
    const rangeState = useMemo((): {start: moment.Moment | null; end: moment.Moment | null} | null => {
        if (!isRange) {
            return null;
        }
        if (isDateTimeRangeValue(value)) {
            const start = stringToMoment(value.start, timezone) || null;
            const end = value.end ? (stringToMoment(value.end, timezone) || null) : null;
            return {start, end};
        }
        return {start: null, end: null};
    }, [value, timezone, isRange]);

    const singleMoment = useMemo((): moment.Moment | null => {
        if (isRange) {
            return null;
        }
        if (value && typeof value === 'string') {
            return stringToMoment(value, timezone) || null;
        }
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

    // Convenience accessors for range mode
    const startMoment = rangeState?.start || null;
    const endMoment = rangeState?.end || null;

    // Helper to emit a range value
    const emitRange = useCallback((start: string | null, end?: string | null) => {
        if (!start) {
            onChange(field.name, null);
            return;
        }
        const result: DateTimeRangeValue = {start, ...(end ? {end} : {})};
        onChange(field.name, result);
    }, [onChange, field.name]);

    // Handle start time change in range mode
    const handleStartTimeChange = useCallback((newMoment: moment.Moment | null) => {
        if (!newMoment) {
            onChange(field.name, null);
            return;
        }

        const startString = momentToString(newMoment, true);
        const endString = endMoment ? momentToString(endMoment, true) : null;
        emitRange(startString, endString);
    }, [onChange, field.name, endMoment, emitRange]);

    // Handle end time change in range mode
    const handleEndTimeChange = useCallback((newMoment: moment.Moment | null) => {
        if (!newMoment) {
            onChange(field.name, null);
            return;
        }

        if (startMoment) {
            const startString = momentToString(startMoment, true);
            const endString = momentToString(newMoment, true);
            emitRange(startString, endString);
        }

        // No start yet — ignore end change; user must pick start first
    }, [onChange, field.name, startMoment, emitRange]);

    // Handle range change from START field calendar
    const handleStartRangeChange = useCallback((rangeFrom: Date, rangeTo: Date | null) => {
        const currentTime = timezone ? moment.tz(timezone) : moment();
        const defaultTime = getRoundedTime(currentTime, timePickerInterval || 60);

        // Convert new start date to moment
        const newStartMoment = timezone ? moment(rangeFrom).tz(timezone, true) : moment(rangeFrom);
        const existingStartTime = startMoment || defaultTime;
        newStartMoment.hour(existingStartTime.hour()).minute(existingStartTime.minute());

        // Check if new start is on or after existing end - if so, start fresh range
        if (endMoment && newStartMoment.isSameOrAfter(endMoment, 'day')) {
            emitRange(momentToString(newStartMoment, true));
            return;
        }

        // Otherwise, update start and keep existing end (or use rangeTo if dragging)
        let endString: string | null = null;

        if (rangeTo) {
            const newEndMoment = timezone ? moment(rangeTo).tz(timezone, true) : moment(rangeTo);
            const existingEndTime = endMoment || defaultTime;
            newEndMoment.hour(existingEndTime.hour()).minute(existingEndTime.minute());
            endString = momentToString(newEndMoment, true);
        } else if (endMoment) {
            endString = momentToString(endMoment, true);
        }

        emitRange(momentToString(newStartMoment, true), endString);
    }, [emitRange, timezone, startMoment, endMoment, timePickerInterval]);

    // Handle range change from END field calendar
    const handleEndRangeChange = useCallback((selectedDate: Date, endDate: Date | null) => {
        if (!startMoment) {
            // No start yet — ignore end change; user must pick start first
            return;
        }

        const currentTime = timezone ? moment.tz(timezone) : moment();
        const defaultTime = getRoundedTime(currentTime, timePickerInterval || 60);

        const startString = momentToString(startMoment, true);

        // Use the selected end date
        const resolvedEndDate = endDate || selectedDate;
        const newEndMoment = timezone ? moment(resolvedEndDate).tz(timezone, true) : moment(resolvedEndDate);
        const existingEndTime = endMoment || defaultTime;
        newEndMoment.hour(existingEndTime.hour()).minute(existingEndTime.minute());
        const endString = momentToString(newEndMoment, true);

        emitRange(startString, endString);
    }, [emitRange, timezone, startMoment, endMoment, timePickerInterval]);

    if (isRange) {
        const containerClass = rangeLayout === 'vertical' ?
            'apps-form-datetime-range apps-form-datetime-range--vertical' :
            'apps-form-datetime-range';

        return (
            <div className='apps-form-datetime-input'>
                <div className={containerClass}>
                    <div className='apps-form-datetime-range__field'>
                        <label className='apps-form-datetime-range__label'>
                            {formatMessage({id: 'datetime.range.start_label', defaultMessage: 'Start Date & Time'})}
                        </label>
                        <DateTimeInput
                            time={startMoment}
                            handleChange={handleStartTimeChange}
                            timezone={timezone}
                            relativeDate={false}
                            timePickerInterval={timePickerInterval}
                            allowPastDates={allowPastDates}
                            allowManualTimeEntry={allowManualTimeEntry}
                            rangeConfig={{
                                rangeValue: {from: startMoment, to: endMoment},
                                isStartField: true,
                                onRangeChange: handleStartRangeChange,
                                allowSingleDayRange,
                            }}
                            setIsInteracting={setIsInteracting}
                        />
                    </div>
                    <div className='apps-form-datetime-range__field'>
                        <label className='apps-form-datetime-range__label'>
                            {formatMessage({id: 'datetime.range.end_label', defaultMessage: 'End Date & Time'})}
                        </label>
                        <DateTimeInput
                            time={endMoment}
                            handleChange={handleEndTimeChange}
                            timezone={timezone}
                            relativeDate={false}
                            timePickerInterval={timePickerInterval}
                            allowPastDates={allowPastDates}
                            allowManualTimeEntry={allowManualTimeEntry}
                            rangeConfig={{
                                rangeValue: {from: startMoment, to: endMoment},
                                isStartField: false,
                                onRangeChange: handleEndRangeChange,
                                allowSingleDayRange,
                            }}
                            setIsInteracting={setIsInteracting}
                        />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className='apps-form-datetime-input'>
            {showTimezoneIndicator && (
                <div className='apps-form-datetime-timezone'>
                    {formatMessage({id: 'datetime.range.timezone_indicator', defaultMessage: 'Times in {timezone}'}, {timezone: getTimezoneAbbreviation(timezone)})}
                </div>
            )}
            <DateTimeInput
                time={singleMoment}
                handleChange={handleDateTimeChange}
                timezone={timezone}
                relativeDate={!locationTimezone}
                timePickerInterval={timePickerInterval}
                allowPastDates={allowPastDates}
                allowManualTimeEntry={allowManualTimeEntry}
                setIsInteracting={setIsInteracting}
            />
        </div>
    );
};

export default AppsFormDateTimeField;
