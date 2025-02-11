// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {
    renderWithContext,
    screen,
} from 'tests/react_testing_utils';

import SearchHint from './search_hint';

describe('components/new_search/SearchHint', () => {
    const baseProps = {
        onSelectFilter: jest.fn(),
        searchType: 'messages',
        searchTerms: '',
        searchTeam: 'teamId',
        hasSelectedOption: false,
        isDate: false,
        showFilterHaveBeenReset: false,
    };

    test('should have the right hint options on search messages empty string', () => {
        renderWithContext(<SearchHint {...baseProps}/>);
        expect(screen.getByText('From:')).toBeInTheDocument();
        expect(screen.queryByText('Ext:')).not.toBeInTheDocument();
    });

    test('should suggest to hit enter to search on search messages with not empty string not ended with space', () => {
        const props = {...baseProps, searchTerms: 'test'};
        renderWithContext(<SearchHint {...props}/>);
        expect(screen.getByText('Press Enter to search')).toBeInTheDocument();
    });

    test('should have the right hint options on search messages with not empty string ended with space', () => {
        const props = {...baseProps, searchTerms: 'test '};
        renderWithContext(<SearchHint {...props}/>);
        expect(screen.getByText('From:')).toBeInTheDocument();
        expect(screen.queryByText('Ext:')).not.toBeInTheDocument();
    });

    test('should have the right hint options on search files empty string', () => {
        const props = {...baseProps, searchType: 'files'};
        renderWithContext(<SearchHint {...props}/>);
        expect(screen.getByText('From:')).toBeInTheDocument();
        expect(screen.queryByText('Ext:')).toBeInTheDocument();
    });

    test('should suggest to hit enter to search on search files with not empty string not ended with space', () => {
        const props = {...baseProps, searchType: 'files', searchTerms: 'test'};
        renderWithContext(<SearchHint {...props}/>);
        expect(screen.getByText('Press Enter to search')).toBeInTheDocument();
    });

    test('should have the right hint options on search files with not empty string ended with space', () => {
        const props = {...baseProps, searchType: 'files', searchTerms: 'test '};
        renderWithContext(<SearchHint {...props}/>);
        expect(screen.getByText('From:')).toBeInTheDocument();
        expect(screen.getByText('Ext:')).toBeInTheDocument();
    });

    test('should not have From: and In: where the searchTeam is set to all teams (\'\')', () => {
        const props = {...baseProps, searchTeam: '', searchTerms: 'test '};
        renderWithContext(<SearchHint {...props}/>);
        expect(screen.queryByText('From:')).not.toBeInTheDocument();
        expect(screen.queryByText('In:')).not.toBeInTheDocument();
    });

    test('should be empty on search if is date', () => {
        const props = {...baseProps, isDate: true};
        const {asFragment} = renderWithContext(<SearchHint {...props}/>);
        expect(asFragment()).toMatchInlineSnapshot('<DocumentFragment />');
    });

    test('should suggest to hit enter to select on search if has selected option', () => {
        const props = {...baseProps, hasSelectedOption: true};
        renderWithContext(<SearchHint {...props}/>);
        expect(screen.getByText('Press Enter to select')).toBeInTheDocument();
    });

    test('on filter clicked should call the onSelectFilter', () => {
        renderWithContext(<SearchHint {...baseProps}/>);
        screen.getByText('From:').click();
        expect(baseProps.onSelectFilter).toHaveBeenCalledWith('From:');
    });

    test('Shows the filter reset message when instructed', () => {
        const props = {...baseProps, showFilterHaveBeenReset: true};
        renderWithContext(<SearchHint {...props}/>);
        expect(screen.getByText('Your filters were reset because you chose a different team')).toBeInTheDocument();
    });
});
