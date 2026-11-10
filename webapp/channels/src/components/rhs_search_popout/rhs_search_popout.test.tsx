// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {MemoryRouter, Route} from 'react-router-dom';

import {
    showChannelFiles,
    showFlaggedPosts,
    showMentions,
    showPinnedPosts,
    showSearchResults,
    updateRhsState,
    updateSearchTeam,
    updateSearchTerms,
    updateSearchType,
} from 'actions/views/rhs';

import {renderWithContext, screen, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import RhsSearchPopout from './rhs_search_popout';

jest.mock('components/search_results', () => ({
    __esModule: true,
    default: () => <div data-testid='search-results'>{'Search Results'}</div>,
}));

jest.mock('utils/popouts/use_popout_title', () => ({
    __esModule: true,
    default: jest.fn(),
}));

const MOCK_ACTION = {type: 'MOCK'};
jest.mock('actions/views/rhs', () => ({
    showChannelFiles: jest.fn(() => MOCK_ACTION),
    showFlaggedPosts: jest.fn(() => MOCK_ACTION),
    showMentions: jest.fn(() => MOCK_ACTION),
    showPinnedPosts: jest.fn(() => MOCK_ACTION),
    showSearchResults: jest.fn(() => MOCK_ACTION),
    updateRhsState: jest.fn(() => MOCK_ACTION),
    updateSearchTeam: jest.fn(() => MOCK_ACTION),
    updateSearchTerms: jest.fn(() => MOCK_ACTION),
    updateSearchType: jest.fn(() => MOCK_ACTION),
    filterFilesSearchByExt: jest.fn(() => MOCK_ACTION),
}));

describe('RhsSearchPopout', () => {
    const team = TestHelper.getTeamMock({id: 'team1', name: 'test-team'});

    // 26 lowercase alphanumeric characters, and not the current team's id.
    const validSearchTeamId = 'abcdefghijklmnopqrstuvwxyz';

    const channel = TestHelper.getChannelMock({
        id: 'channel1',
        name: 'test-channel',
        display_name: 'Test Channel',
        team_id: team.id,
    });

    const baseState = {
        entities: {
            channels: {
                currentChannelId: channel.id,
                channels: {[channel.id]: channel},
                channelsInTeam: {[team.id]: new Set([channel.id])},
                myMembers: {},
            },
            teams: {
                currentTeamId: team.id,
                teams: {[team.id]: team},
            },
            general: {config: {}, license: {}},
            users: {currentUserId: 'user1'},
        },
        views: {
            rhs: {
                rhsState: 'search',
                isSidebarExpanded: false,
                searchTeam: team.id,
                searchTerms: '',
            },
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    function renderPopout(search: string, rhsState?: string) {
        const state = rhsState ? {
            ...baseState,
            views: {rhs: {...baseState.views.rhs, rhsState}},
        } : baseState;

        return renderWithContext(
            <MemoryRouter initialEntries={[`/_popout/rhs/test-team/search${search}`]}>
                <Route
                    path='/_popout/rhs/:team/search'
                    component={RhsSearchPopout}
                />
            </MemoryRouter>,
            state,
        );
    }

    test('should render SearchResults component', () => {
        renderPopout('?q=test&type=messages&mode=search');
        expect(screen.getByTestId('search-results')).toBeInTheDocument();
    });

    test('should dispatch search setup actions from query params on mount', async () => {
        renderPopout('?q=hello+world&type=messages&mode=search');

        await waitFor(() => {
            expect(jest.mocked(updateSearchType)).toHaveBeenCalledWith('messages');
            expect(jest.mocked(updateSearchTerms)).toHaveBeenCalledWith('hello world');
            expect(jest.mocked(updateSearchTeam)).toHaveBeenCalledWith(team.id);
            expect(jest.mocked(showSearchResults)).toHaveBeenCalledWith(false);
        });
    });

    test('should dispatch showMentions for mention mode without search terms', async () => {
        renderPopout('?q=&type=messages&mode=mention', 'mention');

        await waitFor(() => {
            expect(jest.mocked(showMentions)).toHaveBeenCalled();
        });
    });

    test('should dispatch showSearchResults(true) for mention mode with search terms', async () => {
        renderPopout('?q=from:user&type=messages&mode=mention', 'mention');

        await waitFor(() => {
            expect(jest.mocked(showSearchResults)).toHaveBeenCalledWith(true);
        });
    });

    test('should dispatch showFlaggedPosts for flag mode', async () => {
        renderPopout('?q=&type=messages&mode=flag', 'flag');

        await waitFor(() => {
            expect(jest.mocked(showFlaggedPosts)).toHaveBeenCalled();
        });
    });

    test('should dispatch showPinnedPosts for pin mode when channelId is available', async () => {
        renderPopout('?q=&type=messages&mode=pin&channel=test-channel', 'pin');

        await waitFor(() => {
            expect(jest.mocked(showPinnedPosts)).toHaveBeenCalledWith(channel.id);
        });
    });

    test('should not dispatch showPinnedPosts when channelId is not available', async () => {
        renderPopout('?q=&type=messages&mode=pin', 'pin');

        await waitFor(() => {
            expect(jest.mocked(updateSearchType)).toHaveBeenCalled();
        });

        expect(jest.mocked(showPinnedPosts)).not.toHaveBeenCalled();
        expect(jest.mocked(updateRhsState)).toHaveBeenCalledWith('pin', undefined);
    });

    test('should dispatch showChannelFiles for channel_files mode when channelId is available', async () => {
        renderPopout('?q=&type=messages&mode=channel-files&channel=test-channel', 'channel-files');

        await waitFor(() => {
            expect(jest.mocked(showChannelFiles)).toHaveBeenCalledWith(channel.id);
        });
    });

    test('should resolve searchTeamId from query params with fallback to current team', async () => {
        // A 26-character lowercase alphanumeric id is forwarded unchanged.
        renderPopout(`?q=test&type=messages&mode=search&searchTeamId=${validSearchTeamId}`);
        await waitFor(() => {
            expect(jest.mocked(updateSearchTeam)).toHaveBeenCalledWith(validSearchTeamId);
        });

        jest.clearAllMocks();
        renderPopout('?q=test&type=messages&mode=search&searchTeamId=');
        await waitFor(() => {
            expect(jest.mocked(updateSearchTeam)).toHaveBeenCalledWith('');
        });

        jest.clearAllMocks();
        renderPopout('?q=test&type=messages&mode=search');
        await waitFor(() => {
            expect(jest.mocked(updateSearchTeam)).toHaveBeenCalledWith(team.id);
        });
    });

    // A searchTeamId is kept when it is empty or a 26-character lowercase alphanumeric id.
    // Any other value is treated as absent and the current team is used.
    const searchTeamIdCases = [
        {label: 'percent-encoded separators', searchTeamId: '..%2Fusers%2Fabcdefghijklmnopqrstuvwxyz%2Fpromote%23', expected: team.id},
        {label: 'a hyphenated value', searchTeamId: 'other-team', expected: team.id},
        {label: 'a 25 character id', searchTeamId: 'abcdefghijklmnopqrstuvwxy', expected: team.id},
        {label: 'a 27 character id', searchTeamId: 'abcdefghijklmnopqrstuvwxyz1', expected: team.id},
        {label: 'a 26 character id with an uppercase letter', searchTeamId: 'abcdefghijklmnopqrstuvwxyA', expected: team.id},
        {label: 'a value containing a slash', searchTeamId: 'abc/def', expected: team.id},
        {label: 'a value containing a hash', searchTeamId: 'abc%23def', expected: team.id},
        {label: 'a single dot', searchTeamId: '.', expected: team.id},
        {label: 'two dots', searchTeamId: '..', expected: team.id},
        {label: 'a space', searchTeamId: '%20', expected: team.id},
        {label: 'a tab', searchTeamId: '%09', expected: team.id},
        {label: 'a 26 character id with surrounding spaces', searchTeamId: '%20abcdefghijklmnopqrstuvwxyz%20', expected: team.id},
        {label: 'a twice percent-encoded slash', searchTeamId: '%252F', expected: team.id},
        {label: 'a 26 character id followed by more characters', searchTeamId: 'abcdefghijklmnopqrstuvwxyz/extra', expected: team.id},
        {label: 'a repeated parameter', searchTeamId: 'notavalue&searchTeamId=abcdefghijklmnopqrstuvwxyz', expected: team.id},
        {label: 'a fullwidth character', searchTeamId: '%EF%BD%81', expected: team.id},
        {label: 'a 26 character lowercase id', searchTeamId: validSearchTeamId, expected: validSearchTeamId},
        {label: 'an empty value', searchTeamId: '', expected: ''},
    ].flatMap((testCase) => ([
        {...testCase, mode: 'search' as const},
        {...testCase, mode: 'mention' as const},
    ]));

    test.each(searchTeamIdCases)('resolves searchTeamId for $label in $mode mode', async ({searchTeamId, mode, expected}) => {
        const decoded = new URLSearchParams(`searchTeamId=${searchTeamId}`).get('searchTeamId');

        renderPopout(`?q=test&type=messages&mode=${mode}&searchTeamId=${searchTeamId}`, mode === 'mention' ? 'mention' : undefined);

        await waitFor(() => {
            expect(jest.mocked(updateSearchTeam)).toHaveBeenCalledWith(expected);
        });

        if (decoded !== expected) {
            expect(jest.mocked(updateSearchTeam)).not.toHaveBeenCalledWith(decoded);
        }
    });

    test('should not dispatch actions when teamId is not yet available', () => {
        const noTeamState = {
            ...baseState,
            entities: {
                ...baseState.entities,
                teams: {...baseState.entities.teams, currentTeamId: ''},
            },
        };

        renderWithContext(
            <MemoryRouter initialEntries={['/_popout/rhs/test-team/search?q=test&type=messages&mode=search']}>
                <Route
                    path='/_popout/rhs/:team/search'
                    component={RhsSearchPopout}
                />
            </MemoryRouter>,
            noTeamState,
        );

        expect(jest.mocked(updateSearchType)).not.toHaveBeenCalled();
        expect(jest.mocked(updateSearchTerms)).not.toHaveBeenCalled();
    });

    test('should fallback to updateRhsState for search mode with no search terms', async () => {
        renderPopout('?q=&type=messages&mode=search');

        await waitFor(() => {
            expect(jest.mocked(updateRhsState)).toHaveBeenCalledWith('search', undefined);
        });

        expect(jest.mocked(showSearchResults)).not.toHaveBeenCalled();
    });
});
