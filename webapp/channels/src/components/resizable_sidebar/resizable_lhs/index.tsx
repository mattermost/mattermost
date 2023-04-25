// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {HTMLAttributes, useCallback, useMemo} from 'react';
import {useSelector} from 'react-redux';

import {getCurrentUserId} from 'mattermost-redux/selectors/entities/common';

import {getLhsSize} from 'selectors/lhs';
import LocalStorageStore from 'stores/local_storage_store';
import {DEFAULT_LHS_WIDTH, LHS_MIN_MAX_WIDTH} from 'utils/constants';
import {isResizableSize} from '../utils';
import Resizable from '../resizable';

interface Props extends HTMLAttributes<'div'> {
    children: React.ReactNode;
}

function ResizableLhs({
    children,
    id,
    className,
}: Props) {
    const lhsSize = useSelector(getLhsSize);
    const userId = useSelector(getCurrentUserId);

    const minWidth = useMemo(() => LHS_MIN_MAX_WIDTH[lhsSize].min, [lhsSize]);
    const maxWidth = useMemo(() => LHS_MIN_MAX_WIDTH[lhsSize].max, [lhsSize]);

    const isLhsResizable = useMemo(() => isResizableSize(lhsSize), [lhsSize]);

    const handleResize = useCallback((width: number) => {
        LocalStorageStore.setLhsWidth(userId, width);
    }, [userId]);

    const handleLineDoubleClick = useCallback(() => {
        LocalStorageStore.setLhsWidth(userId, DEFAULT_LHS_WIDTH);
    }, [userId]);

    return (
        <Resizable
            id={id}
            className={className}
            maxWidth={maxWidth}
            minWidth={minWidth}
            defaultWidth={DEFAULT_LHS_WIDTH}
            initialWidth={Number(LocalStorageStore.getLhsWidth(userId))}
            enabled={{
                left: isLhsResizable,
                right: false,
            }}
            onResize={handleResize}
            onLineDoubleClick={handleLineDoubleClick}
        >

            {children}
        </Resizable>
    );
}

export default ResizableLhs;
