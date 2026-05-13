// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createMemoryHistory} from 'history';
import React from 'react';

import {Preferences} from 'mattermost-redux/constants';
import {getPreferenceKey} from 'mattermost-redux/utils/preference_utils';

import {act, renderWithContext, waitFor} from 'tests/react_testing_utils';
import {applyTheme} from 'utils/utils';

import {WithUserTheme} from './theme_context';
import ThemeProvider from './theme_provider';

jest.mock('utils/utils', () => ({
    applyTheme: jest.fn(),
}));

describe('ThemeProvider', () => {
    afterEach(() => {
        jest.clearAllMocks();
        document.body.classList.remove('app__body');
    });

    it('reapplies the current theme when the route changes', async () => {
        const history = createMemoryHistory({initialEntries: ['/team/channels/town-square']});

        renderWithContext(
            <ThemeProvider>
                <div>{'Themed content'}</div>
            </ThemeProvider>,
            {},
            {history},
        );

        await waitFor(() => {
            expect(applyTheme).toHaveBeenCalledTimes(1);
        });
        expect(applyTheme).toHaveBeenLastCalledWith(Preferences.THEMES.denim);

        act(() => {
            history.push('/playbooks/start');
        });

        await waitFor(() => {
            expect(applyTheme).toHaveBeenCalledTimes(2);
        });
        expect(applyTheme).toHaveBeenLastCalledWith(Preferences.THEMES.denim);
    });

    it('reapplies the selected user theme when the route changes', async () => {
        const history = createMemoryHistory({initialEntries: ['/team/channels/town-square']});

        renderWithContext(
            <ThemeProvider>
                <WithUserTheme>
                    <div>{'Themed content'}</div>
                </WithUserTheme>
            </ThemeProvider>,
            {
                entities: {
                    preferences: {
                        myPreferences: {
                            [getPreferenceKey(Preferences.CATEGORY_THEME, '')]: {
                                category: Preferences.CATEGORY_THEME,
                                name: '',
                                value: JSON.stringify(Preferences.THEMES.indigo),
                            },
                        },
                    },
                },
            },
            {history},
        );

        await waitFor(() => {
            expect(applyTheme).toHaveBeenLastCalledWith(Preferences.THEMES.indigo);
        });
        const callsBeforeNavigation = (applyTheme as jest.Mock).mock.calls.length;

        act(() => {
            history.push('/playbooks/start');
        });

        await waitFor(() => {
            expect(applyTheme).toHaveBeenCalledTimes(callsBeforeNavigation + 1);
        });
        expect(applyTheme).toHaveBeenLastCalledWith(Preferences.THEMES.indigo);
    });

    it('keeps the user theme active until all themed children unmount', async () => {
        const ThemedChildren = ({count}: {count: number}) => (
            <ThemeProvider>
                {Array.from({length: count}, (_, index) => (
                    <WithUserTheme key={index}>
                        <div>{'Themed content'}</div>
                    </WithUserTheme>
                ))}
            </ThemeProvider>
        );

        const {rerender} = renderWithContext(
            <ThemedChildren count={2}/>,
            {
                entities: {
                    preferences: {
                        myPreferences: {
                            [getPreferenceKey(Preferences.CATEGORY_THEME, '')]: {
                                category: Preferences.CATEGORY_THEME,
                                name: '',
                                value: JSON.stringify(Preferences.THEMES.indigo),
                            },
                        },
                    },
                },
            },
        );

        await waitFor(() => {
            expect(applyTheme).toHaveBeenLastCalledWith(Preferences.THEMES.indigo);
        });

        rerender(<ThemedChildren count={1}/>);

        await waitFor(() => {
            expect(applyTheme).toHaveBeenLastCalledWith(Preferences.THEMES.indigo);
        });

        rerender(<ThemedChildren count={0}/>);

        await waitFor(() => {
            expect(applyTheme).toHaveBeenLastCalledWith(Preferences.THEMES.denim);
        });
    });
});
