// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import ProductMenuItem from './product_menu_item';

type ProductMenuItemProps = React.ComponentProps<typeof ProductMenuItem>;

describe('components/ProductMenuItem', () => {
    const defaultProps: ProductMenuItemProps = {
        destination: '/test-destination',
        icon: 'product-channels',
        text: 'Test Product',
        active: false,
        onClick: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should render menu item with correct text', () => {
        renderWithContext(<ProductMenuItem {...defaultProps}/>);

        expect(screen.getByRole('menuitem')).toBeInTheDocument();
        expect(screen.getByText('Test Product')).toBeInTheDocument();
    });

    test('should render with string icon from glyphMap', () => {
        renderWithContext(<ProductMenuItem {...defaultProps}/>);

        // When icon is a string, the component looks up the glyph from glyphMap
        // The icon should be rendered with proper styling
        const menuItem = screen.getByRole('menuitem');
        expect(menuItem).toBeInTheDocument();

        // The ProductChannelsIcon should be rendered (via glyphMap lookup)
        // We can verify the menu item contains an svg element
        expect(menuItem.querySelector('svg')).toBeInTheDocument();
    });

    test('should render with React element icon', () => {
        const CustomIcon = (
            <svg data-testid='custom-svg-icon'>
                <rect
                    width='24'
                    height='24'
                />
            </svg>
        );
        const props: ProductMenuItemProps = {
            ...defaultProps,
            icon: CustomIcon,
        };

        renderWithContext(<ProductMenuItem {...props}/>);

        expect(screen.getByTestId('custom-svg-icon')).toBeInTheDocument();
    });

    test('should show check icon when active is true', () => {
        const props: ProductMenuItemProps = {
            ...defaultProps,
            active: true,
        };

        renderWithContext(<ProductMenuItem {...props}/>);

        const menuItem = screen.getByRole('menuitem');

        // When active, there should be two SVG elements: the product icon and the check icon
        const svgElements = menuItem.querySelectorAll('svg');
        expect(svgElements.length).toBe(2);
    });

    test('should show open in new tab button when active is false', () => {
        renderWithContext(<ProductMenuItem {...defaultProps}/>);

        expect(screen.getByLabelText('Open in new tab')).toBeInTheDocument();
    });

    test('should not show open in new tab button when active is true', () => {
        const props: ProductMenuItemProps = {
            ...defaultProps,
            active: true,
        };

        renderWithContext(<ProductMenuItem {...props}/>);

        expect(screen.queryByLabelText('Open in new tab')).not.toBeInTheDocument();
    });

    test('should call onClick when clicked', async () => {
        const onClick = jest.fn();
        const props: ProductMenuItemProps = {
            ...defaultProps,
            onClick,
        };

        renderWithContext(<ProductMenuItem {...props}/>);

        await userEvent.click(screen.getByRole('menuitem'));

        expect(onClick).toHaveBeenCalledTimes(1);
    });

    test('should open destination in new tab when open in new tab button is clicked', async () => {
        const onClick = jest.fn();
        const windowOpenSpy = jest.spyOn(window, 'open').mockImplementation();
        const props: ProductMenuItemProps = {
            ...defaultProps,
            onClick,
        };

        renderWithContext(<ProductMenuItem {...props}/>);

        await userEvent.click(screen.getByLabelText('Open in new tab'), {pointerEventsCheck: 0});

        expect(windowOpenSpy).toHaveBeenCalledWith('/test-destination', '_blank', 'noopener,noreferrer');
        expect(onClick).toHaveBeenCalledTimes(1);

        windowOpenSpy.mockRestore();
    });

    test('should render tour tip when provided', () => {
        const tourTipContent = 'Tour tip content';
        const TourTip = <div data-testid='tour-tip'>{tourTipContent}</div>;
        const props: ProductMenuItemProps = {
            ...defaultProps,
            tourTip: TourTip,
        };

        renderWithContext(<ProductMenuItem {...props}/>);

        expect(screen.getByTestId('tour-tip')).toBeInTheDocument();
        expect(screen.getByText(tourTipContent)).toBeInTheDocument();
    });

    test('should pass correct id to menu item', () => {
        const props: ProductMenuItemProps = {
            ...defaultProps,
            id: 'test-menu-item-id',
        };

        renderWithContext(<ProductMenuItem {...props}/>);

        expect(screen.getByRole('menuitem')).toHaveAttribute('id', 'test-menu-item-id');
    });

    test('should render with correct destination link', () => {
        renderWithContext(<ProductMenuItem {...defaultProps}/>);

        const menuItem = screen.getByRole('menuitem');
        expect(menuItem).toHaveAttribute('href', '/test-destination');
    });

    test('should render custom React component as icon', () => {
        const customIconText = 'Custom Icon';
        const CustomIconComponent = () => <span data-testid='custom-component-icon'>{customIconText}</span>;
        const props: ProductMenuItemProps = {
            ...defaultProps,
            icon: <CustomIconComponent/>,
        };

        renderWithContext(<ProductMenuItem {...props}/>);

        expect(screen.getByTestId('custom-component-icon')).toBeInTheDocument();
        expect(screen.getByText(customIconText)).toBeInTheDocument();
    });
});
