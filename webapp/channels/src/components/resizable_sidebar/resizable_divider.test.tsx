// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent} from '@testing-library/react';
import React, {useRef} from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import {CssVarKeyForResizable, ResizeDirection} from './constants';
import ResizableDivider from './resizable_divider';

describe('components/resizable_sidebar/ResizableDivider', () => {
    const dividerId = 'resizable-divider';

    function TestWrapper(props: {onResizeStart: jest.Mock}) {
        const containerRef = useRef<HTMLDivElement>(null);

        return (
            <div ref={containerRef}>
                <ResizableDivider
                    id={dividerId}
                    name='test'
                    defaultWidth={240}
                    globalCssVar={CssVarKeyForResizable.LHS}
                    dir={ResizeDirection.LEFT}
                    containerRef={containerRef}
                    onResizeStart={props.onResizeStart}
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
});
