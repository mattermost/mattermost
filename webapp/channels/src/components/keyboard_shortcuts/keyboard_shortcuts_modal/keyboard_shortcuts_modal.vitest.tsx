// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import KeyboardShortcutsModal from 'components/keyboard_shortcuts/keyboard_shortcuts_modal/keyboard_shortcuts_modal';

import {renderWithContext} from 'tests/vitest_react_testing_utils';
import {suitePluginIds} from 'utils/constants';

describe('components/KeyboardShortcutsModal', () => {
    const initialState = {
        plugins: {
            plugins: {},
        },
    };

    test('should match snapshot modal', async () => {
        const {container} = renderWithContext(
            <KeyboardShortcutsModal onExited={vi.fn()}/>,
            initialState,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot modal with Calls enabled', async () => {
        const stateWithCalls = {
            ...initialState,
            plugins: {
                ...initialState.plugins,
                plugins: {
                    ...initialState.plugins.plugins,
                    [suitePluginIds.calls]: {
                        id: suitePluginIds.calls,
                        version: '0.15.0',
                    },
                },
            },
        };

        const {container} = renderWithContext(
            <KeyboardShortcutsModal onExited={vi.fn()}/>,
            stateWithCalls,
        );

        expect(container).toMatchSnapshot();
    });
});
