// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createMemoryHistory} from 'history';
import React from 'react';
import {Route} from 'react-router-dom';

import type {DeepPartial} from '@mattermost/types/utilities';

import {renderHookWithContext, renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import {useThreadRouting} from './hooks';

describe('components/threading/hooks', () => {
    const mockUser = TestHelper.getUserMock();
    const mockTeam = TestHelper.getTeamMock();

    const mockState: DeepPartial<GlobalState> = {
        entities: {
            users: {
                currentUserId: mockUser.id,
            },
            teams: {
                currentTeamId: mockTeam.id,
            },
        },
    };

    describe('useThreadRouting', () => {
        test('should indicate current team and user', () => {
            const {result} = renderHookWithContext(() => useThreadRouting(), mockState);

            expect(result.current.currentUserId).toBe(mockUser.id);
            expect(result.current.currentTeamId).toBe(mockTeam.id);
        });

        describe('clear', () => {
            const historyMock = (global as any).historyMock;

            // Captures clear from within a route match so that it can be called afterwards, the way
            // an effect scheduled while the threads view was mounted would.
            const renderAtTeamAThreads = () => {
                let clear: () => void = () => {};

                const Probe = () => {
                    clear = useThreadRouting().clear;
                    return null;
                };

                renderWithContext(
                    <Route path='/:team/threads'><Probe/></Route>,
                    mockState,
                    {history: createMemoryHistory({initialEntries: ['/team-a/threads/thread-1']})},
                );

                return () => clear();
            };

            beforeEach(() => {
                historyMock.replace.mockClear();
            });

            test('should drop the selected thread while still on the threads route', () => {
                historyMock.location.pathname = '/team-a/threads/thread-1';

                renderAtTeamAThreads()();

                expect(historyMock.replace).toHaveBeenCalledWith('/team-a/threads');
            });

            test('should not navigate back once the user has left the threads route', () => {
                const clear = renderAtTeamAThreads();

                historyMock.location.pathname = '/team-b';
                clear();

                expect(historyMock.replace).not.toHaveBeenCalled();
            });
        });
    });
});
