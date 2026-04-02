// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, waitFor} from '@testing-library/react';
import React from 'react';

import type {AdminConfig} from '@mattermost/types/config';

import CustomTermsOfServiceSettings from 'components/admin_console/custom_terms_of_service_settings/custom_terms_of_service_settings';

import {renderWithContext, userEvent} from 'tests/react_testing_utils';

describe('components/admin_console/CustomTermsOfServiceSettings', () => {
    const getBaseProps = () => ({
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
    });

    async function renderLoaded(props: ReturnType<typeof getBaseProps>) {
        const view = renderWithContext(
            <CustomTermsOfServiceSettings
                {...props}
            />,
        );
        expect(await screen.findByText('Enable Custom Terms of Service')).toBeInTheDocument();
        return view;
    }

    test('should match snapshot', async () => {
        const props = getBaseProps();
        const {container} = await renderLoaded(props);

        expect(container).toMatchSnapshot();
    });

    test('save button is disabled until a setting is changed, then enabled after edit', async () => {
        const user = userEvent.setup();
        const props = getBaseProps();
        await renderLoaded(props);

        const saveButton = screen.getByTestId('saveSetting');
        expect(saveButton).toBeDisabled();

        const periodInput = screen.getByTestId('SupportSettings.CustomTermsOfServiceReAcceptancePeriodnumber');
        await user.clear(periodInput);
        await user.type(periodInput, '364');

        await waitFor(() => {
            expect(saveButton).not.toBeDisabled();
        });
    });

    test('shows saving state on the save button while patchConfig is in progress', async () => {
        const user = userEvent.setup();
        const props = getBaseProps();

        let resolvePatch!: (value: {data: AdminConfig; error?: undefined}) => void;
        props.patchConfig = jest.fn(
            () =>
                new Promise((resolve) => {
                    resolvePatch = resolve;
                }),
        );

        await renderLoaded(props);

        const periodInput = screen.getByTestId('SupportSettings.CustomTermsOfServiceReAcceptancePeriodnumber');
        await user.clear(periodInput);
        await user.type(periodInput, '364');

        await user.click(screen.getByTestId('saveSetting'));

        expect(await screen.findByText('Saving Config...')).toBeInTheDocument();

        const savedConfig = JSON.parse(JSON.stringify(props.config)) as AdminConfig;
        savedConfig.SupportSettings!.CustomTermsOfServiceReAcceptancePeriod = 364;

        resolvePatch({data: savedConfig});

        await waitFor(() => {
            expect(screen.queryByText('Saving Config...')).not.toBeInTheDocument();
        });

        expect(props.patchConfig).toHaveBeenCalledTimes(1);
    });

    test('shows server error when patchConfig returns an error', async () => {
        const user = userEvent.setup();
        const props = getBaseProps();
        props.patchConfig = jest.fn().mockResolvedValue({
            data: undefined,
            error: {
                message: 'error',
                server_error_id: 'test.patch_config.error',
            },
        });

        await renderLoaded(props);

        const periodInput = screen.getByTestId('SupportSettings.CustomTermsOfServiceReAcceptancePeriodnumber');
        await user.clear(periodInput);
        await user.type(periodInput, '364');

        await user.click(screen.getByTestId('saveSetting'));

        expect(await screen.findByText('error')).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.queryByText('Saving Config...')).not.toBeInTheDocument();
        });
    });
});
