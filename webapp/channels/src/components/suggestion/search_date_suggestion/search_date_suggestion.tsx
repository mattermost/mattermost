// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locale} from 'date-fns';
import React from 'react';
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

export default class SearchDateSuggestion extends React.PureComponent<Props> {
    private loadedLocales: Record<string, Locale> = {};

    state = {
        datePickerFocused: false,
    };

    handleDayClick = (day: Date) => {
        const dayString = new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate())).toISOString().split('T')[0];
        this.props.onClick(dayString, this.props.matchedPretext);
    };

    handleKeyDown = (e: KeyboardEvent) => {
        if (Keyboard.isKeyPressed(e, Constants.KeyCodes.DOWN) && document.activeElement?.id === 'searchBox') {
            this.setState({datePickerFocused: true});
        } else if (Keyboard.isKeyPressed(e, Constants.KeyCodes.ESCAPE)) {
            this.props.handleEscape?.();
        }
    };

    componentDidMount() {
        document.addEventListener('keydown', this.handleKeyDown);
    }

    componentWillUnmount() {
        document.removeEventListener('keydown', this.handleKeyDown);
    }

    iconLeft = () => {
        return (
            <i className='icon icon-chevron-left'/>
        );
    };

    iconRight = () => {
        return (
            <i className='icon icon-chevron-right'/>
        );
    };

    render() {
        const locale: string = this.props.locale;

        this.loadedLocales = Utils.getDatePickerLocalesForDateFns(locale, this.loadedLocales);

        return (
            <DayPicker
                onDayClick={this.handleDayClick}
                showOutsideDays={true}
                mode={'single'}
                locale={this.loadedLocales[locale]}
                initialFocus={this.state.datePickerFocused}
                onMonthChange={this.props.preventClose}
                id='searchDatePicker'
                selected={this.props.currentDate}
                components={{
                    IconRight: this.iconRight,
                    IconLeft: this.iconLeft,
                }}
            />
        );
    }
}
