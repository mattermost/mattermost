// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';
import {describe, test, expect, vi} from 'vitest';

import type {AdminConfig} from '@mattermost/types/config';

import ElasticSearchSettings from 'components/admin_console/elasticsearch_settings';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

vi.mock('actions/admin_actions.jsx', () => {
    return {
        elasticsearchPurgeIndexes: vi.fn(),
        rebuildChannelsIndex: vi.fn(),
        elasticsearchTest: (_config: AdminConfig, success: () => void) => success(),
    };
});

describe('components/ElasticSearchSettings', () => {
    test('should match snapshot, disabled', () => {
        const config = {
            ElasticsearchSettings: {
                ConnectionURL: 'test',
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
            },
        };
        const {container} = renderWithContext(
            <ElasticSearchSettings
                config={config as AdminConfig}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, enabled', () => {
        const config = {
            ElasticsearchSettings: {
                ConnectionURL: 'test',
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
            },
        };
        const {container} = renderWithContext(
            <ElasticSearchSettings
                config={config as AdminConfig}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should have save button disabled initially', () => {
        const config = {
            ElasticsearchSettings: {
                ConnectionURL: 'test',
                SkipTLSVerification: false,
                Username: 'test',
                Password: 'test',
                Sniff: false,
                EnableIndexing: false,
                EnableSearching: false,
                EnableAutocomplete: false,
            },
        };

        renderWithContext(
            <ElasticSearchSettings
                config={config as AdminConfig}
            />,
        );

        // Initially save button should be disabled
        const saveButton = screen.getByText('Save');
        expect(saveButton.closest('button')).toBeDisabled();
    });
});
