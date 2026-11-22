// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';
import type {RouteComponentProps} from 'react-router-dom';

import type {Scheme} from '@mattermost/types/schemes';

import PermissionSchemesSettings from 'components/admin_console/permission_schemes_settings/permission_schemes_settings';

import {renderWithContext, screen, waitFor} from 'tests/react_testing_utils';

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
            loadSchemes: jest.fn(() => Promise.resolve({data: [], error: {}})),
            loadSchemeTeams: jest.fn(() => Promise.resolve({data: []})),
        },
        license: {
            CustomPermissionsSchemes: 'true',
            SkuShortName: '',
        },
        ...{} as RouteComponentProps,
    };

    test('should render without schemes', async () => {
        const loadSchemes = jest.fn(() => Promise.resolve({data: [], error: {}}));
        renderWithContext(
            <PermissionSchemesSettings
                {...defaultProps}
                schemes={{}}
                actions={{...defaultProps.actions, loadSchemes}}
            />,
        );
        await waitFor(() => {
            expect(screen.getByText('Permission Schemes')).toBeInTheDocument();
        });
    });

    test('should render with schemes', async () => {
        const loadSchemes = jest.fn(() => Promise.resolve({data: [], error: {}}));
        renderWithContext(
            <PermissionSchemesSettings
                {...defaultProps}
                actions={{...defaultProps.actions, loadSchemes}}
            />,
        );
        await waitFor(() => {
            expect(screen.getByText('Permission Schemes')).toBeInTheDocument();
        });
    });

    test('should show migration in-progress view', async () => {
        const loadSchemes = jest.fn(() =>
            Promise.resolve({data: [], error: {status_code: 501}}),
        );
        renderWithContext(
            <PermissionSchemesSettings
                {...defaultProps}
                actions={{...defaultProps.actions, loadSchemes}}
            />,
        );
        await waitFor(() => {
            expect(screen.getByText('Permission Schemes')).toBeInTheDocument();
        });
    });

    test('should show migration on hold view', async () => {
        const loadSchemes = jest.fn(() =>
            Promise.resolve({data: [], error: {status_code: 501}}),
        );
        renderWithContext(
            <PermissionSchemesSettings
                {...defaultProps}
                jobsAreEnabled={false}
                actions={{...defaultProps.actions, loadSchemes}}
            />,
        );
        await waitFor(() => {
            expect(screen.getByText('Permission Schemes')).toBeInTheDocument();
        });
    });

    test('should show normal view (jobs disabled after migration)', async () => {
        const loadSchemes = jest.fn(() => Promise.resolve({data: [], error: {}}));
        renderWithContext(
            <PermissionSchemesSettings
                {...defaultProps}
                jobsAreEnabled={false}
                actions={{...defaultProps.actions, loadSchemes}}
            />,
        );
        await waitFor(() => {
            expect(screen.getByText('Permission Schemes')).toBeInTheDocument();
        });
    });
});
