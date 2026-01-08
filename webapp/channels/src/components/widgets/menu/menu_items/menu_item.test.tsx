// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {render, screen} from 'tests/react_testing_utils';

import menuItem from './menu_item';

describe('components/MenuItem', () => {
    const TestComponent = menuItem(({text}: {text: React.ReactNode}) => <div>{text}</div>);

    const defaultProps = {
        show: true,
        id: 'test-id',
        text: 'test-text',
        otherProp: 'extra-prop',
    };

    test('should not render when show is false', () => {
        const props = {...defaultProps, show: false};
        const {container} = render(<TestComponent {...props}/>);

        expect(container.firstChild).toBeNull();
    });

    test('should render with icon and appropriate classes', () => {
        const props = {...defaultProps, icon: 'test-icon'};
        const {container} = render(<TestComponent {...props}/>);

        const menuItem = screen.getByRole('menuitem');
        expect(menuItem).toBeInTheDocument();
        expect(menuItem).toHaveAttribute('id', 'test-id');
        expect(menuItem).toHaveClass('MenuItem', 'MenuItem--with-icon');

        // Icon is rendered inside the menuitem
        const iconSpan = container.querySelector('.icon');
        expect(iconSpan).toBeInTheDocument();
        expect(iconSpan).toHaveTextContent('test-icon');

        // Text is in a div with class "text"
        const textDiv = container.querySelector('.text');
        expect(textDiv).toBeInTheDocument();
        expect(textDiv).toHaveTextContent('test-text');
    });

    test('should render without icon when icon prop is not provided', () => {
        const {container} = render(<TestComponent {...defaultProps}/>);

        const menuItem = screen.getByRole('menuitem');
        expect(menuItem).toBeInTheDocument();
        expect(menuItem).toHaveAttribute('id', 'test-id');
        expect(menuItem).toHaveClass('MenuItem');
        expect(menuItem).not.toHaveClass('MenuItem--with-icon');

        // Should not have icon span
        const iconSpan = container.querySelector('.icon');
        expect(iconSpan).not.toBeInTheDocument();

        // Text should be present in the rendered component
        expect(container).toHaveTextContent('test-text');
    });
});
