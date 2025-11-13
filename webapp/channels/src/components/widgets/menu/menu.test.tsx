// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {render, screen} from 'tests/react_testing_utils';

import Menu from './menu';

jest.mock('./is_mobile_view_hack', () => ({
    isMobile: jest.fn(() => false),
}));

(global as any).MutationObserver = class {
    public disconnect() {}
    public observe() {}
};

describe('components/Menu', () => {
    test('should render with aria-label and default classes', () => {
        render(<Menu ariaLabel='test-label'>{'text'}</Menu>);

        const menu = screen.getByRole('menu');
        expect(menu).toBeInTheDocument();
        expect(menu).toHaveClass('Menu__content', 'dropdown-menu');
        expect(menu).toHaveTextContent('text');

        const container = screen.getByLabelText('test-label');
        expect(container).toBeInTheDocument();
        expect(container).toHaveClass('a11y__popup', 'Menu');
    });

    test('should render with custom id', () => {
        render(
            <Menu
                id='test-id'
                ariaLabel='test-label'
            >
                {'text'}
            </Menu>,
        );

        const container = screen.getByLabelText('test-label');
        expect(container).toHaveAttribute('id', 'test-id');
        expect(container).toHaveClass('a11y__popup', 'Menu');

        const menu = screen.getByRole('menu');
        expect(menu).toHaveTextContent('text');
    });

    test('should apply openLeft and openUp classes', () => {
        render(
            <Menu
                openLeft={true}
                openUp={true}
                ariaLabel='test-label'
            >
                {'text'}
            </Menu>,
        );

        const menu = screen.getByRole('menu');
        expect(menu).toHaveClass('Menu__content', 'dropdown-menu', 'openLeft', 'openUp');
        expect(menu).toHaveTextContent('text');
    });
});
