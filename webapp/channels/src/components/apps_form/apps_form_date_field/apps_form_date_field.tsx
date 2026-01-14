// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';
import {useIntl} from 'react-intl';

import type {AppField} from '@mattermost/types/apps';

import DatePicker from 'components/date_picker/date_picker';

import {stringToDate, dateToString, resolveRelativeDate, formatDateForDisplay} from 'utils/date_utils';

type Props = {
    field: AppField;
    value: string | string[] | null;
    onChange: (name: string, value: string | string[] | null) => void;
};

const AppsFormDateField: React.FC<Props> = ({
    field,
    value,
    onChange,
}) => {
    const intl = useIntl();
    const [isPopperOpen, setIsPopperOpen] = useState(false);

    // Extract datetime config with fallback to top-level fields
    const config = field.datetime_config || {};
    const isRange = config.is_range ?? false;
    const allowSingleDayRange = config.allow_single_day_range ?? false;

    const dateValue = useMemo(() => {
        if (isRange && Array.isArray(value)) {
            return value.map((val) => stringToDate(val)).filter((d): d is Date => d !== null);
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
            var startDate = formatDateForDisplay(dateValue[0], intl.locale);
            try {
                if (dateValue.length === 1) {
                    return startDate;
                }
                return `${startDate} - ${formatDateForDisplay(dateValue[1], intl.locale)}`;
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

        const values: string[] = [dateToString(range.from)!].filter(Boolean);

        if (range.to) {
            const toString = dateToString(range.to);
            if (toString) {
                values.push(toString);
            }
        }

        onChange(field.name, values.length > 0 ? values : null);
        if (range.to) {
            setIsPopperOpen(false);
        }
    }, [field.name, onChange]);

    const handlePopperOpenState = useCallback((isOpen: boolean) => {
        setIsPopperOpen(isOpen);
    }, []);

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

    const rangeValue = isRange && Array.isArray(dateValue) && dateValue.length > 0 ? {
        from: dateValue[0],
        to: dateValue.length > 1 ? dateValue[1] : undefined,
    } : undefined;

    const datePickerProps = isRange ? {
        mode: 'range' as const,
        selected: rangeValue,
        defaultMonth: rangeValue?.from,
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
