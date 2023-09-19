// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import type {MouseEventHandler, RefObject} from 'react';
import React, {useEffect, useRef, useState} from 'react';
import {useSelector} from 'react-redux';
import styled, {createGlobalStyle, css} from 'styled-components';

import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {useGlobalState} from 'stores/hooks';

import type {CssVarKeyForResizable} from './constants';
import {ResizeDirection} from './constants';
import {isSizeLessThanSnapSize, isSnapableSpeed, shouldSnapWhenSizeGrown, shouldSnapWhenSizeShrunk} from './utils';

type Props = {
    id?: string;
    className?: string;
    name: string;
    disabled?: boolean;
    defaultWidth: number;
    globalCssVar: CssVarKeyForResizable;
    dir: ResizeDirection;
    containerRef: RefObject<HTMLElement>;
    onResizeStart?: (startWidth: number) => void;
    onResize?: (width: number, cssVarProperty: string, cssVarValue: string) => void;
    onResizeEnd?: (finalWidth: number, cssVarProperty: string, cssVarValue: string) => void;
    onDividerDoubleClick?: (prevWidth: number, cssVarProperty: string) => void;
}

const Divider = styled.div<{isActive: boolean}>`
    position: absolute;
    z-index: 50;
    top: 0;
    width: 16px;
    height: 100%;
    cursor: col-resize;
    &.left {
        right: -8px;
    }

    &.right {
        left: -8px;
    }
    &::after {
        position: absolute;
        left: 6px;
        width: 4px;
        height: 100%;
        background-color: ${({isActive}) => (isActive ? 'var(--sidebar-text-active-border)' : 'transparent')};
        content: '';
    }
    &:hover {
        &::after {
            background-color: var(--sidebar-text-active-border);
            transition: background-color 400ms step-end;
        }
    }
    &.snapped {
        &::after {
            animation: emphasis-sidebar-resize-line 800ms;
        }
    }
`;

const ResizableDividerGlobalStyle = createGlobalStyle<{active: boolean; varName: CssVarKeyForResizable; width: number | null}>`
    ${({active}) => active && css`
        body {
            cursor: col-resize;
            user-select: none;
        }
    `}
    ${({varName, width}) => width && css`
        :root {
            --${varName}: ${width}px;
        }
    `}
`;

function ResizableDivider({
    id,
    name,
    className,
    disabled,
    dir,
    containerRef,
    defaultWidth,
    onResize,
    onResizeStart,
    onResizeEnd,
    onDividerDoubleClick,
    ...props
}: Props) {
    const resizeLineRef = useRef<HTMLDivElement>(null);

    const startWidth = useRef(0);
    const lastWidth = useRef<number | null>(null);

    const previousClientX = useRef(0);

    const cssVarKey = `--${props.globalCssVar}`;

    const currentUserID = useSelector(getCurrentUserId);

    const [isActive, setIsActive] = useState(false);
    const [width, setWidth] = useGlobalState<number | null>(null, `resizable_${name}:`, currentUserID);

    const defaultOnResizeChange = (width: number, cssVarProp: string, cssVarValue: string) => {
        containerRef.current?.style.setProperty(cssVarProp, cssVarValue);
        lastWidth.current = width;
    };

    const handleOnResize = (width: number, cssVarProp: string, cssVarValue: string) => {
        if (onResize) {
            onResize(width, cssVarProp, cssVarValue);
        }

        defaultOnResizeChange(width, cssVarProp, cssVarValue);
    };

    const reset = () => {
        startWidth.current = 0;
        previousClientX.current = 0;
        lastWidth.current = null;
    };

    const onMouseDown: MouseEventHandler<HTMLDivElement> = (e) => {
        if (disabled || !containerRef.current) {
            return;
        }
        previousClientX.current = e.clientX;
        startWidth.current = containerRef.current.getBoundingClientRect().width;

        setIsActive(true);

        if (onResizeStart) {
            onResizeStart(startWidth.current);
        }

        handleOnResize(startWidth.current, cssVarKey, `${startWidth.current}px`);

        document.body.classList.add('layout-changing');
    };

    useEffect(() => {
        if (!isActive || disabled) {
            reset();
            return undefined;
        }
        const onMouseMove = (e: MouseEvent) => {
            const resizeLine = resizeLineRef.current;

            if (!isActive) {
                return;
            }

            if (!resizeLine) {
                return;
            }

            e.preventDefault();

            const previousWidth = lastWidth.current ?? 0;
            let widthDiff = 0;

            switch (dir) {
            case ResizeDirection.LEFT:
                widthDiff = e.clientX - previousClientX.current;
                break;
            case ResizeDirection.RIGHT:
                widthDiff = previousClientX.current - e.clientX;
                break;
            }

            const newWidth = previousWidth + widthDiff;

            if (resizeLine.classList.contains('snapped')) {
                const diff = newWidth - defaultWidth;

                if (isSizeLessThanSnapSize(diff)) {
                    return;
                }

                handleOnResize(newWidth, cssVarKey, `${newWidth}px`);

                resizeLine.classList.remove('snapped');
                previousClientX.current = e.clientX;

                return;
            }

            previousClientX.current = e.clientX;

            const shouldSnap = shouldSnapWhenSizeGrown(newWidth, previousWidth, defaultWidth) || shouldSnapWhenSizeShrunk(newWidth, previousWidth, defaultWidth);

            if (isSnapableSpeed(newWidth - previousWidth) && shouldSnap) {
                switch (dir) {
                case ResizeDirection.LEFT:
                    previousClientX.current += defaultWidth - newWidth;
                    break;
                case ResizeDirection.RIGHT:
                    previousClientX.current += newWidth - defaultWidth;
                    break;
                }

                handleOnResize(defaultWidth, cssVarKey, `${defaultWidth}px`);

                resizeLine.classList.add('snapped');
                return;
            }

            handleOnResize(newWidth, cssVarKey, `${newWidth}px`);
        };

        const onMouseUp = () => {
            const finalWidth = containerRef.current?.getBoundingClientRect().width;
            if (isActive && finalWidth) {
                setWidth(finalWidth);
                onResizeEnd?.(finalWidth, cssVarKey, `${finalWidth}px`);
            }

            containerRef.current?.style.removeProperty(cssVarKey);
            document.body.classList.remove('layout-changing');
            reset();
            setIsActive(false);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);

        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [isActive, disabled]);

    const onDoubleClick = () => {
        onDividerDoubleClick?.(width ?? 0, cssVarKey);
        reset();
        setWidth(null);
    };

    if (disabled) {
        return null;
    }

    return (
        <>
            <Divider
                id={id}
                className={classNames(className, {
                    left: dir === ResizeDirection.LEFT,
                    right: dir === ResizeDirection.RIGHT,
                })}
                ref={resizeLineRef}
                isActive={isActive}
                onMouseDown={onMouseDown}
                onDoubleClick={onDoubleClick}
            />
            <ResizableDividerGlobalStyle
                varName={props.globalCssVar}
                width={width}
                active={isActive}
            />
        </>

    );
}

export default ResizableDivider;
