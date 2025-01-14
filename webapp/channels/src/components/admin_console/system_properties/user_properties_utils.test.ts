// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act} from '@testing-library/react-hooks';

import type {UserPropertyField} from '@mattermost/types/properties';
import type {DeepPartial} from '@mattermost/types/utilities';

import {Client4} from 'mattermost-redux/client';

import {renderHookWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import {} from './section_utils';
import {useUserPropertyFields} from './user_properties_utils';

function getBaseState(): DeepPartial<GlobalState> {
    const currentUser = TestHelper.getUserMock();
    const otherUser = TestHelper.getUserMock();

    return {
        entities: {
            users: {
                currentUserId: currentUser.id,
                profiles: {
                    [currentUser.id]: currentUser,
                    [otherUser.id]: otherUser,
                },
            },
            general: {

            },
        },
    };
}

describe('useUserPropertyFields', () => {
    jest.useFakeTimers();
    const getCustomProfileAttributeFields = jest.spyOn(Client4, 'getCustomProfileAttributeFields');

    it('should return a collection', async () => {
        const field0: UserPropertyField = {id: 'f0', name: 'test attribute 0', type: 'text', create_at: 1736541716295, delete_at: 0, update_at: 0};
        const field1: UserPropertyField = {id: 'f1', name: 'test attribute 1', type: 'text', create_at: 1736541716295, delete_at: 0, update_at: 0};
        const field2: UserPropertyField = {id: 'f2', name: 'test attribute 2', type: 'text', create_at: 1736541716295, delete_at: 0, update_at: 0};
        const field3: UserPropertyField = {id: 'f3', name: 'test attribute 3', type: 'text', create_at: 1736541716295, delete_at: 0, update_at: 0};

        getCustomProfileAttributeFields.mockResolvedValue([field0, field1, field2, field3]);

        const {result, rerender, waitFor} = renderHookWithContext(() => {
            return useUserPropertyFields();
        }, getBaseState());

        const [fields1, read1] = result.current;
        expect(read1.loading).toBe(true);
        expect(read1.error).toBe(undefined);
        expect(getCustomProfileAttributeFields).toBeCalledTimes(1);
        expect(fields1.data).toEqual({});
        expect(fields1.order).toEqual([]);

        act(() => {
            jest.runAllTimers();
        });
        rerender();

        await waitFor(() => {
            const [, read] = result.current;
            expect(read.loading).toBe(false);
        });

        const [fields2, read2] = result.current;
        expect(read2.loading).toBe(false);
        expect(read2.error).toBe(undefined);
        expect(fields2.data).toEqual({[field0.id]: field0, [field1.id]: field1, [field2.id]: field2, [field3.id]: field3});
        expect(fields2.order).toEqual(['f0', 'f1', 'f2', 'f3']);
    });
});
