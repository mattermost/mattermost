// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {TimestampFormat} from '@mattermost/types/config';
import type {DeepPartial} from '@mattermost/types/utilities';

import {act, renderWithContext, screen} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

import Timestamp from './index';

const NOW = new Date('2020-06-15T16:32:00.000Z');

function stateFor(format: TimestampFormat, showSeconds = false): DeepPartial<GlobalState> {
    return {
        entities: {
            general: {
                config: {
                    DateTimeDisplayFormat: format,
                    ShowTimestampSeconds: showSeconds ? 'true' : 'false',
                },
            },
            preferences: {
                myPreferences: {},
            },
        },
    };
}

describe('Timestamp usePreferredFormat', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(NOW);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('STANDARD', () => {
        test('post variant renders a bare clock time', () => {
            renderWithContext(
                <Timestamp
                    value={NOW}
                    timeZone='UTC'
                    usePreferredFormat={true}
                    variant='post'
                />,
                stateFor(TimestampFormat.STANDARD),
            );

            expect(screen.getByText('4:32 PM')).toBeInTheDocument();
        });

        test('metadata variant renders the date alongside the time', () => {
            renderWithContext(
                <Timestamp
                    value={NOW}
                    timeZone='UTC'
                    usePreferredFormat={true}
                />,
                stateFor(TimestampFormat.STANDARD),
            );

            expect(screen.getByText('Today at 4:32 PM')).toBeInTheDocument();
        });

        test('honours the seconds preference', () => {
            renderWithContext(
                <Timestamp
                    value={NOW}
                    timeZone='UTC'
                    usePreferredFormat={true}
                    variant='post'
                />,
                stateFor(TimestampFormat.STANDARD, true),
            );

            expect(screen.getByText('4:32:00 PM')).toBeInTheDocument();
        });
    });

    describe('DATE_AND_TIME', () => {
        test.each([
            ['2020-06-15T16:32:00.000Z', 'Today at 4:32 PM'],
            ['2020-06-14T16:32:00.000Z', 'Yesterday at 4:32 PM'],
            ['2020-06-01T16:32:00.000Z', 'Jun 1, 4:32 PM'],
            ['2019-06-01T16:32:00.000Z', 'Jun 1, 2019, 4:32 PM'],
        ])('renders %s as "%s"', (value, expected) => {
            renderWithContext(
                <Timestamp
                    value={new Date(value)}
                    timeZone='UTC'
                    usePreferredFormat={true}
                />,
                stateFor(TimestampFormat.DATE_AND_TIME),
            );

            expect(screen.getByText(expected)).toBeInTheDocument();
        });

        test.each([
            ['ja', '2019年6月1日 午後4:32'],
            ['de', '1. Juni 2019, 4:32 PM'],
        ])('takes the date/time separator from the %s locale', (locale, expected) => {
            // The separator is locale data, not a string we pick: ja-JP uses a space where
            // en-US uses a comma, so joining with a translated "{date}, {time}" would be
            // wrong in Japanese no matter how it was translated.
            renderWithContext(
                <Timestamp
                    value={new Date('2019-06-01T16:32:00.000Z')}
                    timeZone='UTC'
                    usePreferredFormat={true}
                />,
                stateFor(TimestampFormat.DATE_AND_TIME),
                {locale},
            );

            expect(screen.getByText(expected)).toBeInTheDocument();
        });

        test('compact variant collapses to a bare clock time', () => {
            renderWithContext(
                <Timestamp
                    value={new Date('2020-06-01T16:32:00.000Z')}
                    timeZone='UTC'
                    usePreferredFormat={true}
                    variant='compact'
                />,
                stateFor(TimestampFormat.DATE_AND_TIME),
            );

            expect(screen.getByText('4:32 PM')).toBeInTheDocument();
        });
    });

    describe('RELATIVE', () => {
        test('renders relative wording instead of a clock time', () => {
            renderWithContext(
                <Timestamp
                    value={new Date('2020-06-15T13:32:00.000Z')}
                    timeZone='UTC'
                    usePreferredFormat={true}
                />,
                stateFor(TimestampFormat.RELATIVE),
            );

            expect(screen.getByText('3 hours ago')).toBeInTheDocument();
        });

        test('advances as time passes without a prop change', () => {
            // Regression guard: formatting relative time to a static string leaves
            // "just now" frozen on screen until an unrelated re-render.
            renderWithContext(
                <Timestamp
                    value={NOW}
                    timeZone='UTC'
                    usePreferredFormat={true}
                />,
                stateFor(TimestampFormat.RELATIVE),
            );

            expect(screen.getByText('just now')).toBeInTheDocument();

            // Each flush lets one refresh timer fire, so step through a few.
            for (let i = 0; i < 3; i++) {
                act(() => {
                    jest.advanceTimersByTime(60 * 1000);
                });
            }

            expect(screen.queryByText('just now')).not.toBeInTheDocument();
            expect(screen.getByText(/minutes? ago/)).toBeInTheDocument();
        });
    });

    test('an explicitly passed format prop wins over the derived one', () => {
        renderWithContext(
            <Timestamp
                value={NOW}
                timeZone='UTC'
                usePreferredFormat={true}
                useTime={{hour: '2-digit', minute: '2-digit'}}
            />,
            stateFor(TimestampFormat.DATE_AND_TIME),
        );

        // useTime is the caller's; the date half still comes from the preference.
        expect(screen.getByText('Today at 04:32 PM')).toBeInTheDocument();
    });

    test('does not apply the preference unless opted in', () => {
        renderWithContext(
            <Timestamp
                value={NOW}
                timeZone='UTC'
                useDate={false}
            />,
            stateFor(TimestampFormat.RELATIVE),
        );

        expect(screen.queryByText('just now')).not.toBeInTheDocument();
    });
});
