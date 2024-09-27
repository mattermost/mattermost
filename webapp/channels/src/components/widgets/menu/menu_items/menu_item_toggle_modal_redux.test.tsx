// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import MenuItemToggleModalRedux, {MenuItemToggleModalReduxImpl} from './menu_item_toggle_modal_redux';

jest.unmock('react-intl');

describe('components/MenuItemToggleModalRedux', () => {
    const baseProps = {
        modalId: 'test',
        dialogType: jest.fn(),
        dialogProps: {test: 'test'},
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <MenuItemToggleModalReduxImpl
                {...baseProps}
                text='Whatever'
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with extra text', () => {
        const {container} = renderWithContext(
            <MenuItemToggleModalReduxImpl
                {...baseProps}
                text='Whatever'
                extraText='Extra text'
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('should not translate the label and text when given strings', () => {
        renderWithContext(
            <MenuItemToggleModalRedux
                {...baseProps}
                ariaLabel='untranslated aria label'
                text='untranslated text'
            />,
        );

        expect(screen.getByLabelText('untranslated aria label dialog')).toBeVisible();
        expect(screen.getByText('untranslated text')).toBeVisible();
    });

    test('should properly translate the label and text when given message descriptors', () => {
        renderWithContext(
            <MenuItemToggleModalRedux
                {...baseProps}
                ariaLabel={{id: 'MenuItemToggleModalRedux.ariaLabel'}}
                text={{id: 'MenuItemToggleModalRedux.text'}}
            />,
            {},
            {
                intlMessages: {
                    'MenuItemToggleModalRedux.ariaLabel': 'translated aria label',
                    'MenuItemToggleModalRedux.text': 'translated text',
                },
            },
        );

        expect(screen.getByLabelText('translated aria label dialog')).toBeVisible();
        expect(screen.getByText('translated text')).toBeVisible();
    });

    test('should properly translate the text when given a FormattedMessage', () => {
        renderWithContext(
            <MenuItemToggleModalRedux
                {...baseProps}
                text={
                    <FormattedMessage id='MenuItemToggleModalRedux.message'/>
                }
            />,
            {},
            {
                intlMessages: {
                    'MenuItemToggleModalRedux.message': 'translated formatted message',
                },
            },
        );

        expect(screen.getByText('translated formatted message')).toBeVisible();
    });
});
