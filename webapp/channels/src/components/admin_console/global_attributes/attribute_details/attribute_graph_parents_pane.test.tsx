// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyFieldOption} from '@mattermost/types/properties';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import AttributeGraphParentsPane, {
    GraphParentEdgeAlert,
    classifyChildCandidate,
    classifyParentCandidate,
} from './attribute_graph_parents_pane';
import {addChildOption, addParentEdge, addTopLevelOption, removeParentEdge} from './graph_utils';

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

async function openParentSearch() {
    await userEvent.click(screen.getByTestId('attributeGraphParentsPane__search'));
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

describe('classifyChildCandidate', () => {
    const chain: PropertyFieldOption[] = [
        opt('A'),
        opt('B', ['A']),
        opt('C', ['B']),
    ];

    it('omits listed children and cycle-forming ancestors, disables self, and enables a legal sibling', () => {
        expect(classifyChildCandidate(chain, 'A', 'B')).toEqual({kind: 'omit'});
        expect(classifyChildCandidate(chain, 'A', 'A')).toEqual({kind: 'disabled', reason: 'self'});
        expect(classifyChildCandidate(chain, 'A', 'C')).toEqual({kind: 'enabled'});
        expect(classifyChildCandidate(chain, 'C', 'A')).toEqual({kind: 'omit'});
        expect(classifyChildCandidate([opt('A'), opt('B'), opt('C', ['B'])], 'A', 'B')).toEqual({kind: 'enabled'});
    });
});

describe('AttributeGraphParentsPane', () => {
    it('shows Parents of the value, parent rows, and no candidate list until search is focused', async () => {
        const chain = [opt('A'), opt('B', ['A']), opt('C', ['B'])];
        renderPane(chain, 'B');
        await openParentsView();

        expect(screen.getByTestId('attributeGraphParentsPane__back')).toHaveTextContent('Parents of B');
        expect(screen.getByTestId('attributeGraphParentsPane__parentRow')).toHaveTextContent('A');
        expect(screen.getByTestId('attributeGraphParentsPane__parentRow')).not.toHaveTextContent('sits under');
        expect(screen.getByTestId('attributeGraphParentsPane__search')).toHaveAttribute(
            'placeholder',
            'Add a parent, or type a new name…',
        );
        expect(screen.queryByTestId('attributeGraphParentsPane__suggestions')).not.toBeInTheDocument();
        expect(screen.queryByTestId('attributeGraphParentsPane__candidate-A')).not.toBeInTheDocument();
        expect(screen.queryByTestId('attributeGraphParentsPane__candidate-B')).not.toBeInTheDocument();
        expect(screen.queryByTestId('attributeGraphParentsPane__candidate-C')).not.toBeInTheDocument();
        expect(screen.queryByText('Options below this one aren\'t listed')).not.toBeInTheDocument();
        expect(screen.queryByTestId('attributeGraphParentsPane__helper')).not.toBeInTheDocument();
    });

    it('omits listed parents, descendants, and self from search suggestions', async () => {
        const chain = [opt('A'), opt('B', ['A']), opt('C', ['B'])];
        renderPane(chain, 'A');
        await openParentsView();
        await openParentSearch();

        expect(screen.queryByTestId('attributeGraphParentsPane__candidate-A')).not.toBeInTheDocument();
        expect(screen.queryByTestId('attributeGraphParentsPane__candidate-B')).not.toBeInTheDocument();
        expect(screen.queryByTestId('attributeGraphParentsPane__candidate-C')).not.toBeInTheDocument();
        expect(screen.getByTestId('attributeGraphParentsPane__empty')).toHaveTextContent('No parents yet.');
    });

    it('lists an eligible ancestor after focusing search', async () => {
        const chain = [opt('A'), opt('B', ['A']), opt('C', ['B'])];
        renderPane(chain, 'C');
        await openParentsView();

        expect(screen.queryByTestId('attributeGraphParentsPane__candidate-A')).not.toBeInTheDocument();
        await openParentSearch();
        expect(screen.queryByTestId('attributeGraphParentsPane__candidate-B')).not.toBeInTheDocument();
        expect(screen.getByTestId('attributeGraphParentsPane__candidate-A')).toBeEnabled();
    });

    it('adds a parent immediately when newlyReachable is empty', async () => {
        const options = [opt('A'), opt('B', ['A']), opt('C', ['B'])];
        const {onOptionsChange} = renderPane(options, 'C');
        await openParentsView();
        await openParentSearch();
        await userEvent.click(screen.getByTestId('attributeGraphParentsPane__candidate-A'));

        await waitFor(() => {
            expect(onOptionsChange).toHaveBeenCalledWith(addParentEdge(options, 'C', 'A'));
        });
        expect(onOptionsChange.mock.calls[0][0].find((o: PropertyFieldOption) => o.name === 'C')?.parents).toEqual(['B', 'A']);
    });

    it('creates a new parent from a typed name', async () => {
        const options = [opt('A'), opt('B', ['A'])];
        const {onOptionsChange} = renderPane(options, 'B');
        await openParentsView();
        await userEvent.type(screen.getByTestId('attributeGraphParentsPane__search'), 'West');
        await userEvent.click(screen.getByTestId('attributeGraphParentsPane__create'));

        await waitFor(() => {
            expect(onOptionsChange).toHaveBeenCalledWith(
                addParentEdge(addTopLevelOption(options, 'West'), 'B', 'West'),
            );
        });
    });

    it('does not apply a grant-needed parent when confirmGrant is unset', async () => {
        const options = [opt('P'), opt('C'), opt('D', ['C'])];
        const {onOptionsChange} = renderPane(options, 'C');
        await openParentsView();
        await openParentSearch();
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
        await openParentSearch();
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
        await openParentSearch();
        await userEvent.click(screen.getByTestId('attributeGraphParentsPane__candidate-P'));
        await Promise.resolve();
        expect(onOptionsChange).not.toHaveBeenCalled();
        expect(confirmGrantFalse).toHaveBeenCalled();
    });

    it('makes a root when the last parent row is removed', async () => {
        const options = [opt('A'), opt('B', ['A'])];
        const {onOptionsChange} = renderPane(options, 'B');
        await openParentsView();
        await userEvent.click(screen.getByTestId('attributeGraphParentsPane__parentRemove'));

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

    it('shows an editable name, Parents and Children line items, and a delete icon on the main pane', () => {
        renderPane([opt('A'), opt('B', ['A'])], 'A');

        expect(screen.getByTestId('attributeGraphParentsPane__nameInput')).toHaveValue('A');
        expect(screen.getByTestId('attributeGraphParentsPane__openParents')).toHaveTextContent('Top level');
        expect(screen.getByTestId('attributeGraphParentsPane__openChildren')).toHaveTextContent('1');
        expect(screen.getByRole('menuitem', {name: 'Delete this value'})).toBeInTheDocument();
        expect(screen.queryByTestId('attributeGraphParentsPane__children')).not.toBeInTheDocument();
    });

    it('renames from the main pane input and reports a duplicate', async () => {
        const onRename = jest.fn((current: string, next: string) => {
            if (next.trim().toLowerCase() === 'b') {
                return 'duplicate';
            }
            if (next.trim() === '' || next.trim() === current) {
                return 'noop';
            }
            return 'applied';
        });
        renderPane([opt('A'), opt('B', ['A'])], 'A', jest.fn(), {onRename});

        const input = screen.getByTestId('attributeGraphParentsPane__nameInput');
        await userEvent.clear(input);
        await userEvent.type(input, 'B{Enter}');
        expect(onRename).toHaveBeenCalledWith('A', 'B');
        expect(screen.getByRole('alert')).toHaveTextContent('"B" already exists in this field.');

        await userEvent.clear(input);
        await userEvent.type(input, 'West{Enter}');
        expect(onRename).toHaveBeenCalledWith('A', 'West');
    });

    it('opens the children submenu, lists children, and removes a child grant', async () => {
        const options = [opt('A'), opt('B', ['A']), opt('C', ['A'])];
        const {onOptionsChange} = renderPane(options, 'A');

        await userEvent.click(screen.getByTestId('attributeGraphParentsPane__openChildren'));
        expect(screen.getByTestId('attributeGraphParentsPane__back')).toHaveTextContent('Children of A');
        expect(screen.getAllByTestId('attributeGraphParentsPane__childRow').map((row) => row.textContent)).toEqual(
            expect.arrayContaining(['B', 'C']),
        );

        await userEvent.click(screen.getAllByTestId('attributeGraphParentsPane__childRemove')[0]);
        expect(onOptionsChange).toHaveBeenCalledWith(removeParentEdge(options, 'B', 'A'));
    });

    it('creates a new child from a typed name', async () => {
        const options = [opt('A')];
        const {onOptionsChange} = renderPane(options, 'A');

        await userEvent.click(screen.getByTestId('attributeGraphParentsPane__openChildren'));
        expect(screen.getByTestId('attributeGraphParentsPane__childrenEmpty')).toHaveTextContent('No children yet.');
        await userEvent.type(screen.getByTestId('attributeGraphParentsPane__childSearch'), 'Wing');
        await userEvent.click(screen.getByTestId('attributeGraphParentsPane__createChild'));

        expect(onOptionsChange).toHaveBeenCalledWith(addChildOption(options, 'Wing', 'A'));
    });

    it('adds an existing value as a child when newlyReachable is empty', async () => {
        const options = [opt('A'), opt('B')];
        const {onOptionsChange} = renderPane(options, 'A');

        await userEvent.click(screen.getByTestId('attributeGraphParentsPane__openChildren'));
        await userEvent.click(screen.getByTestId('attributeGraphParentsPane__childSearch'));
        await userEvent.click(screen.getByTestId('attributeGraphParentsPane__candidate-B'));

        await waitFor(() => {
            expect(onOptionsChange).toHaveBeenCalledWith(addParentEdge(options, 'B', 'A'));
        });
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
