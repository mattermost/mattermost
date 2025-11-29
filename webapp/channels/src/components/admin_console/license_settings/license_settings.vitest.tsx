// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, waitFor} from 'tests/vitest_react_testing_utils';
import {LicenseSkus} from 'utils/constants';

import LicenseSettings from './license_settings';

describe('components/admin_console/license_settings/LicenseSettings', () => {
    const defaultProps = {
        isDisabled: false,
        license: {
            IsLicensed: 'true',
            IssuedAt: '1517714643650',
            StartsAt: '1517714643650',
            ExpiresAt: '1620335443650',
            SkuShortName: LicenseSkus.E20,
            Name: 'LicenseName',
            Company: 'Mattermost Inc.',
            Users: '100',
        },
        prevTrialLicense: {
            IsLicensed: 'false',
        },
        upgradedFromTE: false,
        enterpriseReady: true,
        totalUsers: 10,
        environmentConfig: {},
        actions: {
            getLicenseConfig: vi.fn(),
            uploadLicense: vi.fn(),
            removeLicense: vi.fn(),
            upgradeToE0: vi.fn(),
            ping: vi.fn(),
            requestTrialLicense: vi.fn(),
            restartServer: vi.fn(),
            getPrevTrialLicense: vi.fn(),
            upgradeToE0Status: vi.fn().mockImplementation(() => Promise.resolve({percentage: 0, error: null})),
            openModal: vi.fn(),
            getFilteredUsersStats: vi.fn(),
            getServerLimits: vi.fn(),
            isAllowedToUpgradeToEnterprise: vi.fn().mockImplementation(() => Promise.resolve({})),
        },
    };

    const initialState = {
        entities: {
            general: {
                license: {
                    IsLicensed: 'true',
                },
            },
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the page title', async () => {
        renderWithContext(
            <LicenseSettings {...defaultProps}/>,
            initialState,
        );

        await waitFor(() => {
            expect(defaultProps.actions.getLicenseConfig).toHaveBeenCalled();
        });

        expect(screen.getByText('Edition and License')).toBeInTheDocument();
    });

    it('renders enterprise edition with license', async () => {
        renderWithContext(
            <LicenseSettings {...defaultProps}/>,
            initialState,
        );

        await waitFor(() => {
            expect(defaultProps.actions.getLicenseConfig).toHaveBeenCalled();
        });

        // Should display license info
        expect(screen.getByText('Mattermost Inc.')).toBeInTheDocument();
    });

    it('renders with isDisabled set to true', async () => {
        renderWithContext(
            <LicenseSettings
                {...defaultProps}
                isDisabled={true}
            />,
            initialState,
        );

        await waitFor(() => {
            expect(defaultProps.actions.getLicenseConfig).toHaveBeenCalled();
        });

        expect(screen.getByText('Edition and License')).toBeInTheDocument();
    });

    it('renders enterprise build without license', async () => {
        const props = {...defaultProps, license: {IsLicensed: 'false'}};
        renderWithContext(
            <LicenseSettings {...props}/>,
            initialState,
        );

        await waitFor(() => {
            expect(defaultProps.actions.getLicenseConfig).toHaveBeenCalled();
        });

        // Should show starter edition panel when no license
        expect(screen.getByText('Edition and License')).toBeInTheDocument();
    });

    it('renders team edition build without license', async () => {
        const props = {...defaultProps, enterpriseReady: false, license: {IsLicensed: 'false'}};
        renderWithContext(
            <LicenseSettings {...props}/>,
            initialState,
        );

        await waitFor(() => {
            expect(defaultProps.actions.isAllowedToUpgradeToEnterprise).toHaveBeenCalled();
        });

        expect(screen.getByText('Edition and License')).toBeInTheDocument();
    });

    it('calls getLicenseConfig on mount', async () => {
        renderWithContext(
            <LicenseSettings {...defaultProps}/>,
            initialState,
        );

        await waitFor(() => {
            expect(defaultProps.actions.getLicenseConfig).toHaveBeenCalledTimes(1);
        });
    });

    it('calls getFilteredUsersStats on mount', async () => {
        renderWithContext(
            <LicenseSettings {...defaultProps}/>,
            initialState,
        );

        await waitFor(() => {
            expect(defaultProps.actions.getFilteredUsersStats).toHaveBeenCalledWith({include_bots: false, include_deleted: false});
        });
    });

    it('calls getPrevTrialLicense on mount for enterprise ready', async () => {
        renderWithContext(
            <LicenseSettings {...defaultProps}/>,
            initialState,
        );

        await waitFor(() => {
            expect(defaultProps.actions.getPrevTrialLicense).toHaveBeenCalledTimes(1);
        });
    });

    it('calls isAllowedToUpgradeToEnterprise on mount for non-enterprise ready', async () => {
        const props = {...defaultProps, enterpriseReady: false};
        renderWithContext(
            <LicenseSettings {...props}/>,
            initialState,
        );

        await waitFor(() => {
            expect(defaultProps.actions.isAllowedToUpgradeToEnterprise).toHaveBeenCalledTimes(1);
        });
    });
});
