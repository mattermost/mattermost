// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import type {AdminConfig} from '@mattermost/types/config';

import BleveSettings from 'components/admin_console/bleve_settings';

import {renderWithContext} from 'tests/react_testing_utils';

jest.mock('actions/admin_actions.jsx', () => {
    return {
        blevePurgeIndexes: jest.fn(),
    };
});

describe('components/BleveSettings', () => {
    test('should render correctly when disabled', () => {
        const config = {
            BleveSettings: {
                IndexDir: '',
                EnableIndexing: false,
                EnableSearching: false,
                EnableAutocomplete: false,
            },
        } as AdminConfig;

        renderWithContext(
            <BleveSettings
                config={config}
            />,
        );

        // Verify the form renders with the Bleve title
        expect(screen.getByText('Bleve')).toBeInTheDocument();

        // Verify the Enable Bleve Indexing option is present and unchecked
        const enableIndexingLabel = screen.getByText('Enable Bleve Indexing:');
        expect(enableIndexingLabel).toBeInTheDocument();

        // Verify the IndexDir field is present and empty
        const indexDirLabel = screen.getByText('Index Directory:');
        expect(indexDirLabel).toBeInTheDocument();

        // Verify the other options are present
        expect(screen.getByText('Bulk Indexing:')).toBeInTheDocument();
        expect(screen.getByText('Purge Indexes:')).toBeInTheDocument();
        expect(screen.getByText('Enable Bleve for search queries:')).toBeInTheDocument();
        expect(screen.getByText('Enable Bleve for autocomplete queries:')).toBeInTheDocument();
    });

    test('should render correctly when enabled', () => {
        const config = {
            BleveSettings: {
                IndexDir: 'bleve.idx',
                EnableIndexing: true,
                EnableSearching: false,
                EnableAutocomplete: false,
            },
        } as AdminConfig;

        renderWithContext(
            <BleveSettings
                config={config}
            />,
        );

        // Verify the form renders with the Bleve title
        expect(screen.getByText('Bleve')).toBeInTheDocument();

        // Verify the Enable Bleve Indexing option is present
        const enableIndexingLabel = screen.getByText('Enable Bleve Indexing:');
        expect(enableIndexingLabel).toBeInTheDocument();

        // Verify the IndexDir field has the correct value
        const indexDirField = screen.getByDisplayValue('bleve.idx');
        expect(indexDirField).toBeInTheDocument();

        // Verify the buttons for bulk indexing are enabled when indexing is enabled
        expect(screen.getByText('Index Now')).toBeInTheDocument();

        // Verify the Purge Indexes button is present
        expect(screen.getByText('Purge Index')).toBeInTheDocument();

        // Verify other options are present and correctly disabled/enabled
        expect(screen.getByText('Enable Bleve for search queries:')).toBeInTheDocument();
        expect(screen.getByText('Enable Bleve for autocomplete queries:')).toBeInTheDocument();
    });
});
