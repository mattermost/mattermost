// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {render, screen} from 'tests/react_testing_utils';

import {ShortcutKey, ShortcutKeyVariant} from './shortcut_key';

describe('components/ShortcutKey', () => {
    test('should render regular key', () => {
        render(<ShortcutKey>{'Shift'}</ShortcutKey>);

        // Test that the key text is visible to users
        expect(screen.getByText('Shift')).toBeInTheDocument();
    });

    test('should render contrast key variant', () => {
        render(
            <ShortcutKey variant={ShortcutKeyVariant.Contrast}>
                {'Ctrl'}
            </ShortcutKey>,
        );

        // Test that the key text is visible to users
        expect(screen.getByText('Ctrl')).toBeInTheDocument();
    });

    test('should render multiple shortcut keys', () => {
        render(
            <div>
                <ShortcutKey>{'Ctrl'}</ShortcutKey>
                <span>{' + '}</span>
                <ShortcutKey>{'S'}</ShortcutKey>
            </div>,
        );

        // Verify both shortcut keys are visible to users
        expect(screen.getByText('Ctrl')).toBeInTheDocument();
        expect(screen.getByText('S')).toBeInTheDocument();
        expect(screen.getByText('+')).toBeInTheDocument();
    });
});
