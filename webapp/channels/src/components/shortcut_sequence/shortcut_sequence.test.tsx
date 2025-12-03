// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {ShortcutKeyVariant} from 'components/shortcut_key';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import {ShortcutSequence, KEY_SEPARATOR} from './shortcut_sequence';

describe('ShortcutSequence', () => {
    test('should render single key from string', () => {
        renderWithContext(<ShortcutSequence keys='Ctrl'/>);

        expect(screen.getByText('Ctrl')).toBeInTheDocument();
    });

    test('should render multiple keys from pipe-separated string', () => {
        renderWithContext(<ShortcutSequence keys={`Ctrl${KEY_SEPARATOR}K`}/>);

        expect(screen.getByText('Ctrl')).toBeInTheDocument();
        expect(screen.getByText('K')).toBeInTheDocument();
    });

    test('should render keys from array of strings', () => {
        renderWithContext(<ShortcutSequence keys={['Shift', 'Enter']}/>);

        expect(screen.getByText('Shift')).toBeInTheDocument();
        expect(screen.getByText('Enter')).toBeInTheDocument();
    });

    test('should render keys from array with message descriptors', () => {
        const keys = [
            /* defineMessage */({
                id: 'test.ctrl',
                defaultMessage: 'Ctrl',
            }),
            'K',
        ];

        renderWithContext(<ShortcutSequence keys={keys}/>);

        expect(screen.getByText('Ctrl')).toBeInTheDocument();
        expect(screen.getByText('K')).toBeInTheDocument();
    });

    test('should apply tooltip variant class', () => {
        renderWithContext(
            <ShortcutSequence
                keys='K'
                variant={ShortcutKeyVariant.Tooltip}
            />,
        );

        const keyElement = screen.getByText('K');
        expect(keyElement).toHaveClass('shortcut-key--tooltip');
    });

    test('should apply contrast variant class', () => {
        renderWithContext(
            <ShortcutSequence
                keys='K'
                variant={ShortcutKeyVariant.Contrast}
            />,
        );

        const keyElement = screen.getByText('K');
        expect(keyElement).toHaveClass('shortcut-key--contrast');
    });
});
