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

    test('should match snapshot on editable and not inherited', () => {
        const {container} = renderWithContext(
            <PermissionRow {...defaultProps}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot on editable and inherited', () => {
        const {container} = renderWithContext(
            <PermissionRow
                {...defaultProps}
                inherited={{name: 'all_users'}}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot on read only and not inherited', () => {
        const {container} = renderWithContext(
            <PermissionRow
                {...defaultProps}
                readOnly={true}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot on read only and inherited', () => {
        const {container} = renderWithContext(
            <PermissionRow
                {...defaultProps}
                readOnly={true}
                inherited={{name: 'all_users'}}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with additional values', () => {
        const ADDITIONAL_VALUES = {
            edit_post: {
                editTimeLimitButton: (
                    <button
                        onClick={jest.fn()}
                    />
                ),
            },
        };

        const {container} = renderWithContext(
            <PermissionRow
                {...defaultProps}
                additionalValues={ADDITIONAL_VALUES}
            />,
        );
        expect(container).toMatchSnapshot();
    });

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
