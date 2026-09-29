// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {act, renderWithContext, screen} from 'tests/react_testing_utils';

import DateSeparator from './date_separator';

describe('components/post_view/DateSeparator', () => {
    const stateForTimezone = (manualTimezone: string) => ({
        entities: {
            general: {
                config: {},
            },
            preferences: {
                myPreferences: {},
            },
            users: {
                currentUserId: 'user1',
                profiles: {
                    user1: {
                        id: 'user1',
                        timezone: {
                            useAutomaticTimezone: 'false',
                            manualTimezone,
                            automaticTimezone: '',
                        },
                    },
                },
            },
        },
    } as any);

    const initialState = stateForTimezone('UTC');
    test('should render Timestamp inside of a BasicSeparator and pass date/value to it', () => {
        const value = new Date('Fri Jan 12 2018 20:15:13 GMT+1200 (+12)');
        renderWithContext(
            <DateSeparator
                date={value}
            />, initialState,
        );

        expect(screen.getByTestId('basicSeparator')).toBeInTheDocument();

        expect(screen.getByText('January 12, 2018')).toBeInTheDocument();
    });

    describe('when the local day changes while the separator stays mounted', () => {
        beforeEach(() => {
            jest.useFakeTimers();
            jest.setSystemTime(new Date('2019-05-03T23:59:50Z'));
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        test('should relabel a Today separator as Yesterday without remounting', () => {
            renderWithContext(
                <DateSeparator
                    date={new Date('2019-05-03T20:00:00Z')}
                />, initialState,
            );

            expect(screen.getByText('Today')).toBeInTheDocument();

            act(() => {
                jest.advanceTimersByTime(11 * 1000);
            });

            expect(screen.getByText('Yesterday')).toBeInTheDocument();
            expect(screen.queryByText('Today')).not.toBeInTheDocument();
        });

        test('should show a single Today separator once a post is added after midnight', () => {
            const beforeMidnight = new Date('2019-05-03T20:00:00Z');
            const afterMidnight = new Date('2019-05-04T00:00:30Z');

            // Keyed by date, the same way the post list keys its separators.
            const {rerender} = renderWithContext(
                <>
                    <DateSeparator
                        key={beforeMidnight.getTime()}
                        date={beforeMidnight}
                    />
                </>, initialState,
            );

            expect(screen.getByText('Today')).toBeInTheDocument();

            act(() => {
                jest.advanceTimersByTime(40 * 1000);
            });

            rerender(
                <>
                    <DateSeparator
                        key={afterMidnight.getTime()}
                        date={afterMidnight}
                    />
                    <DateSeparator
                        key={beforeMidnight.getTime()}
                        date={beforeMidnight}
                    />
                </>,
            );

            expect(screen.getAllByText('Today')).toHaveLength(1);
            expect(screen.getByText('Yesterday')).toBeInTheDocument();
        });

        test('should roll over at midnight in the timezone the user selected', () => {
            renderWithContext(
                <DateSeparator
                    date={new Date('2019-05-03T20:00:00Z')}
                />, stateForTimezone('Asia/Tokyo'),
            );

            expect(screen.getByText('Today')).toBeInTheDocument();

            // Midnight passes in UTC, but it is still the same day in Tokyo.
            act(() => {
                jest.advanceTimersByTime(11 * 1000);
            });

            expect(screen.getByText('Today')).toBeInTheDocument();

            // Midnight in Tokyo.
            act(() => {
                jest.advanceTimersByTime(15 * 60 * 60 * 1000);
            });

            expect(screen.getByText('Yesterday')).toBeInTheDocument();
        });
    });
});
