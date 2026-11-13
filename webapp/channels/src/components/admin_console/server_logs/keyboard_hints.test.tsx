// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import KeyboardHints from './keyboard_hints';

describe('components/admin_console/server_logs/KeyboardHints', () => {
    test('should list each shortcut next to its keys', () => {
        renderWithContext(<KeyboardHints/>);

        const rows = Array.from(document.querySelectorAll('.LogKeyboardHints__row')).map((row) => ({
            keys: Array.from(row.querySelectorAll('.shortcut-key')).map((key) => key.textContent),
            description: row.lastChild?.textContent,
        }));

        expect(screen.getByText('Keyboard shortcuts')).toBeInTheDocument();
        expect(rows).toEqual([
            {keys: ['↑', '↓'], description: 'Move between entries'},
            {keys: ['Enter'], description: 'Expand entry'},
            {keys: ['Esc'], description: 'Collapse entry'},
            {keys: ['/'], description: 'Search'},
        ]);
    });
});
