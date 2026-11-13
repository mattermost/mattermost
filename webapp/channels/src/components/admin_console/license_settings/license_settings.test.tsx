// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {fakeDate} from 'tests/helpers/date';
import {renderWithContext, screen, act} from 'tests/react_testing_utils';
import {LicenseSkus} from 'utils/constants';

import LicenseSettings from './license_settings';

describe('components/admin_console/license_settings/LicenseSettings', () => {
    let resetFakeDate: {(): void};

    beforeAll(() => {
        resetFakeDate = fakeDate(new Date('2021-04-14T12:00:00Z'));
    });

    afterAll(() => {
        resetFakeDate();
    });

    const defaultProps: React.ComponentProps<typeof LicenseSettings> = {
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
            getLicenseConfig: jest.fn(),
            uploadLicense: jest.fn(),
            removeLicense: jest.fn(),
            upgradeToE0: jest.fn(),
            ping: jest.fn(),
            restartServer: jest.fn(),
            getPrevTrialLicense: jest.fn(),
            upgradeToE0Status: jest.fn().mockImplementation(() => Promise.resolve({percentage: 0, error: null})),
            openModal: jest.fn(),
            getFilteredUsersStats: jest.fn(),
            getServerLimits: jest.fn(),
            isAllowedToUpgradeToEnterprise: jest.fn().mockImplementation(() => Promise.resolve({})),
        },
    };

    test('renders left and right panel-card containers for AdminPanel-equivalent chrome', () => {
        // Surface chrome lives on .panel-card (Compass AdminPanel tokens in
        // license_settings.scss) so the two-column layout is preserved.
        const {container} = renderWithContext(<LicenseSettings {...defaultProps}/>);
        expect(container.querySelectorAll('.left-panel > .panel-card')).toHaveLength(1);
        expect(container.querySelectorAll('.right-panel > .panel-card')).toHaveLength(1);
    });

    test('banner section is empty when no seat/trial/renew banners render', () => {
        // license_settings.scss uses .admin-console__banner_section:empty
        // { display: none } so shared .admin-console__content gap does not
        // add an extra 20px above .top-wrapper when banners return null.
        // Far-future expiry (raw ms; moment parsing is unreliable under fakeDate)
        // + low seat usage keeps renew/seat banners off.
        const props = {
            ...defaultProps,
            license: {
                ...defaultProps.license,
                ExpiresAt: '1893456000000', // 2030-01-01T00:00:00Z
            },
            totalUsers: 1,
        };
        const {container} = renderWithContext(<LicenseSettings {...props}/>);
        const banner = container.querySelector('.admin-console__banner_section');
        expect(banner).not.toBeNull();
        expect(banner!.childElementCount).toBe(0);
    });

    test('upgrade to enterprise click', async () => {
        const promise = Promise.resolve({});
        const actions = {
            ...defaultProps.actions,
            getLicenseConfig: jest.fn(),
            upgradeToE0: jest.fn(),
            upgradeToE0Status: jest.fn().mockImplementation(() => Promise.resolve({percentage: 0, error: null})),
            isAllowedToUpgradeToEnterprise: jest.fn().mockImplementation(() => promise),
        };
        const props = {...defaultProps, enterpriseReady: false, actions};
        renderWithContext(<LicenseSettings {...props}/>);

        await act(async () => {
            await promise;
        });

        expect(actions.getLicenseConfig).toHaveBeenCalledTimes(1);
        expect(actions.upgradeToE0Status).toHaveBeenCalledTimes(1);
        actions.upgradeToE0Status = jest.fn().mockImplementation(() => Promise.resolve({percentage: 1, error: null}));

        // Find and click the upgrade button
        const upgradeButton = screen.getByRole('button', {name: /Upgrade to Enterprise Edition/i});
        expect(upgradeButton).toBeInTheDocument();

        await act(async () => {
            upgradeButton.click();
        });

        expect(actions.upgradeToE0).toHaveBeenCalledTimes(1);
    });
});
