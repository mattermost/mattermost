// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {act, renderWithContext, screen} from 'tests/react_testing_utils';

import {RowDropIndicator} from './row_drop_indicator';

// The actual indicator rendering details come from PDND's React adapter,
// which uses CSS pseudo-elements we can't reliably observe in jsdom. Swap
// it for a data-attribute marker so we can assert the `edge` prop is
// threaded through correctly.
jest.mock('@atlaskit/pragmatic-drag-and-drop-react-drop-indicator/box', () => ({
    DropIndicator: ({edge}: {edge: string}) => (
        <span
            data-testid='inner-drop-indicator'
            data-edge={edge}
        />
    ),
}));

describe('RowDropIndicator', () => {
    function renderWithRow(edge: 'top' | 'bottom') {
        // jsdom does not lay rows out, but the floating-ui middleware here
        // only reads `getBoundingClientRect()`, which jsdom returns zero
        // values for — perfectly fine for asserting render structure.
        //
        // The render is wrapped in act() so the post-mount flushSync that
        // @floating-ui/react fires from `whileElementsMounted: autoUpdate`
        // is settled inside an act() boundary, avoiding a noisy (but
        // benign) console warning.
        const row = document.createElement('tr');
        document.body.appendChild(row);
        act(() => {
            renderWithContext(
                <RowDropIndicator
                    rowElement={row}
                    edge={edge}
                />,
            );
        });
        return row;
    }

    afterEach(() => {
        // Clean up rows appended directly to body to keep tests isolated.
        document.querySelectorAll('tr').forEach((tr) => tr.remove());
    });

    test('renders the floating indicator container with the listTableRowDropIndicator class', () => {
        renderWithRow('top');

        // FloatingPortal places the element directly under document.body
        // (default portal root), so query the whole document for it.
        const indicators = document.querySelectorAll('.listTableRowDropIndicator');
        expect(indicators).toHaveLength(1);
    });

    test('forwards the given edge to the inner PDND DropIndicator', () => {
        renderWithRow('bottom');

        const inner = screen.getByTestId('inner-drop-indicator');
        expect(inner).toHaveAttribute('data-edge', 'bottom');
    });

    test('re-renders with a new edge when the prop changes', () => {
        const row = document.createElement('tr');
        document.body.appendChild(row);

        let rerender: (ui: React.ReactElement) => void = () => undefined;
        act(() => {
            const r = renderWithContext(
                <RowDropIndicator
                    rowElement={row}
                    edge='top'
                />,
            );
            rerender = r.rerender;
        });
        expect(screen.getByTestId('inner-drop-indicator')).toHaveAttribute('data-edge', 'top');

        act(() => {
            rerender(
                <RowDropIndicator
                    rowElement={row}
                    edge='bottom'
                />,
            );
        });
        expect(screen.getByTestId('inner-drop-indicator')).toHaveAttribute('data-edge', 'bottom');
    });
});
