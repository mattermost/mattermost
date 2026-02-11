// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ClientLicense, License} from '@mattermost/types/config';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import LicenseDiffView from './license_diff_view';

describe('components/admin_console/license_settings/modals/license_diff_view', () => {
    const initialState = {
        entities: {
            users: {
                currentUserId: '',
            },
        },
    };

    const baseCurrentLicense: ClientLicense = {
        IsLicensed: 'true',
        SkuName: 'Professional',
        SkuShortName: 'professional',
        StartsAt: '1704067200000', // 2024-01-01
        ExpiresAt: '1735689600000', // 2025-01-01
        Users: '100',
        Name: 'Test User',
        Company: 'Test Company',
    };

    const baseNewLicense: License = {
        id: 'license_id',
        issued_at: 1704067200000,
        starts_at: 1735689600000, // 2025-01-01
        expires_at: 1767225600000, // 2026-01-01
        sku_name: 'Enterprise',
        sku_short_name: 'enterprise',
        customer: {
            id: 'customer_id',
            name: 'New Test User',
            email: 'test@example.com',
            company: 'New Test Company',
        },
        features: {
            users: 200,
        },
    };

    const locale = 'en';

    test('should render comparison view when current license exists', () => {
        renderWithContext(
            <LicenseDiffView
                currentLicense={baseCurrentLicense}
                newLicense={baseNewLicense}
                locale={locale}
            />,
            initialState,
        );

        // Should show labels
        expect(screen.getByText('Plan')).toBeInTheDocument();
        expect(screen.getByText('Start Date')).toBeInTheDocument();
        expect(screen.getByText('Expiration Date')).toBeInTheDocument();
        expect(screen.getByText('Users')).toBeInTheDocument();
        expect(screen.getByText('Name')).toBeInTheDocument();
        expect(screen.getByText('Company')).toBeInTheDocument();

        // Should show current values
        expect(screen.getByText('Professional')).toBeInTheDocument();
        expect(screen.getByText('100')).toBeInTheDocument();
        expect(screen.getByText('Test User')).toBeInTheDocument();
        expect(screen.getByText('Test Company')).toBeInTheDocument();

        // Should show new values
        expect(screen.getByText('Enterprise')).toBeInTheDocument();
        expect(screen.getByText('200')).toBeInTheDocument();
        expect(screen.getByText('New Test User')).toBeInTheDocument();
        expect(screen.getByText('New Test Company')).toBeInTheDocument();
    });

    test('should render info-only view when current license is entry', () => {
        const entryLicense: ClientLicense = {
            ...baseCurrentLicense,
            SkuShortName: 'entry',
            SkuName: 'Entry',
        };

        renderWithContext(
            <LicenseDiffView
                currentLicense={entryLicense}
                newLicense={baseNewLicense}
                locale={locale}
            />,
            initialState,
        );

        // Should have info-only table class
        const table = screen.getByRole('table');
        expect(table).toHaveClass('info-only');

        // Should show new license info only
        expect(screen.getByText('Enterprise')).toBeInTheDocument();
        expect(screen.getByText('200')).toBeInTheDocument();
        expect(screen.getByText('New Test User')).toBeInTheDocument();
        expect(screen.getByText('New Test Company')).toBeInTheDocument();

        // Should NOT show current license values
        expect(screen.queryByText('Professional')).not.toBeInTheDocument();
        expect(screen.queryByText('100')).not.toBeInTheDocument();

        // Should show End Date label instead of Expiration Date
        expect(screen.getByText('End Date')).toBeInTheDocument();
        expect(screen.queryByText('Expiration Date')).not.toBeInTheDocument();
    });

    test('should show warning banner for entry to professional transition', () => {
        const entryLicense: ClientLicense = {
            ...baseCurrentLicense,
            SkuShortName: 'entry',
            SkuName: 'Entry',
        };

        const professionalLicense: License = {
            ...baseNewLicense,
            sku_name: 'Professional',
            sku_short_name: 'professional',
        };

        const {container} = renderWithContext(
            <LicenseDiffView
                currentLicense={entryLicense}
                newLicense={professionalLicense}
                locale={locale}
            />,
            initialState,
        );

        expect(screen.getByText('This license changes your available features')).toBeInTheDocument();
        expect(container.querySelector('.license-transition-banner--warning')).toBeInTheDocument();
        expect(screen.getByText('View plan differences')).toBeInTheDocument();
    });

    test('should show info banner for entry to enterprise transition', () => {
        const entryLicense: ClientLicense = {
            ...baseCurrentLicense,
            SkuShortName: 'entry',
            SkuName: 'Entry',
        };

        const {container} = renderWithContext(
            <LicenseDiffView
                currentLicense={entryLicense}
                newLicense={baseNewLicense}
                locale={locale}
            />,
            initialState,
        );

        expect(screen.getByText('This license adds Enterprise capabilities, with feature changes')).toBeInTheDocument();
        expect(container.querySelector('.license-transition-banner--info')).toBeInTheDocument();
        expect(screen.getByText('View plan differences')).toBeInTheDocument();
    });

    test('should show success banner for entry to enterprise advanced transition', () => {
        const entryLicense: ClientLicense = {
            ...baseCurrentLicense,
            SkuShortName: 'entry',
            SkuName: 'Entry',
        };

        const advancedLicense: License = {
            ...baseNewLicense,
            sku_name: 'Enterprise Advanced',
            sku_short_name: 'advanced',
        };

        const {container} = renderWithContext(
            <LicenseDiffView
                currentLicense={entryLicense}
                newLicense={advancedLicense}
                locale={locale}
            />,
            initialState,
        );

        expect(screen.getByText('This license adds Enterprise Advanced capabilities')).toBeInTheDocument();
        expect(container.querySelector('.license-transition-banner--success')).toBeInTheDocument();
        expect(screen.queryByText('View plan differences')).not.toBeInTheDocument();
    });

    test('should not show banner when no current license', () => {
        const emptyLicense: ClientLicense = {};

        const {container} = renderWithContext(
            <LicenseDiffView
                currentLicense={emptyLicense}
                newLicense={baseNewLicense}
                locale={locale}
            />,
            initialState,
        );

        expect(container.querySelector('.license-transition-banner')).not.toBeInTheDocument();
    });

    test('should highlight changed values', () => {
        const {container} = renderWithContext(
            <LicenseDiffView
                currentLicense={baseCurrentLicense}
                newLicense={baseNewLicense}
                locale={locale}
            />,
            initialState,
        );

        // Find rows with 'changed' class (values that differ)
        const changedRows = container.querySelectorAll('.diff-row.changed');
        expect(changedRows.length).toBeGreaterThan(0);
    });

    test('should not highlight unchanged values', () => {
        const sameLicense: License = {
            ...baseNewLicense,
            sku_name: 'Professional',
            sku_short_name: 'professional',
            customer: {
                ...baseNewLicense.customer!,
                name: 'Test User',
                company: 'Test Company',
            },
            features: {
                users: 100,
            },
        };

        const {container} = renderWithContext(
            <LicenseDiffView
                currentLicense={baseCurrentLicense}
                newLicense={sameLicense}
                locale={locale}
            />,
            initialState,
        );

        // Find the Plan row (SKU) - should not be changed
        const rows = container.querySelectorAll('.diff-row');
        const planRow = Array.from(rows).find((row) =>
            row.querySelector('.diff-label')?.textContent === 'Plan',
        );
        expect(planRow).not.toHaveClass('changed');
    });

    test('should display dash for missing values', () => {
        const licenseWithMissingData: License = {
            ...baseNewLicense,
            customer: undefined,
        };

        renderWithContext(
            <LicenseDiffView
                currentLicense={baseCurrentLicense}
                newLicense={licenseWithMissingData}
                locale={locale}
            />,
            initialState,
        );

        // Should show '-' for missing customer name and company
        const dashes = screen.getAllByText('-');
        expect(dashes.length).toBeGreaterThan(0);
    });
});
