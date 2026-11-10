// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {renderHook} from '@testing-library/react';
import {useRef} from 'react';

import {useClickOutside} from './useClickOutside';

function fireMousedown(target: EventTarget) {
    target.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, cancelable: true}));
}

describe('useClickOutside', () => {
    it('should invoke the handler when a mousedown occurs outside the referenced element', () => {
        const handler = jest.fn();

        const div = document.createElement('div');
        document.body.appendChild(div);

        const outside = document.createElement('button');
        document.body.appendChild(outside);

        const {unmount} = renderHook(() => {
            const ref = useRef<HTMLElement | null>(div);
            useClickOutside(ref, handler);
        });

        fireMousedown(outside);

        expect(handler).toHaveBeenCalledTimes(1);

        unmount();
        document.body.removeChild(div);
        document.body.removeChild(outside);
    });

    it('should NOT invoke the handler when a mousedown occurs inside the referenced element', () => {
        const handler = jest.fn();

        const div = document.createElement('div');
        const inner = document.createElement('span');
        div.appendChild(inner);
        document.body.appendChild(div);

        const {unmount} = renderHook(() => {
            const ref = useRef<HTMLElement | null>(div);
            useClickOutside(ref, handler);
        });

        fireMousedown(inner);

        expect(handler).not.toHaveBeenCalled();

        unmount();
        document.body.removeChild(div);
    });

    it('should NOT invoke the handler when mousedown is on the element itself', () => {
        const handler = jest.fn();

        const div = document.createElement('div');
        document.body.appendChild(div);

        const {unmount} = renderHook(() => {
            const ref = useRef<HTMLElement | null>(div);
            useClickOutside(ref, handler);
        });

        fireMousedown(div);

        expect(handler).not.toHaveBeenCalled();

        unmount();
        document.body.removeChild(div);
    });

    it('should not attach the listener when enabled is false', () => {
        const handler = jest.fn();

        const div = document.createElement('div');
        document.body.appendChild(div);

        const outside = document.createElement('button');
        document.body.appendChild(outside);

        const {unmount} = renderHook(() => {
            const ref = useRef<HTMLElement | null>(div);
            useClickOutside(ref, handler, false);
        });

        fireMousedown(outside);

        expect(handler).not.toHaveBeenCalled();

        unmount();
        document.body.removeChild(div);
        document.body.removeChild(outside);
    });

    it('should remove the listener on unmount — outside mousedown after unmount does not call handler', () => {
        const handler = jest.fn();

        const div = document.createElement('div');
        document.body.appendChild(div);

        const outside = document.createElement('button');
        document.body.appendChild(outside);

        const {unmount} = renderHook(() => {
            const ref = useRef<HTMLElement | null>(div);
            useClickOutside(ref, handler);
        });

        unmount();

        fireMousedown(outside);

        expect(handler).not.toHaveBeenCalled();

        document.body.removeChild(div);
        document.body.removeChild(outside);
    });

    it('should fire on any mousedown when the ref argument is null (click-anywhere mode)', () => {
        const handler = jest.fn();

        const anywhere = document.createElement('button');
        document.body.appendChild(anywhere);

        const {unmount} = renderHook(() => {
            useClickOutside(null, handler);
        });

        fireMousedown(anywhere);

        expect(handler).toHaveBeenCalledTimes(1);

        unmount();
        document.body.removeChild(anywhere);
    });

    it('should use the latest handler identity without re-registering the listener', () => {
        const firstHandler = jest.fn();
        const secondHandler = jest.fn();

        const div = document.createElement('div');
        document.body.appendChild(div);

        const outside = document.createElement('button');
        document.body.appendChild(outside);

        const {rerender, unmount} = renderHook(
            ({handler}: {handler: () => void}) => {
                const ref = useRef<HTMLElement | null>(div);
                useClickOutside(ref, handler);
            },
            {initialProps: {handler: firstHandler}},
        );

        // Swap to second handler before firing
        rerender({handler: secondHandler});

        fireMousedown(outside);

        expect(firstHandler).not.toHaveBeenCalled();
        expect(secondHandler).toHaveBeenCalledTimes(1);

        unmount();
        document.body.removeChild(div);
        document.body.removeChild(outside);
    });
});
