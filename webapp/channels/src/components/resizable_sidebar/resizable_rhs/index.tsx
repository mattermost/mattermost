// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {HTMLAttributes, useCallback, useLayoutEffect, useMemo} from 'react';
import {useSelector} from 'react-redux';

import {getIsRhsExpanded, getRhsSize} from 'selectors/rhs';
import LocalStorageStore from 'stores/local_storage_store';

import {isResizableSize, preventAnimation, resetStyle, restoreAnimation, setWidth, shouldRhsOverlapChannelView} from '../utils';
import Resizable from '../resizable';
import {RHS_MIN_MAX_WIDTH, SidebarSize} from '../constants';

interface Props extends HTMLAttributes<'div'> {
    children: React.ReactNode;
    rightWidthHolderRef: React.RefObject<HTMLDivElement>;
}

function ResizableRhs({
    role,
    children,
    id,
    className,
    rightWidthHolderRef,
}: Props) {
    const rhsSize = useSelector(getRhsSize);
    const isRhsExpanded = useSelector(getIsRhsExpanded);

    const minWidth = useMemo(() => RHS_MIN_MAX_WIDTH[rhsSize].min, [rhsSize]);
    const maxWidth = useMemo(() => RHS_MIN_MAX_WIDTH[rhsSize].max, [rhsSize]);
    const defaultWidth = useMemo(() => RHS_MIN_MAX_WIDTH[rhsSize].default, [rhsSize]);

    const isRhsResizable = useMemo(() => isResizableSize(rhsSize), [rhsSize]);
    const shouldRhsOverlap = useMemo(() => shouldRhsOverlapChannelView(rhsSize), [rhsSize]);

    const handleInit = useCallback((width: number) => {
        const rightWidthHolderRefElement = rightWidthHolderRef.current;

        if (!rightWidthHolderRefElement) {
            return;
        }
        if (!shouldRhsOverlap) {
            setWidth(rightWidthHolderRefElement, width);
        } else if (shouldRhsOverlap) {
            setWidth(rightWidthHolderRefElement, minWidth);
        }

        preventAnimation(rightWidthHolderRefElement);

        requestAnimationFrame(() => {
            if (rightWidthHolderRefElement) {
                restoreAnimation(rightWidthHolderRefElement);
            }
        });
    }, [rightWidthHolderRef, minWidth, rhsSize, shouldRhsOverlap]);

    const handleLimitChange = useCallback(() => {
        const rightWidthHolderRefElement = rightWidthHolderRef.current;

        if (!rightWidthHolderRefElement) {
            return;
        }

        if (rhsSize === SidebarSize.MEDIUM) {
            setWidth(rightWidthHolderRefElement, minWidth);
            return;
        }

        if (rhsSize === SidebarSize.SMALL) {
            resetStyle(rightWidthHolderRefElement);
            return;
        }

        setWidth(rightWidthHolderRefElement, defaultWidth);
    }, [defaultWidth, rightWidthHolderRef, minWidth, rhsSize]);

    const handleResize = useCallback((width: number) => {
        const rightWidthHolderRefElement = rightWidthHolderRef.current;

        LocalStorageStore.setRhsWidth(width);

        if (!rightWidthHolderRefElement) {
            return;
        }

        if (!shouldRhsOverlap) {
            setWidth(rightWidthHolderRefElement, width);
        }
    }, [rightWidthHolderRef, shouldRhsOverlap]);

    const handleResizeStart = useCallback(() => {
        const rightWidthHolderRefElement = rightWidthHolderRef.current;

        if (rightWidthHolderRefElement) {
            preventAnimation(rightWidthHolderRefElement);
        }
    }, [rightWidthHolderRef]);

    const handleResizeEnd = useCallback(() => {
        const rightWidthHolderRefElement = rightWidthHolderRef.current;
        if (rightWidthHolderRefElement) {
            restoreAnimation(rightWidthHolderRefElement);
        }
    }, [rightWidthHolderRef]);

    const handleLineDoubleClick = useCallback(() => {
        const rightWidthHolderRefElement = rightWidthHolderRef.current;

        if (!shouldRhsOverlap && rightWidthHolderRefElement) {
            setWidth(rightWidthHolderRefElement, defaultWidth);
            preventAnimation(rightWidthHolderRefElement);

            requestAnimationFrame(() => {
                if (rightWidthHolderRefElement) {
                    restoreAnimation(rightWidthHolderRefElement);
                }
            });
        }
    }, [defaultWidth, rightWidthHolderRef, shouldRhsOverlap]);

    useLayoutEffect(() => {
        const rightWidthHolderRefElement = rightWidthHolderRef.current;

        if (!rightWidthHolderRefElement) {
            return;
        }
        if (isRhsExpanded) {
            resetStyle(rightWidthHolderRefElement);
        }
    }, [isRhsExpanded, rightWidthHolderRef]);

    return (
        <Resizable
            id={id}
            className={className}
            role={role}
            maxWidth={maxWidth}
            minWidth={minWidth}
            defaultWidth={defaultWidth}
            disabled={isRhsExpanded}
            initialWidth={Number(LocalStorageStore.getRhsWidth())}
            enabled={{
                left: false,
                right: isRhsResizable,
            }}
            onInit={handleInit}
            onLimitChange={handleLimitChange}
            onResize={handleResize}
            onResizeStart={handleResizeStart}
            onResizeEnd={handleResizeEnd}
            onLineDoubleClick={handleLineDoubleClick}
        >

            {children}
        </Resizable>
    );
}

export default ResizableRhs;
