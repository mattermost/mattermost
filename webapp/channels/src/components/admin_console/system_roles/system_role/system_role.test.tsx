// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';

import {TestHelper} from 'utils/test_helper';

import SystemRole from './system_role';

// Mock the dependencies to avoid rendering issues
jest.mock('./system_role_permissions', () => 
    function MockSystemRolePermissions() {
        return <div data-testid="system-role-permissions" />;
    }
);

jest.mock('./system_role_users', () => 
    function MockSystemRoleUsers() {
        return <div data-testid="system-role-users" />;
    }
);

jest.mock('components/admin_console/save_changes_panel', () => 
    function MockSaveChangesPanel() {
        return <div data-testid="save-changes-panel" />;
    }
);

jest.mock('components/admin_console/blockable_link', () => (props: any) => (
    <a {...props} data-testid="blockable-link" />
));

describe('admin_console/system_role', () => {
    const props = {
        role: TestHelper.getRoleMock(),
        isDisabled: false,
        isLicensedForCloud: false,
        actions: {
            editRole: jest.fn(),
            updateUserRoles: jest.fn(),
            setNavigationBlocked: jest.fn(),
        },
    };

    const renderComponent = (customProps = {}) => {
        const mergedProps = {...props, ...customProps};
        return render(
            <MemoryRouter>
                <SystemRole {...mergedProps} />
            </MemoryRouter>
        );
    };

    test('should render correctly with default props', () => {
        const {container, getByTestId} = renderComponent();
        
        // Verify that the component renders properly
        expect(getByTestId('system-role-permissions')).toBeInTheDocument();
        expect(getByTestId('system-role-users')).toBeInTheDocument();
        expect(getByTestId('save-changes-panel')).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    test('should render correctly with isLicensedForCloud = true', () => {
        const {container, getByTestId} = renderComponent({isLicensedForCloud: true});
        
        // Verify that the component renders properly
        expect(getByTestId('system-role-permissions')).toBeInTheDocument();
        expect(getByTestId('system-role-users')).toBeInTheDocument();
        expect(getByTestId('save-changes-panel')).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });
});
