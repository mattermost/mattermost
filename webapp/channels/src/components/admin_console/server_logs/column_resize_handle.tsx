// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useId, useRef, useState} from 'react';
import {useIntl} from 'react-intl';

import {WithTooltip} from '@mattermost/shared/components/tooltip';

import {useLatest} from 'hooks/useLatest';

export type ResizableColumn = 'timestamp' | 'node' | 'caller';

export type ColumnWidths = Partial<Record<ResizableColumn, number>>;

export const COLUMN_WIDTH_BOUNDS: Record<ResizableColumn, {min: number; max: number; fallback: number}> = {

    // The longest format, "YYYY-MM-DD h:mm:ss.SSS A", is 26 chars at 8px = 208px; wider only takes room from
    // Node, Message and Caller
    timestamp: {min: 48, max: 240, fallback: 96},
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
    pointerId: number;
    startX: number;
    startWidth: number;
    width: number;
    moved: boolean;

    // The width prop turns live on the first move, so whether the column was automatic is noted at the press
    automatic: boolean;
};

export default function ColumnResizeHandle({column, label, width, edge, onResize, onCommit, onReset}: Props) {
    const intl = useIntl();
    const hintId = useId();
    const ref = useRef<HTMLDivElement>(null);
    const drag = useRef<Drag | null>(null);
    const {min, max, fallback} = COLUMN_WIDTH_BOUNDS[column];

    // The cell's rendered position, which flex may have moved off the set width; only read for aria-valuenow
    const [measured, setMeasured] = useState<number | undefined>(undefined);

    // The cell's rendered width, as the timestamp's default depends on the time format
    const measure = useCallback(() => {
        const cell = ref.current?.parentElement;
        const rendered = cell ? cell.getBoundingClientRect().width : 0;
        return rendered > 0 ? rendered : fallback;
    }, [fallback]);

    // The width the column is sized from. Node and caller default to their stylesheet basis, which flex may shrink
    // below, so dragging from the rendered width would shrink a column on the first move. The timestamp never
    // shrinks, so its rendered width is its basis
    const basis = useCallback(() => {
        return width ?? (column === 'timestamp' ? measure() : fallback);
    }, [width, column, measure, fallback]);

    useEffect(() => {
        const cell = ref.current?.parentElement;
        if (!cell) {
            return undefined;
        }
        const update = () => {
            const rendered = Math.round(cell.getBoundingClientRect().width);
            setMeasured(rendered > 0 ? rendered : undefined);
        };
        update();
        if (typeof ResizeObserver === 'undefined') {
            return undefined;
        }
        const observer = new ResizeObserver(update);
        observer.observe(cell);
        return () => observer.disconnect();
    }, []);

    // Unmounted mid-drag, as when the list reloads, keeps the width so the viewer doesn't stay in its resizing state
    const latest = useLatest({column, onCommit, onReset});
    useEffect(() => () => {
        const current = drag.current;
        if (current?.moved) {
            const {column: col, onCommit: commit, onReset: reset} = latest.current;
            if (current.automatic && current.width === current.startWidth) {
                reset(col);
            } else {
                commit(col, current.width);
            }
        }
    }, [latest]);

    // +1 grows the column when dragged right
    const direction = edge === 'end' ? 1 : -1;

    const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        // The time header is next to a sort button, and a handle press isn't a click on it
        e.stopPropagation();
        if (e.button !== undefined && e.button !== 0) {
            return;
        }
        e.preventDefault();

        // A second pointer, as in a multi-touch gesture, doesn't take over the drag
        if (drag.current) {
            return;
        }
        const startWidth = basis();
        drag.current = {pointerId: e.pointerId, startX: e.clientX, startWidth, width: startWidth, moved: false, automatic: width === undefined};

        // jsdom and old browsers have no pointer capture
        try {
            e.currentTarget.setPointerCapture?.(e.pointerId);
        } catch {
            // ignore
        }
    }, [basis, width]);

    const endDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        const current = drag.current;
        if (!current || current.pointerId !== e.pointerId) {
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
            // Dragged back to where it started, so the column keeps its automatic width instead of saving one
            if (current.automatic && current.width === current.startWidth) {
                onReset(column);
            } else {
                onCommit(column, current.width);
            }
        }
    }, [column, onCommit, onReset]);

    const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        const current = drag.current;
        if (!current || current.pointerId !== e.pointerId) {
            return;
        }

        // Released outside the handle without a pointerup reaching it, as when capture failed
        if (e.buttons === 0) {
            endDrag(e);
            return;
        }
        const next = clampColumnWidth(column, current.startWidth + ((e.clientX - current.startX) * direction));
        if (next !== current.width) {
            current.width = next;
            current.moved = true;
            onResize(column, next);
        }
    }, [column, direction, onResize, endDrag]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
        const handled = ['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter'].includes(e.key);
        if (!handled) {
            return;
        }

        // The viewer has its own shortcuts
        e.preventDefault();
        e.stopPropagation();

        // A key mid-drag takes over from it, so the pointer's release can't overwrite the result
        const active = drag.current;
        drag.current = null;
        if (active) {
            try {
                ref.current?.releasePointerCapture?.(active.pointerId);
            } catch {
                // ignore
            }
        }

        switch (e.key) {
        case 'Enter':
            onReset(column);
            break;
        case 'Home':
            onCommit(column, min);
            break;
        case 'End':
            onCommit(column, max);
            break;
        default: {
            const step = e.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
            const sign = e.key === 'ArrowRight' ? 1 : -1;
            onCommit(column, clampColumnWidth(column, (active ? active.width : basis()) + (step * sign * direction)));
        }
        }
    }, [column, direction, min, max, basis, onCommit, onReset]);

    const stop = useCallback((e: React.SyntheticEvent) => e.stopPropagation(), []);

    const handleDoubleClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        onReset(column);
    }, [column, onReset]);

    const hint = intl.formatMessage({id: 'admin.logs.header.resizeHint', defaultMessage: 'Drag or use the arrow keys to resize. Double-click or press Enter to reset.'});

    return (
        <>
            <WithTooltip title={hint}>
                <div
                    ref={ref}
                    className={`LogViewer__resize-handle LogViewer__resize-handle--${edge}`}
                    role='separator'
                    aria-orientation='vertical'
                    aria-label={intl.formatMessage({id: 'admin.logs.header.resizeColumn', defaultMessage: 'Resize {column} column'}, {column: label})}
                    aria-describedby={hintId}
                    aria-valuenow={Math.round(measured ?? width ?? fallback)}
                    aria-valuemin={min}
                    aria-valuemax={max}
                    tabIndex={0}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onLostPointerCapture={endDrag}
                    onClick={stop}
                    onDoubleClick={handleDoubleClick}
                    onKeyDown={handleKeyDown}
                />
            </WithTooltip>

            {/* Always in the DOM, as the tooltip only exists while open and a native title isn't shown on keyboard focus */}
            <span
                id={hintId}
                className='sr-only'
            >
                {hint}
            </span>
        </>
    );
}
