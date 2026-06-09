// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {monitorForElements} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import type {Edge} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import {extractClosestEdge} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import {useEffect} from 'react';

import {useLatest} from 'hooks/useLatest';

type UseListTableDndOptions = {
    dragKind: string;
    onReorder?: (prev: number, next: number) => void;
};

/**
 * Registers a container-level PDND monitor for the given drag kind.
 * Resolves the final drop index and calls onReorder when a row is dropped.
 * Safe to call unconditionally; no-ops when onReorder is undefined.
 */
export function useListTableDnd({dragKind, onReorder}: UseListTableDndOptions): void {
    const onReorderRef = useLatest(onReorder);

    useEffect(() => {
        if (!onReorder) {
            return undefined;
        }
        return monitorForElements({
            canMonitor: ({source}) => source.data.kind === dragKind,
            onDrop: ({source, location}) => {
                const target = location.current.dropTargets[0];
                if (!target) {
                    return;
                }
                const sourceIndex = source.data.rowIndex as number;
                const targetIndex = target.data.rowIndex as number;
                const edge = extractClosestEdge(target.data);
                const dropIndex = getDropIndex(sourceIndex, targetIndex, edge);
                if (dropIndex !== sourceIndex) {
                    onReorderRef.current?.(sourceIndex, dropIndex);
                }
            },
        });

    // onReorder identity is captured via ref; only re-register when dragKind changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dragKind, Boolean(onReorder)]);
}

function getDropIndex(
    sourceIndex: number,
    targetIndex: number,
    edge: Edge | null,
): number {
    if (edge === 'top') {
        if (sourceIndex < targetIndex) {
            return targetIndex - 1;
        }
        return targetIndex;
    }

    // 'bottom' — insert after the target
    if (sourceIndex < targetIndex) {
        return targetIndex;
    }
    return targetIndex + 1;
}
