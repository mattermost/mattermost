// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import {getMissingProfilesByIds} from 'mattermost-redux/actions/users';

import {renderWithContext} from 'tests/react_testing_utils';

import Avatars from './avatars';

jest.mock('mattermost-redux/actions/users', () => {
    return {
        ...jest.requireActual('mattermost-redux/actions/users'),
        getMissingProfilesByIds: jest.fn((ids) => {
            return {
                type: 'MOCK_GET_MISSING_PROFILES_BY_IDS',
                data: ids,
            };
        }),
    };
});

describe('components/widgets/users/Avatars', () => {
    const state = {
        entities: {
            general: {
                config: {},
            },
            users: {
                currentUserId: 'uid',
                profiles: {
                    1: {
                        id: '1',
                        username: 'first.last1',
                        nickname: 'nickname1',
                        first_name: 'First1',
                        last_name: 'Last1',
                        last_picture_update: 1620680333191,

                    },
                    2: {
                        id: '2',
                        username: 'first.last2',
                        nickname: 'nickname2',
                        first_name: 'First2',
                        last_name: 'Last2',
                        last_picture_update: 1620680333191,
                    },
                    3: {
                        id: '3',
                        username: 'first.last3',
                        nickname: 'nickname3',
                        first_name: 'First3',
                        last_name: 'Last3',
                        last_picture_update: 1620680333191,
                    },
                    4: {
                        id: '4',
                        username: 'first.last4',
                        nickname: 'nickname4',
                        first_name: 'First4',
                        last_name: 'Last4',
                        last_picture_update: 1620680333191,
                    },
                    5: {
                        id: '5',
                        username: 'first.last5',
                        nickname: 'nickname5',
                        first_name: 'First5',
                        last_name: 'Last5',
                        last_picture_update: 1620680333191,
                    },
                },
            },
            teams: {
                currentTeamId: 'tid',
            },
            preferences: {
                myPreferences: {},
            },
        },
    };

    beforeEach(() => {
        (getMissingProfilesByIds as jest.Mock).mockClear();
    });

    test('should support userIds', () => {
        const {container} = renderWithContext(
            <Avatars
                size='xl'
                userIds={[
                    '1',
                    '2',
                    '3',
                ]}
            />,
            state,
        );
        expect(container).toMatchSnapshot();
        expect(container.querySelector('img[src="/api/v4/users/1/image?_=1620680333191"]')).toBeInTheDocument();
        expect(container.querySelector('img[src="/api/v4/users/2/image?_=1620680333191"]')).toBeInTheDocument();
        expect(container.querySelector('img[src="/api/v4/users/3/image?_=1620680333191"]')).toBeInTheDocument();
        expect(container.querySelectorAll('img.Avatar')).toHaveLength(3);
    });

    test('should properly count overflow', () => {
        const {container} = renderWithContext(
            <Avatars
                size='xl'
                userIds={[
                    '1',
                    '2',
                    '3',
                    '4',
                    '5',
                ]}
            />,
            state,
        );

        expect(container).toMatchSnapshot();
        expect(container.querySelector('img[src="/api/v4/users/1/image?_=1620680333191"]')).toBeInTheDocument();
        expect(container.querySelector('img[src="/api/v4/users/2/image?_=1620680333191"]')).toBeInTheDocument();
        expect(container.querySelector('img[src="/api/v4/users/3/image?_=1620680333191"]')).toBeInTheDocument();
        expect(container.querySelector('img[src="/api/v4/users/4/image?_=1620680333191"]')).not.toBeInTheDocument();
        expect(container.querySelector('img[src="/api/v4/users/5/image?_=1620680333191"]')).not.toBeInTheDocument();

        // Check for +2 overflow avatar (text is rendered via data-content attribute)
        expect(container.querySelector('[data-content="+2"]')).toBeInTheDocument();
    });

    test('should not duplicate displayed users in overflow tooltip', () => {
        const {container} = renderWithContext(
            <Avatars
                size='xl'
                userIds={[
                    '1',
                    '2',
                    '3',
                    '4',
                    '5',
                ]}
            />,
            state,
        );

        // The overflow avatar should exist with +2 text
        expect(container.querySelector('[data-content="+2"]')).toBeInTheDocument();
    });

    describe('canOpenOverflow', () => {
        const overflowChip = (container: HTMLElement) => container.querySelector('[data-content="+2"]')!;

        test('does not open a list from the overflow chip when not opted in', async () => {
            const {container} = renderWithContext(
                <Avatars
                    size='xl'
                    userIds={['1', '2', '3', '4', '5']}
                />,
                state,
            );

            await userEvent.click(overflowChip(container));

            expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
        });

        test('opens a list of the overflow users when opted in', async () => {
            const {container} = renderWithContext(
                <Avatars
                    size='xl'
                    userIds={['1', '2', '3', '4', '5']}
                    canOpenOverflow={true}
                />,
                state,
            );

            await userEvent.click(overflowChip(container));

            await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2));

            // Only the overflow users, not the three already displayed.
            expect(screen.getByText('first.last4')).toBeInTheDocument();
            expect(screen.getByText('first.last5')).toBeInTheDocument();
            expect(screen.queryByText('first.last1')).not.toBeInTheDocument();
        });

        // The trigger wraps the chip, taking it out of the sibling selectors that give
        // it its overlap offset. avatars.scss re-applies them via this class.
        test('marks the trigger so the chip keeps its stack styling', () => {
            const {container} = renderWithContext(
                <Avatars
                    size='xl'
                    userIds={['1', '2', '3', '4', '5']}
                    canOpenOverflow={true}
                />,
                state,
            );

            const trigger = container.querySelector('.Avatars > .Avatars__overflowTrigger');

            expect(trigger).toBeInTheDocument();
            expect(trigger!.querySelector('[data-content="+2"]')).toBeInTheDocument();
        });

        // makeIsEligibleForClick ignores clicks under a button ancestor, which is what
        // keeps opening the list from also opening the surrounding post's thread.
        test('renders the trigger as a button so the click does not reach the post', () => {
            const {container} = renderWithContext(
                <Avatars
                    size='xl'
                    userIds={['1', '2', '3', '4', '5']}
                    canOpenOverflow={true}
                />,
                state,
            );

            const trigger = container.querySelector('.Avatars__overflowTrigger')!;

            expect(trigger.tagName).toBe('BUTTON');
            expect(trigger).toHaveAttribute('type', 'button');

            // The trigger is the tab stop; the chip inside must not be a second one.
            expect(trigger.querySelector('[data-content="+2"]')).toHaveAttribute('tabindex', '-1');
        });

        test('leaves the chip focusable when it is not a popover trigger', () => {
            const {container} = renderWithContext(
                <Avatars
                    size='xl'
                    userIds={['1', '2', '3', '4', '5']}
                />,
                state,
            );

            expect(container.querySelector('[data-content="+2"]')).toHaveAttribute('tabindex', '0');
        });

        // The popover is additive: hover still summarises the overflow.
        test('keeps the hover tooltip when opted in', async () => {
            const {container} = renderWithContext(
                <Avatars
                    size='xl'
                    userIds={['1', '2', '3', '4', '5']}
                    canOpenOverflow={true}
                />,
                state,
            );

            await userEvent.hover(overflowChip(container));

            await waitFor(() => {
                expect(screen.getByText('first.last4, first.last5')).toBeInTheDocument();
            });
        });

        // avatars.scss holds the trigger's hover lift on [aria-expanded='true'];
        // without it the trigger shrinks on mouse-out and drags the list with it.
        test('marks the trigger expanded while the list is open', async () => {
            const {container} = renderWithContext(
                <Avatars
                    size='xl'
                    userIds={['1', '2', '3', '4', '5']}
                    canOpenOverflow={true}
                />,
                state,
            );

            const trigger = container.querySelector('.Avatars__overflowTrigger')!;
            expect(trigger).toHaveAttribute('aria-expanded', 'false');

            await userEvent.click(overflowChip(container));

            await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'true'));
        });

        test('closes on Escape', async () => {
            const {container} = renderWithContext(
                <Avatars
                    size='xl'
                    userIds={['1', '2', '3', '4', '5']}
                    canOpenOverflow={true}
                />,
                state,
            );

            await userEvent.click(overflowChip(container));
            await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2));

            await userEvent.keyboard('{Escape}');

            await waitFor(() => expect(screen.queryByRole('listitem')).not.toBeInTheDocument());
        });

        // totalUsers can exceed the ids given, and those extra users cannot be listed.
        test('does not open a list when every overflow user is unnamed', async () => {
            const {container} = renderWithContext(
                <Avatars
                    size='xl'
                    userIds={['1', '2', '3']}
                    totalUsers={6}
                    canOpenOverflow={true}
                />,
                state,
            );

            await userEvent.click(container.querySelector('[data-content="+3"]')!);

            expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
        });

        test('lists the named overflow users and reports the unnamed remainder', async () => {
            const {container} = renderWithContext(
                <Avatars
                    size='xl'
                    userIds={['1', '2', '3', '4', '5']}
                    totalUsers={7}
                    canOpenOverflow={true}
                />,
                state,
            );

            await userEvent.click(container.querySelector('[data-content="+4"]')!);

            await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2));
            expect(screen.getByText('and 2 more people')).toBeInTheDocument();
        });
    });

    test('should fetch missing users', () => {
        const {container} = renderWithContext(
            <Avatars
                size='xl'
                userIds={[
                    '1',
                    '6',
                    '7',
                    '2',
                    '8',
                    '9',
                ]}
            />,
            state,
        );

        expect(container).toMatchSnapshot();
        expect(getMissingProfilesByIds).toHaveBeenCalledWith(['1', '6', '7', '2', '8', '9']);

        expect(container.querySelector('img[src="/api/v4/users/1/image?_=1620680333191"]')).toBeInTheDocument();
        expect(container.querySelector('img[src="/api/v4/users/6/image?_=0"]')).toBeInTheDocument();
        expect(container.querySelector('img[src="/api/v4/users/7/image?_=0"]')).toBeInTheDocument();
    });
});
