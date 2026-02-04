// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import type {HTMLAttributes} from 'react';
import React, {useRef} from 'react';
import {useSelector} from 'react-redux';

import {getConfig} from 'mattermost-redux/selectors/entities/general';

import type {GlobalState} from 'types/store';

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
    const freeResizing = useSelector((state: GlobalState) => getConfig(state).FeatureFlagFreeSidebarResizing === 'true');

    return (
        <div
            id={id}
            className={classNames(className, {'free-resizing': freeResizing})}
            ref={containerRef}
        >
            {children}
            <ResizableDivider
                name={'lhsResizeHandle'}
                globalCssVar={CssVarKeyForResizable.LHS}
                defaultWidth={DEFAULT_LHS_WIDTH}
                dir={ResizeDirection.LEFT}
                containerRef={containerRef}
                disableSnapping={freeResizing}
            />
        </div>
    );
}

export default ResizableLhs;
