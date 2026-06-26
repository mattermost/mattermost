// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import PermissionGroup from 'components/admin_console/permission_schemes_settings/permission_group';

import {renderWithContext, userEvent} from 'tests/react_testing_utils';

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
        selectRow: jest.fn(),
        onChange: jest.fn(),
    };

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
                    <button
                        onClick={jest.fn()}
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

    test('should expand and collapse correctly, expanded by default, collapsed and then expanded again', async () => {
        const {container} = renderWithContext(
            <PermissionGroup {...defaultProps}/>,
        );

        // Expanded by default
        const arrow = container.querySelector('.permission-arrow')!;
        expect(arrow).toHaveClass('open');

        // Click to collapse
        await userEvent.setup().click(arrow);
        expect(arrow).not.toHaveClass('open');

        // Click to expand again
        await userEvent.setup().click(arrow);
        expect(arrow).toHaveClass('open');
    });

    test('should call correctly onChange function on click without permissions', async () => {
        const onChange = jest.fn();
        const {container} = renderWithContext(
            <PermissionGroup
                {...defaultProps}
                onChange={onChange}
            />,
        );
        const groupRow = container.querySelector('.permission-group-row')!;
        await userEvent.setup().click(groupRow);
        expect(onChange).toHaveBeenCalledWith(['invite_user', 'add_user_to_team']);
    });

    test('should call correctly onChange function on click with some permissions', async () => {
        const onChange = jest.fn();
        const {container} = renderWithContext(
            <PermissionGroup
                {...defaultProps}
                role={{permissions: ['invite_user']}}
                onChange={onChange}
            />,
        );
        const groupRow = container.querySelector('.permission-group-row')!;
        await userEvent.setup().click(groupRow);
        expect(onChange).toHaveBeenCalledWith(['add_user_to_team']);
    });

    test('should call correctly onChange function on click with all permissions', async () => {
        const onChange = jest.fn();
        const {container} = renderWithContext(
            <PermissionGroup
                {...defaultProps}
                role={{permissions: ['invite_user', 'add_user_to_team']}}
                onChange={onChange}
            />,
        );
        const groupRow = container.querySelector('.permission-group-row')!;
        await userEvent.setup().click(groupRow);
        expect(onChange).toHaveBeenCalledWith(['invite_user', 'add_user_to_team']);
    });

    test('shouldn\'t call onChange function on click when is read-only', async () => {
        const onChange = jest.fn();
        const {container} = renderWithContext(
            <PermissionGroup
                {...defaultProps}
                readOnly={true}
                onChange={onChange}
            />,
        );
        const groupRow = container.querySelector('.permission-group-row')!;
        await userEvent.setup().click(groupRow);
        expect(onChange).not.toHaveBeenCalled();
    });

    test('should collapse when toggle to all permissions and expand otherwise', async () => {
        // Start with some permissions (intermediate state) -> clicking toggles to all -> should collapse
        const {container, rerender} = renderWithContext(
            <PermissionGroup
                {...defaultProps}
                role={{permissions: ['invite_user']}}
            />,
        );

        const arrow = container.querySelector('.permission-arrow')!;
        expect(arrow).toHaveClass('open'); // expanded by default

        const groupRow = container.querySelector('.permission-group-row')!;
        await userEvent.setup().click(groupRow);

        // After toggling intermediate -> all checked, it should collapse
        expect(arrow).not.toHaveClass('open');

        // Now render with all permissions (checked state) and collapsed
        rerender(
            <PermissionGroup
                {...defaultProps}
                role={{permissions: ['invite_user', 'add_user_to_team']}}
            />,
        );

        // Click again to toggle all -> none, should expand
        await userEvent.setup().click(container.querySelector('.permission-group-row')!);
        expect(container.querySelector('.permission-arrow')).toHaveClass('open');
    });

    test('should toggle correctly between states', async () => {
        // Start with some permissions (intermediate) -> click toggles to all
        let onChange = jest.fn();
        const user = userEvent.setup();
        const {container, rerender} = renderWithContext(
            <PermissionGroup
                {...defaultProps}
                role={{permissions: ['invite_user']}}
                onChange={onChange}
            />,
        );

        let groupRow = container.querySelector('.permission-group-row')!;
        await user.click(groupRow);
        expect(onChange).toHaveBeenCalledWith(['add_user_to_team']);

        // Simulate parent applying the change: now all permissions are checked
        onChange = jest.fn();
        rerender(
            <PermissionGroup
                {...defaultProps}
                role={{permissions: ['invite_user', 'add_user_to_team']}}
                onChange={onChange}
            />,
        );
        groupRow = container.querySelector('.permission-group-row')!;
        await user.click(groupRow);

        // When all checked -> unchecks all, saves prevPermissions as current role.permissions
        expect(onChange).toHaveBeenCalledWith(['invite_user', 'add_user_to_team']);

        // Simulate parent applying the change: now no permissions
        onChange = jest.fn();
        rerender(
            <PermissionGroup
                {...defaultProps}
                role={{permissions: []}}
                onChange={onChange}
            />,
        );
        groupRow = container.querySelector('.permission-group-row')!;
        await user.click(groupRow);

        // When none checked -> restores prevPermissions saved from the intermediate->checked transition
        // The component saved prevPermissions = ['invite_user'] (the role.permissions at step 1)
        expect(onChange).toHaveBeenCalledWith(['invite_user']);
    });
});
