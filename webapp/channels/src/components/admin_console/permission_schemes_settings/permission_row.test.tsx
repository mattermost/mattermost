// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {screen, fireEvent} from '@testing-library/react';
import {Button} from 'react-bootstrap';

import {renderWithContext} from 'tests/react_testing_utils';
import PermissionRow from 'components/admin_console/permission_schemes_settings/permission_row';

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

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should render correctly on editable and not inherited', () => {
        renderWithContext(
            <PermissionRow {...defaultProps}/>
        );
        
        // Verify the permission row exists
        const permissionRow = screen.getByText('id').closest('.permission-row');
        expect(permissionRow).toBeInTheDocument();
        
        // Verify it's not read-only or selected
        expect(permissionRow).not.toHaveClass('read-only');
        expect(permissionRow).not.toHaveClass('selected');
        
        // Verify the checkbox is in checked state
        const checkbox = screen.getByTestId('uniqId-checkbox');
        expect(checkbox).toHaveClass('permission-check', 'checked');
    });

    test('should render correctly on editable and inherited', () => {
        renderWithContext(
            <PermissionRow
                {...defaultProps}
                inherited={{name: 'test'}}
            />
        );
        
        // Verify it contains inherited message
        expect(screen.getByText('Inherited from')).toBeInTheDocument();
    });

    test('should render correctly on read only', () => {
        renderWithContext(
            <PermissionRow
                {...defaultProps}
                readOnly={true}
            />
        );
        
        // Verify it has the read-only class
        const permissionRow = screen.getByText('id').closest('.permission-row');
        expect(permissionRow).toHaveClass('read-only');
    });

    test('should render correctly with selected state', () => {
        renderWithContext(
            <PermissionRow
                {...defaultProps}
                selected="id"
            />
        );
        
        // Verify it has the selected class
        const permissionRow = screen.getByText('id').closest('.permission-row');
        expect(permissionRow).toHaveClass('selected');
    });

    test('should render with additional values', () => {
        const ADDITIONAL_VALUES = {
            edit_post: {
                editTimeLimitButton: (
                    <Button
                        data-testid="edit-time-limit-button"
                        onClick={jest.fn()}
                    />
                ),
            },
        };

        renderWithContext(
            <PermissionRow
                {...defaultProps}
                id="edit_post"
                additionalValues={ADDITIONAL_VALUES}
            />
        );
        
        // Since FormattedMessage is mocked in tests, we can't directly verify the button rendering
        // in the description. We can verify the row renders correctly.
        expect(screen.getByText('edit_post')).toBeInTheDocument();
    });

    test('should call onChange function on click', () => {
        const onChange = jest.fn();
        
        renderWithContext(
            <PermissionRow
                {...defaultProps}
                onChange={onChange}
            />
        );
        
        // Click on the permission row
        fireEvent.click(screen.getByText('id').closest('.permission-row')!);
        
        expect(onChange).toHaveBeenCalledWith('id');
    });

    test('shouldn\'t call onChange function on click when is read-only', () => {
        const onChange = jest.fn();
        
        renderWithContext(
            <PermissionRow
                {...defaultProps}
                readOnly={true}
                onChange={onChange}
            />
        );
        
        // Click on the permission row
        fireEvent.click(screen.getByText('id').closest('.permission-row')!);
        
        expect(onChange).not.toHaveBeenCalled();
    });
});
