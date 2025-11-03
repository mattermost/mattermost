// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';
import {useIntl} from 'react-intl';

import type {AppField} from '@mattermost/types/apps';

import DatePicker from 'components/date_picker/date_picker';

import {stringToDate, dateToString, parseDisabledDays, resolveRelativeDate} from 'utils/date_utils';

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

    const dateValue = useMemo(() => {
        if (field.is_range && Array.isArray(value)) {
            return value.map((val) => stringToDate(val)).filter((d): d is Date => d !== null);
        }
        return stringToDate(value as string);
    }, [value, field.is_range]);

    const displayValue = useMemo(() => {
        if (!dateValue) {
            return '';
        }

        if (field.is_range && Array.isArray(dateValue)) {
            if (dateValue.length === 0) {
                return '';
            }
            if (dateValue.length === 1) {
                // Only start date selected
                try {
                    const val0 = dateValue[0];
                    if (!val0) {
                        return '';
                    }
                    const startDate = new Intl.DateTimeFormat(intl.locale, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                    }).format(val0);
                    return `${startDate} - ...`;
                } catch {
                    return '';
                }
            }

            try {
                const startDate = dateValue[0];
                const endDate = dateValue[1];
                if (!startDate || !endDate) {
                    return '';
                }
                if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                    return '';
                }
                const formatter = new Intl.DateTimeFormat(intl.locale, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                });
                return `${formatter.format(startDate)} - ${formatter.format(endDate)}`;
            } catch {
                return '';
            }
        }

        // Single date mode
        if (Array.isArray(dateValue)) {
            return '';
        }

        try {
            return new Intl.DateTimeFormat(intl.locale, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
            }).format(dateValue);
        } catch {
            return '';
        }
    }, [dateValue, intl.locale]);

    const handleDayClick = useCallback((day: Date) => {
        // Intercept clicks on the start date when we have a complete range
        // react-day-picker ignores these clicks, but we want to allow collapsing to single day
        if (!field.is_range || !Array.isArray(dateValue) || dateValue.length < 2) {
            return; // Let onSelect handle it
        }

        const existingFrom = dateValue[0];
        const existingTo = dateValue[1];

        if (!existingFrom || !existingTo) {
            return;
        }

        // Check if clicking on the start date (which react-day-picker would ignore)
        const dayYear = day.getFullYear();
        const dayMonth = day.getMonth();
        const dayDay = day.getDate();

        const fromYear = existingFrom.getFullYear();
        const fromMonth = existingFrom.getMonth();
        const fromDay = existingFrom.getDate();

        // If clicking on start date
        if (dayYear === fromYear && dayMonth === fromMonth && dayDay === fromDay) {
            if (field.allow_single_day_range) {
                // Collapse to single day range
                const rangeValues = [dateToString(day), dateToString(day)].filter((v): v is string => Boolean(v));
                onChange(field.name, rangeValues);
                setIsPopperOpen(false);
            }
            // If allow_single_day_range is false, do nothing (keep ignoring the click)
        }
    }, [field.is_range, field.allow_single_day_range, field.name, dateValue, onChange]);

    const handleDateChange = useCallback((date: Date | {from?: Date; to?: Date} | undefined) => {
        if (!date) {
            return;
        }

        if (field.is_range && typeof date === 'object' && 'from' in date) {
            // Handle date range selection (DateRange object)
            if (!date.from) {
                return;
            }

            const rangeDates = [date.from];

            // Validate range.to based on allow_single_day_range
            if (date.to) {
                // Check if allow_single_day_range is false and dates are the same day
                if (!field.allow_single_day_range) {
                    const fromYear = date.from.getFullYear();
                    const fromMonth = date.from.getMonth();
                    const fromDay = date.from.getDate();

                    const toYear = date.to.getFullYear();
                    const toMonth = date.to.getMonth();
                    const toDay = date.to.getDate();

                    // If same day and not allowed, ignore the 'to' value (keep range incomplete)
                    if (fromYear === toYear && fromMonth === toMonth && fromDay === toDay) {
                        // Don't add date.to - leave range incomplete
                    } else {
                        rangeDates.push(date.to);
                    }
                } else {
                    // allow_single_day_range is true or not set - allow same day
                    rangeDates.push(date.to);
                }
            }

            const rangeValues = rangeDates.map((d) => dateToString(d)).filter((v): v is string => Boolean(v));
            onChange(field.name, rangeValues);

            // Close popper when both dates are selected
            if (rangeDates.length === 2) {
                setIsPopperOpen(false);
            }
        } else if (date instanceof Date) {
            // Handle single date selection
            const newValue = dateToString(date);
            onChange(field.name, newValue);
            setIsPopperOpen(false);
        }
    }, [field.name, field.is_range, field.allow_single_day_range, onChange]);

    const handlePopperOpenState = useCallback((isOpen: boolean) => {
        setIsPopperOpen(isOpen);
    }, []);

    const disabledDays = useMemo(() => {
        console.log('apps_form_date_field - field:', field.name, 'disabled_days:', field.disabled_days, 'min_date:', field.min_date, 'max_date:', field.max_date);
        const disabled = [];

        // For date ranges with allow_single_day_range = false, disable the start date when selecting end
        if (field.is_range && !field.allow_single_day_range && Array.isArray(dateValue) && dateValue.length > 0 && dateValue[0]) {
            const startDate = dateValue[0];
            const startYear = startDate.getFullYear();
            const startMonth = startDate.getMonth();
            const startDay = startDate.getDate();

            // Disable everything before and including the start date
            const dayAfterStart = new Date(startYear, startMonth, startDay + 1);
            disabled.push({before: dayAfterStart});
        }

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

        console.log('apps_form_date_field - final disabled array:', disabled);
        return disabled.length > 0 ? disabled : undefined;
    }, [field.is_range, field.allow_single_day_range, field.min_date, field.max_date, field.disabled_days, dateValue]);

    const placeholder = field.hint || intl.formatMessage({
        id: 'apps_form.date_field.placeholder',
        defaultMessage: 'Select a date',
    });

    const calendarIcon = (
        <i className='icon-calendar-outline'/>
    );

    // Prepare props for different modes
    const datePickerProps = useMemo(() => {
        if (field.is_range) {
            // Range mode
            const rangeSelection = Array.isArray(dateValue) && dateValue.length > 0 && dateValue[0] ? {
                from: dateValue[0],
                to: (dateValue.length > 1 && dateValue[1]) ? dateValue[1] : undefined,
            } : undefined;

            return {
                mode: 'range' as const,
                selected: rangeSelection,
                defaultMonth: rangeSelection?.from || undefined,
                onSelect: handleDateChange,
                onDayClick: handleDayClick,
                disabled: field.readonly ? true : disabledDays,
            };
        }

        // Single mode
        const singleDate = Array.isArray(dateValue) ? null : dateValue;
        return {
            mode: 'single' as const,
            selected: singleDate || undefined,
            defaultMonth: singleDate || undefined,
            onSelect: handleDateChange,
            disabled: field.readonly ? true : disabledDays,
        };
    }, [field.is_range, dateValue, handleDateChange, handleDayClick, field.readonly, disabledDays]);

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
