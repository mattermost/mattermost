// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Route} from 'react-router-dom';

import type {DeepPartial} from '@mattermost/types/utilities';

import {act, renderHookWithContext, renderWithContext} from 'tests/react_testing_utils';
import {getHistory} from 'utils/browser_history';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import {useThreadRouting} from './hooks';

jest.unmock('react-router-dom');
jest.unmock('utils/browser_history');

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
            const history = getHistory();

            const renderAtTeamAThreads = () => {
                let clear: () => void = () => {};

                const Probe = () => {
                    clear = useThreadRouting().clear;
                    return null;
                };

                history.push('/team-a/threads/thread-1');

                renderWithContext(
                    <Route path='/:team/threads'><Probe/></Route>,
                    mockState,
                    {history},
                );

                return clear;
            };

            beforeEach(() => {
                history.replace('/team-a/channels/town-square');
            });

            test('should drop the selected thread while still on the threads route', () => {
                const clear = renderAtTeamAThreads();
                act(() => clear());

                expect(window.location.pathname).toBe('/team-a/threads');
            });

            test.each(['/team-b', '/team-a/channels/town-square'])('should not navigate back after leaving for %s', (path) => {
                const clear = renderAtTeamAThreads();

                act(() => history.push(path));
                act(() => clear());

                expect(window.location.pathname).toBe(path);
            });
        });
    });
});
