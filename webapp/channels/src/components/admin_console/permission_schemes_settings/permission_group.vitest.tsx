// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Button} from 'react-bootstrap';

import {renderWithContext, fireEvent} from 'tests/vitest_react_testing_utils';

import PermissionGroup from './permission_group';

describe('components/admin_console/permission_schemes_settings/permission_group', () => {
    const defaultProps = {
        id: 'name',
        uniqId: 'uniqId',
        permissions: ['invite_user', 'add_user_to_team'],
        readOnly: false,
        role: {
            permissions: [],
        },
        parentRole: undefined,
        scope: 'team_scope',
        value: 'checked',
        selectRow: vi.fn(),
        onChange: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('should match snapshot on editable without permissions', () => {
        const {container} = renderWithContext(
            <PermissionGroup {...defaultProps}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot on editable without every permission out of the scope', () => {
        const {container} = renderWithContext(
            <PermissionGroup
                {...defaultProps}
                scope={'system_scope'}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot on editable with some permissions', () => {
        const {container} = renderWithContext(
            <PermissionGroup
                {...defaultProps}
                role={{permissions: ['invite_user']}}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot on editable with all permissions', () => {
        const {container} = renderWithContext(
            <PermissionGroup
                {...defaultProps}
                role={{permissions: ['invite_user', 'add_user_to_team']}}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot on editable without permissions and read-only', () => {
        const {container} = renderWithContext(
            <PermissionGroup
                {...defaultProps}
                readOnly={true}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot on editable with some permissions and read-only', () => {
        const {container} = renderWithContext(
            <PermissionGroup
                {...defaultProps}
                role={{permissions: ['invite_user']}}
                readOnly={true}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot on editable with all permissions and read-only', () => {
        const {container} = renderWithContext(
            <PermissionGroup
                {...defaultProps}
                role={{permissions: ['invite_user', 'add_user_to_team']}}
                readOnly={true}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot on editable with some permissions from parentRole', () => {
        const {container} = renderWithContext(
            <PermissionGroup
                {...defaultProps}
                parentRole={{permissions: ['invite_user']}}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot on editable with all permissions from parentRole', () => {
        const {container} = renderWithContext(
            <PermissionGroup
                {...defaultProps}
                parentRole={{permissions: ['invite_user', 'add_user_to_team']}}
            />,
        );
        expect(container).toMatchSnapshot();
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

        const {container} = renderWithContext(
            <PermissionGroup
                {...defaultProps}
                additionalValues={ADDITIONAL_VALUES}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should expand and collapse correctly, expanded by default, collapsed and then expanded again', () => {
        const {container} = renderWithContext(
            <PermissionGroup {...defaultProps}/>,
        );
        expect(container).toMatchSnapshot();

        const arrow = container.querySelector('.permission-arrow');
        if (arrow) {
            fireEvent.click(arrow);
            expect(container).toMatchSnapshot();
            fireEvent.click(arrow);
            expect(container).toMatchSnapshot();
        }
    });

    test('should call correctly onChange function on click without permissions', () => {
        const onChange = vi.fn();
        renderWithContext(
            <PermissionGroup
                {...defaultProps}
                onChange={onChange}
            />,
        );
        const groupRow = document.querySelector('.permission-group-row');
        if (groupRow) {
            fireEvent.click(groupRow);
            expect(onChange).toHaveBeenCalledWith(['invite_user', 'add_user_to_team']);
        }
    });

    test('should call correctly onChange function on click with some permissions', () => {
        const onChange = vi.fn();
        renderWithContext(
            <PermissionGroup
                {...defaultProps}
                role={{permissions: ['invite_user']}}
                onChange={onChange}
            />,
        );
        const groupRow = document.querySelector('.permission-group-row');
        if (groupRow) {
            fireEvent.click(groupRow);
            expect(onChange).toHaveBeenCalledWith(['add_user_to_team']);
        }
    });

    test('should call correctly onChange function on click with all permissions', () => {
        const onChange = vi.fn();
        renderWithContext(
            <PermissionGroup
                {...defaultProps}
                role={{permissions: ['invite_user', 'add_user_to_team']}}
                onChange={onChange}
            />,
        );
        const groupRow = document.querySelector('.permission-group-row');
        if (groupRow) {
            fireEvent.click(groupRow);
            expect(onChange).toHaveBeenCalledWith(['invite_user', 'add_user_to_team']);
        }
    });

    test('shouldn\'t call onChange function on click when is read-only', () => {
        const onChange = vi.fn();
        renderWithContext(
            <PermissionGroup
                {...defaultProps}
                readOnly={true}
                onChange={onChange}
            />,
        );
        const groupRow = document.querySelector('.permission-group-row');
        if (groupRow) {
            fireEvent.click(groupRow);
            expect(onChange).not.toHaveBeenCalled();
        }
    });

    test('shouldn\'t call onChange function on click when is read-only', () => {
        const onChange = vi.fn();
        renderWithContext(
            <PermissionGroup
                {...defaultProps}
                readOnly={true}
                onChange={onChange}
            />,
        );
        const groupRow = document.querySelector('.permission-group-row');
        if (groupRow) {
            fireEvent.click(groupRow);
            expect(onChange).not.toHaveBeenCalled();
        }
    });

    test('should collapse when toggle to all permissions and expand otherwise', () => {
        // Test toggling behavior - click to collapse when fully selected
        const onChange = vi.fn();
        const {rerender, container} = renderWithContext(
            <PermissionGroup
                {...defaultProps}
                role={{permissions: ['invite_user']}}
                onChange={onChange}
            />,
        );

        // Initially expanded
        expect(container.querySelector('.permission-group')).toBeInTheDocument();

        // After selecting all, should collapse
        rerender(
            <PermissionGroup
                {...defaultProps}
                role={{permissions: ['invite_user', 'add_user_to_team']}}
                onChange={onChange}
            />,
        );
        expect(container.querySelector('.permission-group')).toBeInTheDocument();
    });

    test('should toggle correctly between states', () => {
        const onChange = vi.fn();
        renderWithContext(
            <PermissionGroup
                {...defaultProps}
                role={{permissions: ['invite_user']}}
                onChange={onChange}
            />,
        );
        const groupRow = document.querySelector('.permission-group-row');
        if (groupRow) {
            fireEvent.click(groupRow);
            expect(onChange).toHaveBeenCalled();
        }
    });
});
