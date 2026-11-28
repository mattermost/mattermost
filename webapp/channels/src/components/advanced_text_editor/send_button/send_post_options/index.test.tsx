// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DateTime} from 'luxon';
import type {ComponentProps} from 'react';
import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {getPreferenceKey} from 'mattermost-redux/utils/preference_utils';

import ModalController from 'components/modal_controller';

import {act, fireEvent, renderWithContext, screen} from 'tests/react_testing_utils';
import {scheduledPosts, WindowSizes} from 'utils/constants';

import type {GlobalState} from 'types/store';

import {SendPostOptions} from './index';

const userTimezone = 'America/New_York';

// A Wednesday, so that "Tomorrow at 9:00 AM" is always the first preset option
const now = DateTime.fromISO('2024-11-06T10:00:00', {zone: userTimezone});
const tomorrowAt9am = DateTime.fromISO('2024-11-07T09:00:00', {zone: userTimezone}).toMillis();
const recentlyUsedCustomTime = DateTime.fromISO('2024-11-13T14:30:00', {zone: userTimezone}).toMillis();

const baseState: DeepPartial<GlobalState> = {
    entities: {
        general: {
            config: {
                ScheduledPosts: 'true',
            },
            license: {
                IsLicensed: 'true',
            },
        },
        users: {
            currentUserId: 'currentUserId',
            profiles: {
                currentUserId: {
                    id: 'currentUserId',
                    timezone: {
                        useAutomaticTimezone: 'false',
                        automaticTimezone: '',
                        manualTimezone: userTimezone,
                    },
                },
            },
        },
        channels: {
            channels: {
                channelId: {
                    id: 'channelId',
                    type: 'O',
                },
            },
        },
        preferences: {
            myPreferences: {},
        },
    },
};

function stateForView(windowSize: string, myPreferences = {}): DeepPartial<GlobalState> {
    return {
        ...baseState,
        entities: {
            ...baseState.entities,
            preferences: {myPreferences},
        },
        views: {
            browser: {
                windowSize,
            },
        },
    };
}

function menuModal() {
    return document.querySelector('.modal-dialog.menuModal');
}

describe('SendPostOptions', () => {
    const onSelect = jest.fn();

    beforeEach(() => {
        onSelect.mockReset();

        jest.useFakeTimers();
        jest.setSystemTime(now.toJSDate());
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    function renderComponent(
        state: DeepPartial<GlobalState>,
        props: Partial<ComponentProps<typeof SendPostOptions>> = {},
    ) {
        return renderWithContext(
            <>
                <SendPostOptions
                    channelId='channelId'
                    onSelect={onSelect}
                    {...props}
                />
                <ModalController/>
            </>,
            state,
        );
    }

    function openMenu() {
        // fireEvent instead of userEvent because userEvent doesn't work well with fake timers
        fireEvent.click(screen.getByRole('button', {name: 'Schedule message'}));
    }

    // Only the modal relies on the click reaching the list that wraps the menu items
    function expectMenuOpenedAsModal(rendersAsModal: boolean) {
        if (rendersAsModal) {
            expect(menuModal()).toBeVisible();
        } else {
            expect(menuModal()).toBeNull();
        }
    }

    // Flush the menu's close animation so deferred click handlers run in desktop view
    function runPendingTimers() {
        act(() => {
            jest.runOnlyPendingTimers();
        });
    }

    describe.each([
        ['mobile view', WindowSizes.MOBILE_VIEW, true],
        ['desktop view', WindowSizes.DESKTOP_VIEW, false],
    ])('%s', (_name, windowSize, rendersAsModal) => {
        it('schedules the message once and closes the menu when a preset time is selected', () => {
            renderComponent(stateForView(windowSize));

            openMenu();
            expectMenuOpenedAsModal(rendersAsModal);
            expect(screen.getByTestId('send_post_options.menu.tomorrow_9_am--menuitem')).toBeVisible();

            fireEvent.click(screen.getByTestId('send_post_options.menu.tomorrow_9_am--menuitem'));
            runPendingTimers();

            expect(onSelect).toHaveBeenCalledTimes(1);
            expect(onSelect).toHaveBeenCalledWith({scheduled_at: tomorrowAt9am});

            // A menu left open lets the same draft be scheduled repeatedly
            expect(screen.queryByTestId('send_post_options.menu.tomorrow_9_am--menuitem')).not.toBeInTheDocument();
        });

        it('schedules the message once and closes the menu when the recently used custom time is selected', () => {
            const myPreferences = {
                [getPreferenceKey(scheduledPosts.SCHEDULED_POSTS, scheduledPosts.RECENTLY_USED_CUSTOM_TIME)]: {
                    value: JSON.stringify({
                        update_at: now.minus({days: 1}).toMillis(),
                        timestamp: recentlyUsedCustomTime,
                    }),
                },
            };

            renderComponent(stateForView(windowSize, myPreferences));

            openMenu();
            expectMenuOpenedAsModal(rendersAsModal);

            fireEvent.click(screen.getByTestId('send_post_options.menu.recently_used_custom_time--menuitem'));
            runPendingTimers();

            expect(onSelect).toHaveBeenCalledTimes(1);
            expect(onSelect).toHaveBeenCalledWith({scheduled_at: recentlyUsedCustomTime});
            expect(screen.queryByTestId('send_post_options.menu.recently_used_custom_time--menuitem')).not.toBeInTheDocument();
        });

        it('closes the menu and opens the custom time modal when choosing a custom time', () => {
            renderComponent(stateForView(windowSize));

            openMenu();
            expectMenuOpenedAsModal(rendersAsModal);

            fireEvent.click(screen.getByText('Choose a custom time'));
            runPendingTimers();

            expect(screen.queryByText('Choose a custom time')).not.toBeInTheDocument();
            expect(menuModal()).toBeNull();
            expect(screen.getByRole('heading', {name: 'Schedule message'})).toBeVisible();
            expect(onSelect).not.toHaveBeenCalled();
        });
    });

    describe('custom time modal', () => {
        async function scheduleFromCustomTimeModal() {
            openMenu();
            fireEvent.click(screen.getByText('Choose a custom time'));
            runPendingTimers();

            await act(async () => {
                fireEvent.click(screen.getByRole('button', {name: 'Schedule'}));
            });
        }

        it('stays open and shows the error when scheduling fails', async () => {
            onSelect.mockResolvedValue({error: 'Invalid scheduled at time.'});
            renderComponent(stateForView(WindowSizes.DESKTOP_VIEW));

            await scheduleFromCustomTimeModal();

            expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({scheduled_at: tomorrowAt9am}));
            expect(screen.getByText('Invalid scheduled at time.')).toBeVisible();
            expect(screen.getByRole('heading', {name: 'Schedule message'})).toBeVisible();
        });

        it('closes when scheduling succeeds', async () => {
            onSelect.mockResolvedValue({});
            renderComponent(stateForView(WindowSizes.DESKTOP_VIEW));

            await scheduleFromCustomTimeModal();
            runPendingTimers();

            expect(onSelect).toHaveBeenCalledTimes(1);
            expect(screen.queryByRole('heading', {name: 'Schedule message'})).not.toBeInTheDocument();
        });
    });

    it('reopens the menu in mobile view after a message has been scheduled', () => {
        renderComponent(stateForView(WindowSizes.MOBILE_VIEW));

        openMenu();
        fireEvent.click(screen.getByTestId('send_post_options.menu.tomorrow_9_am--menuitem'));
        runPendingTimers();
        expect(onSelect).toHaveBeenCalledTimes(1);
        expect(menuModal()).toBeNull();

        openMenu();

        expect(screen.getByTestId('send_post_options.menu.tomorrow_9_am--menuitem')).toBeVisible();
    });

    it('does not open the menu while the send button is disabled', () => {
        renderComponent(stateForView(WindowSizes.MOBILE_VIEW), {disabled: true});

        expect(screen.getByRole('button', {name: 'Schedule message'})).toBeDisabled();

        openMenu();

        expect(menuModal()).toBeNull();
    });

    describe('blocked reason', () => {
        const reason = 'Messages with attributes can’t be scheduled';

        // The tooltip opens on focus of its trigger: the wrapper when there is a reason,
        // the button itself otherwise
        async function showTooltip(trigger: HTMLElement) {
            await act(async () => {
                fireEvent.focus(trigger);
            });
            runPendingTimers();
        }

        it('disables the chevron and shows the reason as its tooltip', async () => {
            renderComponent(stateForView(WindowSizes.DESKTOP_VIEW), {blockedReason: reason});

            expect(screen.getByRole('button', {name: 'Schedule message'})).toBeDisabled();

            await showTooltip(screen.getByRole('button', {name: 'Schedule message'}).parentElement!);

            expect(await screen.findByText(reason)).toBeVisible();
        });

        it('does not open the menu', () => {
            renderComponent(stateForView(WindowSizes.MOBILE_VIEW), {blockedReason: reason});

            openMenu();

            expect(menuModal()).toBeNull();
        });

        it('leaves the chevron enabled and shows the usual tooltip without a reason', async () => {
            renderComponent(stateForView(WindowSizes.DESKTOP_VIEW));

            expect(screen.getByRole('button', {name: 'Schedule message'})).toBeEnabled();

            await showTooltip(screen.getByRole('button', {name: 'Schedule message'}));

            expect(await screen.findByRole('tooltip')).toHaveTextContent('Schedule message');
            expect(screen.queryByText(reason)).not.toBeInTheDocument();
        });

        it('keeps the disabled chevron without a tooltip when only `disabled` is set', async () => {
            renderComponent(stateForView(WindowSizes.DESKTOP_VIEW), {disabled: true});

            expect(screen.getByRole('button', {name: 'Schedule message'})).toBeDisabled();

            await showTooltip(screen.getByRole('button', {name: 'Schedule message'}));

            expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
        });
    });
});
