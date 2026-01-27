// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';
import {MemoryRouter} from 'react-router-dom';

import ProductMenuItem from './product_menu_item';
import type {ProductMenuItemProps} from './product_menu_item';

describe('components/ProductMenuItem', () => {
    const defaultProps: ProductMenuItemProps = {
        destination: '/test-destination',
        icon: 'product-channels',
        text: 'Test Product',
        active: false,
        onClick: jest.fn(),
    };

    const renderComponent = (props: ProductMenuItemProps) => {
        return shallow(
            <MemoryRouter>
                <ProductMenuItem {...props}/>
            </MemoryRouter>,
        ).find(ProductMenuItem).shallow();
    };

    test('should render correctly with string icon from glyphMap', () => {
        const wrapper = renderComponent(defaultProps);
        expect(wrapper).toMatchSnapshot();
    });

    test('should render correctly with React element icon', () => {
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

        const wrapper = renderComponent(props);
        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find('[data-testid="custom-svg-icon"]').exists()).toBe(true);
    });

    test('should show check icon when active is true', () => {
        const props: ProductMenuItemProps = {
            ...defaultProps,
            active: true,
        };

        const wrapper = renderComponent(props);
        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find('CheckIcon').exists()).toBe(true);
    });

    test('should not show check icon when active is false', () => {
        const wrapper = renderComponent(defaultProps);
        expect(wrapper.find('CheckIcon').exists()).toBe(false);
    });

    test('should call onClick when clicked', () => {
        const onClick = jest.fn();
        const props: ProductMenuItemProps = {
            ...defaultProps,
            onClick,
        };

        const wrapper = renderComponent(props);
        wrapper.simulate('click');
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    test('should render tour tip when provided', () => {
        const TourTip = <div data-testid='tour-tip'>{'Tour tip content'}</div>;
        const props: ProductMenuItemProps = {
            ...defaultProps,
            tourTip: TourTip,
        };

        const wrapper = renderComponent(props);
        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find('[data-testid="tour-tip"]').exists()).toBe(true);
    });

    test('should pass correct id to menu item', () => {
        const props: ProductMenuItemProps = {
            ...defaultProps,
            id: 'test-menu-item-id',
        };

        const wrapper = renderComponent(props);
        expect(wrapper.prop('id')).toBe('test-menu-item-id');
    });

    test('should render with correct destination link', () => {
        const wrapper = renderComponent(defaultProps);
        expect(wrapper.prop('to')).toBe('/test-destination');
    });

    test('should render custom React component as icon', () => {
        const CustomIconComponent = () => <span data-testid='custom-component-icon'>{'Custom Icon'}</span>;
        const props: ProductMenuItemProps = {
            ...defaultProps,
            icon: <CustomIconComponent/>,
        };

        const wrapper = renderComponent(props);
        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find('CustomIconComponent').exists()).toBe(true);
    });
});
