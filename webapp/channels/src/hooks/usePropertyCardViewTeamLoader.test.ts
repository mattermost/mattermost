// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {renderHookWithContext, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import {usePropertyCardViewTeamLoader} from './usePropertyCardViewTeamLoader';

describe('usePropertyCardViewTeamLoader', () => {
    const team1 = TestHelper.getTeamMock({id: 'team1'});
    const team2 = TestHelper.getTeamMock({id: 'team2'});

    describe('with store team loading', () => {
        test('should return the team from store when available and no getTeam provided', () => {
            const {result} = renderHookWithContext(
                () => usePropertyCardViewTeamLoader('team1'),
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
        });

        test('should return undefined when team not in store and no getTeam provided', () => {
            const {result} = renderHookWithContext(
                () => usePropertyCardViewTeamLoader('team1'),
            );

            expect(result.current).toBe(undefined);
        });

        test('should return undefined when no teamId provided', () => {
            const {result} = renderHookWithContext(
                () => usePropertyCardViewTeamLoader(),
            );

            expect(result.current).toBe(undefined);
        });
    });

    describe('with custom getTeam function', () => {
        test('should use getTeam when provided and team not in store', async () => {
            const getTeamMock = jest.fn().mockResolvedValue(team1);

            const {result} = renderHookWithContext(
                () => usePropertyCardViewTeamLoader('team1', getTeamMock),
            );

            expect(result.current).toBe(undefined);
            expect(getTeamMock).toHaveBeenCalledWith('team1');

            await waitFor(() => {
                expect(result.current).toBe(team1);
            });
        });

        test('should prefer getTeam over store when both available', async () => {
            const mockedTeam1 = TestHelper.getTeamMock({id: 'team1', display_name: 'Mocked Team 1'});
            const getTeamMock = jest.fn().mockResolvedValue(mockedTeam1);

            const {result} = renderHookWithContext(
                () => usePropertyCardViewTeamLoader('team1', getTeamMock),
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

            await waitFor(() => {
                expect(result.current).toBe(mockedTeam1);
            });
            expect(getTeamMock).toHaveBeenCalledTimes(1);
        });

        test('should handle getTeam errors gracefully', async () => {
            const getTeamMock = jest.fn().mockRejectedValue(new Error('Network error'));
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            const {result} = renderHookWithContext(
                () => usePropertyCardViewTeamLoader('team1', getTeamMock),
            );

            expect(result.current).toBe(undefined);

            await waitFor(() => {
                expect(consoleSpy).toHaveBeenCalledWith(
                    'Error occurred while fetching team for post preview property renderer',
                    expect.any(Error),
                );
            });

            expect(result.current).toBe(undefined);
            consoleSpy.mockRestore();
        });

        test('should only call getTeam once per teamId', async () => {
            const getTeamMock = jest.fn().mockResolvedValue(team1);

            const {result, rerender} = renderHookWithContext(
                () => usePropertyCardViewTeamLoader('team1', getTeamMock),
            );

            expect(getTeamMock).toHaveBeenCalledTimes(1);

            await waitFor(() => {
                expect(result.current).toBe(team1);
            });

            // Rerender multiple times
            for (let i = 0; i < 5; i++) {
                rerender();
            }

            expect(getTeamMock).toHaveBeenCalledTimes(1);
        });

        test('should call getTeam again when teamId changes', async () => {
            const getTeamMock = jest.fn().
                mockResolvedValueOnce(team1).
                mockResolvedValueOnce(team2);

            let teamId = 'team1';
            const {result, rerender} = renderHookWithContext(
                () => usePropertyCardViewTeamLoader(teamId, getTeamMock),
            );

            expect(getTeamMock).toHaveBeenCalledWith('team1');

            await waitFor(() => {
                expect(result.current).toBe(team1);
            });

            // Change teamId
            teamId = 'team2';
            rerender();

            expect(getTeamMock).toHaveBeenCalledWith('team2');

            await waitFor(() => {
                expect(result.current).toBe(team2);
            });

            expect(getTeamMock).toHaveBeenCalledTimes(2);
        });

        test('should not call getTeam when teamId is empty', () => {
            const getTeamMock = jest.fn();

            const {result} = renderHookWithContext(
                () => usePropertyCardViewTeamLoader('', getTeamMock),
            );

            expect(result.current).toBe(undefined);
            expect(getTeamMock).not.toHaveBeenCalled();
        });
    });
});
