// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {within} from '@testing-library/react';
import React from 'react';

import SearchResults, {arePropsEqual} from 'components/search_results/search_results';

import {renderWithContext} from 'tests/react_testing_utils';
import {getHistory} from 'utils/browser_history';
import {popoutRhsSearch} from 'utils/popouts/popout_windows';
import {TestHelper} from 'utils/test_helper';

import type {Props} from './types';

jest.mock('utils/popouts/popout_windows', () => ({
    popoutRhsSearch: jest.fn(),
    canPopout: () => true,
}));

jest.mock('utils/browser_history', () => ({
    getHistory: jest.fn(() => ({push: jest.fn()})),
}));

jest.mock('components/search_results_header', () => ({
    __esModule: true,
    default: (props: {newWindowHandler?: () => void; children: React.ReactNode}) => (
        <div data-testid='search-results-header'>
            {props.children}
            {props.newWindowHandler && (
                <button
                    data-testid='popout-button'
                    onClick={props.newWindowHandler}
                />
            )}
        </div>
    ),
}));

window.HTMLElement.prototype.scrollTo = jest.fn();

describe('components/SearchResults', () => {
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
                myMembers: {[team.id]: {}},
            },
            general: {
                config: {},
                license: {},
                serverVersion: '',
            },
            users: {
                currentUserId: 'user1',
                profiles: {},
            },
            preferences: {myPreferences: {}},
            roles: {roles: {}},
        },
        views: {
            rhs: {
                rhsState: 'search',
                isSidebarExpanded: false,
                searchTeam: team.id,
                searchTerms: 'hello',
            },
        },
        plugins: {
            components: {},
        },
    };

    const baseProps: Props = {
        results: [],
        fileResults: [],
        matches: {},
        searchPage: 0,
        searchTerms: 'hello',
        searchSelectedType: 'messages',
        isSearchingTerm: false,
        isSearchingFlaggedPost: false,
        isSearchingPinnedPost: false,
        isSearchGettingMore: false,
        isSearchAtEnd: true,
        isSearchFilesAtEnd: true,
        currentTeamName: team.name,
        channelDisplayName: '',
        crossTeamSearchEnabled: false,
        isChannelFiles: false,
        isFlaggedPosts: false,
        isMentionSearch: false,
        isOpened: true,
        isPinnedPosts: false,
        isSideBarExpanded: false,
        searchFilterType: 'all',
        searchType: 'messages',
        getMoreFilesForSearch: jest.fn(),
        getMorePostsForSearch: jest.fn(),
        setSearchFilterType: jest.fn(),
        updateSearchTeam: jest.fn(),
        updateSearchTerms: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(getHistory).mockReturnValue({push: jest.fn()} as any);
    });

    function renderSearchResults(propOverrides?: Partial<Props>) {
        const props = {...baseProps, ...propOverrides};
        return renderWithContext(
            <SearchResults {...props}/>,
            baseState,
        );
    }

    describe('newWindowHandler', () => {
        function clickPopout(propOverrides?: Partial<Props>) {
            const {container} = renderSearchResults(propOverrides);
            within(container).getByTestId('popout-button').click();
        }

        test('should resolve mode from boolean props and pass channel only when needed', () => {
            clickPopout({isMentionSearch: true});
            expect(jest.mocked(popoutRhsSearch)).toHaveBeenCalledWith(
                expect.any(String), team.name, 'hello', 'mention', 'messages', undefined, team.id,
            );

            jest.clearAllMocks();
            clickPopout({isFlaggedPosts: true});
            expect(jest.mocked(popoutRhsSearch)).toHaveBeenCalledWith(
                expect.any(String), team.name, 'hello', 'flag', 'messages', undefined, team.id,
            );

            jest.clearAllMocks();
            clickPopout({isPinnedPosts: true});
            expect(jest.mocked(popoutRhsSearch)).toHaveBeenCalledWith(
                expect.any(String), team.name, 'hello', 'pin', 'messages', channel.name, team.id,
            );

            jest.clearAllMocks();
            clickPopout({isChannelFiles: true});
            expect(jest.mocked(popoutRhsSearch)).toHaveBeenCalledWith(
                expect.any(String), team.name, 'hello', 'channel-files', 'messages', channel.name, team.id,
            );

            jest.clearAllMocks();
            clickPopout();
            expect(jest.mocked(popoutRhsSearch)).toHaveBeenCalledWith(
                expect.any(String), team.name, 'hello', 'search', 'messages', undefined, team.id,
            );
        });
    });

    describe('arePropsEqual', () => {
        const result1 = {test: 'test'};
        const result2 = {test: 'test'};
        const fileResult1 = {test: 'test'};
        const fileResult2 = {test: 'test'};
        const results = [result1, result2];
        const fileResults = [fileResult1, fileResult2];
        const props = {
            prop1: 'someprop',
            somearray: [1, 2, 3],
            results,
            fileResults,
        };

        test('should not render', () => {
            expect(arePropsEqual(props as any, {...props} as any)).toBeTruthy();
            expect(arePropsEqual(props as any, {...props, results: [result1, result2]} as any)).toBeTruthy();
            expect(arePropsEqual(props as any, {...props, fileResults: [fileResult1, fileResult2]} as any)).toBeTruthy();
        });

        test('should render', () => {
            expect(!arePropsEqual(props as any, {...props, prop1: 'newprop'} as any)).toBeTruthy();
            expect(!arePropsEqual(props as any, {...props, results: [result2, result1]} as any)).toBeTruthy();
            expect(!arePropsEqual(props as any, {...props, results: [result1, result2, {test: 'test'}]} as any)).toBeTruthy();
            expect(!arePropsEqual(props as any, {...props, fileResults: [fileResult2, fileResult1]} as any)).toBeTruthy();
            expect(!arePropsEqual(props as any, {...props, fileResults: [fileResult1, fileResult2, {test: 'test'}]} as any)).toBeTruthy();
            expect(!arePropsEqual(props as any, {...props, somearray: [1, 2, 3]} as any)).toBeTruthy();
        });
    });
});
