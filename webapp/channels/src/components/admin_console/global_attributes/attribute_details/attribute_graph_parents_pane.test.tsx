// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyFieldOption} from '@mattermost/types/properties';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import AttributeGraphParentsPane, {
    GraphParentEdgeAlert,
    classifyParentCandidate,
} from './attribute_graph_parents_pane';
import {addParentEdge, removeParentEdge} from './graph_utils';

const opt = (name: string, parents: string[] = []): PropertyFieldOption => ({id: '', name, parents});

function renderPane(
    options: PropertyFieldOption[],
    optionName: string,
    onOptionsChange = jest.fn(),
    extra: Partial<React.ComponentProps<typeof AttributeGraphParentsPane>> = {},
) {
    const onDelete = extra.onDelete ?? jest.fn();
    renderWithContext(
        <AttributeGraphParentsPane
            options={options}
            optionName={optionName}
            onOptionsChange={onOptionsChange}
            onDelete={onDelete}
            {...extra}
        />,
    );
    return {onOptionsChange, onDelete};
}

async function openParentsView() {
    await userEvent.click(screen.getByTestId('attributeGraphParentsPane__openParents'));
}

describe('classifyParentCandidate', () => {
    const chain: PropertyFieldOption[] = [
        opt('A'),
        opt('B', ['A']),
        opt('C', ['B']),
    ];

    it('omits listed parents and descendants, disables self, and enables a legal ancestor', () => {
        expect(classifyParentCandidate(chain, 'A', 'B')).toEqual({kind: 'omit'});
        expect(classifyParentCandidate(chain, 'A', 'C')).toEqual({kind: 'omit'});
        expect(classifyParentCandidate(chain, 'A', 'A')).toEqual({kind: 'disabled', reason: 'self'});
        expect(classifyParentCandidate(chain, 'C', 'B')).toEqual({kind: 'omit'});
        expect(classifyParentCandidate(chain, 'C', 'A')).toEqual({kind: 'enabled'});
    });
});

describe('AttributeGraphParentsPane', () => {
    it('omits listed parents and descendants, lists self disabled, and shows the descendants helper', async () => {
        const chain = [opt('A'), opt('B', ['A']), opt('C', ['B'])];
        renderPane(chain, 'A');
        await openParentsView();

        expect(screen.queryByTestId('attributeGraphParentsPane__candidate-B')).not.toBeInTheDocument();
        expect(screen.queryByTestId('attributeGraphParentsPane__candidate-C')).not.toBeInTheDocument();
        const self = screen.getByTestId('attributeGraphParentsPane__candidate-A');
        expect(self).toHaveAttribute('aria-disabled', 'true');
        expect(self).toHaveTextContent('same value — an option can\'t be its own parent');
        expect(screen.getByTestId('attributeGraphParentsPane__helper')).toHaveTextContent(
            'Options below this one aren\'t listed — a parent can\'t be one of its own descendants.',
        );
        expect(screen.getByTestId('attributeGraphParentsPane__helper')).not.toHaveTextContent(
            'Every link is re-checked before it commits.',
        );
    });

    it('omits the listed parent of C and lists ancestor A enabled', async () => {
        const chain = [opt('A'), opt('B', ['A']), opt('C', ['B'])];
        renderPane(chain, 'C');
        await openParentsView();

        expect(screen.queryByTestId('attributeGraphParentsPane__candidate-B')).not.toBeInTheDocument();
        expect(screen.getByTestId('attributeGraphParentsPane__candidate-A')).not.toHaveAttribute('aria-disabled', 'true');
    });

    it('adds a parent immediately when newlyReachable is empty', async () => {
        const options = [opt('A'), opt('B', ['A']), opt('C', ['B'])];
        const {onOptionsChange} = renderPane(options, 'C');
        await openParentsView();
        await userEvent.click(screen.getByTestId('attributeGraphParentsPane__candidate-A'));

        await waitFor(() => {
            expect(onOptionsChange).toHaveBeenCalledWith(addParentEdge(options, 'C', 'A'));
        });
        expect(onOptionsChange.mock.calls[0][0].find((o: PropertyFieldOption) => o.name === 'C')?.parents).toEqual(['B', 'A']);
    });

    it('does not apply a grant-needed parent when confirmGrant is unset', async () => {
        const options = [opt('P'), opt('C'), opt('D', ['C'])];
        const {onOptionsChange} = renderPane(options, 'C');
        await openParentsView();
        await userEvent.click(screen.getByTestId('attributeGraphParentsPane__candidate-P'));

        await Promise.resolve();
        expect(onOptionsChange).not.toHaveBeenCalled();
    });

    it('applies when confirmGrant resolves true and blocks when it resolves false', async () => {
        const options = [opt('P'), opt('C'), opt('D', ['C'])];
        const confirmGrantTrue = jest.fn().mockResolvedValue(true);
        const onOptionsChangeTrue = jest.fn();
        renderPane(options, 'C', onOptionsChangeTrue, {confirmGrant: confirmGrantTrue});
        await openParentsView();
        await userEvent.click(screen.getByTestId('attributeGraphParentsPane__candidate-P'));

        await waitFor(() => {
            expect(onOptionsChangeTrue).toHaveBeenCalledWith(addParentEdge(options, 'C', 'P'));
        });
        expect(confirmGrantTrue).toHaveBeenCalledWith(expect.objectContaining({
            parentName: 'P',
            childName: 'C',
            newlyReachable: ['D'],
        }));
    });

    it('does not apply when confirmGrant resolves false', async () => {
        const options = [opt('P'), opt('C'), opt('D', ['C'])];
        const confirmGrantFalse = jest.fn().mockResolvedValue(false);
        const {onOptionsChange} = renderPane(options, 'C', jest.fn(), {confirmGrant: confirmGrantFalse});
        await openParentsView();
        await userEvent.click(screen.getByTestId('attributeGraphParentsPane__candidate-P'));
        await Promise.resolve();
        expect(onOptionsChange).not.toHaveBeenCalled();
        expect(confirmGrantFalse).toHaveBeenCalled();
    });

    it('makes a root when the last parent chip is removed', async () => {
        const options = [opt('A'), opt('B', ['A'])];
        const {onOptionsChange} = renderPane(options, 'B');
        await openParentsView();
        await userEvent.click(screen.getByTestId('attributeGraphParentsPane__chipRemove'));

        expect(onOptionsChange).toHaveBeenCalledWith(removeParentEdge(options, 'B', 'A'));
        expect(onOptionsChange.mock.calls[0][0].find((o: PropertyFieldOption) => o.name === 'B')?.parents).toEqual([]);
    });

    it('calls onDelete from the main pane without mutating options', async () => {
        const options = [opt('A'), opt('B', ['A']), opt('C', ['B'])];
        const {onOptionsChange, onDelete} = renderPane(options, 'C');
        await userEvent.click(screen.getByRole('menuitem', {name: 'Delete this value'}));
        expect(onDelete).toHaveBeenCalledWith('C');
        expect(onOptionsChange).not.toHaveBeenCalled();
    });

    it('keeps Delete this value enabled when the value has an exclusive child', () => {
        renderPane([opt('X'), opt('Orphan', ['X'])], 'X');
        expect(screen.getByRole('menuitem', {name: 'Delete this value'})).not.toBeDisabled();
    });
});

describe('GraphParentEdgeAlert', () => {
    it('renders cycle, depth, and max-parents option copy and skips self', () => {
        const {unmount} = renderWithContext(
            <GraphParentEdgeAlert
                result={{ok: false, error: 'cycle'}}
                parentName='B'
                childName='A'
            />,
        );
        expect(screen.getByRole('alert')).toHaveTextContent(
            'B can\'t be a parent of A — A already grants B, so this would loop back on itself.',
        );
        expect(screen.getByRole('alert')).not.toHaveTextContent('values on one chain');
        expect(screen.getByRole('alert')).not.toHaveTextContent('A value can have');
        unmount();

        renderWithContext(
            <GraphParentEdgeAlert
                result={{ok: false, error: 'depth', depth: 101}}
                parentName='B'
                childName='A'
            />,
        );
        expect(screen.getByRole('alert')).toHaveTextContent(
            'Adding this parent pushes "A" to depth 101; the limit is 100.',
        );
        expect(screen.getByRole('alert')).not.toHaveTextContent('values on one chain');
        expect(screen.getByRole('alert')).not.toHaveTextContent('A value can have');
    });

    it('renders max-parents option copy and no alert for self', () => {
        const {unmount} = renderWithContext(
            <GraphParentEdgeAlert
                result={{ok: false, error: 'max-parents'}}
                parentName='B'
                childName='A'
            />,
        );
        expect(screen.getByRole('alert')).toHaveTextContent('An option can have at most 100 parents.');
        expect(screen.getByRole('alert')).not.toHaveTextContent('A value can have');
        unmount();

        renderWithContext(
            <GraphParentEdgeAlert
                result={{ok: false, error: 'self'}}
                parentName='A'
                childName='A'
            />,
        );
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
});
