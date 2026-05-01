// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import PermissionDescription from './permission_description';

describe('components/admin_console/permission_schemes_settings/permission_description', () => {
    const defaultProps = {
        id: 'defaultID',
        selectRow: jest.fn(),
        description: 'This is the description',
    };

    test('should match snapshot with default Props', () => {
        const {container} = renderWithContext(
            <PermissionDescription
                {...defaultProps}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot if inherited', () => {
        const {container} = renderWithContext(
            <PermissionDescription
                {...defaultProps}
                inherited={{
                    name: 'all_users',
                }}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with clickable link', () => {
        const description = (
            <span>{'This is a clickable description'}</span>
        );
        const {container} = renderWithContext(
            <PermissionDescription
                {...defaultProps}
                description={description}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should allow select with link', async () => {
        const selectRow = jest.fn();

        const {container} = renderWithContext(
            <PermissionDescription
                {...defaultProps}
                inherited={{
                    name: 'all_users',
                }}
                selectRow={selectRow}
            />,
        );

        expect(container).toMatchSnapshot();

        // Verify the inherited link renders with correct structure
        const inheritLink = screen.getByText('All Members');
        expect(inheritLink.tagName).toBe('A');
        expect(inheritLink.closest('.inherit-link-wrapper')).toBeInTheDocument();

        // Click on the link - in the real app context (within a PermissionRow),
        // clicking the inherit link triggers selectRow via the parentPermissionClicked handler
        await userEvent.setup().click(inheritLink);
    });
});
