// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {renderHook} from '@testing-library/react';

import {useFLIPAnimation} from './use_flip_animation';

type Rect = {top: number; left: number; width: number; height: number};

/**
 * Build a detached HTMLElement whose getBoundingClientRect can be swapped to
 * simulate layout changes between renders. The element is connected to the
 * DOM (the hook skips disconnected nodes via `isConnected`).
 */
function buildItem(id: string, initialRect: Rect): HTMLElement {
    const el = document.createElement('div');
    el.id = id;
    document.body.appendChild(el);
    setRect(el, initialRect);
    return el;
}

function setRect(el: HTMLElement, rect: Rect) {
    el.getBoundingClientRect = jest.fn(() => ({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        bottom: rect.top + rect.height,
        right: rect.left + rect.width,
        x: rect.left,
        y: rect.top,
        toJSON: () => ({}),
    }));
}

describe('useFLIPAnimation', () => {
    let animateSpy: jest.SpyInstance;
    let originalAnimate: typeof HTMLElement.prototype.animate;

    beforeAll(() => {
        // jsdom doesn't implement WAAPI; stub Element.prototype.animate.
        originalAnimate = HTMLElement.prototype.animate;
        HTMLElement.prototype.animate = jest.fn();
    });

    afterAll(() => {
        HTMLElement.prototype.animate = originalAnimate;
    });

    beforeEach(() => {
        document.body.innerHTML = '';
        animateSpy = jest.spyOn(HTMLElement.prototype, 'animate');
        animateSpy.mockClear();
    });

    afterEach(() => {
        animateSpy.mockRestore();
    });

    it('does not animate on first render (no previous positions to compare)', () => {
        // buildItem appends to document.body; we only need the side effect here.
        buildItem('a', {top: 0, left: 0, width: 50, height: 20});
        buildItem('b', {top: 30, left: 0, width: 50, height: 20});

        renderHook(() =>
            useFLIPAnimation({
                items: ['a', 'b'],
                getElement: (id) => document.getElementById(id),
            }),
        );

        expect(animateSpy).not.toHaveBeenCalled();
    });

    it('does not animate when the order is unchanged between renders', () => {
        buildItem('a', {top: 0, left: 0, width: 50, height: 20});
        buildItem('b', {top: 30, left: 0, width: 50, height: 20});

        const {rerender} = renderHook(
            ({items}: {items: string[]}) =>
                useFLIPAnimation({
                    items,
                    getElement: (id) => document.getElementById(id),
                }),
            {initialProps: {items: ['a', 'b']}},
        );
        rerender({items: ['a', 'b']});

        expect(animateSpy).not.toHaveBeenCalled();
    });

    it('animates elements that moved when the order key changes', () => {
        const a = buildItem('a', {top: 0, left: 0, width: 50, height: 20});
        const b = buildItem('b', {top: 30, left: 0, width: 50, height: 20});

        const {rerender} = renderHook(
            ({items}: {items: string[]}) =>
                useFLIPAnimation({
                    items,
                    getElement: (id) => document.getElementById(id),
                }),
            {initialProps: {items: ['a', 'b']}},
        );

        // Simulate the DOM having swapped after a reorder: 'a' now at b's old slot, 'b' at a's.
        setRect(a, {top: 30, left: 0, width: 50, height: 20});
        setRect(b, {top: 0, left: 0, width: 50, height: 20});
        rerender({items: ['b', 'a']});

        // Both elements moved by 30px vertically (in opposite directions).
        expect(animateSpy).toHaveBeenCalledTimes(2);
        const animateCalls = animateSpy.mock.calls;
        const keyframes = animateCalls.map((call) => call[0]);

        // First keyframe is `translate(0 -30px)` for one element and `translate(0 30px)` for the other.
        const hasUpMovement = keyframes.some((kf: Array<{transform: string}>) => kf[0].transform === 'translate(0px, -30px)');
        const hasDownMovement = keyframes.some((kf: Array<{transform: string}>) => kf[0].transform === 'translate(0px, 30px)');
        expect(hasUpMovement).toBe(true);
        expect(hasDownMovement).toBe(true);
    });

    it('does not animate elements whose position is unchanged even when the order key changes (e.g., new item appended)', () => {
        buildItem('a', {top: 0, left: 0, width: 50, height: 20});

        const {rerender} = renderHook(
            ({items}: {items: string[]}) =>
                useFLIPAnimation({
                    items,
                    getElement: (id) => document.getElementById(id),
                }),
            {initialProps: {items: ['a']}},
        );

        // Append 'b' below 'a'; 'a' did not move.
        buildItem('b', {top: 30, left: 0, width: 50, height: 20});
        rerender({items: ['a', 'b']});

        // 'a' didn't move (dx=dy=0). 'b' is new and has no prior rect, so it's skipped.
        expect(animateSpy).not.toHaveBeenCalled();
    });

    it('redirects the animation onto custom targets via getAnimationTargets', () => {
        const wrapper = buildItem('row1', {top: 0, left: 0, width: 200, height: 40});
        const wrapper2 = buildItem('row2', {top: 50, left: 0, width: 200, height: 40});
        const cell1 = document.createElement('span');
        const cell2 = document.createElement('span');
        wrapper.appendChild(cell1);
        wrapper2.appendChild(cell2);

        const {rerender} = renderHook(
            ({items}: {items: string[]}) =>
                useFLIPAnimation({
                    items,
                    getElement: (id) => document.getElementById(id),
                    getAnimationTargets: (row) =>
                        Array.from(row.querySelectorAll('span')) as HTMLElement[],
                }),
            {initialProps: {items: ['row1', 'row2']}},
        );

        // Swap rows.
        setRect(wrapper, {top: 50, left: 0, width: 200, height: 40});
        setRect(wrapper2, {top: 0, left: 0, width: 200, height: 40});
        rerender({items: ['row2', 'row1']});

        // Each row had one <span>; animation should run on each span (not the row).
        const animatedNodes = animateSpy.mock.instances;
        expect(animatedNodes).toContain(cell1);
        expect(animatedNodes).toContain(cell2);
    });

    it('skips elements that have unmounted (isConnected=false) between snapshots', () => {
        const a = buildItem('a', {top: 0, left: 0, width: 50, height: 20});
        const b = buildItem('b', {top: 30, left: 0, width: 50, height: 20});

        const {rerender} = renderHook(
            ({items}: {items: string[]}) =>
                useFLIPAnimation({
                    items,
                    getElement: (id) => document.getElementById(id),
                }),
            {initialProps: {items: ['a', 'b']}},
        );

        // Remove 'b' before the next render's reorder commits.
        b.remove();
        setRect(a, {top: 30, left: 0, width: 50, height: 20});
        rerender({items: ['b', 'a']});

        // 'b' is disconnected → skipped. 'a' moved → animated.
        const animatedNodes = animateSpy.mock.instances;
        expect(animatedNodes).toContain(a);
        expect(animatedNodes).not.toContain(b);
    });

    it('uses the provided duration option', () => {
        const a = buildItem('a', {top: 0, left: 0, width: 50, height: 20});
        const b = buildItem('b', {top: 30, left: 0, width: 50, height: 20});

        const {rerender} = renderHook(
            ({items}: {items: string[]}) =>
                useFLIPAnimation({
                    items,
                    getElement: (id) => document.getElementById(id),
                    duration: 500,
                }),
            {initialProps: {items: ['a', 'b']}},
        );

        setRect(a, {top: 30, left: 0, width: 50, height: 20});
        setRect(b, {top: 0, left: 0, width: 50, height: 20});
        rerender({items: ['b', 'a']});

        expect(animateSpy).toHaveBeenCalled();
        const animationOptions = animateSpy.mock.calls[0][1];
        expect(animationOptions.duration).toBe(500);
    });
});
