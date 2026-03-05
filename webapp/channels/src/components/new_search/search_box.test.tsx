// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Team} from '@mattermost/types/teams';

import {
    renderWithContext,
    screen,
    userEvent,
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
        myTeams: [{id: 'team1', name: 'team1', display_name: 'Team 1', description: ''}] as Team[],
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

    test('should have the focus on the input field after switching search type', async () => {
        renderWithContext(<SearchBox {...baseProps}/>);
        await userEvent.click(screen.getByText('Files'));
        expect(screen.getByPlaceholderText('Search files')).toHaveFocus();
    });

    test('should see files hints when i click on files', async () => {
        renderWithContext(<SearchBox {...baseProps}/>);
        expect(screen.getByText('From:')).toBeInTheDocument();
        expect(screen.queryByText('Ext:')).not.toBeInTheDocument();
        await userEvent.click(screen.getByText('Files'));
        expect(screen.getByText('Ext:')).toBeInTheDocument();
    });

    test('should call close on esc keydown', async () => {
        renderWithContext(<SearchBox {...baseProps}/>);
        const input = screen.getByPlaceholderText('Search messages');
        input.focus();
        await userEvent.keyboard('{Escape}');
        expect(baseProps.onClose).toHaveBeenCalledTimes(1);
    });

    test('should call search on enter keydown', async () => {
        renderWithContext(<SearchBox {...baseProps}/>);
        const input = screen.getByPlaceholderText('Search messages');
        input.focus();
        await userEvent.keyboard('{Enter}');
        expect(baseProps.onSearch).toHaveBeenCalledTimes(1);
    });

    test('should be able to select with the up and down arrows', async () => {
        renderWithContext(<SearchBox {...baseProps}/>);
        await userEvent.click(screen.getByText('Files'));
        await userEvent.type(screen.getByPlaceholderText('Search files'), 'ext:');
        expect(screen.getByText('Text file')).toHaveClass('selected');
        expect(screen.getByText('Word Document')).not.toHaveClass('selected');
        await userEvent.keyboard('{ArrowDown}');
        expect(screen.getByText('Text file')).not.toHaveClass('selected');
        expect(screen.getByText('Word Document')).toHaveClass('selected');
        await userEvent.keyboard('{ArrowUp}');
        expect(screen.getByText('Text file')).toHaveClass('selected');
        expect(screen.getByText('Word Document')).not.toHaveClass('selected');
    });

    test('should show team selector when there is more than one team', () => {
        const props = {
            ...baseProps,
            myTeams: [
                {id: 'team1', name: 'team1', display_name: 'Team 1', description: ''} as Team,
                {id: 'team2', name: 'team2', display_name: 'Team 2', description: ''} as Team,
            ],
        };
        renderWithContext(<SearchBox {...props}/>);

        // The select team dropdown should be visible
        const teamSelector = document.querySelector('div[data-testid="searchTeamSelector"]');
        expect(teamSelector).toBeInTheDocument();
    });

    test('should not show team selector when there is only one team', () => {
        // Base props already has one team
        renderWithContext(<SearchBox {...baseProps}/>);

        // The select team dropdown should not be visible
        const teamSelector = document.querySelector('div[data-testid="searchTeamSelector"]');
        expect(teamSelector).not.toBeInTheDocument();
    });

    test('should not show team selector when cross-team search is disabled', () => {
        const props = {
            ...baseProps,
            crossTeamSearchEnabled: false,
            myTeams: [
                {id: 'team1', name: 'team1', display_name: 'Team 1', description: ''} as Team,
                {id: 'team2', name: 'team2', display_name: 'Team 2', description: ''} as Team,
            ],
        };
        renderWithContext(<SearchBox {...props}/>);

        // The select team dropdown should not be visible
        const teamSelector = document.querySelector('div[data-testid="searchTeamSelector"]');
        expect(teamSelector).not.toBeInTheDocument();
    });
});
