// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locale} from 'date-fns';
import React, {useCallback, useEffect, useState} from 'react';
import {DayPicker} from 'react-day-picker';

import Constants from 'utils/constants';
import * as Keyboard from 'utils/keyboard';
import * as Utils from 'utils/utils';

import type {SuggestionProps} from '../suggestion';

import 'react-day-picker/dist/style.css';

type Props = SuggestionProps<never> & {
    currentDate?: Date;
    handleEscape?: () => void;
    locale: string;
    preventClose?: () => void;
}

const IconLeft = () => {
    return (
        <i className='icon icon-chevron-left'/>
    );
};

const IconRight = () => {
    return (
        <i className='icon icon-chevron-right'/>
    );
};

const DAY_PICKER_ICONS = {IconRight, IconLeft};

const SearchDateSuggestion = ({
    currentDate,
    handleEscape,
    locale,
    preventClose,
    matchedPretext,
    onClick,
}: Props) => {
    let loadedLocales: Record<string, Locale> = {};
    loadedLocales = Utils.getDatePickerLocalesForDateFns(locale, loadedLocales);
    const [datePickerFocused, setDatePickerFocused] = useState(false);

    const handleDayClick = useCallback((day: Date) => {
        const dayString = new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate())).toISOString().split('T')[0];
        onClick(dayString, matchedPretext);
    }, [onClick, matchedPretext]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (Keyboard.isKeyPressed(e, Constants.KeyCodes.DOWN) && document.activeElement?.id === 'searchBox') {
                setDatePickerFocused(true);
            } else if (Keyboard.isKeyPressed(e, Constants.KeyCodes.ESCAPE)) {
                handleEscape?.();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleEscape]);

    return (
        <DayPicker
            onDayClick={handleDayClick}
            showOutsideDays={true}
            mode={'single'}
            locale={loadedLocales[locale]}
            initialFocus={datePickerFocused}
            onMonthChange={preventClose}
            id='searchDatePicker'
            selected={currentDate}
            components={DAY_PICKER_ICONS}
        />
    );
};
export default React.memo(SearchDateSuggestion);
