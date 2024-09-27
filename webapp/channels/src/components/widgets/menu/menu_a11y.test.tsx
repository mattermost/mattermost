// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import Menu from './menu';

jest.unmock('react-intl');

describe('Menu', () => {
    test('should translate the label when given a message descriptor', () => {
        renderWithContext(
            <Menu
                ariaLabel={{id: 'Menu.testAriaLabel'}}
            />,
            {},
            {
                intlMessages: {
                    'Menu.testAriaLabel': 'test aria label',
                },
            },
        );

        expect(screen.getByLabelText('test aria label')).toBeVisible();
    });

    test('should not translate the label when given a string', () => {
        renderWithContext(
            <Menu
                ariaLabel='untranslated aria label'
            />,
        );

        expect(screen.getByLabelText('untranslated aria label')).toBeVisible();
    });
});
