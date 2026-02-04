// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {createRef} from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {fireEvent, renderWithContext} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

import {CssVarKeyForResizable, ResizeDirection} from './constants';
import ResizableDivider from './resizable_divider';

describe('components/resizable_sidebar/resizable_divider', () => {
    const baseState: DeepPartial<GlobalState> = {
        entities: {
            users: {
                currentUserId: 'current_user_id',
            },
            teams: {
                currentTeamId: 'team_id',
            },
        },
        views: {
            browser: {
                windowSize: 'desktopView',
            },
        },
        storage: {
            storage: {},
        },
    };

    const createContainerRef = () => {
        const container = document.createElement('div');
        container.style.width = '300px';
        document.body.appendChild(container);

        // Mock getBoundingClientRect
        container.getBoundingClientRect = jest.fn(() => ({
            width: 300,
            height: 600,
            top: 0,
            left: 0,
            right: 300,
            bottom: 600,
            x: 0,
            y: 0,
            toJSON: () => {},
        }));

        const ref = createRef<HTMLDivElement>();
        (ref as any).current = container;
        return ref;
    };

    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('should render divider when not disabled and not mobile view', () => {
        const containerRef = createContainerRef();

        const {container} = renderWithContext(
            <ResizableDivider
                name='test-divider'
                globalCssVar={CssVarKeyForResizable.LHS}
                defaultWidth={240}
                dir={ResizeDirection.LEFT}
                containerRef={containerRef}
            />,
            baseState,
        );

        // The divider should be rendered (styled-component creates a div)
        const divider = container.querySelector('div[class*="Divider"]') || container.querySelector('div');
        expect(divider).toBeInTheDocument();
    });

    test('should not render when disabled', () => {
        const containerRef = createContainerRef();

        const {container} = renderWithContext(
            <ResizableDivider
                name='test-divider'
                globalCssVar={CssVarKeyForResizable.LHS}
                defaultWidth={240}
                dir={ResizeDirection.LEFT}
                containerRef={containerRef}
                disabled={true}
            />,
            baseState,
        );

        // When disabled, the component returns null
        expect(container.firstChild).toBeNull();
    });

    test('should not render on mobile view', () => {
        const containerRef = createContainerRef();
        const mobileState: DeepPartial<GlobalState> = {
            ...baseState,
            views: {
                browser: {
                    windowSize: 'mobileView',
                },
            },
        };

        const {container} = renderWithContext(
            <ResizableDivider
                name='test-divider'
                globalCssVar={CssVarKeyForResizable.LHS}
                defaultWidth={240}
                dir={ResizeDirection.LEFT}
                containerRef={containerRef}
            />,
            mobileState,
        );

        expect(container.firstChild).toBeNull();
    });

    test('should accept disableSnapping prop', () => {
        const containerRef = createContainerRef();

        // This test verifies the component accepts the prop without error
        const {container} = renderWithContext(
            <ResizableDivider
                name='test-divider'
                globalCssVar={CssVarKeyForResizable.LHS}
                defaultWidth={240}
                dir={ResizeDirection.LEFT}
                containerRef={containerRef}
                disableSnapping={true}
            />,
            baseState,
        );

        const divider = container.querySelector('div');
        expect(divider).toBeInTheDocument();
    });

    test('should call onResizeStart when mousedown occurs', () => {
        const containerRef = createContainerRef();
        const onResizeStart = jest.fn();

        const {container} = renderWithContext(
            <ResizableDivider
                name='test-divider'
                globalCssVar={CssVarKeyForResizable.LHS}
                defaultWidth={240}
                dir={ResizeDirection.LEFT}
                containerRef={containerRef}
                onResizeStart={onResizeStart}
            />,
            baseState,
        );

        const divider = container.querySelector('div');
        if (divider) {
            fireEvent.mouseDown(divider, {clientX: 300});
            expect(onResizeStart).toHaveBeenCalledWith(300);
        }
    });

    test('should reset width on double click', () => {
        const containerRef = createContainerRef();
        const onDividerDoubleClick = jest.fn();

        const {container} = renderWithContext(
            <ResizableDivider
                name='test-divider'
                globalCssVar={CssVarKeyForResizable.LHS}
                defaultWidth={240}
                dir={ResizeDirection.LEFT}
                containerRef={containerRef}
                onDividerDoubleClick={onDividerDoubleClick}
            />,
            baseState,
        );

        const divider = container.querySelector('div');
        if (divider) {
            fireEvent.doubleClick(divider);
            expect(onDividerDoubleClick).toHaveBeenCalled();
        }
    });

    test('should apply left class for LEFT direction', () => {
        const containerRef = createContainerRef();

        const {container} = renderWithContext(
            <ResizableDivider
                name='test-divider'
                globalCssVar={CssVarKeyForResizable.LHS}
                defaultWidth={240}
                dir={ResizeDirection.LEFT}
                containerRef={containerRef}
            />,
            baseState,
        );

        const divider = container.querySelector('.left');
        expect(divider).toBeInTheDocument();
    });

    test('should apply right class for RIGHT direction', () => {
        const containerRef = createContainerRef();

        const {container} = renderWithContext(
            <ResizableDivider
                name='test-divider'
                globalCssVar={CssVarKeyForResizable.RHS}
                defaultWidth={400}
                dir={ResizeDirection.RIGHT}
                containerRef={containerRef}
            />,
            baseState,
        );

        const divider = container.querySelector('.right');
        expect(divider).toBeInTheDocument();
    });
});
