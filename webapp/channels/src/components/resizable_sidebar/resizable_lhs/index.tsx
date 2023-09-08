// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {HTMLAttributes, useRef} from 'react';

import {DEFAULT_LHS_WIDTH, CssVarKeyForResizable, ResizeDirection} from '../constants';
import ResizableDivider from '../resizable_divider';

interface Props extends HTMLAttributes<'div'> {
    children: React.ReactNode;
}

function ResizableLhs({
    children,
    id,
    className,
}: Props) {
    const containerRef = useRef<HTMLDivElement>(null);

    return (
        <div
            id={id}
            className={className}
            ref={containerRef}
        >
            {children}
            <ResizableDivider
                name={'lhsResizeHandle'}
                globalCssVar={CssVarKeyForResizable.LHS}
                defaultWidth={DEFAULT_LHS_WIDTH}
                dir={ResizeDirection.LEFT}
                containerRef={containerRef}
            />
        </div>
    );
}

export default ResizableLhs;
