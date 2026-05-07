// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {AdminConfig} from '@mattermost/types/config';

import ElasticSearchSettings from 'components/admin_console/elasticsearch_settings';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

jest.mock('actions/admin_actions.jsx', () => {
    return {
        elasticsearchPurgeIndexes: jest.fn(),
        rebuildChannelsIndex: jest.fn(),
        elasticsearchTest: (config: AdminConfig, success: () => void) => success(),
    };
});

describe('components/ElasticSearchSettings', () => {
    test('should match snapshot, disabled', () => {
        const config = {
            ElasticsearchSettings: {
                ConnectionURL: 'test',
                Backend: '',
                SkipTLSVerification: false,
                CA: 'test.ca',
                ClientCert: 'test.crt',
                ClientKey: 'test.key',
                Username: 'test',
                Password: 'test',
                Sniff: false,
                EnableIndexing: false,
                EnableSearching: false,
                EnableAutocomplete: false,
                EnableSearchPublicChannelsWithoutMembership: false,
                IgnoredPurgeIndexes: '',
            },
        };
        const {container} = renderWithContext(
            <ElasticSearchSettings
                config={config as AdminConfig}
                isDisabled={false}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, enabled', () => {
        const config = {
            ElasticsearchSettings: {
                ConnectionURL: 'test',
                Backend: '',
                SkipTLSVerification: false,
                CA: 'test.ca',
                ClientCert: 'test.crt',
                ClientKey: 'test.key',
                Username: 'test',
                Password: 'test',
                Sniff: false,
                EnableIndexing: true,
                EnableSearching: false,
                EnableAutocomplete: false,
                EnableSearchPublicChannelsWithoutMembership: false,
                IgnoredPurgeIndexes: '',
            },
        };
        const {container} = renderWithContext(
            <ElasticSearchSettings
                config={config as AdminConfig}
                isDisabled={false}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, sniff enabled', () => {
        const config = {
            ElasticsearchSettings: {
                ConnectionURL: 'test',
                Backend: '',
                SkipTLSVerification: false,
                CA: 'test.ca',
                ClientCert: 'test.crt',
                ClientKey: 'test.key',
                Username: 'test',
                Password: 'test',
                Sniff: true,
                EnableIndexing: true,
                EnableSearching: false,
                EnableAutocomplete: false,
                EnableSearchPublicChannelsWithoutMembership: false,
                IgnoredPurgeIndexes: '',
            },
        };
        const {container} = renderWithContext(
            <ElasticSearchSettings
                config={config as AdminConfig}
                isDisabled={false}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should show warning when sniff is enabled', () => {
        const config = {
            ElasticsearchSettings: {
                ConnectionURL: 'test',
                Backend: '',
                SkipTLSVerification: false,
                CA: '',
                ClientCert: '',
                ClientKey: '',
                Username: '',
                Password: '',
                Sniff: true,
                EnableIndexing: true,
                EnableSearching: false,
                EnableAutocomplete: false,
                EnableSearchPublicChannelsWithoutMembership: false,
                IgnoredPurgeIndexes: '',
            },
        };
        renderWithContext(
            <ElasticSearchSettings
                config={config as AdminConfig}
                isDisabled={false}
            />,
        );
        expect(screen.getByText('Do not enable cluster sniffing with cloud-hosted providers such as Elastic Cloud or Amazon OpenSearch Service.')).toBeInTheDocument();
    });

    test('should not show warning when sniff is disabled', () => {
        const config = {
            ElasticsearchSettings: {
                ConnectionURL: 'test',
                Backend: '',
                SkipTLSVerification: false,
                CA: '',
                ClientCert: '',
                ClientKey: '',
                Username: '',
                Password: '',
                Sniff: false,
                EnableIndexing: true,
                EnableSearching: false,
                EnableAutocomplete: false,
                EnableSearchPublicChannelsWithoutMembership: false,
                IgnoredPurgeIndexes: '',
            },
        };
        renderWithContext(
            <ElasticSearchSettings
                config={config as AdminConfig}
                isDisabled={false}
            />,
        );
        expect(screen.queryByText('Do not enable cluster sniffing with cloud-hosted providers such as Elastic Cloud or Amazon OpenSearch Service.')).not.toBeInTheDocument();
    });

    test('should maintain save disable until is tested', async () => {
        const config = {
            ElasticsearchSettings: {
                ConnectionURL: 'test',
                Backend: '',
                SkipTLSVerification: false,
                CA: '',
                ClientCert: '',
                ClientKey: '',
                Username: 'test',
                Password: 'test',
                Sniff: false,
                EnableIndexing: false,
                EnableSearching: false,
                EnableAutocomplete: false,
                EnableSearchPublicChannelsWithoutMembership: false,
                IgnoredPurgeIndexes: '',
            },
        };
        renderWithContext(
            <ElasticSearchSettings
                config={config as AdminConfig}
                isDisabled={false}
            />,
        );

        // Save button should be disabled initially (no changes)
        expect(screen.getByTestId('saveSetting')).toBeDisabled();

        // Enable indexing by clicking the true radio for enableIndexing
        const enableIndexingTrue = screen.getByTestId('enableIndexingtrue');
        await userEvent.click(enableIndexingTrue);

        // Save button should still be disabled because config hasn't been tested
        expect(screen.getByTestId('saveSetting')).toBeDisabled();

        // Click Test Connection button to test config
        const testButton = screen.getByText('Test Connection');
        await userEvent.click(testButton);

        // After successful test, save button should be enabled
        expect(screen.getByTestId('saveSetting')).not.toBeDisabled();
    });
});
