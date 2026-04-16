// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {renderHook} from '@testing-library/react';

import {useLatest} from './useLatest';

describe('useLatest', () => {
    it('should initialize ref.current with the value passed on first render', () => {
        const {result} = renderHook(() => useLatest(42));
        expect(result.current.current).toBe(42);
    });

    it('should update ref.current to reflect the most recent value after rerender', () => {
        const {result, rerender} = renderHook(({value}) => useLatest(value), {
            initialProps: {value: 'first'},
        });

        expect(result.current.current).toBe('first');

        rerender({value: 'second'});
        expect(result.current.current).toBe('second');

        rerender({value: 'third'});
        expect(result.current.current).toBe('third');
    });

    it('should return a stable ref identity across renders', () => {
        const {result, rerender} = renderHook(({value}) => useLatest(value), {
            initialProps: {value: 1},
        });

        const refAfterFirstRender = result.current;
        rerender({value: 2});
        const refAfterSecondRender = result.current;

        expect(refAfterFirstRender).toBe(refAfterSecondRender);
    });

    it('should work with object values and reflect identity changes', () => {
        const obj1 = {id: 1};
        const obj2 = {id: 2};

        const {result, rerender} = renderHook(({value}) => useLatest(value), {
            initialProps: {value: obj1},
        });

        expect(result.current.current).toBe(obj1);

        rerender({value: obj2});
        expect(result.current.current).toBe(obj2);
    });

    it('should update synchronously during the commit phase — ref is current by the time a layout effect reads it', () => {
        // useLatest uses useLayoutEffect which runs synchronously after the DOM mutation.
        // After rerender() resolves (React Testing Library flushes effects), ref.current should be updated.
        const {result, rerender} = renderHook(({value}) => useLatest(value), {
            initialProps: {value: 'initial'},
        });

        rerender({value: 'updated'});

        // By the time rerender() returns, layout effects have been flushed.
        expect(result.current.current).toBe('updated');
    });
});
