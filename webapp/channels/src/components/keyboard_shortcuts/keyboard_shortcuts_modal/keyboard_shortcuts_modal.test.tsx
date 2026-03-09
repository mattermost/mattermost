// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import KeyboardShortcutsModal from 'components/keyboard_shortcuts/keyboard_shortcuts_modal/keyboard_shortcuts_modal';

import {renderWithContext} from 'tests/react_testing_utils';
import {suitePluginIds} from 'utils/constants';

describe('components/KeyboardShortcutsModal', () => {
    const initialState = {
        plugins: {
            plugins: {},
        },
    };

    test('should match snapshot modal', () => {
        const {baseElement} = renderWithContext(
            <KeyboardShortcutsModal onExited={jest.fn()}/>,
            initialState,
        );

        expect(baseElement).toMatchSnapshot();
    });

    test('should match snapshot modal with Calls enabled', () => {
        const {baseElement} = renderWithContext(
            <KeyboardShortcutsModal onExited={jest.fn()}/>,
            {
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
            },
        );

        expect(baseElement).toMatchSnapshot();
    });
});
