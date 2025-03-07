// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {screen, fireEvent} from '@testing-library/react';

import type {AdminConfig} from '@mattermost/types/config';

import {renderWithContext} from 'tests/react_testing_utils';
import * as adminActions from 'actions/admin_actions.jsx';

import ElasticSearchSettings from 'components/admin_console/elasticsearch_settings';

jest.mock('actions/admin_actions.jsx', () => {
    return {
        elasticsearchPurgeIndexes: jest.fn(),
        rebuildChannelsIndex: jest.fn(),
        elasticsearchTest: jest.fn((config, success) => success()),
    };
});

// Mock JobsTable to avoid prop-type warnings
jest.mock('components/admin_console/jobs', () => {
    return {
        __esModule: true,
        default: () => <div data-testid="mock-jobs-table">Jobs Table</div>,
    };
});

// Also mock the SaveButton to avoid issues with button disabled state
jest.mock('components/save_button', () => {
    return function MockSaveButton(props) {
        return (
            <button
                id="saveSetting"
                data-testid="saveSetting"
                className={`save-button ${props.disabled ? 'disabled' : ''}`}
                disabled={props.disabled}
            >
                Save
            </button>
        );
    };
});

describe('components/ElasticSearchSettings', () => {
    const baseConfig = {
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
            IgnoredPurgeIndexes: '',
        },
    };

    test('should render correctly when indexing is disabled', () => {
        renderWithContext(
            <ElasticSearchSettings
                config={baseConfig as AdminConfig}
            />,
        );

        expect(screen.getByText('Elasticsearch')).toBeInTheDocument();
        expect(screen.getByText('Enable Elasticsearch Indexing:')).toBeInTheDocument();
        
        // Verify connection options exist but are disabled
        const connectionUrlInput = screen.getByLabelText('Server Connection Address:');
        expect(connectionUrlInput).toBeInTheDocument();
        expect(connectionUrlInput).toBeDisabled();
        
        // Test button should be disabled when indexing is disabled
        const testButton = screen.getByText('Test Connection');
        expect(testButton).toBeDisabled();
    });

    test('should render correctly when indexing is enabled', () => {
        const config = {
            ...baseConfig,
            ElasticsearchSettings: {
                ...baseConfig.ElasticsearchSettings,
                EnableIndexing: true,
            },
        };

        renderWithContext(
            <ElasticSearchSettings
                config={config as AdminConfig}
            />,
        );

        // Check that connection options are enabled
        const connectionUrlInput = screen.getByLabelText('Server Connection Address:');
        expect(connectionUrlInput).toBeInTheDocument();
        expect(connectionUrlInput).toBeEnabled();
        
        // Test button should be enabled when indexing is enabled
        const testButton = screen.getByText('Test Connection');
        expect(testButton).toBeEnabled();
    });

    test('should maintain save disabled until connection is tested', () => {
        const config = {
            ...baseConfig,
            ElasticsearchSettings: {
                ...baseConfig.ElasticsearchSettings,
            },
        };

        renderWithContext(
            <ElasticSearchSettings
                config={config as AdminConfig}
            />,
        );

        // Initially, save button should be disabled
        const saveButton = screen.getByTestId('saveSetting');
        expect(saveButton).toBeDisabled();

        // Enable indexing
        const enableIndexingInput = screen.getByTestId('enableIndexingtrue');
        fireEvent.click(enableIndexingInput);

        // Save button should still be disabled
        expect(saveButton).toBeDisabled();

        // Test connection
        const testButton = screen.getByText('Test Connection');
        fireEvent.click(testButton);

        // Verify elasticsearchTest was called
        expect(adminActions.elasticsearchTest).toHaveBeenCalled();

        // After successful test, save button should be enabled
        expect(saveButton).not.toBeDisabled();
    });

    test('should disable settings when indexing is disabled', () => {
        // Start with indexing enabled
        const config = {
            ...baseConfig,
            ElasticsearchSettings: {
                ...baseConfig.ElasticsearchSettings,
                EnableIndexing: true,
            },
        };

        renderWithContext(
            <ElasticSearchSettings
                config={config as AdminConfig}
            />,
        );

        // Enable indexing should be checked
        const enableIndexingTrueInput = screen.getByTestId('enableIndexingtrue');
        expect(enableIndexingTrueInput).toBeChecked();

        // Disable indexing
        const enableIndexingFalseInput = screen.getByTestId('enableIndexingfalse');
        fireEvent.click(enableIndexingFalseInput);

        // Now check that connection URL is disabled
        const connectionUrlInput = screen.getByLabelText('Server Connection Address:');
        expect(connectionUrlInput).toBeDisabled();

        // And test button should be disabled too
        const testButton = screen.getByText('Test Connection');
        expect(testButton).toBeDisabled();
    });
});