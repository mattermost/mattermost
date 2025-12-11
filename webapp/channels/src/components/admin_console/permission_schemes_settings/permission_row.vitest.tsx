// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Button} from 'react-bootstrap';

import {renderWithContext, fireEvent} from 'tests/vitest_react_testing_utils';

// Mock the PermissionDescription component to avoid intl errors
vi.mock('./permission_description', () => ({
    default: ({id, description}: {id: string; description: React.ReactNode}) => (
        <div
            className='permission-description'
            data-testid={`description-${id}`}
        >
            {typeof description === 'string' ? description : 'Mocked description'}
        </div>
    ),
}));

// Mock the permissionRolesStrings to avoid intl errors
vi.mock('./strings/permissions', () => ({
    permissionRolesStrings: {},
}));

import PermissionRow from './permission_row';

describe('components/admin_console/permission_schemes_settings/permission_row', () => {
    const defaultProps = {
        id: 'id',
        uniqId: 'uniqId',
        inherited: undefined,
        readOnly: false,
        value: 'checked',
        selectRow: vi.fn(),
        onChange: vi.fn(),
        additionalValues: {},
    };

    test('should match snapshot on editable and not inherited', () => {
        const {baseElement} = renderWithContext(
            <PermissionRow {...defaultProps}/>,
        );
        expect(baseElement).toMatchSnapshot();
    });

    test('should match snapshot on editable and inherited', () => {
        const {baseElement} = renderWithContext(
            <PermissionRow
                {...defaultProps}
                inherited={{name: 'test'}}
            />,
        );
        expect(baseElement).toMatchSnapshot();
    });

    test('should match snapshot on read only and not inherited', () => {
        const {baseElement} = renderWithContext(
            <PermissionRow
                {...defaultProps}
                readOnly={true}
            />,
        );
        expect(baseElement).toMatchSnapshot();
    });

    test('should match snapshot on read only and not inherited', () => {
        const {baseElement} = renderWithContext(
            <PermissionRow
                {...defaultProps}
                readOnly={true}
            />,
        );
        expect(baseElement).toMatchSnapshot();
    });

    test('should match snapshot with additional values', () => {
        const ADDITIONAL_VALUES = {
            edit_post: {
                editTimeLimitButton: (
                    <Button
                        onClick={vi.fn()}
                    />
                ),
            },
        };

        const {baseElement} = renderWithContext(
            <PermissionRow
                {...defaultProps}
                additionalValues={ADDITIONAL_VALUES}
            />,
        );
        expect(baseElement).toMatchSnapshot();
    });

    test('should call onChange function on click', () => {
        const onChange = vi.fn();
        const {container} = renderWithContext(
            <PermissionRow
                {...defaultProps}
                onChange={onChange}
            />,
        );
        const div = container.querySelector('div');
        if (div) {
            fireEvent.click(div);
        }
        expect(onChange).toHaveBeenCalledWith('id');
    });

    test('shouldn\'t call onChange function on click when is read-only', () => {
        const onChange = vi.fn();
        const {container} = renderWithContext(
            <PermissionRow
                {...defaultProps}
                readOnly={true}
                onChange={onChange}
            />,
        );
        const div = container.querySelector('div');
        if (div) {
            fireEvent.click(div);
        }
        expect(onChange).not.toHaveBeenCalled();
    });
});
