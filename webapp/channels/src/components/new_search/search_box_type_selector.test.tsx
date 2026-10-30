// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {
    renderWithContext,
    screen,
} from 'tests/react_testing_utils';

import SearchBoxTypeSelector from './search_box_type_selector';

describe('components/new_search/SearchBoxTypeSelector', () => {
    const baseProps = {
        setSearchType: jest.fn(),
        searchType: 'messages',
    };

    test('should have the built-in type options', () => {
        renderWithContext(
            <SearchBoxTypeSelector {...baseProps}/>,
            {entities: {general: {config: {EnableFileAttachments: 'true', EnableFileSearch: 'true'}}}},
        );
        expect(screen.getByText('Files')).toBeInTheDocument();
        expect(screen.getByText('Messages')).toBeInTheDocument();
    });

    test('should not have the files option when file search is disabled', () => {
        renderWithContext(
            <SearchBoxTypeSelector {...baseProps}/>,
            {entities: {general: {config: {EnableFileAttachments: 'true', EnableFileSearch: 'false'}}}},
        );
        expect(screen.queryByText('Files')).not.toBeInTheDocument();
        expect(screen.getByText('Messages')).toBeInTheDocument();
    });

    test('should not have the files option when file attachments are disabled', () => {
        renderWithContext(
            <SearchBoxTypeSelector {...baseProps}/>,
            {entities: {general: {config: {EnableFileAttachments: 'false', EnableFileSearch: 'true'}}}},
        );
        expect(screen.queryByText('Files')).not.toBeInTheDocument();
        expect(screen.getByText('Messages')).toBeInTheDocument();
    });

    test('on option clicked should call the setSearchType', () => {
        renderWithContext(<SearchBoxTypeSelector {...baseProps}/>);
        screen.getByText('Messages').click();
        expect(baseProps.setSearchType).toHaveBeenCalledWith('messages');
    });

    test('should not have the plugin options without license', () => {
        renderWithContext(
            <SearchBoxTypeSelector {...baseProps}/>,
            {
                plugins: {components: {SearchButtons: [{component: (() => <pre>{'test'}</pre>) as React.ComponentType, pluginId: 'test-id'}]}},
                entities: {general: {license: {IsLicensed: 'false'}}},
            },
        );
        expect(screen.queryByText('test')).not.toBeInTheDocument();
    });

    test('should have the plugin options', () => {
        renderWithContext(
            <SearchBoxTypeSelector {...baseProps}/>,
            {
                plugins: {components: {SearchButtons: [{component: (() => <pre>{'test'}</pre>) as React.ComponentType, pluginId: 'test-id'}]}},
                entities: {general: {license: {IsLicensed: 'true'}}},
            },
        );
        expect(screen.getByText('test')).toBeInTheDocument();
    });

    test('on plugin option clicked should call the setSearchType', () => {
        renderWithContext(
            <SearchBoxTypeSelector {...baseProps}/>,
            {
                plugins: {components: {SearchButtons: [{component: (() => <pre>{'test'}</pre>) as React.ComponentType, pluginId: 'test-id'}]}},
                entities: {general: {license: {IsLicensed: 'true'}}},
            },
        );
        screen.getByText('test').click();
        expect(baseProps.setSearchType).toHaveBeenCalledWith('test-id');
    });

    test('should show prioritized plugin options before the keyword options', () => {
        renderWithContext(
            <SearchBoxTypeSelector {...baseProps}/>,
            {
                plugins: {
                    components: {
                        SearchButtons: [
                            {component: (() => <span>{'low'}</span>) as React.ComponentType, pluginId: 'low-id', priority: 0},
                            {component: (() => <span>{'mid'}</span>) as React.ComponentType, pluginId: 'mid-id', priority: 5},
                            {component: (() => <span>{'high'}</span>) as React.ComponentType, pluginId: 'high-id', priority: 10},
                        ],
                    },
                },
                entities: {general: {license: {IsLicensed: 'true'}, config: {EnableFileAttachments: 'true', EnableFileSearch: 'true'}}},
            },
        );

        const options = screen.getAllByRole('radio').map((option) => option.textContent);
        expect(options).toEqual(['high', 'mid', 'Messages', 'Files', 'low']);
        expect(screen.getByText('Keyword:')).toBeInTheDocument();
    });

    test('should not show the keyword label without prioritized plugin options', () => {
        renderWithContext(
            <SearchBoxTypeSelector {...baseProps}/>,
            {
                plugins: {components: {SearchButtons: [{component: (() => <span>{'test'}</span>) as React.ComponentType, pluginId: 'test-id'}]}},
                entities: {general: {license: {IsLicensed: 'true'}}},
            },
        );

        expect(screen.queryByText('Keyword:')).not.toBeInTheDocument();
    });
});
