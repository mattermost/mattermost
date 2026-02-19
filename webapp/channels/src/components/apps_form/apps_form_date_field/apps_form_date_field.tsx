// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';
import {useIntl} from 'react-intl';

import type {AppField, DateTimeRangeValue, AppFormValue} from '@mattermost/types/apps';
import {isDateTimeRangeValue} from '@mattermost/types/apps';

import DatePicker from 'components/date_picker/date_picker';

import {stringToDate, dateToString, resolveRelativeDate, formatDateForDisplay} from 'utils/date_utils';

type Props = {
    field: AppField;
    value: string | DateTimeRangeValue | null;
    onChange: (name: string, value: AppFormValue) => void;
    setIsInteracting?: (isInteracting: boolean) => void;
};

const AppsFormDateField: React.FC<Props> = ({
    field,
    value,
    onChange,
    setIsInteracting,
}) => {
    const intl = useIntl();
    const [isPopperOpen, setIsPopperOpen] = useState(false);

    // Extract datetime config with fallback to top-level fields
    const config = field.datetime_config || {};
    const isRange = config.is_range ?? false;
    const allowSingleDayRange = config.allow_single_day_range ?? false;

    const dateValue = useMemo(() => {
        if (isRange && isDateTimeRangeValue(value)) {
            const dates = [stringToDate(value.start)];
            if (value.end) {
                dates.push(stringToDate(value.end));
            }
            return dates.filter((d): d is Date => d !== null);
        }
        return stringToDate(value as string);
    }, [value, isRange]);

    const displayValue = useMemo(() => {
        if (!dateValue) {
            return '';
        }

        if (isRange && Array.isArray(dateValue)) {
            if (dateValue.length === 0) {
                return '';
            }
            const formattedStart = formatDateForDisplay(dateValue[0], intl.locale);
            try {
                if (dateValue.length === 1) {
                    return formattedStart;
                }
                return `${formattedStart} - ${formatDateForDisplay(dateValue[1], intl.locale)}`;
            } catch {
                return '';
            }
        }

        if (dateValue instanceof Date) {
            try {
                return formatDateForDisplay(dateValue, intl.locale);
            } catch {
                return '';
            }
        }

        return '';
    }, [dateValue, intl.locale, isRange]);

    const handleDateChange = useCallback((date: Date | undefined) => {
        if (!date) {
            return;
        }

        // Convert Date to ISO string (YYYY-MM-DD)
        const newValue = dateToString(date);
        onChange(field.name, newValue);
        setIsPopperOpen(false);
    }, [field.name, onChange]);

    const handleRangeChange = useCallback((range: {from?: Date; to?: Date} | undefined) => {
        if (!range || !range.from) {
            onChange(field.name, null);
            return;
        }

        const start = dateToString(range.from);
        if (!start) {
            onChange(field.name, null);
            return;
        }

        // Validate same-day range based on allow_single_day_range setting
        let validTo = range.to;
        if (range.to && !allowSingleDayRange) {
            const from = range.from;
            const to = range.to;
            if (
                from.getFullYear() === to.getFullYear() &&
                from.getMonth() === to.getMonth() &&
                from.getDate() === to.getDate()
            ) {
                validTo = undefined;
            }
        }

        const end = validTo ? dateToString(validTo) : undefined;
        const rangeResult: DateTimeRangeValue = {start, ...(end ? {end} : {})};

        onChange(field.name, rangeResult);
        if (validTo) {
            setIsPopperOpen(false);
        }
    }, [field.name, onChange, allowSingleDayRange]);

    const handlePopperOpenState = useCallback((isOpen: boolean) => {
        setIsPopperOpen(isOpen);
        setIsInteracting?.(isOpen);
    }, [setIsInteracting]);

    const disabledDays = useMemo(() => {
        const disabled = [];

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

        return disabled.length > 0 ? disabled : undefined;
    }, [field.min_date, field.max_date]);

    const placeholder = field.hint || intl.formatMessage({
        id: 'apps_form.date_field.placeholder',
        defaultMessage: 'Select a date',
    });

    const calendarIcon = (
        <i className='icon-calendar-outline'/>
    );

    const rangePickerValue = isRange && Array.isArray(dateValue) && dateValue.length > 0 ? {
        from: dateValue[0],
        to: dateValue.length > 1 ? dateValue[1] : undefined,
    } : undefined;

    const datePickerProps = isRange ? {
        mode: 'range' as const,
        selected: rangePickerValue,
        defaultMonth: rangePickerValue?.from,
        onSelect: handleRangeChange,
        disabled: field.readonly ? true : disabledDays,
    } : {
        mode: 'single' as const,
        selected: (dateValue instanceof Date ? dateValue : undefined),
        defaultMonth: (dateValue instanceof Date ? dateValue : undefined),
        onSelect: handleDateChange,
        disabled: field.readonly ? true : disabledDays,
    };

    return (
        <div>
            <DatePicker
                isPopperOpen={isPopperOpen}
                handlePopperOpenState={handlePopperOpenState}
                locale={intl.locale}
                datePickerProps={datePickerProps}
                value={displayValue || undefined}
                icon={calendarIcon}
            >
                <span className='date-time-input__value'>{placeholder}</span>
            </DatePicker>
        </div>
    );
};

export default AppsFormDateField;
