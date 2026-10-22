// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {monitorForElements} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import type {Edge} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import {extractClosestEdge} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import {useEffect} from 'react';

import type {BoardsPropertyFieldOption} from '@mattermost/types/properties_board';

import {useLatest} from 'hooks/useLatest';

type BoardOption = BoardsPropertyFieldOption;

type UseBoardOptionsDndOptions = {
    fieldId: string;
    options: BoardOption[];
    setOptions: (next: BoardOption[]) => void;
    enabled: boolean;
};

/**
 * Registers a container-level PDND monitor scoped to board option chips for a
 * specific field. Reorders options in place when a chip is dropped.
 * Safe to call unconditionally; no-ops when enabled is false.
 */
export function useBoardOptionsDnd({fieldId, options, setOptions, enabled}: UseBoardOptionsDndOptions): void {
    const optionsRef = useLatest(options);
    const setOptionsRef = useLatest(setOptions);

    useEffect(() => {
        if (!enabled) {
            return undefined;
        }
        const dragKind = `board-option-chip:${fieldId}`;
        return monitorForElements({
            canMonitor: ({source}) => source.data.kind === dragKind,
            onDrop: ({source, location}) => {
                const target = location.current.dropTargets[0];
                if (!target) {
                    return;
                }
                const sourceKey = source.data.optionKey as string;
                const targetKey = target.data.optionKey as string;
                const edge = extractClosestEdge(target.data);
                const current = optionsRef.current;
                const sourceIndex = current.findIndex((o) => o.id === sourceKey);
                const targetIndex = current.findIndex((o) => o.id === targetKey);
                if (sourceIndex === -1 || targetIndex === -1) {
                    return;
                }
                const dropIndex = getDropIndex(sourceIndex, targetIndex, edge);
                if (dropIndex !== sourceIndex) {
                    const next = [...current];
                    const [moved] = next.splice(sourceIndex, 1);
                    next.splice(dropIndex, 0, moved);
                    setOptionsRef.current(next);
                }
            },
        });

    // Refs handle options/setOptions freshness; re-register only when fieldId or enabled changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fieldId, enabled]);
}

function getDropIndex(
    sourceIndex: number,
    targetIndex: number,
    edge: Edge | null,
): number {
    if (edge === 'left' || edge === 'top') {
        if (sourceIndex < targetIndex) {
            return targetIndex - 1;
        }
        return targetIndex;
    }

    // 'right' or 'bottom' — insert after the target
    if (sourceIndex < targetIndex) {
        return targetIndex;
    }
    return targetIndex + 1;
}
