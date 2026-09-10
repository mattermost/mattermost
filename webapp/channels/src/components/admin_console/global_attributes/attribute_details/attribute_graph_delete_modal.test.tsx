// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyFieldOption} from '@mattermost/types/properties';

import {openModal} from 'actions/views/modals';

import {renderHookWithContext, renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';

import AttributeGraphDeleteModal, {
    buildGraphNodeDeleteViewModel,
    useGraphNodeDelete,
} from './attribute_graph_delete_modal';
import {removeOption} from './graph_utils';

jest.mock('actions/views/modals', () => ({
    openModal: jest.fn(() => ({type: 'MOCK_OPEN_MODAL'})),
}));

const opt = (name: string, parents: string[] = []): PropertyFieldOption => ({id: '', name, parents});

const blockedOptions = [
    opt('X'),
    opt('Keep'),
    opt('Orphan', ['X']),
    opt('Shared', ['X', 'Keep']),
    opt('Grandchild', ['Orphan']),
];

const diamondOptions = [
    opt('A'),
    opt('B', ['A']),
    opt('C', ['B', 'D']),
    opt('D'),
];

const leafOptions = [
    opt('A'),
    opt('B', ['A']),
];

const twoExclusiveChildren = [
    opt('X'),
    opt('A', ['X']),
    opt('B', ['X']),
];

const twoDescendants = [
    opt('B'),
    opt('C', ['B', 'X']),
    opt('E', ['B', 'X']),
    opt('X'),
];

const safeDeleteXOptions = [
    opt('X'),
    opt('Keep'),
    opt('Shared', ['X', 'Keep']),
];

function getDeleteModalBody() {
    const paragraph = screen.getByTestId('attributeGraphDeleteModal').querySelector('p');
    expect(paragraph).not.toBeNull();
    return paragraph!;
}

describe('buildGraphNodeDeleteViewModel', () => {
    it('returns null for an unknown name', () => {
        expect(buildGraphNodeDeleteViewModel([opt('A')], 'Nope')).toBeNull();
    });

    it('returns blocked for a direct exclusive child and ignores a grandchild', () => {
        expect(buildGraphNodeDeleteViewModel(blockedOptions, 'X')).toEqual({
            variant: 'blocked',
            optionName: 'X',
            orphanCount: 1,
            firstOrphan: 'Orphan',
        });
    });

    it('returns blocked for two exclusive children in options-array order', () => {
        expect(buildGraphNodeDeleteViewModel(twoExclusiveChildren, 'X')).toEqual({
            variant: 'blocked',
            optionName: 'X',
            orphanCount: 2,
            firstOrphan: 'A',
        });
    });

    it('returns the safe diamond fixture', () => {
        expect(buildGraphNodeDeleteViewModel(diamondOptions, 'B')).toEqual({
            variant: 'safe',
            optionName: 'B',
            survivingChildren: ['C'],
        });
    });

    it('returns safe when the only children still have another parent', () => {
        expect(buildGraphNodeDeleteViewModel(safeDeleteXOptions, 'X')).toEqual({
            variant: 'safe',
            optionName: 'X',
            survivingChildren: ['Shared'],
        });
    });

    it('returns safe with two surviving children in options-array order', () => {
        expect(buildGraphNodeDeleteViewModel(twoDescendants, 'B')).toEqual({
            variant: 'safe',
            optionName: 'B',
            survivingChildren: ['C', 'E'],
        });
    });

    it('returns direct for a leaf with a parent', () => {
        expect(buildGraphNodeDeleteViewModel(leafOptions, 'B')).toEqual({
            variant: 'direct',
            optionName: 'B',
        });
    });

    it('returns direct for an isolated root', () => {
        expect(buildGraphNodeDeleteViewModel([opt('Only')], 'Only')).toEqual({
            variant: 'direct',
            optionName: 'Only',
        });
    });
});

describe('AttributeGraphDeleteModal blocked', () => {
    const renderBlocked = (options: PropertyFieldOption[] = blockedOptions, optionName = 'X') => {
        const props = {
            optionName,
            options,
            onConfirm: jest.fn(),
            onExited: jest.fn(),
        };
        renderWithContext(<AttributeGraphDeleteModal {...props}/>);
        return props;
    };

    it('shows the singular can\'t-delete title and lead', () => {
        renderBlocked();

        expect(screen.getByRole('heading', {name: "Can't delete X"})).toBeInTheDocument();
        expect(getDeleteModalBody()).toHaveTextContent(
            "Child values need a parent. X is the only parent of 1 child value, so it can't be deleted until that child is moved or deleted.",
        );
    });

    it('does not show leftover list or not-affected copy', () => {
        renderBlocked();

        expect(screen.queryByText('Would be left with no parent')).not.toBeInTheDocument();
        expect(screen.queryByText('Not affected')).not.toBeInTheDocument();
        expect(screen.queryByText(/is its only parent/)).not.toBeInTheDocument();
        expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });

    it('uses a non-destructive Go to primary that calls onConfirm', async () => {
        const props = renderBlocked();

        const goTo = screen.getByRole('button', {name: 'Go to Orphan'});
        expect(goTo).not.toHaveClass('delete');
        expect(goTo).not.toHaveClass('btn-danger');

        await userEvent.click(goTo);

        expect(props.onConfirm).toHaveBeenCalledTimes(1);
    });

    it('does not call onConfirm when Cancel is clicked', async () => {
        const props = renderBlocked();

        await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

        expect(props.onConfirm).not.toHaveBeenCalled();
    });

    it('uses can\'t-delete title, 2 child values, and Go to A', () => {
        renderBlocked(twoExclusiveChildren, 'X');

        expect(screen.getByRole('heading', {name: "Can't delete X"})).toBeInTheDocument();
        expect(getDeleteModalBody()).toHaveTextContent(
            "Child values need a parent. X is the only parent of 2 child values, so it can't be deleted until those children are moved or deleted.",
        );
        expect(screen.getByRole('button', {name: 'Go to A'})).toBeInTheDocument();
        expect(screen.queryByText('Not affected')).not.toBeInTheDocument();
    });

    it('omits in-use, undo, and policy copy', () => {
        renderBlocked();

        expect(screen.queryByText(/currently carry/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/cannot be undone/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/polic/i)).not.toBeInTheDocument();
    });
});

describe('AttributeGraphDeleteModal safe', () => {
    const renderSafe = (options: PropertyFieldOption[], optionName: string) => {
        const props = {
            optionName,
            options,
            onConfirm: jest.fn(),
            onExited: jest.fn(),
        };
        renderWithContext(<AttributeGraphDeleteModal {...props}/>);
        return props;
    };

    it('returns null for a leaf that is now a direct delete', () => {
        renderSafe(leafOptions, 'B');

        expect(screen.queryByTestId('attributeGraphDeleteModal')).not.toBeInTheDocument();
        expect(screen.queryByRole('heading', {name: 'Delete B?'})).not.toBeInTheDocument();
    });

    it('shows Delete X? with no subtitle and the surviving-child lead', () => {
        renderSafe(safeDeleteXOptions, 'X');

        expect(screen.getByRole('heading', {name: 'Delete X?'})).toBeInTheDocument();
        expect(screen.queryByText('This removes access, not just a row')).not.toBeInTheDocument();
        expect(getDeleteModalBody()).toHaveTextContent(
            '1 child (Shared) of this value has other parent values, so it will not be removed. Are you sure you want to delete X?',
        );

        const confirm = screen.getByRole('button', {name: 'Delete'});
        expect(confirm).toHaveClass('delete');
        expect(confirm).toHaveClass('btn-danger');
    });

    it('uses the singular surviving-child lead for the diamond fixture', () => {
        renderSafe(diamondOptions, 'B');

        expect(screen.getByRole('heading', {name: 'Delete B?'})).toBeInTheDocument();
        expect(getDeleteModalBody()).toHaveTextContent(
            '1 child (C) of this value has other parent values, so it will not be removed. Are you sure you want to delete B?',
        );
        expect(screen.queryByText('Access removed')).not.toBeInTheDocument();
        expect(screen.queryByText('Stays reachable')).not.toBeInTheDocument();
        expect(screen.queryByText(/grants access to nothing else/)).not.toBeInTheDocument();
        expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });

    it('uses the plural surviving-children lead and oxfordJoinNames', () => {
        renderSafe(twoDescendants, 'B');

        expect(getDeleteModalBody()).toHaveTextContent(
            '2 children (C and E) of this value have other parent values, so they will not be removed. Are you sure you want to delete B?',
        );
    });

    it('does not call onConfirm when Cancel is clicked', async () => {
        const props = renderSafe(diamondOptions, 'B');

        await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

        expect(props.onConfirm).not.toHaveBeenCalled();
    });

    it('omits live-playground drift copy', () => {
        renderSafe(diamondOptions, 'B');

        expect(screen.queryByText(/currently carry/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/This cannot be undone/)).not.toBeInTheDocument();
        expect(screen.queryByText(/has 1 child value/)).not.toBeInTheDocument();
        expect(screen.queryByText('Stays under another parent')).not.toBeInTheDocument();
    });
});

describe('useGraphNodeDelete', () => {
    const onOptionsChange = jest.fn();
    const onGoToOrphan = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        onOptionsChange.mockReset();
        onGoToOrphan.mockReset();
    });

    const dialogProps = () => (openModal as jest.Mock).mock.calls[0][0].dialogProps;

    it('dispatches openModal with GRAPH_NODE_DELETE and the modal component', () => {
        const {result} = renderHookWithContext(() =>
            useGraphNodeDelete(blockedOptions, onOptionsChange, onGoToOrphan),
        );

        result.current('X');

        expect(openModal).toHaveBeenCalledWith({
            modalId: ModalIdentifiers.GRAPH_NODE_DELETE,
            dialogType: AttributeGraphDeleteModal,
            dialogProps: {
                optionName: 'X',
                options: blockedOptions,
                onConfirm: expect.any(Function),
                onExited: expect.any(Function),
            },
        });
    });

    it('does not open the modal for an unknown name', () => {
        const {result} = renderHookWithContext(() =>
            useGraphNodeDelete(blockedOptions, onOptionsChange, onGoToOrphan),
        );

        result.current('Nope');

        expect(openModal).not.toHaveBeenCalled();
        expect(onOptionsChange).not.toHaveBeenCalled();
    });

    it('deletes a leaf immediately without opening the modal', () => {
        const {result} = renderHookWithContext(() =>
            useGraphNodeDelete(leafOptions, onOptionsChange, onGoToOrphan),
        );

        result.current('B');

        expect(openModal).not.toHaveBeenCalled();
        expect(onOptionsChange).toHaveBeenCalledTimes(1);
        expect(onOptionsChange).toHaveBeenCalledWith(removeOption(leafOptions, 'B'));
    });

    it('deletes an isolated root immediately without opening the modal', () => {
        const isolated = [opt('Only')];
        const {result} = renderHookWithContext(() =>
            useGraphNodeDelete(isolated, onOptionsChange, onGoToOrphan),
        );

        result.current('Only');

        expect(openModal).not.toHaveBeenCalled();
        expect(onOptionsChange).toHaveBeenCalledTimes(1);
        expect(onOptionsChange).toHaveBeenCalledWith(removeOption(isolated, 'Only'));
    });

    it('removes the option on safe confirm and does not Go to on exit', () => {
        const {result} = renderHookWithContext(() =>
            useGraphNodeDelete(safeDeleteXOptions, onOptionsChange, onGoToOrphan),
        );

        result.current('X');
        dialogProps().onConfirm();

        expect(onOptionsChange).toHaveBeenCalledTimes(1);
        expect(onOptionsChange).toHaveBeenCalledWith(removeOption(safeDeleteXOptions, 'X'));
        expect(onOptionsChange.mock.calls[0][0].map((option: PropertyFieldOption) => option.name)).toEqual(['Keep', 'Shared']);
        expect(onOptionsChange.mock.calls[0][0].find((option: PropertyFieldOption) => option.name === 'Shared')?.parents).toEqual(['Keep']);
        expect(onGoToOrphan).not.toHaveBeenCalled();

        dialogProps().onExited();

        expect(onGoToOrphan).not.toHaveBeenCalled();
    });

    it('does not delete on blocked confirm and Goes to the first orphan on exit', () => {
        const {result} = renderHookWithContext(() =>
            useGraphNodeDelete(blockedOptions, onOptionsChange, onGoToOrphan),
        );

        result.current('X');
        dialogProps().onConfirm();

        expect(onOptionsChange).not.toHaveBeenCalled();
        expect(onGoToOrphan).not.toHaveBeenCalled();

        dialogProps().onExited();

        expect(onGoToOrphan).toHaveBeenCalledTimes(1);
        expect(onGoToOrphan).toHaveBeenCalledWith('Orphan');
    });

    it('does not Go to on blocked cancel', () => {
        const {result} = renderHookWithContext(() =>
            useGraphNodeDelete(blockedOptions, onOptionsChange, onGoToOrphan),
        );

        result.current('X');
        dialogProps().onExited();

        expect(onOptionsChange).not.toHaveBeenCalled();
        expect(onGoToOrphan).not.toHaveBeenCalled();
    });
});
