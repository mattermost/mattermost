// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {renderHook} from '@testing-library/react-hooks';

import usePrefixedIds, {joinIds} from './usePrefixedIds';

describe('usePrefixedIds', () => {
    test('should combine prefixes with suffixes and return the result', () => {
        const {result} = renderHook((props) => usePrefixedIds(props.prefix, props.suffixes), {
            initialProps: {
                prefix: 'p1',
                suffixes: {
                    s1: null,
                    s2: null,
                    s3: null,
                },
            },
        });

        expect(result.current).toEqual({
            s1: 'p1-s1',
            s2: 'p1-s2',
            s3: 'p1-s3',
        });
    });

    test('should recalculate the result only when the prefix changes', () => {
        const {rerender, result} = renderHook((props) => usePrefixedIds(props.prefix, props.suffixes), {
            initialProps: {
                prefix: 'p1',
                suffixes: {
                    s1: null,
                    s2: null,
                    s3: null,
                },
            },
        });

        expect(result.all.length).toBe(1);

        // Re-rendering without changing the props should return the same result
        rerender();

        expect(result.all.length).toBe(2);
        expect(result.all[0]).toBe(result.all[1]);

        // Re-rendering without changing the prefix should return the same result, even if getSuffixes isn't memoized
        rerender({
            prefix: 'p1',
            suffixes: {
                s1: null,
                s2: null,
                s3: null,
            },
        });

        expect(result.all.length).toBe(3);
        expect(result.all[0]).toBe(result.all[1]);
        expect(result.all[0]).toBe(result.all[2]);

        // Changing the prefix should cause it to recalculate
        rerender({
            prefix: 'p2',
            suffixes: {
                s1: null,
                s2: null,
                s3: null,
            },
        });

        expect(result.all.length).toBe(4);
        expect(result.all[0]).toBe(result.all[1]);
        expect(result.all[0]).toBe(result.all[2]);
        expect(result.all[0]).not.toBe(result.all[3]);
        expect(result.current).toEqual({
            s1: 'p2-s1',
            s2: 'p2-s2',
            s3: 'p2-s3',
        });
    });
});

describe('joinIds', () => {
    test('should concatenate together provided IDs without any falsy ones', () => {
        expect(joinIds('aa', 'bb', '', 'dd', '', '', 'gg')).toEqual('aa bb dd gg');
    });
});
