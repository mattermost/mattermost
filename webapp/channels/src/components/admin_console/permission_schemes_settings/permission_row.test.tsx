// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import PermissionRow from 'components/admin_console/permission_schemes_settings/permission_row';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

describe('components/admin_console/permission_schemes_settings/permission_row', () => {
    const defaultProps = {
        id: 'id',
        uniqId: 'uniqId',
        inherited: undefined,
        readOnly: false,
        value: 'checked',
        selectRow: jest.fn(),
        onChange: jest.fn(),
        additionalValues: {},
    };

    test('should call onChange function on click', async () => {
        const onChange = jest.fn();
        renderWithContext(
            <PermissionRow
                {...defaultProps}
                onChange={onChange}
            />,
        );
        await userEvent.click(screen.getByTestId('uniqId-checkbox').closest('.permission-row')!);
        expect(onChange).toHaveBeenCalledWith('id');
    });

    test('shouldn\'t call onChange function on click when is read-only', async () => {
        const onChange = jest.fn();
        renderWithContext(
            <PermissionRow
                {...defaultProps}
                readOnly={true}
                onChange={onChange}
            />,
        );
        await userEvent.click(screen.getByTestId('uniqId-checkbox').closest('.permission-row')!);
        expect(onChange).not.toHaveBeenCalled();
    });
});
