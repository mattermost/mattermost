// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useEffect, useRef, useState, MouseEventHandler, RefObject} from 'react';
import {currentUserSuffix, useGlobalState} from 'stores/hooks';
import styled, {createGlobalStyle, css} from 'styled-components';

export enum ResizeDirection {
    LEFT = 'left',
    RIGHT = 'right',
}

type Props = {
    id?: string;
    className?: string;
    name: string;
    disabled?: boolean;
    globalCssVar: string;
    dir: ResizeDirection;
    containerRef: RefObject<HTMLElement>;
    onStart?: (startWidth: number) => void;
    onChange?: (width: number, cssVarProperty: string, cssVarValue: string) => void;
    onEnd?: (finalWidth: number, cssVarProperty: string, cssVarValue: string) => void;
    onClear?: (prevWidth: number, cssVarProperty: string) => void;
}

const ResizableDivider = ({
    id,
    name,
    className,
    disabled,
    dir,
    containerRef,
    ...props
}: Props) => {
    const defaultOnChange = (_: number, cssVarProp: string, cssVarValue: string) => {
        containerRef.current?.style.setProperty(cssVarProp, cssVarValue);
    };
    const defaultOnFinally = (_: number, cssVarProp: string) => {
        containerRef.current?.style.removeProperty(cssVarProp);
    };

    const {
        onStart,
        onChange = defaultOnChange,
        onEnd = defaultOnFinally,
        onClear = defaultOnFinally,
    } = props;

    const startWidth = useRef(0);
    const startX = useRef(0);
    const lastWidth = useRef<number | null>(null);
    const cssVarKey = `--${props.globalCssVar}`;

    const reset = () => {
        startWidth.current = 0;
        startX.current = 0;
        lastWidth.current = null;
    };

    const [isActive, setIsActive] = useState(false);
    const [width, setWidth] = useGlobalState<number | null>(null, `resizable_${name}`, currentUserSuffix);

    const onMouseDown: MouseEventHandler<HTMLDivElement> = (e) => {
        if (disabled || !containerRef.current) {
            return;
        }
        startX.current = e.clientX;
        setIsActive(true);
    };

    useEffect(() => {
        if (!isActive || disabled) {
            reset();
            return undefined;
        }

        let start: (() => void) | null = () => {
            if (!containerRef.current) {
                return;
            }
            startWidth.current = containerRef.current.getBoundingClientRect().width;
            onStart?.(startWidth.current);
            onChange?.(startWidth.current, cssVarKey, `${startWidth.current}px`);
            document.body.classList.add('layout-changing');
            start = null;
        };

        const onMouseMove = (e: MouseEvent) => {
            if (!isActive) {
                return;
            }

            start?.();

            let widthDiff = 0;
            switch (dir) {
            case ResizeDirection.RIGHT:
                widthDiff = e.clientX - startX.current;
                break;
            case ResizeDirection.LEFT:
                widthDiff = startX.current - e.clientX;
                break;
            }

            lastWidth.current = Math.max(startWidth.current + widthDiff, 0);
            onChange?.(lastWidth.current, cssVarKey, `${lastWidth.current}px`);
        };

        const onMouseUp = () => {
            const finalWidth = containerRef.current?.getBoundingClientRect().width;
            const started = !start;
            if (started && finalWidth) {
                setWidth(finalWidth);
                onEnd?.(finalWidth, cssVarKey, `${finalWidth}px`);
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
        onClear?.(width ?? 0, cssVarKey);
        reset();
        setWidth(null);
    };

    return (
        <>
            {!disabled && (
                <Divider
                    id={id}
                    className={classNames(className, {
                        left: dir === ResizeDirection.LEFT,
                        right: dir === ResizeDirection.RIGHT,
                    })}
                    isActive={isActive}
                    onMouseDown={onMouseDown}
                    onDoubleClick={onDoubleClick}
                />
            )}
            <GlobalStyle
                varName={props.globalCssVar}
                width={width}
                active={isActive}
            />
        </>
    );
};

const Divider = styled.div<{isActive: boolean}>`
    position: absolute;
    z-index: 50;
    top: 0;
    width: 16px;
    height: 100%;
    cursor: col-resize;

    &.left {
        left: -8px;
    }

    &.right {
        right: -8px;
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

const GlobalStyle = createGlobalStyle<{active: boolean; varName: string; width: number | null}>`
    ${({active}) => active && css`
        body {
            cursor: 'col-resize';
            user-select: none;
        }
    `}
    ${({varName, width}) => width && css`
        :root {
            --${varName}: ${width}px;
        }
    `}
`;

export default ResizableDivider;

