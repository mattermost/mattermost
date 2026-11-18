// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useIntl} from 'react-intl';

export type ResizableColumn = 'timestamp' | 'node' | 'caller';

export type ColumnWidths = Partial<Record<ResizableColumn, number>>;

export const COLUMN_WIDTH_BOUNDS: Record<ResizableColumn, {min: number; max: number; fallback: number}> = {
    timestamp: {min: 48, max: 400, fallback: 96},
    node: {min: 64, max: 600, fallback: 120},
    caller: {min: 60, max: 600, fallback: 200},
};

export const KEY_STEP = 8;
export const KEY_STEP_LARGE = 32;

export function clampColumnWidth(column: ResizableColumn, width: number): number {
    const {min, max} = COLUMN_WIDTH_BOUNDS[column];
    return Math.min(max, Math.max(min, Math.round(width)));
}

type Props = {
    column: ResizableColumn;

    // The translated column name, used for the accessible label
    label: string;

    // The committed or live custom width; undefined while the column has its default width
    width: number | undefined;

    // The handle sits on the column's right edge, or on its left edge for a right-aligned column
    edge: 'start' | 'end';

    // Called on every pointer move with the live width
    onResize: (column: ResizableColumn, width: number) => void;

    // Called on release, key press, with the width to keep
    onCommit: (column: ResizableColumn, width: number) => void;

    // Removes the custom width
    onReset: (column: ResizableColumn) => void;
};

type Drag = {
    startX: number;
    startWidth: number;
    width: number;
    moved: boolean;
};

export default function ColumnResizeHandle({column, label, width, edge, onResize, onCommit, onReset}: Props) {
    const intl = useIntl();
    const ref = useRef<HTMLDivElement>(null);
    const drag = useRef<Drag | null>(null);
    const {min, max, fallback} = COLUMN_WIDTH_BOUNDS[column];

    // Only read for aria-valuenow, since the default width isn't known until the cell is laid out
    const [measured, setMeasured] = useState<number | undefined>(undefined);

    // The cell's rendered width, as its default depends on the time format and the room left on the row
    const measure = useCallback(() => {
        const cell = ref.current?.parentElement;
        const rendered = cell ? cell.getBoundingClientRect().width : 0;
        return rendered > 0 ? rendered : fallback;
    }, [fallback]);

    useEffect(() => {
        if (width === undefined) {
            setMeasured(Math.round(measure()));
        }
    }, [width, measure]);

    // +1 grows the column when dragged right
    const direction = edge === 'end' ? 1 : -1;

    const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        // The time header is next to a sort button, and a handle press isn't a click on it
        e.stopPropagation();
        if (e.button !== undefined && e.button !== 0) {
            return;
        }
        e.preventDefault();

        // Starts from the rendered width, as on a narrow window flex may have shrunk the column below its set width
        const rendered = ref.current?.parentElement?.getBoundingClientRect().width ?? 0;
        const startWidth = rendered > 0 ? rendered : (width ?? measure());
        drag.current = {startX: e.clientX, startWidth, width: startWidth, moved: false};

        // jsdom and old browsers have no pointer capture
        try {
            e.currentTarget.setPointerCapture?.(e.pointerId);
        } catch {
            // ignore
        }
    }, [width, measure]);

    const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        const current = drag.current;
        if (!current) {
            return;
        }
        const next = clampColumnWidth(column, current.startWidth + ((e.clientX - current.startX) * direction));
        if (next !== current.width) {
            current.width = next;
            current.moved = true;
            onResize(column, next);
        }
    }, [column, direction, onResize]);

    const endDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        const current = drag.current;
        if (!current) {
            return;
        }
        drag.current = null;
        try {
            e.currentTarget.releasePointerCapture?.(e.pointerId);
        } catch {
            // ignore
        }

        // A plain click keeps the width the column has
        if (current.moved) {
            onCommit(column, current.width);
        }
    }, [column, onCommit]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') {
            return;
        }

        // The viewer has its own shortcuts
        e.preventDefault();
        e.stopPropagation();
        const step = e.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
        const sign = e.key === 'ArrowRight' ? 1 : -1;
        onCommit(column, clampColumnWidth(column, (width ?? measure()) + (step * sign * direction)));
    }, [column, direction, width, measure, onCommit]);

    const stop = useCallback((e: React.SyntheticEvent) => e.stopPropagation(), []);

    const handleDoubleClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        onReset(column);
    }, [column, onReset]);

    return (
        <div
            ref={ref}
            className={`LogViewer__resize-handle LogViewer__resize-handle--${edge}`}
            role='separator'
            aria-orientation='vertical'
            aria-label={intl.formatMessage({id: 'admin.logs.header.resizeColumn', defaultMessage: 'Resize {column} column'}, {column: label})}
            aria-valuenow={Math.round(width ?? measured ?? fallback)}
            aria-valuemin={min}
            aria-valuemax={max}
            tabIndex={0}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onClick={stop}
            onDoubleClick={handleDoubleClick}
            onKeyDown={handleKeyDown}
        />
    );
}
