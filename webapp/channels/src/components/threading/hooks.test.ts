// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {DeepPartial} from '@mattermost/types/utilities';

import {renderHookWithContext} from 'tests/react_testing_utils';
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
    });
});
