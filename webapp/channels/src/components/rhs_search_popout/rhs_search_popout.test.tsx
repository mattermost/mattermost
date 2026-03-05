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

const mockShowChannelFiles = showChannelFiles as jest.MockedFunction<typeof showChannelFiles>;
const mockShowFlaggedPosts = showFlaggedPosts as jest.MockedFunction<typeof showFlaggedPosts>;
const mockShowMentions = showMentions as jest.MockedFunction<typeof showMentions>;
const mockShowPinnedPosts = showPinnedPosts as jest.MockedFunction<typeof showPinnedPosts>;
const mockShowSearchResults = showSearchResults as jest.MockedFunction<typeof showSearchResults>;
const mockUpdateRhsState = updateRhsState as jest.MockedFunction<typeof updateRhsState>;
const mockUpdateSearchTeam = updateSearchTeam as jest.MockedFunction<typeof updateSearchTeam>;
const mockUpdateSearchTerms = updateSearchTerms as jest.MockedFunction<typeof updateSearchTerms>;
const mockUpdateSearchType = updateSearchType as jest.MockedFunction<typeof updateSearchType>;

describe('RhsSearchPopout', () => {
    const team = TestHelper.getTeamMock({id: 'team1', name: 'test-team'});
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
            expect(mockUpdateSearchType).toHaveBeenCalledWith('messages');
            expect(mockUpdateSearchTerms).toHaveBeenCalledWith('hello world');
            expect(mockUpdateSearchTeam).toHaveBeenCalledWith(team.id);
            expect(mockShowSearchResults).toHaveBeenCalledWith(false);
        });
    });

    test('should dispatch showMentions for mention mode without search terms', async () => {
        renderPopout('?q=&type=messages&mode=mention', 'mention');

        await waitFor(() => {
            expect(mockShowMentions).toHaveBeenCalled();
        });
    });

    test('should dispatch showSearchResults(true) for mention mode with search terms', async () => {
        renderPopout('?q=from:user&type=messages&mode=mention', 'mention');

        await waitFor(() => {
            expect(mockShowSearchResults).toHaveBeenCalledWith(true);
        });
    });

    test('should dispatch showFlaggedPosts for flag mode', async () => {
        renderPopout('?q=&type=messages&mode=flag', 'flag');

        await waitFor(() => {
            expect(mockShowFlaggedPosts).toHaveBeenCalled();
        });
    });

    test('should dispatch showPinnedPosts for pin mode when channelId is available', async () => {
        renderPopout('?q=&type=messages&mode=pin&channel=test-channel', 'pin');

        await waitFor(() => {
            expect(mockShowPinnedPosts).toHaveBeenCalledWith(channel.id);
        });
    });

    test('should not dispatch showPinnedPosts when channelId is not available', async () => {
        renderPopout('?q=&type=messages&mode=pin', 'pin');

        await waitFor(() => {
            expect(mockUpdateSearchType).toHaveBeenCalled();
        });

        expect(mockShowPinnedPosts).not.toHaveBeenCalled();
        expect(mockUpdateRhsState).toHaveBeenCalledWith('pin', undefined);
    });

    test('should dispatch showChannelFiles for channel_files mode when channelId is available', async () => {
        renderPopout('?q=&type=messages&mode=channel-files&channel=test-channel', 'channel-files');

        await waitFor(() => {
            expect(mockShowChannelFiles).toHaveBeenCalledWith(channel.id);
        });
    });

    test('should resolve searchTeamId from query params with fallback to current team', async () => {
        renderPopout('?q=test&type=messages&mode=search&searchTeamId=other-team');
        await waitFor(() => {
            expect(mockUpdateSearchTeam).toHaveBeenCalledWith('other-team');
        });

        jest.clearAllMocks();
        renderPopout('?q=test&type=messages&mode=search&searchTeamId=');
        await waitFor(() => {
            expect(mockUpdateSearchTeam).toHaveBeenCalledWith('');
        });

        jest.clearAllMocks();
        renderPopout('?q=test&type=messages&mode=search');
        await waitFor(() => {
            expect(mockUpdateSearchTeam).toHaveBeenCalledWith(team.id);
        });
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

        expect(mockUpdateSearchType).not.toHaveBeenCalled();
        expect(mockUpdateSearchTerms).not.toHaveBeenCalled();
    });

    test('should fallback to updateRhsState for search mode with no search terms', async () => {
        renderPopout('?q=&type=messages&mode=search');

        await waitFor(() => {
            expect(mockUpdateRhsState).toHaveBeenCalledWith('search', undefined);
        });

        expect(mockShowSearchResults).not.toHaveBeenCalled();
    });
});
