// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {
    renderWithContext,
    screen,
    fireEvent,
} from 'tests/react_testing_utils';

import SearchBoxInput from './search_box_input';

describe('components/new_search/SearchBoxInput', () => {
    const baseProps = {
        searchType: 'messages',
        searchTerms: '',
        setSearchTerms: jest.fn(),
        onKeyDown: jest.fn(),
        focus: jest.fn(),
    };

    test('should show the right placeholder for messages', () => {
        renderWithContext(<SearchBoxInput {...baseProps}/>);
        expect(screen.getByPlaceholderText('Search messages')).toBeInTheDocument();
    });

    test('should show the right placeholder for files', () => {
        const props = {...baseProps, searchType: 'files'};
        renderWithContext(<SearchBoxInput {...props}/>);
        expect(screen.getByPlaceholderText('Search files')).toBeInTheDocument();
    });

    test('should show the right placeholder for plugins', () => {
        const props = {...baseProps, searchType: 'plugin-id'};
        renderWithContext(<SearchBoxInput {...props}/>);
        expect(screen.getByPlaceholderText('Search')).toBeInTheDocument();
    });

    test('should show the right value when the searchTerms are set', () => {
        const props = {...baseProps, searchTerms: 'test-value'};
        renderWithContext(<SearchBoxInput {...props}/>);
        expect(screen.getByPlaceholderText('Search messages')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Search messages')).toHaveValue('test-value');
    });

    test('should call on key down when there is a key down event on the input field', () => {
        const props = {...baseProps};
        renderWithContext(<SearchBoxInput {...props}/>);
        fireEvent.keyDown(screen.getByPlaceholderText('Search messages'), {key: 'Enter'});
        expect(props.onKeyDown).toHaveBeenCalledTimes(1);
    });

    test('should call on key down when there is a key down event on the input field', () => {
        const props = {...baseProps};
        renderWithContext(<SearchBoxInput {...props}/>);
        fireEvent.keyDown(screen.getByPlaceholderText('Search messages'), {key: 'Enter'});
        expect(props.onKeyDown).toHaveBeenCalledTimes(1);
    });

    test('should update the search term on change', () => {
        const props = {...baseProps};
        renderWithContext(<SearchBoxInput {...props}/>);
        fireEvent.change(screen.getByPlaceholderText('Search messages'), {target: {value: 'new-value'}});
        expect(props.setSearchTerms).toHaveBeenCalledWith('new-value');
    });

    test('should clear the terms and focus in the input whenever click the clear button', () => {
        const props = {...baseProps, searchTerms: 'test-value'};
        renderWithContext(<SearchBoxInput {...props}/>);
        fireEvent.click(screen.getByText('Clear'));
        expect(props.setSearchTerms).toHaveBeenCalledWith('');
        expect(props.focus).toHaveBeenCalledWith(0);
    });
});
