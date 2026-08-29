// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyFieldOption} from '@mattermost/types/properties';

import {openModal} from 'actions/views/modals';

import {act, renderWithContext, screen, userEvent, waitFor, within} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';

import AttributeGraphDeleteModal from './attribute_graph_delete_modal';
import AttributeOptionsGraphValues from './attribute_options_graph_values';
import {addChildOption, renameOption} from './graph_utils';

jest.mock('actions/views/modals', () => ({
    openModal: jest.fn(() => ({type: 'MOCK_OPEN_MODAL'})),
}));

function getRow(optionName: string, parentName = '') {
    const row = screen.getAllByTestId('attributeOptionsGraphRow').find(
        (el) => el.getAttribute('data-option-name') === optionName && el.getAttribute('data-parent-name') === parentName,
    );
    if (!row) {
        throw new Error(`row not found: ${optionName} @ ${parentName || 'root'}`);
    }
    return row;
}

async function clickRowAddChild(optionName: string, parentName = '') {
    await userEvent.click(within(getRow(optionName, parentName)).getByTestId('attributeOptionsGraphRow__addChild'));
}

async function clickRowParents(optionName: string, parentName = '') {
    await userEvent.click(within(getRow(optionName, parentName)).getByTestId('attributeOptionsGraphRow__parents'));
}

async function clickRowDelete(optionName: string, parentName = '') {
    await userEvent.click(within(getRow(optionName, parentName)).getByTestId('attributeOptionsGraphRow__delete'));
}

async function openItemMenu(optionName: string, parentName = '') {
    await userEvent.click(within(getRow(optionName, parentName)).getByTestId('attributeOptionsGraphRow__name'));
}

describe('AttributeOptionsGraphValues', () => {
    const renderEmpty = (onOptionsChange = jest.fn()) =>
        renderWithContext(
            <AttributeOptionsGraphValues
                options={[]}
                onOptionsChange={onOptionsChange}
            />,
        );

    const tree = (): PropertyFieldOption[] => [
        {id: '', name: 'Air', parents: []},
        {id: '', name: 'Falcon', parents: ['Air']},
        {id: '', name: 'Deepwater', parents: ['Falcon', 'Trident']},
        {id: '', name: 'Maritime', parents: []},
        {id: '', name: 'Trident', parents: ['Maritime']},
    ];

    it('renders helper, empty canvas, footer, and a disabled Add value', () => {
        renderEmpty();

        expect(screen.getByTestId('attributeOptionsGraphEmpty')).toBeInTheDocument();
        expect(screen.getByText('Each value can have parents and children.')).toBeInTheDocument();
        expect(screen.getByText('Add the first value')).toBeInTheDocument();
        expect(screen.getByText('Start with a top-level value. You can add parents and children from its row.')).toBeInTheDocument();
        expect(screen.getByText('Up to 100 parents per value, 100 levels deep.')).toBeInTheDocument();
        expect(screen.getByTestId('attributeOptionsGraphEmpty__addButton')).toBeDisabled();
        expect(screen.getByTestId('attributeOptionsGraphEmpty__addButton')).toHaveClass('btn-primary');
        expect(screen.getByTestId('attributeOptionsGraphEmpty__nameInput')).toHaveAttribute('placeholder', 'Value name');
        expect(screen.queryByTestId('attributeOptionsGraphList')).not.toBeInTheDocument();
    });

    it('does not enable Add value on whitespace', async () => {
        const onOptionsChange = jest.fn();
        renderEmpty(onOptionsChange);

        await userEvent.type(screen.getByTestId('attributeOptionsGraphEmpty__nameInput'), '   ');

        expect(screen.getByTestId('attributeOptionsGraphEmpty__addButton')).toBeDisabled();
        expect(onOptionsChange).not.toHaveBeenCalled();
    });

    it('enables Add value once a trimmed name is present and commits parents: []', async () => {
        const onOptionsChange = jest.fn();
        renderEmpty(onOptionsChange);

        await userEvent.type(screen.getByTestId('attributeOptionsGraphEmpty__nameInput'), '  Root  ');
        expect(screen.getByTestId('attributeOptionsGraphEmpty__addButton')).not.toBeDisabled();

        await userEvent.click(screen.getByTestId('attributeOptionsGraphEmpty__addButton'));

        expect(onOptionsChange).toHaveBeenCalledTimes(1);
        expect(onOptionsChange).toHaveBeenCalledWith([{id: '', name: 'Root', parents: []}]);
        expect(onOptionsChange.mock.calls[0][0][0]).toEqual(expect.objectContaining({parents: []}));
    });

    it('shows the uniqueness alert and does not add a duplicate top-level name', async () => {
        const onOptionsChange = jest.fn();
        const options: PropertyFieldOption[] = [{id: '', name: 'Engineering', parents: []}];
        renderWithContext(
            <AttributeOptionsGraphValues
                options={options}
                onOptionsChange={onOptionsChange}
            />,
        );

        await userEvent.type(screen.getByTestId('attributeOptionsGraphAddTop__nameInput'), 'engineering{Enter}');

        expect(onOptionsChange).not.toHaveBeenCalled();
        expect(screen.getByRole('alert')).toHaveTextContent('"engineering" already exists in this field.');
        expect(screen.getByTestId('attributeOptionsGraphAddTop__nameInput')).toHaveAttribute('aria-invalid', 'true');

        await userEvent.clear(screen.getByTestId('attributeOptionsGraphAddTop__nameInput'));
        await userEvent.type(screen.getByTestId('attributeOptionsGraphAddTop__nameInput'), 'ENGINEERING{Enter}');

        expect(onOptionsChange).not.toHaveBeenCalled();
        expect(screen.getByRole('alert')).toHaveTextContent('"ENGINEERING" already exists in this field.');
    });

    it('disables the empty-state Add value control when disabled', () => {
        renderWithContext(
            <AttributeOptionsGraphValues
                options={[]}
                onOptionsChange={jest.fn()}
                disabled={true}
            />,
        );

        expect(screen.getByTestId('attributeOptionsGraphEmpty__addButton')).toBeDisabled();
        expect(screen.getByTestId('attributeOptionsGraphEmpty__nameInput')).toBeDisabled();
    });

    it('renders a root occurrence row with a placeholder drag handle after the first value', () => {
        renderWithContext(
            <AttributeOptionsGraphValues
                options={[{id: '', name: 'Root', parents: []}]}
                onOptionsChange={jest.fn()}
            />,
        );

        expect(screen.queryByTestId('attributeOptionsGraphEmpty')).not.toBeInTheDocument();
        expect(screen.getByTestId('attributeOptionsGraphList')).toBeInTheDocument();
        expect(screen.getByTestId('attributeOptionsGraphAddTop__nameInput')).toHaveAttribute('placeholder', 'Add a top-level value');
        expect(screen.getByTestId('attributeOptionsGraphAddTop__addButton')).toHaveClass('btn-secondary');
        expect(screen.getByTestId('attributeOptionsGraphAddTop__addButton')).toBeDisabled();

        const row = getRow('Root');
        expect(row).toHaveAttribute('data-depth', '0');
        const handle = within(row).getByTestId('attributeOptionsGraphRow__dragHandle');
        expect(handle).toHaveAttribute('aria-hidden', 'true');
        expect(handle).toHaveAttribute('tabindex', '-1');
        expect(handle).not.toHaveAttribute('tabindex', '0');
        expect(handle.tagName).toBe('SPAN');
    });

    it('keeps Add value secondary after a name is entered', async () => {
        renderWithContext(
            <AttributeOptionsGraphValues
                options={[{id: '', name: 'Root', parents: []}]}
                onOptionsChange={jest.fn()}
            />,
        );

        await userEvent.type(screen.getByTestId('attributeOptionsGraphAddTop__nameInput'), 'Trunk');

        expect(screen.getByTestId('attributeOptionsGraphAddTop__addButton')).not.toBeDisabled();
        expect(screen.getByTestId('attributeOptionsGraphAddTop__addButton')).toHaveClass('btn-secondary');
        expect(screen.getByTestId('attributeOptionsGraphAddTop__addButton')).not.toHaveClass('btn-primary');
    });

    it('adds a trimmed child from the overflow menu as an indented sibling row', async () => {
        const onOptionsChange = jest.fn();
        const options: PropertyFieldOption[] = [{id: '', name: 'Root', parents: []}];
        renderWithContext(
            <AttributeOptionsGraphValues
                options={options}
                onOptionsChange={onOptionsChange}
            />,
        );

        await clickRowAddChild('Root');
        const draftInput = await screen.findByTestId('attributeOptionsGraphRow__childNameInput');

        expect(screen.getByTestId('attributeOptionsGraphRow__childAddButton')).toBeDisabled();
        await userEvent.type(draftInput, '   ');
        expect(screen.getByTestId('attributeOptionsGraphRow__childAddButton')).toBeDisabled();
        expect(onOptionsChange).not.toHaveBeenCalled();

        await userEvent.clear(draftInput);
        await userEvent.type(draftInput, '  Child  ');
        await userEvent.click(screen.getByTestId('attributeOptionsGraphRow__childAddButton'));

        expect(onOptionsChange).toHaveBeenCalledWith(addChildOption(options, 'Child', 'Root'));
    });

    it('cancels the child draft without adding a value', async () => {
        const onOptionsChange = jest.fn();
        const options: PropertyFieldOption[] = [{id: '', name: 'Root', parents: []}];
        renderWithContext(
            <AttributeOptionsGraphValues
                options={options}
                onOptionsChange={onOptionsChange}
            />,
        );

        await clickRowAddChild('Root');
        const draft = await screen.findByTestId('attributeOptionsGraphRow__childDraft');
        expect(draft).toHaveAttribute('data-depth', '1');
        expect(screen.getByTestId('attributeOptionsGraphRow__childNameInput')).toHaveAttribute('placeholder', 'Name the new value');
        expect(screen.getByTestId('attributeOptionsGraphRow__childAddButton')).toBeDisabled();
        expect(screen.getByTestId('attributeOptionsGraphRow__childCancelButton')).toBeEnabled();

        await userEvent.type(screen.getByTestId('attributeOptionsGraphRow__childNameInput'), 'Child');
        await userEvent.click(screen.getByTestId('attributeOptionsGraphRow__childCancelButton'));

        expect(onOptionsChange).not.toHaveBeenCalled();
        expect(screen.queryByTestId('attributeOptionsGraphRow__childDraft')).not.toBeInTheDocument();
    });

    it('dismisses the child draft on Escape', async () => {
        const onOptionsChange = jest.fn();
        renderWithContext(
            <AttributeOptionsGraphValues
                options={[{id: '', name: 'Root', parents: []}]}
                onOptionsChange={onOptionsChange}
            />,
        );

        await clickRowAddChild('Root');
        const draftInput = await screen.findByTestId('attributeOptionsGraphRow__childNameInput');
        await userEvent.type(draftInput, 'Child{Escape}');

        expect(onOptionsChange).not.toHaveBeenCalled();
        expect(screen.queryByTestId('attributeOptionsGraphRow__childDraft')).not.toBeInTheDocument();
    });

    it('renders the new child occurrence under its parent after add', () => {
        const options: PropertyFieldOption[] = [{id: '', name: 'Root', parents: []}];
        const next = addChildOption(options, 'Child', 'Root');
        renderWithContext(
            <AttributeOptionsGraphValues
                options={next}
                onOptionsChange={jest.fn()}
            />,
        );

        expect(getRow('Root')).toHaveAttribute('data-depth', '0');
        const childRow = getRow('Child', 'Root');
        expect(childRow).toHaveAttribute('data-depth', '1');
        expect(childRow).toHaveAttribute('data-parent-name', 'Root');
    });

    it('blocks a duplicate child name with the uniqueness alert', async () => {
        const onOptionsChange = jest.fn();
        const options: PropertyFieldOption[] = [
            {id: '', name: 'Root', parents: []},
            {id: '', name: 'Child', parents: ['Root']},
        ];
        renderWithContext(
            <AttributeOptionsGraphValues
                options={options}
                onOptionsChange={onOptionsChange}
            />,
        );

        await clickRowAddChild('Root');
        const draftInput = await screen.findByTestId('attributeOptionsGraphRow__childNameInput');
        await userEvent.type(draftInput, 'child{Enter}');

        expect(onOptionsChange).not.toHaveBeenCalled();
        expect(screen.getByRole('alert')).toHaveTextContent('"child" already exists in this field.');
    });

    it('renames in place with uniqueness, trim, and a blank no-op', async () => {
        const onOptionsChange = jest.fn();
        const options: PropertyFieldOption[] = [
            {id: '', name: 'Root', parents: []},
            {id: '', name: 'Child', parents: ['Root']},
            {id: '', name: 'Falcon', parents: ['Root']},
        ];
        renderWithContext(
            <AttributeOptionsGraphValues
                options={options}
                onOptionsChange={onOptionsChange}
            />,
        );

        await openItemMenu('Root');
        const input = await screen.findByTestId('attributeGraphParentsPane__nameInput');

        await userEvent.clear(input);
        await userEvent.type(input, 'Child{Enter}');
        expect(onOptionsChange).not.toHaveBeenCalled();
        expect(screen.getByRole('alert')).toHaveTextContent('"Child" already exists in this field.');

        await userEvent.clear(input);
        await userEvent.type(input, '  Trunk  {Enter}');
        expect(onOptionsChange).toHaveBeenCalledWith(renameOption(options, 'Root', 'Trunk'));
    });

    it('does not call onOptionsChange when rename is cleared to blank', async () => {
        const onOptionsChange = jest.fn();
        const options: PropertyFieldOption[] = [{id: '', name: 'Root', parents: []}];
        renderWithContext(
            <AttributeOptionsGraphValues
                options={options}
                onOptionsChange={onOptionsChange}
            />,
        );

        await openItemMenu('Root');
        const input = await screen.findByTestId('attributeGraphParentsPane__nameInput');
        await userEvent.clear(input);
        await userEvent.type(input, '{Enter}');

        expect(onOptionsChange).not.toHaveBeenCalled();
        expect(screen.getByTestId('attributeOptionsGraphRow__name')).toHaveTextContent('Root');
    });

    it('shows a 2 parents badge on every dual occurrence and indents by path depth', () => {
        renderWithContext(
            <AttributeOptionsGraphValues
                options={tree()}
                onOptionsChange={jest.fn()}
            />,
        );

        const deepwaterRows = screen.getAllByTestId('attributeOptionsGraphRow').filter(
            (row) => row.getAttribute('data-option-name') === 'Deepwater',
        );
        expect(deepwaterRows).toHaveLength(2);
        expect(getRow('Deepwater', 'Falcon')).toHaveAttribute('data-depth', '2');
        expect(getRow('Deepwater', 'Trident')).toHaveAttribute('data-depth', '2');
        expect(getRow('Air')).toHaveAttribute('data-depth', '0');
        expect(getRow('Maritime')).toHaveAttribute('data-depth', '0');

        const badges = screen.getAllByTestId('attributeOptionsGraphRow__parentsBadge');
        expect(badges).toHaveLength(2);
        expect(badges[0]).toHaveTextContent('2 parents');
        expect(badges[1]).toHaveTextContent('2 parents');
        expect(within(getRow('Falcon', 'Air')).queryByTestId('attributeOptionsGraphRow__parentsBadge')).not.toBeInTheDocument();
        const dualRow = getRow('Deepwater', 'Falcon');
        expect(within(dualRow).getByTestId('attributeOptionsGraphRow__name').nextElementSibling).toBe(
            within(dualRow).getByTestId('attributeOptionsGraphRow__parentsBadge'),
        );
    });

    it('collapses descendants of that occurrence without hiding the same value under another parent', async () => {
        renderWithContext(
            <AttributeOptionsGraphValues
                options={tree()}
                onOptionsChange={jest.fn()}
            />,
        );

        expect(within(getRow('Air')).getByTestId('attributeOptionsGraphRow__collapse')).toHaveAttribute('aria-expanded', 'true');
        expect(within(getRow('Maritime')).queryByTestId('attributeOptionsGraphRow__collapse')).toBeInTheDocument();
        expect(within(getRow('Deepwater', 'Falcon')).queryByTestId('attributeOptionsGraphRow__collapse')).not.toBeInTheDocument();

        await userEvent.click(within(getRow('Air')).getByTestId('attributeOptionsGraphRow__collapse'));

        expect(screen.queryAllByTestId('attributeOptionsGraphRow').find(
            (el) => el.getAttribute('data-option-name') === 'Falcon',
        )).toBeUndefined();
        expect(getRow('Deepwater', 'Trident')).toBeInTheDocument();
        expect(getRow('Trident', 'Maritime')).toBeInTheDocument();
        expect(getRow('Air')).toHaveAttribute('aria-expanded', 'false');

        await userEvent.click(within(getRow('Air')).getByTestId('attributeOptionsGraphRow__collapse'));
        expect(getRow('Falcon', 'Air')).toBeInTheDocument();
        expect(getRow('Deepwater', 'Falcon')).toBeInTheDocument();
    });

    it('opens the Parents pane from the parents badge', async () => {
        renderWithContext(
            <AttributeOptionsGraphValues
                options={tree()}
                onOptionsChange={jest.fn()}
            />,
        );

        await userEvent.click(within(getRow('Deepwater', 'Falcon')).getByTestId('attributeOptionsGraphRow__parentsBadge'));
        expect(await screen.findByTestId('attributeGraphParentsPane__back')).toHaveTextContent('Parents of Deepwater');
        expect(screen.queryByText(/sits under/i)).not.toBeInTheDocument();
        expect(screen.getByTestId('attributeOptionsGraphRow__parentsAnchor').tagName).toBe('DIV');
    });

    it('indents dual occurrences by their own path depth, not maxDepth', () => {
        const options: PropertyFieldOption[] = [
            {id: '', name: 'A', parents: []},
            {id: '', name: 'B', parents: ['A']},
            {id: '', name: 'E', parents: ['B']},
            {id: '', name: 'C', parents: ['A']},
            {id: '', name: 'D', parents: ['E', 'C']},
        ];
        renderWithContext(
            <AttributeOptionsGraphValues
                options={options}
                onOptionsChange={jest.fn()}
            />,
        );

        expect(getRow('D', 'E')).toHaveAttribute('data-depth', '3');
        expect(getRow('D', 'C')).toHaveAttribute('data-depth', '2');
    });

    it('shows hover actions for add child, parents, and delete; clicking the name opens the item submenu', async () => {
        const onOptionsChange = jest.fn();
        renderWithContext(
            <AttributeOptionsGraphValues
                options={[{id: '', name: 'Root', parents: []}]}
                onOptionsChange={onOptionsChange}
            />,
        );

        const row = getRow('Root');
        expect(within(row).getByTestId('attributeOptionsGraphRow__addChild')).toBeInTheDocument();
        expect(within(row).getByTestId('attributeOptionsGraphRow__parents')).toBeInTheDocument();
        expect(within(row).getByTestId('attributeOptionsGraphRow__delete')).toBeInTheDocument();
        expect(within(row).queryByTestId('attributeOptionsGraphRow__menu')).not.toBeInTheDocument();
        expect(within(row).queryByTestId('attributeOptionsGraphRow__collapse')).not.toBeInTheDocument();

        await openItemMenu('Root');
        expect(await screen.findByTestId('attributeGraphParentsPane__nameInput')).toHaveValue('Root');
        expect(screen.getByTestId('attributeGraphParentsPane__openParents')).toHaveTextContent('Top level');
        expect(screen.getByTestId('attributeGraphParentsPane__openChildren')).toHaveTextContent('None');
        expect(screen.getByRole('menuitem', {name: 'Delete this value'})).toBeInTheDocument();

        await clickRowDelete('Root');
        expect(onOptionsChange).not.toHaveBeenCalled();
    });

    it('opens the children submenu from the item menu and grants a new child', async () => {
        const onOptionsChange = jest.fn();
        const options: PropertyFieldOption[] = [{id: '', name: 'Root', parents: []}];
        renderWithContext(
            <AttributeOptionsGraphValues
                options={options}
                onOptionsChange={onOptionsChange}
            />,
        );

        await openItemMenu('Root');
        await userEvent.click(await screen.findByTestId('attributeGraphParentsPane__openChildren'));
        expect(screen.getByTestId('attributeGraphParentsPane__back')).toHaveTextContent('Children of Root');
        expect(screen.getByTestId('attributeGraphParentsPane__childrenEmpty')).toHaveTextContent('No children yet.');

        await userEvent.type(screen.getByTestId('attributeGraphParentsPane__childSearch'), 'Wing');
        await userEvent.click(screen.getByTestId('attributeGraphParentsPane__createChild'));

        expect(onOptionsChange).toHaveBeenCalledWith(addChildOption(options, 'Wing', 'Root'));
    });

    it('keeps occurrence rows as a flat list with no nested lists', () => {
        renderWithContext(
            <AttributeOptionsGraphValues
                options={tree()}
                onOptionsChange={jest.fn()}
            />,
        );

        const list = screen.getByTestId('attributeOptionsGraphList');
        expect(within(list).queryByRole('list')).toBeNull();
        expect(list.querySelectorAll(':scope > li')).toHaveLength(screen.getAllByTestId('attributeOptionsGraphRow').length);
    });
});

describe('AttributeOptionsGraphValues delete wiring', () => {
    const blockedOptions = (): PropertyFieldOption[] => [
        {id: '', name: 'X', parents: []},
        {id: '', name: 'Keep', parents: []},
        {id: '', name: 'Orphan', parents: ['X']},
        {id: '', name: 'Shared', parents: ['X', 'Keep']},
    ];

    const dialogProps = () => (openModal as jest.Mock).mock.calls[0][0].dialogProps;

    beforeEach(() => {
        (openModal as jest.Mock).mockClear();
        HTMLElement.prototype.scrollIntoView = jest.fn();
    });

    it('keeps the row Delete action enabled on a node with an exclusive child', async () => {
        renderWithContext(
            <AttributeOptionsGraphValues
                options={blockedOptions()}
                onOptionsChange={jest.fn()}
            />,
        );

        expect(within(getRow('X')).getByTestId('attributeOptionsGraphRow__delete')).not.toBeDisabled();
    });

    it('opens GRAPH_NODE_DELETE from the row Delete action', async () => {
        const options = blockedOptions();
        renderWithContext(
            <AttributeOptionsGraphValues
                options={options}
                onOptionsChange={jest.fn()}
            />,
        );

        await clickRowDelete('X');

        await waitFor(() => {
            expect(openModal).toHaveBeenCalledWith({
                modalId: ModalIdentifiers.GRAPH_NODE_DELETE,
                dialogType: AttributeGraphDeleteModal,
                dialogProps: {
                    optionName: 'X',
                    options,
                    onConfirm: expect.any(Function),
                    onExited: expect.any(Function),
                },
            });
        });
    });

    it('opens GRAPH_NODE_DELETE from the Parents pane Delete this value', async () => {
        const options = blockedOptions();
        renderWithContext(
            <AttributeOptionsGraphValues
                options={options}
                onOptionsChange={jest.fn()}
            />,
        );

        await clickRowParents('X');
        await userEvent.click(await screen.findByTestId('attributeGraphParentsPane__back'));
        const paneDelete = await screen.findByRole('menuitem', {name: 'Delete this value'});
        await userEvent.click(paneDelete);

        expect(openModal).toHaveBeenCalledTimes(1);
        expect(openModal).toHaveBeenCalledWith({
            modalId: ModalIdentifiers.GRAPH_NODE_DELETE,
            dialogType: AttributeGraphDeleteModal,
            dialogProps: {
                optionName: 'X',
                options,
                onConfirm: expect.any(Function),
                onExited: expect.any(Function),
            },
        });
    });

    it('focuses the first orphan row on Go-to after the modal exits, not on confirm', async () => {
        renderWithContext(
            <AttributeOptionsGraphValues
                options={blockedOptions()}
                onOptionsChange={jest.fn()}
            />,
        );

        await clickRowDelete('X');
        await waitFor(() => {
            expect(openModal).toHaveBeenCalled();
        });

        const orphanRow = getRow('Orphan', 'X');
        dialogProps().onConfirm();
        expect(document.activeElement).not.toBe(orphanRow);

        dialogProps().onExited();
        expect(orphanRow).toHaveFocus();
        expect(orphanRow.scrollIntoView).toHaveBeenCalledWith({block: 'nearest'});
    });

    it('closes the Parents pane when Go-to focuses the orphan after the modal exits', async () => {
        renderWithContext(
            <AttributeOptionsGraphValues
                options={blockedOptions()}
                onOptionsChange={jest.fn()}
            />,
        );

        await clickRowParents('X');
        expect(await screen.findByTestId('attributeGraphParentsPane__back')).toHaveTextContent('Parents of X');
        await userEvent.click(screen.getByTestId('attributeGraphParentsPane__back'));
        expect(await screen.findByTestId('attributeGraphParentsPane__nameInput')).toHaveValue('X');

        await userEvent.click(screen.getByRole('menuitem', {name: 'Delete this value'}));
        await waitFor(() => {
            expect(openModal).toHaveBeenCalled();
        });

        const orphanRow = getRow('Orphan', 'X');
        act(() => {
            dialogProps().onConfirm();
        });
        expect(document.activeElement).not.toBe(orphanRow);
        expect(screen.getByTestId('attributeGraphParentsPane__nameInput')).toBeInTheDocument();

        act(() => {
            dialogProps().onExited();
        });
        expect(orphanRow).toHaveFocus();
        expect(screen.queryByTestId('attributeGraphParentsPane__nameInput')).not.toBeInTheDocument();
    });

    it('closes the Parents pane when another row add-child action opens', async () => {
        renderWithContext(
            <AttributeOptionsGraphValues
                options={blockedOptions()}
                onOptionsChange={jest.fn()}
            />,
        );

        await clickRowParents('X');
        expect(await screen.findByTestId('attributeGraphParentsPane__back')).toHaveTextContent('Parents of X');

        await clickRowAddChild('Orphan', 'X');

        expect(screen.queryByTestId('attributeGraphParentsPane__back')).not.toBeInTheDocument();
        expect(within(getRow('Orphan', 'X')).getByTestId('attributeOptionsGraphRow__delete')).not.toBeDisabled();
        expect(screen.getByTestId('attributeOptionsGraphRow__childNameInput')).toBeInTheDocument();
    });
});
