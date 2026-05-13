// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createMemoryHistory} from 'history';
import React from 'react';

import {Preferences} from 'mattermost-redux/constants';

import {act, renderWithContext, waitFor} from 'tests/react_testing_utils';
import {applyTheme} from 'utils/utils';

import ThemeProvider from './theme_provider';

jest.mock('utils/utils', () => ({
    applyTheme: jest.fn(),
}));

describe('ThemeProvider', () => {
    afterEach(() => {
        jest.clearAllMocks();
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
});
