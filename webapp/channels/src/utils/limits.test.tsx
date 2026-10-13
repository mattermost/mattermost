// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getUsageProgressBarProps} from './limits';

describe('getUsageProgressBarProps', () => {
    test.each([
        [0, 'var(--online-indicator)'],
        [49, 'var(--online-indicator)'],
        [50, 'var(--away-indicator)'],
        [65, 'var(--away-indicator)'],
        [66, 'var(--dnd-indicator)'],
        [100, 'var(--dnd-indicator)'],
    ])('percent %i uses fill %s', (percent, fill) => {
        const props = getUsageProgressBarProps(percent, '155px');

        expect(props.value).toBe(percent);
        expect(props.style).toEqual({width: '155px', '--button-bg': fill, backgroundColor: undefined});
    });

    test('exceeded shows partial warning fill on danger track', () => {
        const props = getUsageProgressBarProps(150, 'auto');

        expect(props.value).toBe(91);
        expect(props.style).toEqual({width: 'auto', '--button-bg': 'var(--away-indicator)', backgroundColor: 'var(--dnd-indicator)'});
    });

    test('negative percent is clamped to 0', () => {
        expect(getUsageProgressBarProps(-5, '155px').value).toBe(0);
    });
});
