// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {HTMLAttributes, useEffect, useRef, useState} from 'react';
import {useSelector} from 'react-redux';

import {getIsRhsExpanded, getRhsSize} from 'selectors/rhs';

import {shouldRhsOverlapChannelView} from '../utils';
import {CssVarKeyForResizable, RHS_MIN_MAX_WIDTH, ResizeDirection} from '../constants';
import ResizableDivider from '../resizable_divider';

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
    const containerRef = useRef<HTMLDivElement>(null);

    const rhsSize = useSelector(getRhsSize);
    const isRhsExpanded = useSelector(getIsRhsExpanded);

    const [previousRhsExpanded, setPreviousRhsExpanded] = useState(false);

    const defaultWidth = RHS_MIN_MAX_WIDTH[rhsSize].default;

    const shouldRhsOverlap = shouldRhsOverlapChannelView(rhsSize);

    const handleResize = (_: number, cssVarProp: string, cssVarValue: string) => {
        const rightWidthHolderRefElement = rightWidthHolderRef.current;

        if (!rightWidthHolderRefElement) {
            return;
        }

        if (!shouldRhsOverlap) {
            rightWidthHolderRefElement.style.setProperty(cssVarProp, cssVarValue);
        }
    };

    const handleResizeEnd = (_: number, cssVarProp: string) => {
        const rightWidthHolderRefElement = rightWidthHolderRef.current;

        if (!rightWidthHolderRefElement) {
            return;
        }

        rightWidthHolderRefElement.style.removeProperty(cssVarProp);
    };

    const handleDividerDoubleClick = (_: number, cssVarProp: string) => {
        handleResizeEnd(_, cssVarProp);

        document.body.classList.add('layout-changing');

        setTimeout(() => {
            document.body.classList.remove('layout-changing');
        }, 1000);
    };

    // If max-width is applied immediately when expanded is collapsed, the transition will not work correctly.
    useEffect(() => {
        const containerRefElement = containerRef.current;

        if (!containerRefElement) {
            return;
        }

        setPreviousRhsExpanded(isRhsExpanded);

        if (previousRhsExpanded && !isRhsExpanded) {
            containerRefElement.classList.add('resize-disabled');

            setTimeout(() => {
                containerRefElement.classList.remove('resize-disabled');
            }, 1000);
        }
    }, [isRhsExpanded]);

    return (
        <div
            id={id}
            className={className}
            role={role}
            ref={containerRef}
        >
            {children}
            <ResizableDivider
                name='rhsResizeHandle'
                globalCssVar={CssVarKeyForResizable.RHS}
                defaultWidth={defaultWidth}
                dir={ResizeDirection.RIGHT}
                disabled={isRhsExpanded}
                containerRef={containerRef}
                onResize={handleResize}
                onResizeEnd={handleResizeEnd}
                onDividerDoubleClick={handleDividerDoubleClick}
            />
        </div>
    );
}

export default ResizableRhs;
