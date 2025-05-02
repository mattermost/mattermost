// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Placement} from '@floating-ui/react-dom';
import {useFloating, offset as floatingOffset, autoUpdate} from '@floating-ui/react-dom';
import React, {useLayoutEffect} from 'react';
import {CSSTransition} from 'react-transition-group';
import styled from 'styled-components';

const Overlay = styled.div`
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    height: 100%;
    min-height: 100%;
    left: 0;
    right: 0;
    top: 0;
    position: fixed;
    overflow: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    pointer-events: auto;
    -ms-scroll-chaining: none;
    transition: 150ms;
    transition-property: background-color;
    transition-timing-function: ease-in-out;
    z-index: 100;
    &.fade-enter {
        background-color: rgba(0, 0, 0, 0);
    }
    &.fade-enter-active {
        background-color: rgba(0, 0, 0, 0.5);
    }
    &.fade-enter-done {
        background-color: rgba(0, 0, 0, 0.5);
    }
    &.fade-exit {
        background-color: rgba(0, 0, 0, 0.5);
    }
    &.fade-exit-active {
        background-color: rgba(0, 0, 0, 0);
    }
    &.fade-exit-done {
        background-color: rgba(0, 0, 0, 0);
    }
`;

interface TaskListPopoverProps {
    trigger: HTMLButtonElement | null;
    isVisible: boolean;
    placement?: Placement;
    offset?: [number, number];
    children: React.ReactNode;
    onClick: () => void;
}

export const TaskListPopover = ({
    trigger,
    placement = 'top-start',
    isVisible,
    offset = [0, 5],
    children,
    onClick,
}: TaskListPopoverProps): JSX.Element | null => {
    const {x, y, strategy, refs: {setReference, setFloating}} = useFloating({
        placement,
        middleware: [floatingOffset({
            mainAxis: offset[1],
            crossAxis: offset[0],
        })],
        whileElementsMounted: autoUpdate,
    });

    useLayoutEffect(() => {
        setReference(trigger);
    }, [setReference, trigger]);

    const style = {
        container: {
            position: strategy,
            top: y ?? 0,
            left: x ?? 0,
            zIndex: isVisible ? 100 : -1,
        },
    };
    return (
        <>
            <CSSTransition
                timeout={150}
                classNames='fade'
                in={isVisible}
                unmountOnExit={true}
            >
                <Overlay
                    onClick={onClick}
                    data-cy='onboarding-task-list-overlay'
                />
            </CSSTransition>
            <div
                ref={setFloating}
                style={style.container}
            >
                {children}
            </div>
        </>
    );
};

