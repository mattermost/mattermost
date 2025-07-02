// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment-timezone';
import React, {useCallback, useEffect, useMemo} from 'react';
import {useSelector} from 'react-redux';

import type {AppField} from '@mattermost/types/apps';

import {getCurrentTimezone} from 'mattermost-redux/selectors/entities/timezone';

import DateTimeInput, {getRoundedTime} from 'components/datetime_input/datetime_input';

import {stringToMoment, momentToString, validateDateRange} from 'utils/date_utils';

type Props = {
    field: AppField;
    value: string | null;
    onChange: (name: string, value: string | null) => void;
    hasError: boolean;
    errorText?: React.ReactNode;
};

const AppsFormDateTimeField: React.FC<Props> = ({
    field,
    value,
    onChange,
    hasError,
    errorText,
}) => {
    const timezone = useSelector(getCurrentTimezone);

    // Set default value to current time if no value is provided
    useEffect(() => {
        if (!value) {
            // Use current time rounded to next interval
            const currentTime = timezone ? moment.tz(timezone) : moment();
            const timePickerInterval = field.time_interval || 60; // Default to 60 minutes
            const defaultMoment = getRoundedTime(currentTime, timePickerInterval);
            const newValue = momentToString(defaultMoment, true);
            onChange(field.name, newValue);
        }
    }, [value, field.name, field.time_interval, onChange, timezone]);

    const momentValue = useMemo(() => {
        if (!value) {
            return null;
        }

        return stringToMoment(value, timezone);
    }, [value, timezone]);

    const handleDateTimeChange = useCallback((date: moment.Moment) => {
        const newValue = momentToString(date, true);
        onChange(field.name, newValue);
    }, [field.name, onChange]);

    const validationError = useMemo(() => {
        if (!value) {
            return null;
        }
        return validateDateRange(value, field.min_date, field.max_date, timezone);
    }, [value, field.min_date, field.max_date, timezone]);

    const timePickerInterval = field.time_interval || 60; // Default to 60 minutes

    return (
        <div className='form-group'>
            {field.label && (
                <label className='control-label'>
                    {field.label}
                    {field.is_required && <span className='error-text'>{' *'}</span>}
                </label>
            )}

            <div className={`apps-form-datetime-input ${hasError || validationError ? 'has-error' : ''}`}>
                {momentValue && (
                    <DateTimeInput
                        time={momentValue}
                        handleChange={handleDateTimeChange}
                        timezone={timezone}
                        relativeDate={true}
                        timePickerInterval={timePickerInterval}
                        allowPastDates={true}
                    />
                )}
            </div>

            {field.description && (
                <div
                    id={`${field.name}-description`}
                    className='help-text'
                >
                    {field.description}
                </div>
            )}

            {(hasError || validationError) && (
                <div className='has-error'>
                    <span className='control-label'>{validationError || errorText}</span>
                </div>
            )}
        </div>
    );
};

export default AppsFormDateTimeField;
