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

    test('formats the next run in the schedule timezone rather than the browser zone', () => {
        const {result} = renderHookWithContext(() => useScheduleDisplay());

        // 23:30 UTC is 18:30 EST on 2026-03-06 (before US DST), so the schedule timezone must win.
        const nextRun = result.current.formatNextRun(
            new Date('2026-03-06T23:30:00.000Z').getTime(),
            true,
            'America/New_York',
        );

        expect(nextRun).toContain('6:30');
        expect(nextRun).toContain('EST');
        expect(nextRun).not.toContain('11:30');
    });
});
