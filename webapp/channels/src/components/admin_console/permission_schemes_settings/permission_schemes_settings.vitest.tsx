// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import type {Scheme} from '@mattermost/types/schemes';

import {renderWithContext, screen, waitFor} from 'tests/vitest_react_testing_utils';

import PermissionSchemesSettings from './permission_schemes_settings';

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useHistory: () => ({push: vi.fn()}),
        useLocation: () => ({pathname: '/admin_console/user_management/permissions'}),
    };
});

describe('components/admin_console/permission_schemes_settings/permission_schemes_settings', () => {
    const defaultProps: ComponentProps<typeof PermissionSchemesSettings> = {
        schemes: {
            'id-1': {id: 'id-1', name: 'Test 1', description: 'Test description 1'} as Scheme,
            'id-2': {id: 'id-2', name: 'Test 2', description: 'Test description 2'} as Scheme,
            'id-3': {id: 'id-3', name: 'Test 3', description: 'Test description 3'} as Scheme,
        },
        jobsAreEnabled: true,
        clusterIsEnabled: false,
        actions: {
            loadSchemes: vi.fn(() => Promise.resolve({})),
            loadSchemeTeams: vi.fn(),
        },
        license: {
            CustomPermissionsSchemes: 'true',
            SkuShortName: '',
        },
        history: {push: vi.fn(), location: {}, replace: vi.fn()} as any,
        location: {pathname: '/admin_console/user_management/permissions'} as any,
        match: {params: {}, isExact: true, path: '', url: ''} as any,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders permission schemes settings', async () => {
        renderWithContext(
            <PermissionSchemesSettings {...defaultProps}/>,
        );

        await waitFor(() => {
            expect(defaultProps.actions.loadSchemes).toHaveBeenCalled();
        });
    });

    it('renders without schemes', async () => {
        renderWithContext(
            <PermissionSchemesSettings
                {...defaultProps}
                schemes={{}}
            />,
        );

        await waitFor(() => {
            expect(defaultProps.actions.loadSchemes).toHaveBeenCalled();
        });
    });

    it('renders with schemes', async () => {
        renderWithContext(
            <PermissionSchemesSettings {...defaultProps}/>,
        );

        await waitFor(() => {
            expect(defaultProps.actions.loadSchemes).toHaveBeenCalled();
        });
    });

    it('renders with jobs disabled', async () => {
        const testProps = {...defaultProps, jobsAreEnabled: false};
        renderWithContext(
            <PermissionSchemesSettings {...testProps}/>,
        );

        await waitFor(() => {
            expect(testProps.actions.loadSchemes).toHaveBeenCalled();
        });
    });
});
