// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {
    renderWithContext,
    screen,
    fireEvent,
} from 'tests/react_testing_utils';

import SearchBox from './search_box';

describe('components/new_search/SearchBox', () => {
    const baseProps = {
        onClose: jest.fn(),
        onSearch: jest.fn(),
        initialSearchTerms: '',
        initialSearchType: 'messages',
        initialSearchTeam: 'teamId',
        crossTeamSearchEnabled: true,
    };

    test('should have the focus on the input field', () => {
        renderWithContext(<SearchBox {...baseProps}/>);
        expect(screen.getByPlaceholderText('Search messages')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Search messages')).toHaveFocus();
    });

    test('should have set the initial search terms', () => {
        const props = {...baseProps, initialSearchTerms: 'test'};
        renderWithContext(<SearchBox {...props}/>);
        expect(screen.getByPlaceholderText('Search messages')).toHaveValue('test');
    });

    test('should have the focus on the input field after switching search type', () => {
        renderWithContext(<SearchBox {...baseProps}/>);
        screen.getByText('Files').click();
        expect(screen.getByPlaceholderText('Search files')).toHaveFocus();
    });

    test('should see files hints when i click on files', () => {
        renderWithContext(<SearchBox {...baseProps}/>);
        expect(screen.getByText('From:')).toBeInTheDocument();
        expect(screen.queryByText('Ext:')).not.toBeInTheDocument();
        screen.getByText('Files').click();
        expect(screen.getByText('Ext:')).toBeInTheDocument();
    });

    test('should call close on esc keydown', () => {
        renderWithContext(<SearchBox {...baseProps}/>);
        fireEvent.keyDown(screen.getByPlaceholderText('Search messages'), {key: 'Escape', code: 'Escape'});
        expect(baseProps.onClose).toBeCalledTimes(1);
    });

    test('should call search on enter keydown', () => {
        renderWithContext(<SearchBox {...baseProps}/>);
        fireEvent.keyDown(screen.getByPlaceholderText('Search messages'), {key: 'Enter', code: 'Enter'});
        expect(baseProps.onSearch).toBeCalledTimes(1);
    });

    test('should be able to select with the up and down arrows', () => {
        renderWithContext(<SearchBox {...baseProps}/>);
        screen.getByText('Files').click();
        fireEvent.change(screen.getByPlaceholderText('Search files'), {target: {value: 'ext:'}});
        expect(screen.getByText('Text file')).toHaveClass('selected');
        expect(screen.getByText('Word Document')).not.toHaveClass('selected');
        fireEvent.keyDown(screen.getByPlaceholderText('Search files'), {key: 'ArrowDown', code: 'ArrowDown'});
        expect(screen.getByText('Text file')).not.toHaveClass('selected');
        expect(screen.getByText('Word Document')).toHaveClass('selected');
        fireEvent.keyDown(screen.getByPlaceholderText('Search files'), {key: 'ArrowUp', code: 'ArrowUp'});
        expect(screen.getByText('Text file')).toHaveClass('selected');
        expect(screen.getByText('Word Document')).not.toHaveClass('selected');
    });
});
