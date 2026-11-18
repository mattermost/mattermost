// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    useFloating,
    autoUpdate,
    offset,
    flip,
    shift,
    useInteractions,
    FloatingFocusManager,
    useDismiss,
} from '@floating-ui/react';
import type {Locale} from 'date-fns';
import React, {useCallback, useEffect, useState} from 'react';
import {DayContent, DayPicker} from 'react-day-picker';
import type {DayContentProps, DayPickerProps} from 'react-day-picker';

import {getDatePickerLocalesForDateFns} from 'utils/utils';

import 'react-day-picker/dist/style.css';
import './date_picker.scss';

// A day's key: its date as YYYY-MM-DD, which tells apart a day number the calendar shows twice (outside days).
const dayKey = (date: Date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');

type Props = {
    children: React.ReactNode;
    datePickerProps: DayPickerProps;
    isPopperOpen: boolean;
    locale: string;
    handlePopperOpenState: (isOpen: boolean) => void;
    label?: string;
    icon?: React.ReactNode;
    value?: string;

    testIdScope?: string;
};

const DatePicker = ({children, datePickerProps, isPopperOpen, handlePopperOpenState, locale, label, icon, value, testIdScope}: Props) => {
    const [loadedLocales, setLoadedLocales] = useState<Record<string, Locale>>({});
    const {x, y, strategy, context, refs: {setReference, setFloating}} = useFloating({
        open: isPopperOpen,
        onOpenChange: () => handlePopperOpenState(false),
        strategy: 'fixed',
        placement: 'bottom-start',
        whileElementsMounted: autoUpdate,
        middleware: [
            offset(5),
            flip({fallbackPlacements: ['bottom-end', 'top-start', 'top-end', 'right-start', 'left-start'], padding: 5}),
            shift(),
        ],
    });

    const {getReferenceProps, getFloatingProps} = useInteractions([
        useDismiss(context, {
            enabled: true,
            outsidePress: true,
        }),
    ]);

    useEffect(() => {
        setLoadedLocales(getDatePickerLocalesForDateFns(locale, loadedLocales));
    }, [loadedLocales, locale]);

    const iconLeft = useCallback(() => {
        return (
            <i
                className='icon icon-chevron-left'
                data-testid={testIdScope ? `${testIdScope}.calendar.previous_month` : undefined}
            />
        );
    }, [testIdScope]);

    const iconRight = useCallback(() => {
        return (
            <i
                className='icon icon-chevron-right'
                data-testid={testIdScope ? `${testIdScope}.calendar.next_month` : undefined}
            />
        );
    }, [testIdScope]);

    // The library's own day label in an element keyed by the day's date (an outside day repeats a day number).
    const dayContent = useCallback((props: DayContentProps) => {
        return (
            <span data-testid={testIdScope ? `${testIdScope}.calendar.day:${dayKey(props.date)}--text` : undefined}>
                <DayContent {...props}/>
            </span>
        );
    }, [testIdScope]);

    const handleWrapperClick = useCallback((e: React.MouseEvent) => {
        // Prevent click from bubbling up to parent elements
        e.stopPropagation();

        // Open the popper when clicking anywhere in the wrapper
        handlePopperOpenState(true);
    }, [handlePopperOpenState]);

    return (
        <div className='date-picker__wrapper'>
            <div
                ref={setReference}
                {...getReferenceProps()}
                onClick={handleWrapperClick}
                className={isPopperOpen ? 'date-time-input date-time-input--open' : 'date-time-input'}
                role='button'
                data-testid={testIdScope ? `${testIdScope}.date--button` : undefined}
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handlePopperOpenState(true);
                    }
                }}
            >
                {label && <span className='date-time-input__label'>{label}</span>}
                {icon && <span className='date-time-input__icon'>{icon}</span>}
                {value && <span className='date-time-input__value'>{value}</span>}
                {!value && children}
            </div>
            {isPopperOpen && (
                <FloatingFocusManager
                    context={context}
                    modal={true}
                    initialFocus={-1}
                >
                    <div
                        data-testid={testIdScope ? `${testIdScope}.calendar` : 'date-picker-popper'}
                        ref={setFloating}
                        style={{
                            position: strategy,
                            top: y ?? 0,
                            left: x ?? 0,
                            width: 'auto',
                            zIndex: 999,
                        }}
                        {...getFloatingProps()}
                    >
                        <DayPicker
                            {...datePickerProps}
                            className='date-picker__popper'
                            locale={loadedLocales[locale]}
                            components={{
                                IconRight: iconRight,
                                IconLeft: iconLeft,
                                DayContent: dayContent,
                            }}
                        />
                    </div>
                </FloatingFocusManager>
            )}
        </div>
    );
};

export default DatePicker;
