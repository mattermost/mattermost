// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, waitFor} from '@testing-library/react';
import React from 'react';
import {MemoryRouter} from 'react-router-dom';

import type {AdminConfig} from '@mattermost/types/config';

import CustomTermsOfServiceSettings from 'components/admin_console/custom_terms_of_service_settings/custom_terms_of_service_settings';

import {renderWithContext} from 'tests/react_testing_utils';

describe('components/admin_console/CustomTermsOfServiceSettings', () => {
    const baseProps = {
        actions: {
            createTermsOfService: jest.fn(),
            getTermsOfService: jest.fn().mockResolvedValue({data: {id: 'tos_id', text: 'tos_text'}}),
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
        setNavigationBlocked: jest.fn(),
        patchConfig: jest.fn(),
    };

    test('should render form fields correctly', async () => {
        renderWithContext(
            <MemoryRouter>
                <CustomTermsOfServiceSettings {...baseProps}/>
            </MemoryRouter>,
        );

        // Wait for loading screen to disappear
        await waitFor(() => {
            expect(screen.queryByText('Loading')).not.toBeInTheDocument();
        });

        // Check for main section title
        expect(screen.getByText('Custom Terms of Service')).toBeInTheDocument();

        // Check for form fields
        expect(screen.getByText('Enable Custom Terms of Service')).toBeInTheDocument();
        expect(screen.getByText('Custom Terms of Service Text')).toBeInTheDocument();
        expect(screen.getByText('Re-Acceptance Period:')).toBeInTheDocument();

        // Verify radio buttons for enabled setting
        const trueRadio = screen.getByTestId('SupportSettings.CustomTermsOfServiceEnabledtrue');
        expect(trueRadio).toBeChecked();

        // Check that terms text is loaded from API
        const textArea = screen.getByTestId('SupportSettings.CustomTermsOfServiceTextinput');
        expect(textArea).toHaveValue('tos_text');

        // Check that re-acceptance period is set correctly
        const reAcceptanceInput = screen.getByTestId('SupportSettings.CustomTermsOfServiceReAcceptancePeriodnumber');
        expect(reAcceptanceInput).toHaveValue(365);
    });

    test('should call getTermsOfService on mount', () => {
        renderWithContext(
            <MemoryRouter>
                <CustomTermsOfServiceSettings {...baseProps}/>
            </MemoryRouter>,
        );

        expect(baseProps.actions.getTermsOfService).toHaveBeenCalledTimes(1);
    });

    test('should disable fields when license does not allow custom terms', async () => {
        const props = {
            ...baseProps,
            license: {
                IsLicensed: 'true',
                CustomTermsOfService: 'false',
            },
        };

        renderWithContext(
            <MemoryRouter>
                <CustomTermsOfServiceSettings {...props}/>
            </MemoryRouter>,
        );

        // Wait for loading screen to disappear
        await waitFor(() => {
            expect(screen.queryByText('Loading')).not.toBeInTheDocument();
        });

        // Fields should be disabled without the proper license
        const enableInput = screen.getByTestId('SupportSettings.CustomTermsOfServiceEnabledtrue');
        expect(enableInput).toBeDisabled();
    });

    test('should disable text area and re-acceptance period when terms are disabled', async () => {
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
            <MemoryRouter>
                <CustomTermsOfServiceSettings {...props}/>
            </MemoryRouter>,
        );

        // Wait for loading screen to disappear
        await waitFor(() => {
            expect(screen.queryByText('Loading')).not.toBeInTheDocument();
        });

        // Text area and re-acceptance fields should be disabled when terms are disabled
        const textArea = screen.getByTestId('SupportSettings.CustomTermsOfServiceTextinput');
        const reAcceptanceInput = screen.getByTestId('SupportSettings.CustomTermsOfServiceReAcceptancePeriodnumber');
        expect(textArea).toBeDisabled();
        expect(reAcceptanceInput).toBeDisabled();
    });
});
