// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {act, renderWithContext} from 'tests/react_testing_utils';

import RelativeTime from './relative_time';

describe('components/admin_console/health_dashboard/relative_time', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-05-03T12:00:00Z'));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('just now turns into minutes ago as time passes', () => {
        const {container} = renderWithContext(<RelativeTime value={Date.now() - 40000}/>);

        expect(container.textContent).toEqual('just now');

        act(() => {
            jest.advanceTimersByTime(15000);
        });

        expect(container.textContent).toEqual('1 minute ago');
    });
});
