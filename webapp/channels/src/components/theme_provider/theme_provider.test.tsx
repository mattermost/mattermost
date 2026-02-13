// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Preferences} from 'mattermost-redux/constants';
import {setThemeDefaults} from 'mattermost-redux/utils/theme_utils';

import matchMedia from 'tests/helpers/match_media.mock';
import {renderWithContext} from 'tests/react_testing_utils';

import type {DeepPartial} from '@mattermost/types/utilities';
import type {GlobalState} from 'types/store';

import {useUserTheme} from './theme_context';
import ThemeProvider from './theme_provider';

jest.mock('utils/utils', () => ({
    applyTheme: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {applyTheme} = require('utils/utils');

// A child component that calls useUserTheme() to trigger startUsingUserTheme
function ThemedChild() {
    useUserTheme();
    return <div>{'themed'}</div>;
}

const teamId = 'team-id-1';
const teamId2 = 'team-id-2';

const darkThemeForTeam = {
    type: 'custom',
    sidebarBg: '#111111',
    centerChannelBg: '#222222',
    centerChannelColor: '#eeeeee',
};

const darkThemeDefault = {
    type: 'custom',
    sidebarBg: '#333333',
    centerChannelBg: '#444444',
    centerChannelColor: '#dddddd',
};

const userLightTheme = {
    type: 'custom',
    sidebarBg: '#aaaaaa',
    centerChannelBg: '#ffffff',
    centerChannelColor: '#333333',
};

function makeState(overrides: DeepPartial<GlobalState> = {}): DeepPartial<GlobalState> {
    return {
        entities: {
            general: {
                config: {},
                license: {},
            },
            preferences: {
                myPreferences: {},
            },
            teams: {
                currentTeamId: teamId,
                teams: {},
            },
            users: {
                currentUserId: 'user-id',
            },
            ...overrides.entities,
        },
    };
}

describe('ThemeProvider', () => {
    beforeEach(() => {
        applyTheme.mockClear();
    });

    afterEach(() => {
        matchMedia.clear();
    });

    test('applies default denim theme when no child calls startUsingUserTheme', () => {
        renderWithContext(
            <ThemeProvider>
                <div>{'child'}</div>
            </ThemeProvider>,
            makeState(),
        );

        expect(applyTheme).toHaveBeenCalledWith(Preferences.THEMES.denim);
    });

    test('applies user theme from Redux when a child calls startUsingUserTheme', () => {
        const state = makeState({
            entities: {
                preferences: {
                    myPreferences: {
                        [`theme--${teamId}`]: {
                            category: 'theme',
                            name: teamId,
                            user_id: 'user-id',
                            value: JSON.stringify(userLightTheme),
                        },
                    },
                },
            },
        });

        renderWithContext(
            <ThemeProvider>
                <ThemedChild/>
            </ThemeProvider>,
            state,
        );

        // First call is the default theme before useUserTheme fires,
        // second call is after the user theme is applied
        const lastCall = applyTheme.mock.calls[applyTheme.mock.calls.length - 1][0];
        expect(lastCall).toEqual(setThemeDefaults(userLightTheme));
    });

    test('applies team-specific dark theme when auto-switch is on and system is dark', () => {
        matchMedia.useMediaQuery('(prefers-color-scheme: dark)');

        const state = makeState({
            entities: {
                preferences: {
                    myPreferences: {
                        'display_settings--theme_auto_switch': {
                            category: 'display_settings',
                            name: 'theme_auto_switch',
                            user_id: 'user-id',
                            value: 'true',
                        },
                        [`theme_dark--${teamId}`]: {
                            category: 'theme_dark',
                            name: teamId,
                            user_id: 'user-id',
                            value: JSON.stringify(darkThemeForTeam),
                        },
                    },
                },
            },
        });

        renderWithContext(
            <ThemeProvider>
                <ThemedChild/>
            </ThemeProvider>,
            state,
        );

        const lastCall = applyTheme.mock.calls[applyTheme.mock.calls.length - 1][0];
        expect(lastCall).toEqual(setThemeDefaults(darkThemeForTeam));
    });

    test('falls back to default dark theme when no team-specific dark theme exists', () => {
        matchMedia.useMediaQuery('(prefers-color-scheme: dark)');

        const state = makeState({
            entities: {
                preferences: {
                    myPreferences: {
                        'display_settings--theme_auto_switch': {
                            category: 'display_settings',
                            name: 'theme_auto_switch',
                            user_id: 'user-id',
                            value: 'true',
                        },
                        'theme_dark--': {
                            category: 'theme_dark',
                            name: '',
                            user_id: 'user-id',
                            value: JSON.stringify(darkThemeDefault),
                        },
                    },
                },
            },
        });

        renderWithContext(
            <ThemeProvider>
                <ThemedChild/>
            </ThemeProvider>,
            state,
        );

        const lastCall = applyTheme.mock.calls[applyTheme.mock.calls.length - 1][0];
        expect(lastCall).toEqual(setThemeDefaults(darkThemeDefault));
    });

    test('falls back to regular light theme when no dark theme is configured at all', () => {
        matchMedia.useMediaQuery('(prefers-color-scheme: dark)');

        const state = makeState({
            entities: {
                preferences: {
                    myPreferences: {
                        'display_settings--theme_auto_switch': {
                            category: 'display_settings',
                            name: 'theme_auto_switch',
                            user_id: 'user-id',
                            value: 'true',
                        },
                        [`theme--${teamId}`]: {
                            category: 'theme',
                            name: teamId,
                            user_id: 'user-id',
                            value: JSON.stringify(userLightTheme),
                        },
                    },
                },
            },
        });

        renderWithContext(
            <ThemeProvider>
                <ThemedChild/>
            </ThemeProvider>,
            state,
        );

        const lastCall = applyTheme.mock.calls[applyTheme.mock.calls.length - 1][0];
        expect(lastCall).toEqual(setThemeDefaults(userLightTheme));
    });

    test('applies regular light theme when auto-switch is on but system is in light mode', () => {
        // Light mode is the default — no matchMedia.useMediaQuery call needed

        const state = makeState({
            entities: {
                preferences: {
                    myPreferences: {
                        'display_settings--theme_auto_switch': {
                            category: 'display_settings',
                            name: 'theme_auto_switch',
                            user_id: 'user-id',
                            value: 'true',
                        },
                        [`theme_dark--${teamId}`]: {
                            category: 'theme_dark',
                            name: teamId,
                            user_id: 'user-id',
                            value: JSON.stringify(darkThemeForTeam),
                        },
                        [`theme--${teamId}`]: {
                            category: 'theme',
                            name: teamId,
                            user_id: 'user-id',
                            value: JSON.stringify(userLightTheme),
                        },
                    },
                },
            },
        });

        renderWithContext(
            <ThemeProvider>
                <ThemedChild/>
            </ThemeProvider>,
            state,
        );

        const lastCall = applyTheme.mock.calls[applyTheme.mock.calls.length - 1][0];
        expect(lastCall).toEqual(setThemeDefaults(userLightTheme));
    });

    test('applies the new team dark theme when currentTeamId changes', () => {
        matchMedia.useMediaQuery('(prefers-color-scheme: dark)');

        const darkThemeForTeam2 = {
            type: 'custom',
            sidebarBg: '#555555',
            centerChannelBg: '#666666',
            centerChannelColor: '#cccccc',
        };

        const state = makeState({
            entities: {
                preferences: {
                    myPreferences: {
                        'display_settings--theme_auto_switch': {
                            category: 'display_settings',
                            name: 'theme_auto_switch',
                            user_id: 'user-id',
                            value: 'true',
                        },
                        [`theme_dark--${teamId}`]: {
                            category: 'theme_dark',
                            name: teamId,
                            user_id: 'user-id',
                            value: JSON.stringify(darkThemeForTeam),
                        },
                        [`theme_dark--${teamId2}`]: {
                            category: 'theme_dark',
                            name: teamId2,
                            user_id: 'user-id',
                            value: JSON.stringify(darkThemeForTeam2),
                        },
                    },
                },
            },
        });

        const {updateStoreState} = renderWithContext(
            <ThemeProvider>
                <ThemedChild/>
            </ThemeProvider>,
            state,
        );

        // Verify initial team dark theme
        let lastCall = applyTheme.mock.calls[applyTheme.mock.calls.length - 1][0];
        expect(lastCall).toEqual(setThemeDefaults(darkThemeForTeam));

        // Switch to team2
        applyTheme.mockClear();
        updateStoreState({
            entities: {
                teams: {
                    currentTeamId: teamId2,
                },
            },
        });

        lastCall = applyTheme.mock.calls[applyTheme.mock.calls.length - 1][0];
        expect(lastCall).toEqual(setThemeDefaults(darkThemeForTeam2));
    });
});
