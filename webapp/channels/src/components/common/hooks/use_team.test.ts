// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';
import * as ReactRedux from 'react-redux';

import {Client4} from 'mattermost-redux/client';

import {renderHookWithContext, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import {useTeam} from './use_team';

describe('useTeam', () => {
    const team1 = TestHelper.getTeamMock({id: 'team1'});
    const team2 = TestHelper.getTeamMock({id: 'team2'});

    describe('with fake dispatch', () => {
        const dispatchMock = jest.fn();

        beforeAll(() => {
            jest.spyOn(ReactRedux, 'useDispatch').mockImplementation(() => dispatchMock);
        });

        afterAll(() => {
            jest.restoreAllMocks();
        });

        test("should return the team if it's already in the store", () => {
            const {result} = renderHookWithContext(
                () => useTeam('team1'),
                {
                    entities: {
                        teams: {
                            teams: {
                                team1,
                            },
                        },
                    },
                },
            );

            expect(result.current).toBe(team1);
            expect(dispatchMock).not.toHaveBeenCalled();
        });

        test("should fetch the team if it's not in the store", () => {
            const {result} = renderHookWithContext(
                () => useTeam('team1'),
            );

            expect(result.current).toBe(undefined);
            expect(dispatchMock).toHaveBeenCalledTimes(1);
        });

        test('should only attempt to fetch the team once regardless of how many times the hook is used', () => {
            const {result, rerender} = renderHookWithContext(
                () => useTeam('team1'),
            );

            expect(result.current).toBe(undefined);
            expect(dispatchMock).toHaveBeenCalledTimes(1);

            for (let i = 0; i < 10; i++) {
                rerender();
            }

            expect(result.current).toBe(undefined);
            expect(dispatchMock).toHaveBeenCalledTimes(1);
        });

        test('should attempt to fetch different teams if the team ID changes', () => {
            let teamId = 'team1';
            const {result, rerender} = renderHookWithContext(
                () => useTeam(teamId),
            );

            expect(result.current).toBe(undefined);
            expect(dispatchMock).toHaveBeenCalledTimes(1);

            teamId = 'team2';
            rerender();

            expect(result.current).toBe(undefined);
            expect(dispatchMock).toHaveBeenCalledTimes(2);
        });

        test("should only attempt to fetch each team once when they aren't loaded", () => {
            let teamId = 'team1';
            const {result, replaceStoreState, rerender} = renderHookWithContext(
                () => useTeam(teamId),
            );

            // Initial state without team1 loaded
            expect(result.current).toBe(undefined);
            expect(dispatchMock).toHaveBeenCalledTimes(1);

            // Simulate the response to loading team1
            replaceStoreState({
                entities: {
                    teams: {
                        teams: {
                            team1,
                        },
                    },
                },
            });

            expect(result.current).toBe(team1);
            expect(dispatchMock).toHaveBeenCalledTimes(1);

            // Switch to team2
            teamId = 'team2';

            rerender();

            expect(result.current).toBe(undefined);
            expect(dispatchMock).toHaveBeenCalledTimes(2);

            // Simulate the response to loading team2
            replaceStoreState({
                entities: {
                    teams: {
                        teams: {
                            team1,
                            team2,
                        },
                    },
                },
            });

            expect(result.current).toBe(team2);
            expect(dispatchMock).toHaveBeenCalledTimes(2);

            // Switch back to team1 which has already been loaded
            teamId = 'team1';

            rerender();

            expect(result.current).toBe(team1);
            expect(dispatchMock).toHaveBeenCalledTimes(2);
        });

        test("shouldn't attempt to load anything when given an empty team ID", () => {
            const {result} = renderHookWithContext(
                () => useTeam(''),
            );

            expect(result.current).toBe(undefined);
            expect(dispatchMock).toHaveBeenCalledTimes(0);
        });
    });

    describe('with real dispatch', () => {
        beforeAll(() => {
            Client4.setUrl('http://localhost:8065');
        });

        test("should fetch team when it's not loaded", async () => {
            const teamMock = nock(Client4.getBaseRoute()).
                get(`/teams/${team1.id}`).
                once().
                reply(200, team1);

            const {result} = renderHookWithContext(
                () => useTeam('team1'),
            );

            // Initial state without team1 loaded
            expect(result.current).toEqual(undefined);
            expect(teamMock.isDone()).toBe(false);

            // Wait for the response with team1
            await waitFor(() => {
                expect(teamMock.isDone()).toBe(true);
                expect(result.current).toEqual(team1);
            });
        });

        test("should only attempt to fetch each team once when they aren't loaded", async () => {
            const team1Mock = nock(Client4.getBaseRoute()).
                get(`/teams/${team1.id}`).
                once().
                reply(200, team1);
            const team2Mock = nock(Client4.getBaseRoute()).
                get(`/teams/${team2.id}`).
                once().
                reply(200, team2);

            let teamId = 'team1';
            const {result, rerender} = renderHookWithContext(
                () => useTeam(teamId),
            );

            // Initial state without team1 loaded
            expect(result.current).toEqual(undefined);
            expect(team1Mock.isDone()).toBe(false);
            expect(team2Mock.isDone()).toBe(false);

            // Wait for the response with team1
            await waitFor(() => {
                expect(team1Mock.isDone()).toBe(true);
                expect(team2Mock.isDone()).toBe(false);
                expect(result.current).toEqual(team1);
            });

            // Switch to team2
            teamId = 'team2';
            rerender();

            expect(result.current).toEqual(undefined);

            // Wait for the response with team2
            await waitFor(() => {
                expect(team1Mock.isDone()).toBe(true);
                expect(team2Mock.isDone()).toBe(true);
                expect(result.current).toEqual(team2);
            });

            // Switch back to team1 which has already been loaded
            teamId = 'team1';
            rerender();

            expect(result.current).toEqual(team1);

            // We know there's no second call because nock is set to only mock the first request for each team
        });
    });
});
