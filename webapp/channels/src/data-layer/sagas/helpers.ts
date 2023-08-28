// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ActionMatchingPattern} from '@redux-saga/types';
import {
    delay,
    fork,
    race,
    take,
} from 'redux-saga/effects';
import type {ActionPattern} from 'redux-saga/effects';

export const batchDebounce = <P extends ActionPattern>(ms: number, pattern: P, worker: (actions: Array<ActionMatchingPattern<P>>) => any) => fork(function* batchDebouncedTask() {
    while (true) {
        const action = (yield take(pattern)) as ActionMatchingPattern<P>;

        const actions = [action];

        while (true) {
            const {debounced, latestAction} = yield race({
                debounced: delay(ms),
                latestAction: take(pattern),
            });

            if (debounced) {
                yield fork(worker, actions);
                break;
            }

            actions.push(latestAction);
        }
    }
});
