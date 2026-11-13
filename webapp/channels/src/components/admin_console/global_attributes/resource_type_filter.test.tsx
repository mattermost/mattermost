// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {GlobalAttributeResourceType} from '@mattermost/types/global_attributes';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import ResourceTypeFilter from './resource_type_filter';

describe('ResourceTypeFilter', () => {
    const onChange = jest.fn();

    beforeEach(() => {
        onChange.mockReset();
    });

    function renderFilter(value?: GlobalAttributeResourceType, allowedTypes: GlobalAttributeResourceType[] = ['user', 'channel', 'post']) {
        return renderWithContext(
            <ResourceTypeFilter
                allowedTypes={allowedTypes}
                value={value}
                onChange={onChange}
            />,
        );
    }

    const trigger = () => screen.getByTestId('global-attributes-resource-type-filter');
    const shownValue = () => screen.getByRole('textbox', {hidden: true});

    test('shows the current selection under the Resource type label', () => {
        const {unmount} = renderFilter();
        expect(trigger()).toHaveTextContent('Resource type');
        expect(shownValue()).toHaveValue('All');
        unmount();

        renderFilter('channel');
        expect(shownValue()).toHaveValue('Channels');
    });

    test('is a single tab stop that names what it filters', () => {
        renderFilter();

        expect(trigger()).toHaveAttribute('role', 'button');
        expect(trigger()).toHaveAttribute('tabindex', '0');
        expect(trigger()).toHaveAccessibleName('Filter attributes by resource type');
        expect(shownValue()).toHaveAttribute('tabindex', '-1');
    });

    test('lists All then every allowed type as radio items, with the Applies to labels', async () => {
        renderFilter();

        await userEvent.click(trigger());

        const labels = screen.getAllByRole('menuitemradio').map((item) => item.textContent);
        expect(labels).toEqual(['All', 'Users', 'Channels', 'Posts']);
    });

    test('offers only the types the server allows', async () => {
        renderFilter(undefined, ['user', 'post']);

        await userEvent.click(trigger());

        const labels = screen.getAllByRole('menuitemradio').map((item) => item.textContent);
        expect(labels).toEqual(['All', 'Users', 'Posts']);
    });

    test('marks only the current selection as checked', async () => {
        renderFilter('post');

        await userEvent.click(trigger());

        const checked = screen.getAllByRole('menuitemradio').filter((item) => item.getAttribute('aria-checked') === 'true');
        expect(checked.map((item) => item.textContent)).toEqual(['Posts']);
    });

    test.each([
        ['Users', 'user'],
        ['Channels', 'channel'],
        ['Posts', 'post'],
    ])('picking %s reports %s and closes the menu', async (label, expected) => {
        renderFilter();

        await userEvent.click(trigger());
        await userEvent.click(screen.getByRole('menuitemradio', {name: label}));

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(expected);
        expect(screen.queryByRole('menuitemradio')).not.toBeInTheDocument();
    });

    test('picking All reports no resource type', async () => {
        renderFilter('user');

        await userEvent.click(trigger());
        await userEvent.click(screen.getByRole('menuitemradio', {name: 'All'}));

        expect(onChange).toHaveBeenCalledWith(undefined);
    });

    test('is operable from the keyboard', async () => {
        renderFilter();

        trigger().focus();
        await userEvent.keyboard('{Enter}');
        expect(screen.getAllByRole('menuitemradio')).toHaveLength(4);

        await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith('channel');
    });
});
