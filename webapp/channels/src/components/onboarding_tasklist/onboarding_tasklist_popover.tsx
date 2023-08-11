// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {RefObject} from 'react';
import {usePopper} from 'react-popper';
import {CSSTransition} from 'react-transition-group';

import type {Placement} from 'popper.js';
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
    trigger: RefObject<HTMLButtonElement>;
    isVisible: boolean;
    placement?: Placement;
    offset?: [number | null | undefined, number | null | undefined];
    children?: React.ReactNode;
    onClick?: () => void;
}

export const TaskListPopover = ({
    trigger,
    placement = 'top-start',
    isVisible,
    offset = [0, 5],
    children,
    onClick,
}: TaskListPopoverProps): JSX.Element | null => {
    const [popperElement, setPopperElement] =
        React.useState<HTMLDivElement | null>(null);

    const {
        styles: {popper},
        attributes,
    } = usePopper(trigger.current, popperElement, {
        placement,
        modifiers: [
            {
                name: 'offset',
                options: {
                    offset,
                },
            },
        ],
    });
    const style = {
        ...popper,
        zIndex: isVisible ? 100 : -1,
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
                ref={setPopperElement}
                style={style}
                {...attributes.popper}
            >
                {children}
            </div>
        </>
    );
};

