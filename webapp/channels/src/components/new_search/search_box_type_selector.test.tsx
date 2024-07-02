// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    renderWithContext,
    screen,
} from 'tests/react_testing_utils';
import React from 'react';

import SearchBoxTypeSelector from './search_box_type_selector';

describe('components/new_search/SearchBoxTypeSelector', () => {
    const baseProps = {
        setSearchType: jest.fn(),
        searchType: 'messages',
    };

    test('should have the built-in type options', () => {
        renderWithContext(<SearchBoxTypeSelector {...baseProps}/>)
        expect(screen.getByText("Files")).toBeInTheDocument();
        expect(screen.getByText("Messages")).toBeInTheDocument();
    });

    test('on option clicked should call the setSearchType', () => {
        renderWithContext(<SearchBoxTypeSelector {...baseProps}/>);
        screen.getByText('Messages').click();
        expect(baseProps.setSearchType).toHaveBeenCalledWith('messages');
    });

    test('should have the plugin options', () => {
        renderWithContext(
            <SearchBoxTypeSelector {...baseProps}/>,
            {plugins: {components: {SearchButtons: [{component: (() => <pre>{'test'}</pre>) as React.ComponentType, pluginId: 'test-id'}]}}},
        );
        expect(screen.getByText("test")).toBeInTheDocument();
    });

    test('on plugin option clicked should call the setSearchType', () => {
        renderWithContext(
            <SearchBoxTypeSelector {...baseProps}/>,
            {plugins: {components: {SearchButtons: [{component: (() => <pre>{'test'}</pre>) as React.ComponentType, pluginId: 'test-id'}]}}},
        );
        screen.getByText('test').click();
        expect(baseProps.setSearchType).toHaveBeenCalledWith('test-id');
    });
});
