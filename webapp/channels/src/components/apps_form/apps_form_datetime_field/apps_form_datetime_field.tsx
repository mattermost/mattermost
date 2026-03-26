// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment-timezone';
import React, {useCallback, useMemo} from 'react';
import {useSelector} from 'react-redux';

import type {AppField} from '@mattermost/types/apps';

import {getCurrentTimezone} from 'mattermost-redux/selectors/entities/timezone';

import DateTimeInput from 'components/datetime_input/datetime_input';

import {stringToMoment, momentToString, resolveRelativeDate} from 'utils/date_utils';

// Default time interval for DateTime fields in minutes
const DEFAULT_TIME_INTERVAL_MINUTES = 60;

type Props = {
    field: AppField;
    value: string | null;
    onChange: (name: string, value: string | null) => void;
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
    const userTimezone = useSelector(getCurrentTimezone);

    // Extract datetime config with fallback to top-level fields
    const config = field.datetime_config || {};
    const locationTimezone = config.location_timezone;
    const timePickerInterval = config.time_interval ?? field.time_interval ?? DEFAULT_TIME_INTERVAL_MINUTES;
    const allowManualTimeEntry = config.allow_manual_time_entry ?? false;

    // Use location_timezone if specified, otherwise fall back to user's timezone
    const timezone = locationTimezone || userTimezone;

    // Show timezone indicator when location_timezone is set
    const showTimezoneIndicator = Boolean(locationTimezone);

    const momentValue = useMemo(() => {
        if (value) {
            const parsed = stringToMoment(value, timezone);
            if (parsed) {
                return parsed;
            }
        }

        // No automatic defaults - field starts empty
        // Required fields get a default from apps_form_component.tsx
        return null;
    }, [value, timezone]);

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

    return (
        <div className='apps-form-datetime-input'>
            {showTimezoneIndicator && (
                <div style={{fontSize: '11px', color: '#888', marginBottom: '8px'}}>
                    {'🌍 Times in ' + getTimezoneAbbreviation(timezone)}
                </div>
            )}
            <DateTimeInput
                time={momentValue}
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
