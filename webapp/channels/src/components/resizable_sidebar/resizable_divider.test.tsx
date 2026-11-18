// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent} from '@testing-library/react';
import React, {useRef} from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import {CssVarKeyForResizable, ResizeDirection} from './constants';
import ResizableDivider from './resizable_divider';

describe('components/resizable_sidebar/ResizableDivider', () => {
    const dividerId = 'resizable-divider';

    function TestWrapper(props: {onResizeStart?: jest.Mock; onResizeEnd?: jest.Mock; defaultWidth?: number | (() => number)}) {
        const containerRef = useRef<HTMLDivElement>(null);

        return (
            <div ref={containerRef}>
                <ResizableDivider
                    id={dividerId}
                    name='test'
                    defaultWidth={props.defaultWidth ?? 240}
                    globalCssVar={CssVarKeyForResizable.LHS}
                    dir={ResizeDirection.LEFT}
                    containerRef={containerRef}
                    onResizeStart={props.onResizeStart}
                    onResizeEnd={props.onResizeEnd}
                />
            </div>
        );
    }

    test('should start resizing when using the left mouse button', () => {
        const onResizeStart = jest.fn();
        const {container} = renderWithContext(<TestWrapper onResizeStart={onResizeStart}/>);

        const divider = container.querySelector(`#${dividerId}`)!;
        fireEvent.mouseDown(divider, {button: 0});

        expect(onResizeStart).toHaveBeenCalledTimes(1);
    });

    test('should not start resizing when using the middle mouse button', () => {
        const onResizeStart = jest.fn();
        const {container} = renderWithContext(<TestWrapper onResizeStart={onResizeStart}/>);

        const divider = container.querySelector(`#${dividerId}`)!;
        fireEvent.mouseDown(divider, {button: 1});

        expect(onResizeStart).not.toHaveBeenCalled();
    });

    test('should not start resizing when using the right mouse button', () => {
        const onResizeStart = jest.fn();
        const {container} = renderWithContext(<TestWrapper onResizeStart={onResizeStart}/>);

        const divider = container.querySelector(`#${dividerId}`)!;
        fireEvent.mouseDown(divider, {button: 2});

        expect(onResizeStart).not.toHaveBeenCalled();
    });

    test('should read a default width function when each drag starts', () => {
        const defaultWidth = jest.fn(() => 368);
        const {container} = renderWithContext(<TestWrapper defaultWidth={defaultWidth}/>);

        expect(defaultWidth).not.toHaveBeenCalled();

        const divider = container.querySelector(`#${dividerId}`)!;
        fireEvent.mouseDown(divider, {button: 0});
        fireEvent.mouseUp(window);
        fireEvent.mouseDown(divider, {button: 0});
        fireEvent.mouseUp(window);

        expect(defaultWidth).toHaveBeenCalledTimes(2);
    });

    test('should call onResizeEnd when a drag ends even if the container has no width', () => {
        const onResizeEnd = jest.fn();
        const {container} = renderWithContext(<TestWrapper onResizeEnd={onResizeEnd}/>);

        const divider = container.querySelector(`#${dividerId}`)!;
        fireEvent.mouseDown(divider, {button: 0});
        fireEvent.mouseUp(window);

        expect(onResizeEnd).toHaveBeenCalledWith(0, '--overrideLhsWidth', '0px');
    });

    test('should save the width only when the drag changed it', () => {
        let width = 400;
        const getBoundingClientRect = jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({width} as DOMRect));
        const getSavedWidth = (state: any) => Object.entries(state.storage.storage).find(([key]) => key.startsWith('resizable_test:'))?.[1];

        const {container, store} = renderWithContext(<TestWrapper/>);
        const divider = container.querySelector(`#${dividerId}`)!;

        // A click without moving keeps whatever was saved
        fireEvent.mouseDown(divider, {button: 0, clientX: 400});
        fireEvent.mouseUp(window);
        expect(getSavedWidth(store.getState())).toBeUndefined();

        // A drag that changes the width saves it
        fireEvent.mouseDown(divider, {button: 0, clientX: 400});
        width = 450;
        fireEvent.mouseUp(window);
        expect(getSavedWidth(store.getState())).toMatchObject({value: 450});

        getBoundingClientRect.mockRestore();
    });
});
