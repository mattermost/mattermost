// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GRAPH_ROW_DRAG_KIND, type GraphRowDragData} from './drop_classifier';

const GRAPH_ROW_TEST_ID = 'attributeOptionsGraphRow';
const HONEY_POT_ATTR = 'data-pdnd-honey-pot';

const DRAG_PREVIEW_HOST_CLASS = 'attribute-options-graph-values--drag-preview-host';

// Native setDragImage clips paint outside the snapshot box. Keep the lift
// shadow inside that box, then shift the pointer offset by the same pad.
export const GRAPH_ROW_DRAG_PREVIEW_PAD_PX = 16;

// Clone the full row for the native drag image. A handle-sized source (or a
// row inside overflow:hidden) otherwise ghosts as a clipped icon.
export function createGraphRowDragPreview(rowElement: HTMLElement): HTMLElement {
    const {width} = rowElement.getBoundingClientRect();
    const host = document.createElement('div');
    host.className = `attribute-options-graph-values ${DRAG_PREVIEW_HOST_CLASS}`;
    host.setAttribute('aria-hidden', 'true');
    host.style.padding = `${GRAPH_ROW_DRAG_PREVIEW_PAD_PX}px`;

    const preview = rowElement.cloneNode(true) as HTMLElement;
    preview.removeAttribute('data-testid');
    preview.removeAttribute('tabindex');
    preview.setAttribute('aria-hidden', 'true');
    preview.classList.add('attribute-options-graph-values__row--active');
    preview.style.width = `${width}px`;
    preview.style.boxSizing = 'border-box';
    preview.querySelectorAll('.attribute-options-graph-values__parents-anchor').forEach((node) => node.remove());

    host.appendChild(preview);
    return host;
}

export function graphRowDragDataAtPoint(clientX: number, clientY: number): GraphRowDragData | null {
    const stack = document.elementsFromPoint(clientX, clientY);
    for (const node of stack) {
        // PDND's honey-pot sits on top of the row during drag.
        if (!(node instanceof Element) || node.hasAttribute(HONEY_POT_ATTR)) {
            continue;
        }
        const row = node.closest(`[data-testid="${GRAPH_ROW_TEST_ID}"]`);
        if (!(row instanceof HTMLElement)) {
            continue;
        }
        const optionName = row.getAttribute('data-option-name');
        if (!optionName) {
            return null;
        }
        const parentAttr = row.getAttribute('data-parent-name');
        return {
            kind: GRAPH_ROW_DRAG_KIND,
            optionName,
            parentName: parentAttr || null,
        };
    }
    return null;
}
