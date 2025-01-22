// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act} from '@testing-library/react-hooks';

import type {DeepPartial} from '@mattermost/types/utilities';

import {renderHookWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import {useOperation, useOperationStatus} from './section_utils';

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

describe('useOperationStatus', () => {
    it('should indicate loading true then false', async () => {
        const {result, rerender} = renderHookWithContext(() => {
            return useOperationStatus(true);
        }, getBaseState());

        const [status1, setStatus] = result.current;
        expect(status1.loading).toBe(true);
        expect(status1.error).toBe(undefined);

        act(() => {
            setStatus(false);
        });

        rerender();

        const [status2] = result.current;
        expect(status2.loading).toBe(false);
        expect(status2.error).toBe(undefined);
    });

    it('should indicate loading true then false with error', async () => {
        const {result, rerender} = renderHookWithContext(() => {
            return useOperationStatus(true);
        }, getBaseState());

        const [status1, setStatus] = result.current;
        expect(status1.loading).toBe(true);
        expect(status1.error).toBe(undefined);

        const testErr = new Error('test error');

        act(() => {
            setStatus(testErr);
        });

        rerender();

        const [status2] = result.current;
        expect(status2.loading).toBe(false);
        expect(status2.error).toBe(testErr);
    });
});

describe('useOperation', () => {
    it('should run operation on command with response value and loading phases: false -> true -> false', async () => {
        jest.useFakeTimers();

        const testResolvingAsyncAction = jest.fn().mockImplementation((responseValue) => new Promise((r) => setTimeout(() => r(responseValue), 1000)));

        const {result, rerender} = renderHookWithContext(() => {
            return useOperation(testResolvingAsyncAction, false);
        }, getBaseState());

        const [doAction, status1] = result.current;
        expect(status1.loading).toBe(false);
        expect(status1.error).toBe(undefined);
        expect(testResolvingAsyncAction).not.toBeCalled();

        let actionPromise: Promise<any>;
        await act(async () => {
            actionPromise = doAction('test response value');
        });
        rerender();

        const [, status2] = result.current;
        expect(status2.loading).toBe(true);
        expect(status2.error).toBe(undefined);
        expect(testResolvingAsyncAction).toBeCalledTimes(1);

        jest.runAllTimers();

        await act(async () => {
            await actionPromise;

            const [, status3] = result.current;

            expect(status3.loading).toBe(false);
            expect(await actionPromise).toBe('test response value');
            expect(status3.error).toBe(undefined);
        });
    });

    it('should run operation on command with error and loading phases: false -> true -> false', async () => {
        jest.useFakeTimers();

        const testRejectingAsyncAction = jest.fn().mockImplementation(() => new Promise((resolve, reject) => setTimeout(() => reject(new Error('error somewhere')), 1000)));

        const {result, rerender} = renderHookWithContext(() => {
            return useOperation(testRejectingAsyncAction, false);
        }, getBaseState());

        const [doAction, status1] = result.current;
        expect(status1.loading).toBe(false);
        expect(status1.error).toBe(undefined);

        let actionPromise: Promise<any>;
        act(() => {
            actionPromise = doAction();
        });
        rerender();

        const [, status2] = result.current;
        expect(status2.loading).toBe(true);
        expect(status2.error).toBe(undefined);

        jest.runAllTimers();

        await act(async () => {
            await actionPromise;
        });

        const [, status3] = result.current;
        expect(status3.loading).toBe(false);
        expect(status3.error).toBeTruthy();
    });
});
