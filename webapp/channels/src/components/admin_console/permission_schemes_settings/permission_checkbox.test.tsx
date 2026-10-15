// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import PermissionCheckbox from 'components/admin_console/permission_schemes_settings/permission_checkbox';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

describe('components/admin_console/permission_schemes_settings/permission_checkbox', () => {
    test('should match snapshot on no value', () => {
        const {container} = renderWithContext(
            <PermissionCheckbox/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot on value "checked" and no id', () => {
        const {container} = renderWithContext(
            <PermissionCheckbox value='checked'/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should render checked state', () => {
        const {container} = renderWithContext(
            <PermissionCheckbox
                value='checked'
                id='uniqId-checked'
            />,
        );
        expect(container).toMatchSnapshot();
        expect(screen.getByTestId('uniqId-checked')).toBeChecked();
        expect(screen.getByTestId('uniqId-checked')).not.toHaveAttribute('aria-checked', 'mixed');
    });

    test('should render intermediate state', () => {
        const {container} = renderWithContext(
            <PermissionCheckbox
                value='intermediate'
                id='uniqId-checked'
            />,
        );
        expect(container).toMatchSnapshot();
        expect(screen.getByTestId('uniqId-checked')).toHaveAttribute('aria-checked', 'mixed');
        expect(screen.getByTestId('uniqId-checked')).not.toBeChecked();
    });

    test('should render unchecked for other values', () => {
        const {container} = renderWithContext(
            <PermissionCheckbox
                value='other'
                id='uniqId-checked'
            />,
        );
        expect(container).toMatchSnapshot();
        expect(screen.getByTestId('uniqId-checked')).not.toBeChecked();
        expect(screen.getByTestId('uniqId-checked')).not.toHaveAttribute('aria-checked', 'mixed');
    });

    test('should call onChange when clicked', async () => {
        const onChange = jest.fn();
        renderWithContext(
            <PermissionCheckbox
                id='uniqId-checked'
                onChange={onChange}
            />,
        );
        await userEvent.click(screen.getByTestId('uniqId-checked'));
        expect(onChange).toHaveBeenCalledTimes(1);
    });

    test('should not call onChange when disabled', async () => {
        const onChange = jest.fn();
        renderWithContext(
            <PermissionCheckbox
                id='uniqId-checked'
                disabled={true}
                onChange={onChange}
            />,
        );
        await userEvent.click(screen.getByTestId('uniqId-checked'));
        expect(onChange).not.toHaveBeenCalled();
    });
});
