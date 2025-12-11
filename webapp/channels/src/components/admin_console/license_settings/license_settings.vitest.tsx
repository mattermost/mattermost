// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import {renderWithContext, waitFor} from 'tests/vitest_react_testing_utils';
import {LicenseSkus} from 'utils/constants';

import LicenseSettings from './license_settings';

describe('components/admin_console/license_settings/LicenseSettings', () => {
    // Mock system time to ensure consistent date-based calculations in snapshots
    // Using shouldAdvanceTime to allow waitFor() to work properly
    beforeAll(() => {
        vi.useFakeTimers({shouldAdvanceTime: true});
        vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
    });

    afterAll(() => {
        vi.useRealTimers();
    });
    const defaultProps: ComponentProps<typeof LicenseSettings> = {
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

    test('should match snapshot enterprise build with license', async () => {
        const {container} = renderWithContext(<LicenseSettings {...defaultProps}/>, initialState);
        await waitFor(() => {
            expect(defaultProps.actions.getLicenseConfig).toHaveBeenCalled();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot enterprise build with license and isDisabled set to true', async () => {
        const {container} = renderWithContext(
            <LicenseSettings
                {...defaultProps}
                isDisabled={true}
            />,
            initialState,
        );
        await waitFor(() => {
            expect(defaultProps.actions.getLicenseConfig).toHaveBeenCalled();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot enterprise build with license and upgraded from TE', async () => {
        const props = {...defaultProps, upgradedFromTE: true};
        const {container} = renderWithContext(<LicenseSettings {...props}/>, initialState);
        await waitFor(() => {
            expect(defaultProps.actions.getLicenseConfig).toHaveBeenCalled();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot enterprise build without license', async () => {
        const props = {...defaultProps, license: {IsLicensed: 'false'}};
        const {container} = renderWithContext(<LicenseSettings {...props}/>, initialState);
        await waitFor(() => {
            expect(defaultProps.actions.getLicenseConfig).toHaveBeenCalled();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot enterprise build without license and upgrade from TE', async () => {
        const props = {...defaultProps, license: {IsLicensed: 'false'}, upgradedFromTE: true};
        const {container} = renderWithContext(<LicenseSettings {...props}/>, initialState);
        await waitFor(() => {
            expect(defaultProps.actions.getLicenseConfig).toHaveBeenCalled();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot team edition build without license', async () => {
        const props = {...defaultProps, enterpriseReady: false, license: {IsLicensed: 'false'}};
        const {container} = renderWithContext(<LicenseSettings {...props}/>, initialState);
        await waitFor(() => {
            expect(defaultProps.actions.isAllowedToUpgradeToEnterprise).toHaveBeenCalled();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot team edition build with license', async () => {
        const props = {...defaultProps, enterpriseReady: false};
        const {container} = renderWithContext(<LicenseSettings {...props}/>, initialState);
        await waitFor(() => {
            expect(defaultProps.actions.isAllowedToUpgradeToEnterprise).toHaveBeenCalled();
        });
        expect(container).toMatchSnapshot();
    });

    test('upgrade to enterprise click', async () => {
        const actions = {
            ...defaultProps.actions,
            getLicenseConfig: vi.fn(),
            upgradeToE0: vi.fn(),
            upgradeToE0Status: vi.fn().mockImplementation(() => Promise.resolve({percentage: 0, error: null})),
            isAllowedToUpgradeToEnterprise: vi.fn().mockImplementation(() => Promise.resolve({})),
        };
        const props = {...defaultProps, enterpriseReady: false, actions};
        renderWithContext(<LicenseSettings {...props}/>, initialState);

        await waitFor(() => {
            expect(actions.getLicenseConfig).toHaveBeenCalledTimes(1);
        });

        expect(actions.upgradeToE0Status).toHaveBeenCalledTimes(1);
    });

    test('load screen while upgrading', async () => {
        const actions = {
            ...defaultProps.actions,
            upgradeToE0Status: vi.fn().mockImplementation(() => Promise.resolve({percentage: 42, error: null})),
        };
        const props = {...defaultProps, enterpriseReady: false, actions};
        const {container} = renderWithContext(<LicenseSettings {...props}/>, initialState);
        await waitFor(() => {
            expect(actions.upgradeToE0Status).toHaveBeenCalled();
        });
        expect(container).toMatchSnapshot();
    });

    test('load screen after upgrading', async () => {
        const actions = {
            ...defaultProps.actions,
            upgradeToE0Status: vi.fn().mockImplementation(() => Promise.resolve({percentage: 100, error: null})),
        };
        const props = {...defaultProps, enterpriseReady: false, actions};
        const {container} = renderWithContext(<LicenseSettings {...props}/>, initialState);
        await waitFor(() => {
            expect(actions.upgradeToE0Status).toHaveBeenCalled();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot enterprise build with trial license', async () => {
        const props = {...defaultProps, license: {IsLicensed: 'true', StartsAt: '1617714643650', IssuedAt: '1617714643650', ExpiresAt: '1620335443650'}};
        const {container} = renderWithContext(<LicenseSettings {...props}/>, initialState);
        await waitFor(() => {
            expect(defaultProps.actions.getLicenseConfig).toHaveBeenCalled();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot team edition with expired trial in the past', async () => {
        const props = {...defaultProps, license: {IsLicensed: 'false'}, prevTrialLicense: {IsLicensed: 'true'}};
        const {container} = renderWithContext(<LicenseSettings {...props}/>, initialState);
        await waitFor(() => {
            expect(defaultProps.actions.getLicenseConfig).toHaveBeenCalled();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot enterprise build with E20 license', async () => {
        const props = {...defaultProps, license: {...defaultProps.license, SkuShortName: LicenseSkus.E20}};
        const {container} = renderWithContext(<LicenseSettings {...props}/>, initialState);
        await waitFor(() => {
            expect(defaultProps.actions.getLicenseConfig).toHaveBeenCalled();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot enterprise build with E10 license', async () => {
        const props = {...defaultProps, license: {...defaultProps.license, SkuShortName: LicenseSkus.E10}};
        const {container} = renderWithContext(<LicenseSettings {...props}/>, initialState);
        await waitFor(() => {
            expect(defaultProps.actions.getLicenseConfig).toHaveBeenCalled();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot enterprise build with Enterprise license', async () => {
        const props = {...defaultProps, license: {...defaultProps.license, SkuShortName: LicenseSkus.Enterprise}};
        const {container} = renderWithContext(<LicenseSettings {...props}/>, initialState);
        await waitFor(() => {
            expect(defaultProps.actions.getLicenseConfig).toHaveBeenCalled();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with expiring license', async () => {
        // Set expiration date to 30 days from a fixed date for consistent snapshots
        const expiringDate = Date.now() + (30 * 24 * 60 * 60 * 1000);

        const props = {...defaultProps, license: {...defaultProps.license, ExpiresAt: expiringDate.toString()}};
        const {container} = renderWithContext(<LicenseSettings {...props}/>, initialState);
        await waitFor(() => {
            expect(defaultProps.actions.getLicenseConfig).toHaveBeenCalled();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with cloud expiring license', async () => {
        // Set expiration date to 30 days from a fixed date for consistent snapshots
        const expiringDate = Date.now() + (30 * 24 * 60 * 60 * 1000);

        const props = {...defaultProps, license: {...defaultProps.license, ExpiresAt: expiringDate.toString(), Cloud: 'true'}};
        const {container} = renderWithContext(<LicenseSettings {...props}/>, initialState);
        await waitFor(() => {
            expect(defaultProps.actions.getLicenseConfig).toHaveBeenCalled();
        });
        expect(container).toMatchSnapshot();
    });
});
