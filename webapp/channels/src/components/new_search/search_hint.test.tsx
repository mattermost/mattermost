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
    };

    test('should have the right hint options on search messages empty string', async () => {
        await renderWithContext(<SearchHint {...baseProps}/>);
        expect(screen.getByText('From:')).toBeInTheDocument();
        expect(screen.queryByText('Ext:')).not.toBeInTheDocument();
    });

    test('should suggest to hit enter to search on search messages with not empty string not ended with space', async () => {
        const props = {...baseProps, searchTerms: 'test'};
        await renderWithContext(<SearchHint {...props}/>);
        expect(screen.getByText('Press Enter to search')).toBeInTheDocument();
    });

    test('should have the right hint options on search messages with not empty string ended with space', async () => {
        const props = {...baseProps, searchTerms: 'test '};
        await renderWithContext(<SearchHint {...props}/>);
        expect(screen.getByText('From:')).toBeInTheDocument();
        expect(screen.queryByText('Ext:')).not.toBeInTheDocument();
    });

    test('should have the right hint options on search files empty string', async () => {
        const props = {...baseProps, searchType: 'files'};
        await renderWithContext(<SearchHint {...props}/>);
        expect(screen.getByText('From:')).toBeInTheDocument();
        expect(screen.queryByText('Ext:')).toBeInTheDocument();
    });

    test('should suggest to hit enter to search on search files with not empty string not ended with space', async () => {
        const props = {...baseProps, searchType: 'files', searchTerms: 'test'};
        await renderWithContext(<SearchHint {...props}/>);
        expect(screen.getByText('Press Enter to search')).toBeInTheDocument();
    });

    test('should have the right hint options on search files with not empty string ended with space', async () => {
        const props = {...baseProps, searchType: 'files', searchTerms: 'test '};
        await renderWithContext(<SearchHint {...props}/>);
        expect(screen.getByText('From:')).toBeInTheDocument();
        expect(screen.getByText('Ext:')).toBeInTheDocument();
    });

    test('should not have From: and In: where the searchTeam is set to all teams (\'\')', async () => {
        const props = {...baseProps, searchTeam: '', searchTerms: 'test '};
        await renderWithContext(<SearchHint {...props}/>);
        expect(screen.queryByText('From:')).not.toBeInTheDocument();
        expect(screen.queryByText('In:')).not.toBeInTheDocument();
    });

    test('should be empty on search if is date', async () => {
        const props = {...baseProps, isDate: true};
        const {asFragment} = await renderWithContext(<SearchHint {...props}/>);
        expect(asFragment()).toMatchInlineSnapshot('<DocumentFragment />');
    });

    test('should suggest to hit enter to select on search if has selected option', async () => {
        const props = {...baseProps, hasSelectedOption: true};
        await renderWithContext(<SearchHint {...props}/>);
        expect(screen.getByText('Press Enter to select')).toBeInTheDocument();
    });

    test('on filter clicked should call the onSelectFilter', async () => {
        await renderWithContext(<SearchHint {...baseProps}/>);
        screen.getByText('From:').click();
        expect(baseProps.onSelectFilter).toHaveBeenCalledWith('From:');
    });
});
