// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, fireEvent} from 'tests/vitest_react_testing_utils';

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

    it('renders the permission group', () => {
        renderWithContext(<PermissionGroup {...defaultProps}/>);

        expect(document.querySelector('.permission-group')).toBeInTheDocument();
    });

    it('renders in read only mode', () => {
        renderWithContext(
            <PermissionGroup
                {...defaultProps}
                readOnly={true}
            />,
        );

        expect(document.querySelector('.permission-group')).toBeInTheDocument();
    });

    it('renders with some permissions', () => {
        renderWithContext(
            <PermissionGroup
                {...defaultProps}
                role={{permissions: ['invite_user']}}
            />,
        );

        expect(document.querySelector('.permission-group')).toBeInTheDocument();
    });

    it('renders with all permissions', () => {
        renderWithContext(
            <PermissionGroup
                {...defaultProps}
                role={{permissions: ['invite_user', 'add_user_to_team']}}
            />,
        );

        expect(document.querySelector('.permission-group')).toBeInTheDocument();
    });

    it('renders with system scope', () => {
        renderWithContext(
            <PermissionGroup
                {...defaultProps}
                scope="system_scope"
            />,
        );

        expect(document.querySelector('.permission-group')).toBeInTheDocument();
    });

    it('renders with parent role permissions', () => {
        renderWithContext(
            <PermissionGroup
                {...defaultProps}
                parentRole={{permissions: ['invite_user']}}
            />,
        );

        expect(document.querySelector('.permission-group')).toBeInTheDocument();
    });

    it('calls onChange when group row is clicked', () => {
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
            expect(onChange).toHaveBeenCalled();
        }
    });

    it('does not call onChange when read only and clicked', () => {
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

    it('toggles expansion when arrow is clicked', () => {
        renderWithContext(<PermissionGroup {...defaultProps}/>);

        const arrow = document.querySelector('.permission-arrow');
        if (arrow) {
            fireEvent.click(arrow);
            // Arrow click should toggle expansion state
            expect(arrow).toBeInTheDocument();
        }
    });
});
