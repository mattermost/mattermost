// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createGraphRowDragPreview, GRAPH_ROW_DRAG_PREVIEW_PAD_PX, graphRowDragDataAtPoint} from './drag_preview';
import {GRAPH_ROW_DRAG_KIND} from './drop_classifier';

function graphRowEl(optionName: string, parentName: string) {
    const li = document.createElement('li');
    li.setAttribute('data-testid', 'attributeOptionsGraphRow');
    li.setAttribute('data-option-name', optionName);
    li.setAttribute('data-parent-name', parentName);
    return li;
}

describe('createGraphRowDragPreview', () => {
    afterEach(() => {
        document.body.replaceChildren();
    });

    test('clones the full row at its laid-out width and strips the menu anchor', () => {
        const row = document.createElement('li');
        row.className = 'attribute-options-graph-values__row';
        row.setAttribute('data-testid', 'attributeOptionsGraphRow');
        row.setAttribute('tabindex', '-1');
        row.style.setProperty('--attribute-options-graph-values-indent', '2');

        const name = document.createElement('span');
        name.textContent = 'Falcon Wing';
        row.appendChild(name);

        const actions = document.createElement('div');
        actions.className = 'attribute-options-graph-values__actions';
        actions.appendChild(document.createElement('button'));
        actions.appendChild(document.createElement('button'));
        actions.appendChild(document.createElement('button'));
        row.appendChild(actions);

        const menuAnchor = document.createElement('div');
        menuAnchor.className = 'attribute-options-graph-values__parents-anchor';
        menuAnchor.setAttribute('data-testid', 'attributeOptionsGraphRow__parentsAnchor');
        row.appendChild(menuAnchor);

        document.body.appendChild(row);
        jest.spyOn(row, 'getBoundingClientRect').mockReturnValue({
            width: 480,
            height: 36,
            top: 0,
            left: 0,
            bottom: 36,
            right: 480,
            x: 0,
            y: 0,
            toJSON: () => ({}),
        });

        const preview = createGraphRowDragPreview(row);

        expect(preview.classList.contains('attribute-options-graph-values')).toBe(true);
        expect(preview.classList.contains('attribute-options-graph-values--drag-preview-host')).toBe(true);
        expect(preview.style.padding).toBe(`${GRAPH_ROW_DRAG_PREVIEW_PAD_PX}px`);
        expect(preview.getAttribute('aria-hidden')).toBe('true');
        expect(preview.textContent).toContain('Falcon Wing');

        const clonedRow = preview.querySelector('.attribute-options-graph-values__row');
        expect(clonedRow).toBeInstanceOf(HTMLElement);
        expect(clonedRow).not.toHaveAttribute('data-testid');
        expect(clonedRow).not.toHaveAttribute('tabindex');
        expect((clonedRow as HTMLElement).classList.contains('attribute-options-graph-values__row--active')).toBe(true);
        expect((clonedRow as HTMLElement).style.width).toBe('480px');
        expect((clonedRow as HTMLElement).style.getPropertyValue('--attribute-options-graph-values-indent')).toBe('2');
        expect(preview.querySelectorAll('.attribute-options-graph-values__actions button')).toHaveLength(3);
        expect(preview.querySelector('.attribute-options-graph-values__parents-anchor')).toBeNull();
    });
});

describe('graphRowDragDataAtPoint', () => {
    afterEach(() => {
        Reflect.deleteProperty(document, 'elementsFromPoint');
    });

    function stubElementsFromPoint(stack: Element[]) {
        Object.defineProperty(document, 'elementsFromPoint', {
            configurable: true,
            value: () => stack,
        });
    }

    test('skips the honey-pot and returns the row under the pointer', () => {
        const dRow = graphRowEl('D', 'S');
        const honey = document.createElement('div');
        honey.setAttribute('data-pdnd-honey-pot', 'true');
        stubElementsFromPoint([honey, dRow]);

        expect(graphRowDragDataAtPoint(0, 0)).toEqual({
            kind: GRAPH_ROW_DRAG_KIND,
            optionName: 'D',
            parentName: 'S',
        });
    });

    test('empty stack or no row is null', () => {
        stubElementsFromPoint([]);
        expect(graphRowDragDataAtPoint(0, 0)).toBeNull();

        stubElementsFromPoint([document.createElement('div')]);
        expect(graphRowDragDataAtPoint(0, 0)).toBeNull();
    });
});
