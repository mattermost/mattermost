// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {AdminConfig} from '@mattermost/types/config';

import CustomTermsOfServiceSettings from 'components/admin_console/custom_terms_of_service_settings/custom_terms_of_service_settings';

import {renderWithContext, waitFor} from 'tests/vitest_react_testing_utils';

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

    test('should match snapshot', async () => {
        const {container} = renderWithContext(
            <CustomTermsOfServiceSettings
                {...baseProps}
            />,
        );

        // Wait for async getTermsOfService to complete
        await waitFor(() => {
            expect(baseProps.actions.getTermsOfService).toHaveBeenCalled();
        });

        expect(container).toMatchSnapshot();
    });
});
