// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {BoardsPropertyField} from '@mattermost/types/properties_board';

import {fireEvent, renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import DotMenu from './board_attributes_dot_menu';

function makeField(overrides: Partial<BoardsPropertyField> = {}): BoardsPropertyField {
    return {
        id: 'field-1',
        name: 'My Attribute',
        type: 'text',
        group_id: 'boards',
        object_type: 'post',
        create_at: 1700000000000,
        delete_at: 0,
        update_at: 1700000000000,
        created_by: '',
        updated_by: '',
        target_id: '',
        target_type: 'system',
        attrs: {sort_order: 0},
        ...overrides,
    } as BoardsPropertyField;
}

function renderMenu(overrides: Partial<React.ComponentProps<typeof DotMenu>> = {}) {
    const props = {
        field: makeField(),
        canCreate: true,
        createField: jest.fn(),
        deleteField: jest.fn(),
        ...overrides,
    };
    renderWithContext(<DotMenu {...props}/>);
    return props;
}

describe('Board attributes DotMenu', () => {
    it('disables the trigger button when the field is flagged for delete', () => {
        renderMenu({field: makeField({delete_at: 1700000099999})});

        expect(screen.getByTestId('board-attribute-field_dotmenu-field-1')).toBeDisabled();
    });

    it('exposes Duplicate and Delete items when canCreate=true and field is not protected', async () => {
        renderMenu();

        await userEvent.click(screen.getByTestId('board-attribute-field_dotmenu-field-1'));

        expect(screen.getByText('Duplicate')).toBeInTheDocument();
        expect(screen.getByText('Delete attribute')).toBeInTheDocument();
    });

    it('hides the Duplicate item when canCreate=false', async () => {
        renderMenu({canCreate: false});

        await userEvent.click(screen.getByTestId('board-attribute-field_dotmenu-field-1'));

        expect(screen.queryByText('Duplicate')).not.toBeInTheDocument();
        expect(screen.getByText('Delete attribute')).toBeInTheDocument();
    });

    it('disables both items when the field is protected (and clicking them does NOT call createField/deleteField)', async () => {
        const props = renderMenu({field: makeField({protected: true})});

        await userEvent.click(screen.getByTestId('board-attribute-field_dotmenu-field-1'));

        // Find the actual menuitem elements by role rather than walking up from
        // text — the role query asserts the menuitem exists, and toBeDisabled()
        // handles both `disabled` and `aria-disabled` styles uniformly.
        const menuitems = screen.getAllByRole('menuitem');
        const duplicate = menuitems.find((el) => el.textContent?.includes('Duplicate'));
        const del = menuitems.find((el) => el.textContent?.includes('Delete attribute'));

        expect(duplicate).toBeDefined();
        expect(del).toBeDefined();

        // Menu.Item renders <li role="menuitem">; the lib uses aria-disabled
        // rather than the HTML `disabled` attribute (which has no meaning on <li>).
        expect(duplicate!).toHaveAttribute('aria-disabled', 'true');
        expect(del!).toHaveAttribute('aria-disabled', 'true');

        // Behavioural check: dispatching a synthetic click anyway is a no-op for
        // protected fields. userEvent.click refuses pointer-events:none elements
        // (which disabled menu items have), so use fireEvent.click to bypass that
        // safety and exercise the source's `if (isProtected) return` guards.
        fireEvent.click(duplicate!);
        fireEvent.click(del!);
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(props.createField).not.toHaveBeenCalled();
        expect(props.deleteField).not.toHaveBeenCalled();
    });

    it('invokes createField with the source field name when Duplicate is clicked', async () => {
        const props = renderMenu({field: makeField({name: 'Priority'})});

        await userEvent.click(screen.getByTestId('board-attribute-field_dotmenu-field-1'));
        const duplicate = screen.getByText('Duplicate').closest('[role="menuitem"]') as HTMLElement;
        await userEvent.click(duplicate);

        // Menu.Item defers onClick for non-radio items until after the menu close animation completes
        await waitFor(() => expect(props.createField).toHaveBeenCalledTimes(1));
        const createFieldMock = props.createField as jest.Mock;
        const passed = createFieldMock.mock.calls[0][0] as BoardsPropertyField;
        expect(passed.name).toBe('Priority');

        // attrs should be a shallow copy, not the original reference
        expect(passed.attrs).not.toBe(props.field.attrs);
    });

    it('skips the confirm prompt and deletes immediately when the field is create-pending (never saved)', async () => {
        const pendingField = makeField({
            create_at: 0,
            delete_at: 0,
            id: 'pending_abc',
        });
        const props = renderMenu({field: pendingField});

        await userEvent.click(screen.getByTestId('board-attribute-field_dotmenu-pending_abc'));
        const del = screen.getByText('Delete attribute').closest('[role="menuitem"]') as HTMLElement;
        await userEvent.click(del);

        // No confirm dialog is opened — deleteField is called directly with the field id
        await waitFor(() => expect(props.deleteField).toHaveBeenCalledWith('pending_abc'));
        expect(screen.queryByRole('heading', {name: /delete board attribute/i})).not.toBeInTheDocument();
    });

    it('does NOT delete a saved field immediately (the confirm-modal branch defers via dispatch(openModal))', async () => {
        // For saved fields (create_at > 0) the menu dispatches an openModal action
        // through useBoardAttributeFieldDelete instead of calling deleteField directly.
        // The modal renders via the global ModalController which isn't mounted in
        // this test wrapper, so we verify the negative path: deleteField stays
        // un-called after clicking Delete (proving the prompt branch was taken).
        const props = renderMenu();

        await userEvent.click(screen.getByTestId('board-attribute-field_dotmenu-field-1'));
        const del = screen.getByText('Delete attribute').closest('[role="menuitem"]') as HTMLElement;
        await userEvent.click(del);

        // The pending-path test above proves the deferred Menu.Item onClick *does*
        // call deleteField for create-pending fields. For a saved field the source
        // calls `promptDelete().then(...)` — `deleteField` only fires from inside
        // the resolved `.then()`, which can't resolve in this test because no
        // ModalController is mounted. Flush microtasks once to let the deferred
        // onClick run, then assert deleteField stayed un-called.
        await waitFor(() => {
            // Wait for the deferred onClick to have *had a chance* to fire by
            // asserting the menu is closed (close fires the deferred handler).
            expect(screen.queryByText('Delete attribute')).not.toBeInTheDocument();
        });
        expect(props.deleteField).not.toHaveBeenCalled();
    });
});
