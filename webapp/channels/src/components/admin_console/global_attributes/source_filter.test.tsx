// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {GlobalAttributeSource} from '@mattermost/types/global_attributes';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import SourceFilter from './source_filter';

describe('SourceFilter', () => {
    const onChange = jest.fn();

    beforeEach(() => {
        onChange.mockReset();
    });

    function renderFilter(value?: GlobalAttributeSource) {
        return renderWithContext(
            <SourceFilter
                value={value}
                onChange={onChange}
            />,
        );
    }

    const trigger = () => screen.getByTestId('global-attributes-source-filter');
    const shownValue = () => screen.getByRole('textbox', {hidden: true});

    test('shows the current selection under the Source label', () => {
        const {unmount} = renderFilter();
        expect(trigger()).toHaveTextContent('Source');
        expect(shownValue()).toHaveValue('All');
        unmount();

        renderFilter('openid');
        expect(shownValue()).toHaveValue('OpenID Connect');
    });

    test('is a single tab stop that names what it filters', () => {
        renderFilter();

        expect(trigger()).toHaveAttribute('role', 'button');
        expect(trigger()).toHaveAttribute('tabindex', '0');
        expect(trigger()).toHaveAccessibleName('Filter attributes by source');
        expect(shownValue()).toHaveAttribute('tabindex', '-1');
    });

    test('lists every option as a radio item, in order', async () => {
        renderFilter();

        await userEvent.click(trigger());

        const labels = screen.getAllByRole('menuitemradio').map((item) => item.textContent);
        expect(labels).toEqual(['All', 'Managed here', 'AD/LDAP', 'SAML', 'OpenID Connect', 'Plugin']);
    });

    test('marks only the current selection as checked', async () => {
        renderFilter('saml');

        await userEvent.click(trigger());

        const checked = screen.getAllByRole('menuitemradio').filter((item) => item.getAttribute('aria-checked') === 'true');
        expect(checked.map((item) => item.textContent)).toEqual(['SAML']);
    });

    test.each([
        ['Managed here', 'managed'],
        ['AD/LDAP', 'ldap'],
        ['SAML', 'saml'],
        ['OpenID Connect', 'openid'],
        ['Plugin', 'plugin'],
    ])('picking %s reports %s and closes the menu', async (label, expected) => {
        renderFilter();

        await userEvent.click(trigger());
        await userEvent.click(screen.getByRole('menuitemradio', {name: label}));

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(expected);
        expect(screen.queryByRole('menuitemradio')).not.toBeInTheDocument();
    });

    test('picking All reports no source', async () => {
        renderFilter('ldap');

        await userEvent.click(trigger());
        await userEvent.click(screen.getByRole('menuitemradio', {name: 'All'}));

        expect(onChange).toHaveBeenCalledWith(undefined);
    });

    test('is operable from the keyboard', async () => {
        renderFilter();

        trigger().focus();
        await userEvent.keyboard('{Enter}');
        expect(screen.getAllByRole('menuitemradio')).toHaveLength(6);

        await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith('ldap');
    });

    test('closes on Escape without changing the selection', async () => {
        renderFilter();

        await userEvent.click(trigger());
        await userEvent.keyboard('{Escape}');

        expect(screen.queryByRole('menuitemradio')).not.toBeInTheDocument();
        expect(onChange).not.toHaveBeenCalled();
    });
});
