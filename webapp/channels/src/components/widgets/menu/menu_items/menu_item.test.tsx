// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {render, screen} from 'tests/react_testing_utils';

import menuItem from './menu_item';

describe('components/MenuItem', () => {
    const TestComponent = menuItem((props: any) => props.text || null);

    const defaultProps = {
        show: true,
        id: 'test-id',
        text: 'test-text',
        otherProp: 'extra-prop',
    };

    test('should not render when show is false', () => {
        const props = {...defaultProps, show: false};
        render(<TestComponent {...props}/>);

        expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
        expect(screen.queryByText('test-text')).not.toBeInTheDocument();
    });

    test('should render menuitem with icon and text', () => {
        const props = {...defaultProps, icon: 'test-icon'};
        render(<TestComponent {...props}/>);

        const menuItem = screen.getByRole('menuitem');
        expect(menuItem).toBeInTheDocument();
        expect(menuItem).toHaveAttribute('id', 'test-id');

        expect(screen.getByText('test-icon')).toBeInTheDocument();
        expect(screen.getByText('test-text')).toBeInTheDocument();
    });

    test('should render menuitem with text only', () => {
        render(<TestComponent {...defaultProps}/>);

        const menuItem = screen.getByRole('menuitem');
        expect(menuItem).toBeInTheDocument();
        expect(menuItem).toHaveAttribute('id', 'test-id');

        expect(screen.getByText('test-text')).toBeInTheDocument();
    });
});
