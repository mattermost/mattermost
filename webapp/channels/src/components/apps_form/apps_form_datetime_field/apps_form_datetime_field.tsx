// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type moment from 'moment-timezone';
import React, {useCallback, useMemo} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import type {AppField} from '@mattermost/types/apps';

import {getCurrentTimezone} from 'mattermost-redux/selectors/entities/timezone';

import DateTimeInput from 'components/datetime_input/datetime_input';

import {stringToMoment, momentToString} from 'utils/date_utils';
import {getCurrentMomentForTimezone} from 'utils/timezone';

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

    // Resolve datetime config (datetime_config takes precedence over deprecated top-level fields)
    const locationTimezone = field.datetime_config?.location_timezone;
    const timePickerInterval = field.datetime_config?.time_interval ?? field.time_interval ?? DEFAULT_TIME_INTERVAL_MINUTES;

    // manual_time_entry supersedes the deprecated allow_manual_time_entry. Either enabling
    // it turns it on (booleans can't distinguish explicit-false from not-set across the wire).
    // The OR covers direct Apps Framework bindings that may still carry the deprecated key;
    // dialog-sourced AppFields are pre-normalized by dialog_conversion and only carry manual_time_entry.
    const manualTimeEntry = Boolean(field.datetime_config?.manual_time_entry) || Boolean(field.datetime_config?.allow_manual_time_entry);

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

    // Resolve effective min/max dates (datetime_config takes precedence over deprecated top-level fields)
    const effectiveMinDate = field.datetime_config?.min_date ?? field.min_date;
    const effectiveMaxDate = field.datetime_config?.max_date ?? field.max_date;

    const {minDateTime, allowPastDates} = useMemo(() => {
        if (!effectiveMinDate) {
            return {minDateTime: undefined, allowPastDates: true};
        }
        const min = stringToMoment(effectiveMinDate, timezone) ?? undefined;
        const now = getCurrentMomentForTimezone(timezone);
        return {minDateTime: min, allowPastDates: !min || min.isBefore(now, 'minute')};
    }, [effectiveMinDate, timezone]);

    const maxDateTime = useMemo(() => {
        if (!effectiveMaxDate) {
            return undefined;
        }
        return stringToMoment(effectiveMaxDate, timezone) ?? undefined;
    }, [effectiveMaxDate, timezone]);

    return (
        <div className='apps-form-datetime-input'>
            {showTimezoneIndicator && (
                <div className='apps-form-datetime-input__timezone-hint'>
                    <FormattedMessage
                        id='apps_form.datetime_field.timezone_hint'
                        defaultMessage='Times in {timezone}'
                        values={{timezone: getTimezoneAbbreviation(timezone)}}
                    />
                </div>
            )}
            <DateTimeInput
                time={momentValue}
                handleChange={handleDateTimeChange}
                timezone={timezone}
                relativeDate={!locationTimezone}
                timePickerInterval={timePickerInterval}
                allowPastDates={allowPastDates}
                manualTimeEntry={manualTimeEntry}
                setIsInteracting={setIsInteracting}
                minDateTime={minDateTime}
                maxDateTime={maxDateTime}
            />
        </div>
    );
};

export default AppsFormDateTimeField;
