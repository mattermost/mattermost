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

describe('buildGraphNodeDeleteViewModel', () => {
    it('returns null for an unknown name', () => {
        expect(buildGraphNodeDeleteViewModel([opt('A')], 'Nope')).toBeNull();
    });

    it('returns blocked for a direct exclusive child and ignores a grandchild', () => {
        expect(buildGraphNodeDeleteViewModel(blockedOptions, 'X')).toEqual({
            variant: 'blocked',
            optionName: 'X',
            orphans: ['Orphan'],
            notAffected: [{name: 'Shared', remainingParents: ['Keep']}],
            firstOrphan: 'Orphan',
        });
    });

    it('returns the G8 safe diamond fixture', () => {
        expect(buildGraphNodeDeleteViewModel(diamondOptions, 'B')).toEqual({
            variant: 'safe',
            optionName: 'B',
            descendantCount: 1,
            accessRemoved: [
                {target: 'B', parentsThatLost: ['A']},
                {target: 'C', parentsThatLost: ['A']},
            ],
            staysReachable: [{child: 'C', remainingParents: ['D']}],
        });
    });

    it('returns descendantCount 0 for a leaf with one access-removed line', () => {
        expect(buildGraphNodeDeleteViewModel(leafOptions, 'B')).toEqual({
            variant: 'safe',
            optionName: 'B',
            descendantCount: 0,
            accessRemoved: [{target: 'B', parentsThatLost: ['A']}],
            staysReachable: [],
        });
    });

    it('returns empty sections when deleting an isolated root', () => {
        expect(buildGraphNodeDeleteViewModel([opt('Only')], 'Only')).toEqual({
            variant: 'safe',
            optionName: 'Only',
            descendantCount: 0,
            accessRemoved: [],
            staysReachable: [],
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

    it('shows the singular move-first title and lead', () => {
        renderBlocked();

        expect(screen.getByRole('heading', {name: 'Move one value first'})).toBeInTheDocument();
        expect(screen.getByText('Deleting "X" would leave "Orphan" with no parent. Move it under something else first.')).toBeInTheDocument();
    });

    it('lists orphans under Would be left with no parent', () => {
        renderBlocked();

        expect(screen.getByText('Would be left with no parent')).toBeInTheDocument();
        expect(screen.getByText('Orphan')).toBeInTheDocument();
        expect(screen.getByText('"X" is its only parent')).toBeInTheDocument();
    });

    it('shows Not affected when a sibling still has another parent', () => {
        renderBlocked();

        expect(screen.getByText('Not affected')).toBeInTheDocument();
        expect(screen.getByText('"Shared" is not affected — it also sits under "Keep".')).toBeInTheDocument();
        expect(screen.getByText('A value with another parent stays in the list, so it never blocks a delete.')).toBeInTheDocument();
    });

    it('uses a non-destructive Go to primary that calls onConfirm', async () => {
        const props = renderBlocked();

        const goTo = screen.getByRole('button', {name: 'Go to "Orphan"'});
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

    it('uses plural title, Move them, and the first orphan for Go to', () => {
        renderBlocked(twoExclusiveChildren, 'X');

        expect(screen.getByRole('heading', {name: 'Move 2 values first'})).toBeInTheDocument();
        expect(screen.getByText('Deleting "X" would leave "A" and "B" with no parent. Move them under something else first.')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Go to "A"'})).toBeInTheDocument();
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

    it('shows the nothing-else lead and a destructive confirm for a leaf', async () => {
        const props = renderSafe(leafOptions, 'B');

        expect(screen.getByRole('heading', {name: 'Delete "B"?'})).toBeInTheDocument();
        expect(screen.getByText('This removes access, not just a row')).toBeInTheDocument();
        expect(screen.getByText('"B" grants access to nothing else, so deleting it only removes the value itself.')).toBeInTheDocument();

        const confirm = screen.getByRole('button', {name: 'Delete the value'});
        expect(confirm).toHaveClass('delete');
        expect(confirm).toHaveClass('btn-danger');

        await userEvent.click(confirm);

        expect(props.onConfirm).toHaveBeenCalledTimes(1);
    });

    it('shows Access removed and Stays reachable for the diamond fixture', () => {
        renderSafe(diamondOptions, 'B');

        expect(screen.getByText('"B" grants access to 1 value. Deleting it removes those routes.')).toBeInTheDocument();
        expect(screen.getByText('Access removed')).toBeInTheDocument();
        expect(screen.getByText('Holders of "A" can no longer reach "B".')).toBeInTheDocument();
        expect(screen.getByText('Holders of "A" can no longer reach "C".')).toBeInTheDocument();
        expect(screen.getByText('Stays reachable')).toBeInTheDocument();
        expect(screen.getByText('"C" stays under "D".')).toBeInTheDocument();
    });

    it('uses the plural grants-access lead when there are two descendants', () => {
        renderSafe(twoDescendants, 'B');

        expect(screen.getByText('"B" grants access to 2 values. Deleting it removes those routes.')).toBeInTheDocument();
    });

    it('does not call onConfirm when Cancel is clicked', async () => {
        const props = renderSafe(leafOptions, 'B');

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
