// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act} from '@testing-library/react';

import {getMoreFilesForSearch, getMorePostsForSearch} from 'mattermost-redux/actions/search';

import {
    filterFilesSearchByExt,
    showChannelFiles,
    showSearchResults,
    updateSearchTerms as updateSearchTermsAction,
    updateSearchType as updateSearchTypeAction,
} from 'actions/views/rhs';

import {renderHookWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import useSearchResultsActions from './use_search_results_actions';

const MOCK_ACTION = {type: 'MOCK'};
jest.mock('mattermost-redux/actions/search', () => ({
    getMorePostsForSearch: jest.fn(() => MOCK_ACTION),
    getMoreFilesForSearch: jest.fn(() => MOCK_ACTION),
}));

jest.mock('actions/views/rhs', () => ({
    filterFilesSearchByExt: jest.fn(() => MOCK_ACTION),
    showChannelFiles: jest.fn(() => MOCK_ACTION),
    showSearchResults: jest.fn(() => MOCK_ACTION),
    updateSearchTeam: jest.fn(() => MOCK_ACTION),
    updateSearchTerms: jest.fn(() => MOCK_ACTION),
    updateSearchType: jest.fn(() => MOCK_ACTION),
}));

const {updateSearchTeam: updateSearchTeamAction} = jest.requireMock('actions/views/rhs');

describe('useSearchResultsActions', () => {
    const channel = TestHelper.getChannelMock({id: 'channel1', name: 'test-channel'});
    const initialState = {
        entities: {
            channels: {
                currentChannelId: channel.id,
                channels: {
                    [channel.id]: channel,
                },
                myMembers: {},
            },
        },
        views: {
            rhs: {
                rhsState: 'search',
                searchTeam: 'team1',
                searchTerms: 'hello world',
            },
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    function callAction(
        callback: (actions: ReturnType<typeof useSearchResultsActions>) => void,
        rhsState?: string,
    ) {
        const state = {
            ...initialState,
            views: {
                rhs: {
                    ...initialState.views.rhs,
                    rhsState: rhsState ?? initialState.views.rhs.rhsState,
                },
            },
        };
        const {result} = renderHookWithContext(() => useSearchResultsActions(), state);
        act(() => callback(result.current));
        return result;
    }

    test('getMorePostsForSearch should dispatch with search team', () => {
        callAction((a) => a.getMorePostsForSearch());
        expect(jest.mocked(getMorePostsForSearch)).toHaveBeenCalledWith('team1');
    });

    test('getMorePostsForSearch should dispatch with empty team for mention search', () => {
        callAction((a) => a.getMorePostsForSearch(), 'mention');
        expect(jest.mocked(getMorePostsForSearch)).toHaveBeenCalledWith('');
    });

    test('getMoreFilesForSearch should dispatch with search team', () => {
        callAction((a) => a.getMoreFilesForSearch());
        expect(jest.mocked(getMoreFilesForSearch)).toHaveBeenCalledWith('team1');
    });

    test('setSearchFilterType should dispatch filter and trigger search results', () => {
        callAction((a) => a.setSearchFilterType('documents'));
        expect(jest.mocked(filterFilesSearchByExt)).toHaveBeenCalledWith(['doc', 'pdf', 'docx', 'odt', 'rtf', 'txt']);
        expect(jest.mocked(showSearchResults)).toHaveBeenCalledWith(false);
    });

    test('setSearchFilterType should dispatch showChannelFiles when in channel files mode', () => {
        callAction((a) => a.setSearchFilterType('images'), 'channel-files');
        expect(jest.mocked(filterFilesSearchByExt)).toHaveBeenCalledWith(['png', 'jpg', 'jpeg', 'bmp', 'tiff', 'svg', 'xcf']);
        expect(jest.mocked(showChannelFiles)).toHaveBeenCalledWith(channel.id);
    });

    test('setSearchFilterType "all" should dispatch empty extension array', () => {
        callAction((a) => a.setSearchFilterType('all'));
        expect(jest.mocked(filterFilesSearchByExt)).toHaveBeenCalledWith([]);
    });

    test('updateSearchTerms should append term replacing last word', () => {
        callAction((a) => a.updateSearchTerms('From:'));
        expect(jest.mocked(updateSearchTermsAction)).toHaveBeenCalledWith('hello from:');
    });

    test('setSearchType should dispatch updateSearchType', () => {
        callAction((a) => a.setSearchType('files'));
        expect(jest.mocked(updateSearchTypeAction)).toHaveBeenCalledWith('files');
    });

    test('updateSearchTeam should dispatch team update and re-search', () => {
        callAction((a) => a.updateSearchTeam('team2'));
        expect(jest.mocked(updateSearchTeamAction)).toHaveBeenCalledWith('team2');
        expect(jest.mocked(showSearchResults)).toHaveBeenCalledWith(false);
    });

    test('updateSearchTeam should strip in: and from: filters from terms', () => {
        function callWithTerms(terms: string) {
            const state = {
                ...initialState,
                views: {rhs: {...initialState.views.rhs, searchTerms: terms}},
            };
            const {result} = renderHookWithContext(() => useSearchResultsActions(), state);
            let cleaned = '';
            act(() => {
                cleaned = result.current.updateSearchTeam('team2');
            });
            return cleaned;
        }

        expect(callWithTerms('hello in:town-square from:user1')).toBe('hello');
        expect(callWithTerms('hello world')).toBe('hello world');
        expect(jest.mocked(updateSearchTermsAction)).toHaveBeenCalledTimes(1);
    });

    test('updateSearchTeam should return cleaned terms', () => {
        let result = '';
        callAction((a) => {
            result = a.updateSearchTeam('team2');
        });
        expect(result).toBe('hello world');
    });
});
