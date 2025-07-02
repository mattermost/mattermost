// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import type {AppField} from '@mattermost/types/apps';

import {getCurrentTimezone} from 'mattermost-redux/selectors/entities/timezone';

import DatePicker from 'components/date_picker/date_picker';

import {stringToMoment, momentToString, validateDateRange} from 'utils/date_utils';

type Props = {
    field: AppField;
    value: string | null;
    onChange: (name: string, value: string | null) => void;
    hasError: boolean;
    errorText?: React.ReactNode;
};

const AppsFormDateField: React.FC<Props> = ({
    field,
    value,
    onChange,
    hasError,
    errorText,
}) => {
    const intl = useIntl();
    const timezone = useSelector(getCurrentTimezone);
    const [isPopperOpen, setIsPopperOpen] = useState(false);

    const momentValue = useMemo(() => {
        return stringToMoment(value, timezone);
    }, [value, timezone]);

    const displayValue = useMemo(() => {
        if (!momentValue) {
            return '';
        }

        // Format in user's locale
        return momentValue.format('MMM D, YYYY');
    }, [momentValue]);

    const handleDateChange = useCallback((date: Date | undefined) => {
        if (!date) {
            return;
        }

        // Create a new moment in the user's timezone for the selected date
        // Use the date components directly to avoid timezone conversion issues
        const newMoment = stringToMoment('today', timezone);
        if (newMoment) {
            newMoment.year(date.getFullYear()).
                month(date.getMonth()).
                date(date.getDate());

            const newValue = momentToString(newMoment, false);
            onChange(field.name, newValue);
        }
        setIsPopperOpen(false);
    }, [field.name, onChange, timezone]);

    const handlePopperOpenState = useCallback((isOpen: boolean) => {
        setIsPopperOpen(isOpen);
    }, []);

    const validationError = useMemo(() => {
        if (!value) {
            return null;
        }
        return validateDateRange(value, field.min_date, field.max_date, timezone);
    }, [value, field.min_date, field.max_date, timezone]);

    const placeholder = field.hint || intl.formatMessage({
        id: 'apps_form.date_field.placeholder',
        defaultMessage: 'Select a date',
    });

    const calendarIcon = (
        <i className='icon-calendar-outline'/>
    );

    return (
        <div className='form-group'>
            {field.label && (
                <label className='control-label'>
                    {field.label}
                    {field.is_required && <span className='error-text'>{' *'}</span>}
                </label>
            )}

            <DatePicker
                isPopperOpen={isPopperOpen}
                handlePopperOpenState={handlePopperOpenState}
                locale={intl.locale}
                datePickerProps={{
                    mode: 'single',
                    selected: momentValue ? new Date(momentValue.year(), momentValue.month(), momentValue.date()) : undefined,
                    defaultMonth: momentValue ? new Date(momentValue.year(), momentValue.month(), momentValue.date()) : undefined,
                    onSelect: handleDateChange,
                    disabled: field.readonly,
                }}
                value={displayValue || undefined}
                icon={calendarIcon}
            >
                <span className='date-time-input__value'>{placeholder}</span>
            </DatePicker>

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

export default AppsFormDateField;
