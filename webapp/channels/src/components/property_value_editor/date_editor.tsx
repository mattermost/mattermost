// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locale} from 'date-fns';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {DayPicker} from 'react-day-picker';
import {useIntl} from 'react-intl';

import {getDatePickerLocalesForDateFns} from 'utils/utils';

import type {PropertyValueEditorProps} from './types';

import 'react-day-picker/dist/style.css';

// Parse an ISO YYYY-MM-DD string into a local-time Date. We split and pass
// year/month/day to the Date constructor so we avoid the UTC-vs-local timezone
// shift that `new Date('2026-04-01')` would introduce (that form is parsed as
// UTC midnight, which shows up as the previous day in negative-UTC zones).
function parseIsoDate(value: unknown): Date | undefined {
    if (typeof value !== 'string' || value === '') {
        return undefined;
    }
    const match = (/^(\d{4})-(\d{2})-(\d{2})$/).exec(value);
    if (!match) {
        return undefined;
    }
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const date = new Date(year, month, day);
    if (Number.isNaN(date.getTime())) {
        return undefined;
    }
    return date;
}

// Format a Date as YYYY-MM-DD using its *local* year/month/day. Using
// toISOString() here would silently convert to UTC and could shift the day in
// negative-UTC zones — which is the exact bug parseIsoDate avoids.
function formatIsoDate(date: Date): string {
    const year = String(date.getFullYear()).padStart(4, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export default function DateEditor({field, value, onChange}: PropertyValueEditorProps) {
    const {locale} = useIntl();
    const [loadedLocales, setLoadedLocales] = useState<Record<string, Locale>>({});

    useEffect(() => {
        setLoadedLocales((prev) => getDatePickerLocalesForDateFns(locale, prev));
    }, [locale]);

    const selected = useMemo(() => parseIsoDate(value), [value]);

    const handleSelect = useCallback((date: Date | undefined) => {
        if (!date) {
            onChange(undefined);
            return;
        }
        onChange(formatIsoDate(date));
    }, [onChange]);

    const iconLeft = useCallback(() => <i className='icon icon-chevron-left'/>, []);
    const iconRight = useCallback(() => <i className='icon icon-chevron-right'/>, []);

    return (
        <div
            className='property-value-editor property-value-editor--date'
            data-property-field-id={field.id}
            aria-label={field.name}
        >
            <DayPicker
                mode='single'
                selected={selected}
                defaultMonth={selected}
                onSelect={handleSelect}
                locale={loadedLocales[locale]}
                components={{
                    IconLeft: iconLeft,
                    IconRight: iconRight,
                }}
            />
        </div>
    );
}
