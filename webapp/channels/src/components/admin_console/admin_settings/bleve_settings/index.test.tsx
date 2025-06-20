// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import {useAdminSettingState} from '../hooks';

import BleveSettings from './index';

// Mock the child components
jest.mock('./enable_indexing', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('./enable_searching', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('./enable_autocomplete', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('./index_dir', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('./bulk_indexing', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('./purge_indexes', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mocked(require('./enable_indexing').default).mockImplementation((props: any) => (
    <div data-testid='enable-indexing'>
        <input
            data-testid='enable-indexing-checkbox'
            type='checkbox'
            checked={props.value}
            disabled={props.isDisabled}
            onChange={(e) => props.onChange('enableIndexing', e.target.checked)}
        />
    </div>
));

jest.mocked(require('./enable_searching').default).mockImplementation((props: any) => (
    <div data-testid='enable-searching'>
        <input
            data-testid='enable-searching-checkbox'
            type='checkbox'
            checked={props.value}
            disabled={props.isDisabled || !props.indexingEnabled}
            onChange={(e) => props.onChange('enableSearching', e.target.checked)}
        />
    </div>
));

jest.mocked(require('./enable_autocomplete').default).mockImplementation((props: any) => (
    <div data-testid='enable-autocomplete'>
        <input
            data-testid='enable-autocomplete-checkbox'
            type='checkbox'
            checked={props.value}
            disabled={props.isDisabled || !props.indexingEnabled}
            onChange={(e) => props.onChange('enableAutocomplete', e.target.checked)}
        />
    </div>
));

jest.mocked(require('./index_dir').default).mockImplementation((props: any) => (
    <div data-testid='index-dir'>
        <input
            data-testid='index-dir-input'
            type='text'
            value={props.value}
            disabled={props.isDisabled}
            onChange={(e) => props.onChange('indexDir', e.target.value)}
        />
    </div>
));

jest.mocked(require('./bulk_indexing').default).mockImplementation((props: any) => (
    <div data-testid='bulk-indexing'>
        <div data-testid='can-purge-and-index'>{String(props.canPurgeAndIndex)}</div>
        <div data-testid='is-disabled'>{String(props.isDisabled)}</div>
    </div>
));

jest.mocked(require('./purge_indexes').default).mockImplementation((props: any) => (
    <div data-testid='purge-indexes'>
        <div data-testid='can-purge-and-index'>{String(props.canPurgeAndIndex)}</div>
        <div data-testid='is-disabled'>{String(props.isDisabled)}</div>
    </div>
));

// Mock the hooks
jest.mock('../hooks', () => ({
    useAdminSettingState: jest.fn(),
}));

describe('BleveSettings', () => {
    const mockState = {
        enableIndexing: false,
        indexDir: '',
        enableSearching: false,
        enableAutocomplete: false,
        canPurgeAndIndex: false,
    };

    const mockHandlers = {
        doSubmit: jest.fn(),
        handleChange: jest.fn(),
        saveNeeded: false,
        saving: false,
        serverError: undefined,
        settingValues: mockState,
    };

    beforeEach(() => {
        jest.mocked(useAdminSettingState).mockReturnValue(mockHandlers);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should render the component with correct title', () => {
        renderWithContext(<BleveSettings/>);

        expect(screen.getByText('Bleve')).toBeInTheDocument();
    });

    it('should render all child components', () => {
        renderWithContext(<BleveSettings/>);

        expect(screen.getByTestId('enable-indexing')).toBeInTheDocument();
        expect(screen.getByTestId('enable-searching')).toBeInTheDocument();
        expect(screen.getByTestId('enable-autocomplete')).toBeInTheDocument();
        expect(screen.getByTestId('index-dir')).toBeInTheDocument();
        expect(screen.getByTestId('bulk-indexing')).toBeInTheDocument();
        expect(screen.getByTestId('purge-indexes')).toBeInTheDocument();
    });

    it('should pass correct props to child components', () => {
        renderWithContext(<BleveSettings/>);

        // Check that child components receive the expected props
        expect(screen.getByTestId('enable-indexing-checkbox')).not.toBeChecked();
        expect(screen.getByTestId('enable-searching-checkbox')).not.toBeChecked();
        expect(screen.getByTestId('enable-autocomplete-checkbox')).not.toBeChecked();
        expect(screen.getByTestId('index-dir-input')).toHaveValue('');
    });

    it('should disable child components when isDisabled is true', () => {
        renderWithContext(<BleveSettings isDisabled={true}/>);

        expect(screen.getByTestId('enable-indexing-checkbox')).toBeDisabled();
        expect(screen.getByTestId('enable-searching-checkbox')).toBeDisabled();
        expect(screen.getByTestId('enable-autocomplete-checkbox')).toBeDisabled();
        expect(screen.getByTestId('index-dir-input')).toBeDisabled();
    });

    it('should disable searching and autocomplete when indexing is disabled', () => {
        const stateWithIndexingDisabled = {
            ...mockState,
            enableIndexing: false,
        };

        jest.mocked(useAdminSettingState).mockReturnValue({
            ...mockHandlers,
            settingValues: stateWithIndexingDisabled,
        });

        renderWithContext(<BleveSettings/>);

        expect(screen.getByTestId('enable-searching-checkbox')).toBeDisabled();
        expect(screen.getByTestId('enable-autocomplete-checkbox')).toBeDisabled();
    });

    it('should enable searching and autocomplete when indexing is enabled', () => {
        const stateWithIndexingEnabled = {
            ...mockState,
            enableIndexing: true,
        };

        jest.mocked(useAdminSettingState).mockReturnValue({
            ...mockHandlers,
            settingValues: stateWithIndexingEnabled,
        });

        renderWithContext(<BleveSettings/>);

        expect(screen.getByTestId('enable-searching-checkbox')).not.toBeDisabled();
        expect(screen.getByTestId('enable-autocomplete-checkbox')).not.toBeDisabled();
    });

    it('should pass canPurgeAndIndex state to bulk indexing and purge indexes', () => {
        const stateWithCanPurgeAndIndex = {
            ...mockState,
            canPurgeAndIndex: true,
        };

        jest.mocked(useAdminSettingState).mockReturnValue({
            ...mockHandlers,
            settingValues: stateWithCanPurgeAndIndex,
        });

        renderWithContext(<BleveSettings/>);

        const bulkIndexingElements = screen.getAllByTestId('can-purge-and-index');
        expect(bulkIndexingElements[0]).toHaveTextContent('true');
        expect(bulkIndexingElements[1]).toHaveTextContent('true');
    });
});
