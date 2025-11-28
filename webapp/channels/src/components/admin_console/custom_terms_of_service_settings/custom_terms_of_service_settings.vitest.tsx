// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, waitFor} from '@testing-library/react';
import React from 'react';
import {describe, test, expect, vi} from 'vitest';

import type {AdminConfig} from '@mattermost/types/config';

import CustomTermsOfServiceSettings from 'components/admin_console/custom_terms_of_service_settings/custom_terms_of_service_settings';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

describe('components/admin_console/CustomTermsOfServiceSettings', () => {
    const baseProps = {
        actions: {
            createTermsOfService: vi.fn(),
            getTermsOfService: vi.fn().mockResolvedValue({data: {id: 'tos_id', text: 'tos_text'}}),
        },
        config: {
            SupportSettings: {
                CustomTermsOfServiceEnabled: true,
                CustomTermsOfServiceReAcceptancePeriod: 365,
            },
        } as AdminConfig,
        license: {
            IsLicensed: 'true',
            CustomTermsOfService: 'true',
        },
        setNavigationBlocked: vi.fn(),
        patchConfig: vi.fn(),
    };

    test('should render the component with enabled terms of service', async () => {
        renderWithContext(
            <CustomTermsOfServiceSettings
                {...baseProps}
            />,
        );

        // Wait for loading to complete
        await waitFor(() => {
            expect(screen.queryByText('Loading')).not.toBeInTheDocument();
        });

        // Check that the title is rendered
        expect(screen.getByText('Custom Terms of Service')).toBeInTheDocument();

        // Check that the enable setting is rendered
        expect(screen.getByText('Enable Custom Terms of Service')).toBeInTheDocument();

        // Check that the text setting is rendered
        expect(screen.getByText('Custom Terms of Service Text')).toBeInTheDocument();

        // Check that the re-acceptance period setting is rendered
        expect(screen.getByText('Re-Acceptance Period:')).toBeInTheDocument();
    });

    test('should render loading state initially', () => {
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                getTermsOfService: vi.fn().mockReturnValue(new Promise(() => {})), // Never resolves
            },
        };

        renderWithContext(
            <CustomTermsOfServiceSettings
                {...props}
            />,
        );

        // Check that loading is shown
        expect(screen.getByText('Loading')).toBeInTheDocument();
    });

    test('should render with disabled license', async () => {
        const props = {
            ...baseProps,
            license: {
                IsLicensed: 'false',
                CustomTermsOfService: 'false',
            },
        };

        renderWithContext(
            <CustomTermsOfServiceSettings
                {...props}
            />,
        );

        // Wait for loading to complete
        await waitFor(() => {
            expect(screen.queryByText('Loading')).not.toBeInTheDocument();
        });

        // The toggle should be disabled when license is not valid
        const toggle = screen.getByTestId('SupportSettings.CustomTermsOfServiceEnabledtrue');
        expect(toggle).toBeDisabled();
    });

    test('should render when terms of service is disabled in config', async () => {
        const props = {
            ...baseProps,
            config: {
                SupportSettings: {
                    CustomTermsOfServiceEnabled: false,
                    CustomTermsOfServiceReAcceptancePeriod: 365,
                },
            } as AdminConfig,
        };

        renderWithContext(
            <CustomTermsOfServiceSettings
                {...props}
            />,
        );

        // Wait for loading to complete
        await waitFor(() => {
            expect(screen.queryByText('Loading')).not.toBeInTheDocument();
        });

        // The false radio should be checked when terms is disabled
        const falseToggle = screen.getByTestId('SupportSettings.CustomTermsOfServiceEnabledfalse');
        expect(falseToggle).toBeChecked();
    });

    test('should call getTermsOfService on mount', async () => {
        const getTermsOfService = vi.fn().mockResolvedValue({data: {id: 'tos_id', text: 'tos_text'}});
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                getTermsOfService,
            },
        };

        renderWithContext(
            <CustomTermsOfServiceSettings
                {...props}
            />,
        );

        await waitFor(() => {
            expect(getTermsOfService).toHaveBeenCalledTimes(1);
        });
    });
});
