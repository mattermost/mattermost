// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import MenuItemAction, {MenuItemActionImpl} from './menu_item_action';

jest.unmock('react-intl');

describe('components/MenuItemAction', () => {
    const baseProps = {
        onClick: jest.fn(),
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <MenuItemActionImpl
                {...baseProps}
                text='Whatever'
            />,
        );

        expect(container).toMatchSnapshot();
    });
    test('should match snapshot with extra text', () => {
        const {container} = renderWithContext(
            <MenuItemActionImpl
                {...baseProps}
                text='Whatever'
                extraText='Extra Text'
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('should not translate the label and text when given strings', () => {
        renderWithContext(
            <MenuItemAction
                {...baseProps}
                ariaLabel='untranslated aria label'
                text='untranslated text'
            />,
        );

        expect(screen.getByLabelText('untranslated aria label')).toBeVisible();
        expect(screen.getByText('untranslated text')).toBeVisible();
    });

    test('should properly translate the label and text when given message descriptors', () => {
        renderWithContext(
            <MenuItemAction
                {...baseProps}
                ariaLabel={{id: 'MenuItemAction.ariaLabel'}}
                text={{id: 'MenuItemAction.text'}}
            />,
            {},
            {
                intlMessages: {
                    'MenuItemAction.ariaLabel': 'translated aria label',
                    'MenuItemAction.text': 'translated text',
                },
            },
        );

        expect(screen.getByLabelText('translated aria label')).toBeVisible();
        expect(screen.getByText('translated text')).toBeVisible();
    });

    test('should properly translate the text when given a FormattedMessage', () => {
        renderWithContext(
            <MenuItemAction
                {...baseProps}
                text={
                    <FormattedMessage id='MenuItemAction.message'/>
                }
            />,
            {},
            {
                intlMessages: {
                    'MenuItemAction.message': 'translated formatted message',
                },
            },
        );

        expect(screen.getByText('translated formatted message')).toBeVisible();
    });
});
