// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import ConfigurationBar from 'components/announcement_bar/configuration_bar/configuration_bar';

import {renderWithContext} from 'tests/react_testing_utils';

describe('components/ConfigurationBar', () => {
    const millisPerDay = 24 * 60 * 60 * 1000;

    const baseProps = {
        isLoggedIn: true,
        canViewSystemErrors: true,
        license: {
            Id: '1234',
            IsLicensed: 'true',
            ExpiresAt: Date.now() + millisPerDay,
            ShortSkuName: 'skuShortName',
        },
        config: {
            SendEmailNotifications: 'false',
        },
        dismissedExpiringLicense: false,
        dismissedExpiredLicense: false,
        siteURL: '',
        totalUsers: 100,
        actions: {
            dismissNotice: jest.fn(),
            savePreferences: jest.fn(),
        },
        currentUserId: 'user-id',
    };

    test('should match snapshot, expired, in grace period', async () => {
        const props = {...baseProps, license: {Id: '1234', IsLicensed: 'true', ExpiresAt: Date.now() - millisPerDay, SkuShortName: 'enterprise'}};
        const {container} = await renderWithContext(
            <ConfigurationBar {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, expired', async () => {
        const props = {...baseProps, license: {Id: '1234', IsLicensed: 'true', ExpiresAt: Date.now() - (11 * millisPerDay), SkuShortName: 'enterprise'}};
        const {container} = await renderWithContext(
            <ConfigurationBar {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, expired, regular user', async () => {
        const props = {...baseProps, canViewSystemErrors: false, license: {Id: '1234', IsLicensed: 'true', ExpiresAt: Date.now() - (11 * millisPerDay), SkuShortName: 'enterprise'}};
        const {container} = await renderWithContext(
            <ConfigurationBar {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, expired, cloud license, show nothing', async () => {
        const props = {...baseProps, canViewSystemErrors: false, license: {Id: '1234', IsLicensed: 'true', Cloud: 'true', ExpiresAt: Date.now() - (11 * millisPerDay)}};
        const {container} = await renderWithContext(
            <ConfigurationBar {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, expiring, cloud license, show nothing', async () => {
        const props = {...baseProps, canViewSystemErrors: false, license: {Id: '1234', IsLicensed: 'true', Cloud: 'true', ExpiresAt: Date.now()}};
        const {container} = await renderWithContext(
            <ConfigurationBar {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, show nothing', async () => {
        const props = {...baseProps, license: {Id: '1234', IsLicensed: 'true', ExpiresAt: Date.now() + (61 * millisPerDay)}};
        const {container} = await renderWithContext(
            <ConfigurationBar {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, expiring, trial license, mobile viewport', async () => {
        Object.defineProperty(window, 'innerWidth', {
            writable: true,
            configurable: true,
            value: 150,
        });

        window.dispatchEvent(new Event('500'));
        const props = {...baseProps, canViewSystemErrors: true, license: {Id: '1234', IsLicensed: 'true', IsTrial: 'true', ExpiresAt: Date.now() + 1}};
        const {container} = await renderWithContext(
            <ConfigurationBar {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, expiring, trial license', async () => {
        Object.defineProperty(window, 'innerWidth', {
            writable: true,
            configurable: true,
            value: 1000,
        });

        window.dispatchEvent(new Event('500'));
        const props = {...baseProps, canViewSystemErrors: true, license: {Id: '1234', IsLicensed: 'true', IsTrial: 'true', ExpiresAt: Date.now() + 1}};
        const {container} = await renderWithContext(
            <ConfigurationBar {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });
});
