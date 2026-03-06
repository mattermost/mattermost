// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {renderHookWithContext} from 'tests/react_testing_utils';

import {useScheduleDisplay} from './schedule_display';

describe('useScheduleDisplay', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-03-06T12:00:00.000Z'));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('hides overdue next runs while preserving future ones', () => {
        const {result} = renderHookWithContext(() => useScheduleDisplay());

        expect(result.current.formatNextRun(new Date('2026-03-06T11:00:00.000Z').getTime(), true)).toBeNull();
        expect(result.current.formatNextRun(new Date('2026-03-05T11:00:00.000Z').getTime(), true)).toBeNull();

        const futureNextRun = result.current.formatNextRun(new Date('2026-03-06T13:00:00.000Z').getTime(), true);
        expect(futureNextRun).not.toBeNull();
        expect(futureNextRun as string).toContain('Next:');
    });
});
