// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {
    renderWithContext,
    screen,
} from 'tests/react_testing_utils';

import ExtensionSuggestion from './extension_suggestions';

describe('components/new_search/ExtensionSuggestion', () => {
    const baseProps = {
        item: {type: 'test-type', label: 'test-label', value: 'test-value'},
        term: 'test',
        matchedPretext: 'test',
        isSelection: false,
        onClick: jest.fn(),
        onMouseMove: jest.fn(),
    };

    test('should show the file-type as label and the value as extension whenever is not a know filetype', () => {
        renderWithContext(<ExtensionSuggestion {...baseProps}/>);
        expect(screen.getByText('test-type')).toBeInTheDocument();
        expect(screen.getByText('(.test-value)')).toBeInTheDocument();
    });

    test('should show the name of the type of file whenever it knows the filetype', () => {
        const props = {...baseProps, item: {...baseProps.item, type: 'pdf', value: 'pdf'}};
        renderWithContext(<ExtensionSuggestion {...props}/>);
        expect(screen.getByText('Acrobat')).toBeInTheDocument();
        expect(screen.getByText('(.pdf)')).toBeInTheDocument();
    });

    test('should pass the right data on click', () => {
        const props = {...baseProps};
        renderWithContext(<ExtensionSuggestion {...props}/>);
        screen.getByText('test-type').click();
        expect(props.onClick).toHaveBeenCalledWith('test-value', 'test');
    });

    test('should have selected class whenever is selected', () => {
        const props = {...baseProps, isSelection: true};
        renderWithContext(<ExtensionSuggestion {...props}/>);
        expect(screen.getByText('test-type')).toHaveClass('selected');
    });
});
