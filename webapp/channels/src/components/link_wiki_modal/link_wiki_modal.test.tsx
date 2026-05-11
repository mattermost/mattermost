// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

import LinkWikiModal from './link_wiki_modal';

const mockCloseModal = jest.fn();
const mockFetchTeamWikis = jest.fn();
const mockFetchWikiLinksForChannel = jest.fn();
const mockLinkWikiToChannel = jest.fn();

jest.mock('actions/views/modals', () => ({
    closeModal: (...args: any[]) => {
        mockCloseModal(...args);
        return {type: 'MOCK_CLOSE_MODAL'};
    },
}));

jest.mock('actions/wiki_actions', () => ({
    fetchTeamWikis: (...args: any[]) => mockFetchTeamWikis(...args),
    fetchWikiLinksForChannel: (...args: any[]) => mockFetchWikiLinksForChannel(...args),
    linkWikiToChannel: (...args: any[]) => mockLinkWikiToChannel(...args),
}));

describe('LinkWikiModal', () => {
    const channelId = 'channel123';
    const teamId = 'team123';

    const baseProps = {
        channelId,
        onExited: jest.fn(),
    };

    const initialState: DeepPartial<GlobalState> = {
        entities: {
            teams: {
                currentTeamId: teamId,
            },
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockFetchWikiLinksForChannel.mockReturnValue(() => Promise.resolve({data: []}));
    });

    test('should render modal with title and description', async () => {
        mockFetchTeamWikis.mockReturnValue(() => Promise.resolve({data: []}));

        renderWithContext(<LinkWikiModal {...baseProps}/>, initialState);

        expect(screen.getByText('Link a wiki to this channel')).toBeInTheDocument();
        expect(screen.getByText('Select an existing wiki to link to this channel. Linked wikis appear as tabs.')).toBeInTheDocument();
    });

    test('should fetch wikis on mount', async () => {
        const wikis = [
            {id: 'wiki1', title: 'Wiki One', channel_id: 'wikiChannel1'},
            {id: 'wiki2', title: 'Wiki Two', channel_id: 'wikiChannel2'},
        ];
        mockFetchTeamWikis.mockReturnValue(() => Promise.resolve({data: wikis}));

        renderWithContext(<LinkWikiModal {...baseProps}/>, initialState);

        await waitFor(() => {
            expect(mockFetchTeamWikis).toHaveBeenCalledWith(teamId);
        });

        await waitFor(() => {
            expect(screen.getByText('Wiki One')).toBeInTheDocument();
            expect(screen.getByText('Wiki Two')).toBeInTheDocument();
        });
    });

    test('should show loading text while fetching wikis', () => {
        mockFetchTeamWikis.mockReturnValue(() => new Promise(() => {}));

        renderWithContext(<LinkWikiModal {...baseProps}/>, initialState);

        // Loading text appears in both the sr-only status region and the
        // <option> placeholder, so assert at least one match exists.
        expect(screen.getAllByText('Loading wikis...').length).toBeGreaterThan(0);
    });

    test('should show no wikis message when all are already linked', async () => {
        mockFetchTeamWikis.mockReturnValue(() => Promise.resolve({data: []}));

        renderWithContext(<LinkWikiModal {...baseProps}/>, initialState);

        await waitFor(() => {
            expect(screen.getByText('No wikis available to link. Either no wikis exist in this team, or all wikis are already linked to this channel.')).toBeInTheDocument();
        });
    });

    test('should show error when fetch fails', async () => {
        mockFetchTeamWikis.mockReturnValue(() => Promise.resolve({error: {message: 'fetch failed'}}));

        renderWithContext(<LinkWikiModal {...baseProps}/>, initialState);

        await waitFor(() => {
            expect(screen.getByText('Failed to load wikis.')).toBeInTheDocument();
        });
    });

    test('should handle link action', async () => {
        const wikis = [
            {id: 'wiki1', title: 'Wiki One', channel_id: 'wikiChannel1'},
        ];
        mockFetchTeamWikis.mockReturnValue(() => Promise.resolve({data: wikis}));
        mockLinkWikiToChannel.mockReturnValue(() => Promise.resolve({data: {id: 'link1'}}));

        renderWithContext(<LinkWikiModal {...baseProps}/>, initialState);

        await waitFor(() => {
            expect(screen.getByText('Wiki One')).toBeInTheDocument();
        });

        const select = screen.getByRole('combobox');
        await userEvent.selectOptions(select, 'wiki1');

        const confirmButton = screen.getByText('Link wiki');
        await userEvent.click(confirmButton);

        await waitFor(() => {
            expect(mockLinkWikiToChannel).toHaveBeenCalledWith(channelId, 'wiki1');
        });
    });

    test('should disable confirm button when no wiki is selected', async () => {
        mockFetchTeamWikis.mockReturnValue(() => Promise.resolve({data: [{id: 'wiki1', title: 'Wiki One', channel_id: 'wikiChannel1'}]}));

        renderWithContext(<LinkWikiModal {...baseProps}/>, initialState);

        await waitFor(() => {
            expect(screen.getByText('Wiki One')).toBeInTheDocument();
        });

        const confirmButton = screen.getByText('Link wiki');
        expect(confirmButton).toBeDisabled();
    });

    test('should show error on link failure', async () => {
        const wikis = [
            {id: 'wiki1', title: 'Wiki One', channel_id: 'wikiChannel1'},
        ];
        mockFetchTeamWikis.mockReturnValue(() => Promise.resolve({data: wikis}));
        mockLinkWikiToChannel.mockReturnValue(() => Promise.resolve({error: {status_code: 500}}));

        renderWithContext(<LinkWikiModal {...baseProps}/>, initialState);

        await waitFor(() => {
            expect(screen.getByText('Wiki One')).toBeInTheDocument();
        });

        const select = screen.getByRole('combobox');
        await userEvent.selectOptions(select, 'wiki1');

        const confirmButton = screen.getByText('Link wiki');
        await userEvent.click(confirmButton);

        await waitFor(() => {
            expect(screen.getByText('Failed to link wiki. Please try again.')).toBeInTheDocument();
        });
    });

    test('should show permission error on 403', async () => {
        const wikis = [
            {id: 'wiki1', title: 'Wiki One', channel_id: 'wikiChannel1'},
        ];
        mockFetchTeamWikis.mockReturnValue(() => Promise.resolve({data: wikis}));
        mockLinkWikiToChannel.mockReturnValue(() => Promise.resolve({error: {status_code: 403}}));

        renderWithContext(<LinkWikiModal {...baseProps}/>, initialState);

        await waitFor(() => {
            expect(screen.getByText('Wiki One')).toBeInTheDocument();
        });

        const select = screen.getByRole('combobox');
        await userEvent.selectOptions(select, 'wiki1');

        const confirmButton = screen.getByText('Link wiki');
        await userEvent.click(confirmButton);

        await waitFor(() => {
            expect(screen.getByText("You don't have permission to link wikis to this channel.")).toBeInTheDocument();
        });
    });

    test('should show already linked error on 409', async () => {
        const wikis = [
            {id: 'wiki1', title: 'Wiki One', channel_id: 'wikiChannel1'},
        ];
        mockFetchTeamWikis.mockReturnValue(() => Promise.resolve({data: wikis}));
        mockLinkWikiToChannel.mockReturnValue(() => Promise.resolve({error: {status_code: 409}}));

        renderWithContext(<LinkWikiModal {...baseProps}/>, initialState);

        await waitFor(() => {
            expect(screen.getByText('Wiki One')).toBeInTheDocument();
        });

        const select = screen.getByRole('combobox');
        await userEvent.selectOptions(select, 'wiki1');

        const confirmButton = screen.getByText('Link wiki');
        await userEvent.click(confirmButton);

        await waitFor(() => {
            expect(screen.getByText('This wiki is already linked to this channel.')).toBeInTheDocument();
        });
    });
});
