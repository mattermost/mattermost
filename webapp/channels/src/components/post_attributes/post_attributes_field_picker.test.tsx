// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import userEvent from '@testing-library/user-event';
import type {ComponentType} from 'react';
import React from 'react';

import {
    AccountMultipleOutlineIcon,
    AccountOutlineIcon,
    FormatListBulletedIcon,
    FormatListNumberedIcon,
    MenuDownIcon,
    MenuVariantIcon,
} from '@mattermost/compass-icons/components';
import type IconProps from '@mattermost/compass-icons/components/props';
import type {FieldType, PropertyField} from '@mattermost/types/properties';

import ModalController from 'components/modal_controller';

import {render, renderWithContext, screen, waitFor, within} from 'tests/react_testing_utils';
import {WindowSizes} from 'utils/constants';

import PostAttributesFieldPicker from './post_attributes_field_picker';

const GROUP_ID = 'group_id';
const CHANNEL_ID = 'channel_id';

const SCOPE = 'picker';

// An item is keyed by its field's id and the tests name fields by name, so every field made is recorded here.
const fieldIds: Record<string, string> = {};

function addItemId(name: string): string {
    return `${SCOPE}.add_menu.field:${fieldIds[name] ?? name}--menuitem`;
}

function makeField(overrides: Partial<PropertyField> = {}): PropertyField {
    const field = makeFieldWith(overrides);
    fieldIds[field.name] = field.id;

    return field;
}

function makeFieldWith(overrides: Partial<PropertyField>): PropertyField {
    return {
        id: 'field_1',
        group_id: GROUP_ID,
        name: 'classification',
        type: 'select',
        object_type: 'post',
        target_type: 'channel',
        target_id: CHANNEL_ID,
        attrs: {},
        permission_values: 'member',
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        created_by: 'user_1',
        updated_by: 'user_1',
        ...overrides,
    };
}

/*
 * Compass icons render a bare `<svg>` with one `<path>` and carry no class or
 * test id, so the only thing that identifies which icon was drawn is the path
 * itself. Read off the component rather than written down here, so the
 * assertion survives the icon set being redrawn and still fails if the mapping
 * changes.
 */
function pathOf(Icon: ComponentType<IconProps>): string {
    const {container, unmount} = render(<Icon size={16}/>);
    const drawn = container.querySelector('path')?.getAttribute('d') ?? '';
    unmount();
    return drawn;
}

function iconIn(item: HTMLElement): SVGSVGElement | null {
    return item.querySelector('svg');
}

function renderPicker(fields: PropertyField[], onSelect: (fieldId: string) => void = jest.fn()) {
    return renderWithContext(
        <PostAttributesFieldPicker
            testIdScope={SCOPE}
            fields={fields}
            onSelect={onSelect}
        />,
    );
}

async function openPicker() {
    await userEvent.click(screen.getByTestId(`${SCOPE}.add--button`));
}

describe('PostAttributesFieldPicker', () => {
    test('uses the modal\'s id unless given its own, and carries test ids only with a scope', () => {
        const {unmount} = renderPicker([makeField()]);

        expect(screen.getByTestId(`${SCOPE}.add--button`)).toHaveAttribute('id', 'postAttributesAdd');

        unmount();

        renderWithContext(
            <PostAttributesFieldPicker
                id='composerAdd'
                testIdScope='composer'
                fields={[makeField()]}
                onSelect={jest.fn()}
            />,
        );

        expect(screen.queryByTestId(`${SCOPE}.add--button`)).not.toBeInTheDocument();
        expect(screen.getByTestId('composer.add--button')).toHaveAttribute('id', 'composerAdd');
    });

    test('two pickers with their own ids do not share an id, a test id or a menu id', async () => {
        renderWithContext(
            <>
                <PostAttributesFieldPicker
                    id='firstAdd'
                    testIdScope='first'
                    fields={[makeField()]}
                    onSelect={jest.fn()}
                />
                <PostAttributesFieldPicker
                    id='secondAdd'
                    testIdScope='second'
                    fields={[makeField()]}
                    onSelect={jest.fn()}
                />
            </>,
        );

        const first = screen.getByTestId('first.add--button');
        const second = screen.getByTestId('second.add--button');

        expect(first.id).not.toBe(second.id);
        expect(first.getAttribute('aria-controls')).not.toBe(second.getAttribute('aria-controls'));

        await userEvent.click(second);

        expect(screen.getByRole('menu', {name: 'Add an attribute'})).toHaveAttribute('id', 'secondAddMenu');
    });

    test('draws an icon button labelled by the caller in place of the labelled button', async () => {
        const onSelect = jest.fn();

        renderWithContext(
            <PostAttributesFieldPicker
                testIdScope={SCOPE}
                fields={[makeField({id: 'f_a', name: 'alpha'})]}
                onSelect={onSelect}
                trigger={{
                    label: 'Add attributes',
                    icon: <span data-testid='custom-icon'/>,
                }}
            />,
        );

        expect(screen.queryByText('Add attribute')).not.toBeInTheDocument();

        const button = screen.getByRole('button', {name: 'Add attributes'});
        expect(button).toHaveAttribute('data-testid', `${SCOPE}.add--button`);
        expect(button).toContainElement(screen.getByTestId('custom-icon'));

        await userEvent.click(button);
        await userEvent.click(screen.getByTestId(addItemId('alpha')));

        await waitFor(() => expect(onSelect).toHaveBeenCalledWith('f_a'));
    });

    test('offers one item per field, in the order it was given them', async () => {
        const fields = [
            makeField({id: 'f_c', name: 'caveats'}),
            makeField({id: 'f_a', name: 'alpha'}),
            makeField({id: 'f_b', name: 'beta'}),
        ];

        renderPicker(fields);

        await openPicker();

        expect(screen.getByRole('menu', {name: 'Add an attribute'})).toBeInTheDocument();

        // Deliberately not in sort or alphabetical order: the hook that builds
        // the candidate list orders it, and the menu has to read the same way
        // the rows above it do.
        expect(screen.getAllByRole('menuitem').map((item) => item.getAttribute('data-testid'))).toEqual([
            addItemId('caveats'),
            addItemId('alpha'),
            addItemId('beta'),
        ]);
    });

    test('draws each type its own icon', async () => {
        const expected: Array<[FieldType, ComponentType<IconProps>]> = [
            ['select', MenuDownIcon],
            ['multiselect', FormatListBulletedIcon],
            ['rank', FormatListNumberedIcon],
            ['text', MenuVariantIcon],
            ['user', AccountOutlineIcon],
            ['multiuser', AccountMultipleOutlineIcon],
        ];

        const paths = expected.map(([, Icon]) => pathOf(Icon));

        // Otherwise the mapping could be wrong in every entry and still pass.
        expect(new Set(paths).size).toBe(expected.length);

        const fields = expected.map(([type]) => makeField({id: `f_${type}`, name: type, type}));

        renderPicker([...fields, makeField({id: 'f_date', name: 'date', type: 'date'})]);

        await openPicker();

        expected.forEach(([type], index) => {
            const icon = iconIn(screen.getByTestId(addItemId(type)));

            expect(icon?.querySelector('path')?.getAttribute('d')).toBe(paths[index]);
            expect(icon).toHaveAttribute('height', '18');
        });

        /*
         * `date` has no icon because it has no control that could write it, so
         * the candidate hook never offers one and this menu never sees it. If a
         * `date` control ever lands, the field becomes a candidate and this
         * assertion is what says the icon table has to grow with it.
         */
        expect(iconIn(screen.getByTestId(addItemId('date')))).toBeNull();
    });

    test('calls onSelect once with the field id of the item clicked', async () => {
        const onSelect = jest.fn();

        renderPicker([makeField({id: 'f_a', name: 'alpha'}), makeField({id: 'f_b', name: 'beta'})], onSelect);

        await openPicker();
        await userEvent.click(screen.getByTestId(addItemId('beta')));

        // A plain `menuitem` defers its `onClick` until the close animation has
        // run, so the call has not happened yet at the point the click returns.
        await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1));
        expect(onSelect).toHaveBeenCalledWith('f_b');
    });

    describe('search', () => {
        function fiveFields() {
            return [
                makeField({id: 'f_a', name: 'alpha', attrs: {display_name: 'Priority'}}),
                makeField({id: 'f_b', name: 'bravo', attrs: {display_name: 'Risk'}}),
                makeField({id: 'f_c', name: 'charlie', attrs: {display_name: 'Owner'}}),
                makeField({id: 'f_d', name: 'delta', attrs: {display_name: 'Tags'}}),
                makeField({id: 'f_e', name: 'echo', attrs: {display_name: 'Notes'}}),
            ];
        }

        test('has no search box below five fields', async () => {
            renderPicker(fiveFields().slice(0, 4));
            await openPicker();

            expect(screen.queryByTestId(`${SCOPE}.add_menu.search--textbox`)).not.toBeInTheDocument();
        });

        test('from five fields, focuses a search box that filters by label and by name', async () => {
            renderPicker(fiveFields());
            await openPicker();

            const search = screen.getByRole('searchbox', {name: 'Search attributes'});
            await waitFor(() => expect(search).toHaveFocus());

            await userEvent.type(search, 'ri');
            expect(screen.getAllByRole('menuitem').map((item) => item.getAttribute('data-testid'))).toEqual([
                addItemId('alpha'),
                addItemId('bravo'),
            ]);

            await userEvent.clear(search);
            await userEvent.type(search, 'ECHO');
            expect(screen.getAllByRole('menuitem').map((item) => item.getAttribute('data-testid'))).toEqual([addItemId('echo')]);
        });

        test('a search that matches nothing says so, and the line cannot be picked', async () => {
            const onSelect = jest.fn();
            renderPicker(fiveFields(), onSelect);
            await openPicker();

            const search = screen.getByRole('searchbox', {name: 'Search attributes'});
            await waitFor(() => expect(search).toHaveFocus());
            await userEvent.type(search, 'zzz');

            const noResults = screen.getByTestId(`${SCOPE}.add_menu.no_results--menuitem`);
            expect(noResults).toHaveTextContent('No matching attributes');
            expect(noResults).toHaveAttribute('aria-disabled', 'true');
            expect(screen.getAllByRole('menuitem')).toEqual([noResults]);

            await userEvent.clear(search);
            expect(screen.queryByTestId(`${SCOPE}.add_menu.no_results--menuitem`)).not.toBeInTheDocument();
            expect(onSelect).not.toHaveBeenCalled();
        });

        test('a search of only spaces lists every field and no empty message', async () => {
            renderPicker(fiveFields());
            await openPicker();

            const search = screen.getByRole('searchbox', {name: 'Search attributes'});
            await waitFor(() => expect(search).toHaveFocus());
            await userEvent.type(search, '   ');

            expect(screen.getAllByRole('menuitem')).toHaveLength(5);
            expect(screen.queryByTestId(`${SCOPE}.add_menu.no_results--menuitem`)).not.toBeInTheDocument();
        });

        test('dropping below five fields while a search is active removes the search and its filter', async () => {
            const {rerender} = renderPicker(fiveFields());
            await openPicker();

            const search = screen.getByRole('searchbox', {name: 'Search attributes'});
            await waitFor(() => expect(search).toHaveFocus());
            await userEvent.type(search, 'echo');
            expect(screen.getAllByRole('menuitem')).toHaveLength(1);

            rerender(
                <PostAttributesFieldPicker
                    fields={fiveFields().slice(0, 4)}
                    onSelect={jest.fn()}
                />,
            );

            expect(screen.queryByRole('searchbox', {name: 'Search attributes'})).not.toBeInTheDocument();
            expect(screen.getAllByRole('menuitem')).toHaveLength(4);
        });

        test('ArrowDown moves from the search box into the list', async () => {
            renderPicker(fiveFields());
            await openPicker();

            const search = screen.getByRole('searchbox', {name: 'Search attributes'});
            await waitFor(() => expect(search).toHaveFocus());
            await userEvent.keyboard('{ArrowDown}');

            expect(screen.getByTestId(addItemId('alpha'))).toHaveFocus();
        });

        test('Escape in the search box closes the menu and picks nothing; reopening starts a fresh search', async () => {
            const onSelect = jest.fn();
            renderPicker(fiveFields(), onSelect);
            await openPicker();

            const search = screen.getByRole('searchbox', {name: 'Search attributes'});
            await waitFor(() => expect(search).toHaveFocus());
            await userEvent.type(search, 'risk');
            await userEvent.keyboard('{Escape}');

            await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
            expect(onSelect).not.toHaveBeenCalled();

            await openPicker();
            expect(screen.getByRole('searchbox', {name: 'Search attributes'})).toHaveValue('');
            expect(screen.getAllByRole('menuitem')).toHaveLength(5);
        });

        // In mobile view the menu opens as a modal, which keeps the header and
        // items it was opened with, so these check the modal follows the search.
        describe('in mobile view', () => {
            function renderMobilePicker(onSelect: (fieldId: string) => void = jest.fn()) {
                return renderWithContext(
                    <>
                        <PostAttributesFieldPicker
                            testIdScope={SCOPE}
                            fields={fiveFields()}
                            onSelect={onSelect}
                        />
                        <ModalController/>
                    </>,
                    {views: {browser: {windowSize: WindowSizes.MOBILE_VIEW}}},
                );
            }

            function modalItems() {
                return within(screen.getByRole('dialog')).getAllByRole('menuitem').map((item) => item.getAttribute('data-testid'));
            }

            test('the search box shows what is typed and filters the list', async () => {
                renderMobilePicker();
                await openPicker();

                const search = within(screen.getByRole('dialog')).getByRole('searchbox', {name: 'Search attributes'});
                await userEvent.type(search, 'ri');

                expect(search).toHaveValue('ri');
                expect(modalItems()).toEqual([addItemId('alpha'), addItemId('bravo')]);

                await userEvent.clear(search);
                await userEvent.type(search, 'zzz');
                expect(screen.getByTestId(`${SCOPE}.add_menu.no_results--menuitem`)).toBeInTheDocument();
            });

            test('a click in the search box leaves the menu open', async () => {
                renderMobilePicker();
                await openPicker();

                await userEvent.click(within(screen.getByRole('dialog')).getByRole('searchbox', {name: 'Search attributes'}));

                expect(screen.getByRole('dialog')).toBeInTheDocument();
                expect(modalItems()).toHaveLength(5);
            });

            test('picks a field the search found, and the next opening starts from an empty search', async () => {
                const onSelect = jest.fn();
                renderMobilePicker(onSelect);
                await openPicker();

                await userEvent.type(within(screen.getByRole('dialog')).getByRole('searchbox', {name: 'Search attributes'}), 'echo');
                await userEvent.click(screen.getByTestId(addItemId('echo')));

                expect(onSelect).toHaveBeenCalledTimes(1);
                expect(onSelect).toHaveBeenCalledWith('f_e');
                await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

                await openPicker();
                expect(within(screen.getByRole('dialog')).getByRole('searchbox', {name: 'Search attributes'})).toHaveValue('');
                expect(modalItems()).toHaveLength(5);
            });
        });
    });

    test('inside a dialog, the menu renders in the dialog, so the modal does not take focus back from it', async () => {
        renderWithContext(
            <div role='dialog'>
                <PostAttributesFieldPicker
                    testIdScope={SCOPE}
                    fields={[makeField({id: 'f_a', name: 'alpha'})]}
                    onSelect={jest.fn()}
                />
            </div>,
        );

        await openPicker();

        expect(screen.getByRole('dialog')).toContainElement(screen.getByRole('menu', {name: 'Add an attribute'}));
    });

    test('with a disabled reason, the trigger is disabled, opens nothing, and shows the reason as its tooltip', async () => {
        const onSelect = jest.fn();
        renderWithContext(
            <PostAttributesFieldPicker
                fields={[makeField({id: 'f_a', name: 'alpha'})]}
                onSelect={onSelect}
                trigger={{label: 'Add attributes', icon: <span/>}}
                testIdScope='composer'
                disabledReason='Burn-on-read messages can’t have attributes'
            />,
        );

        const trigger = screen.getByTestId('composer.add--button');
        expect(trigger).toBeDisabled();

        await userEvent.click(trigger);
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();

        await userEvent.hover(screen.getByTestId('composer.add_blocked--group'));
        expect(await screen.findByRole('tooltip')).toHaveTextContent('Burn-on-read messages can’t have attributes');
        expect(screen.queryByText('Add attributes', {selector: '[role="tooltip"] *'})).not.toBeInTheDocument();
    });

    test('outside a dialog, the menu renders in the page body', async () => {
        renderPicker([makeField({id: 'f_a', name: 'alpha'})]);
        await openPicker();

        expect(screen.getByRole('menu', {name: 'Add an attribute'}).closest('[role="dialog"]')).toBeNull();
    });

    test('a compact picker draws "Add attribute" as a Compass button that opens the menu', async () => {
        renderWithContext(
            <PostAttributesFieldPicker
                testIdScope={SCOPE}
                compact={true}
                fields={[makeField({id: 'f_a', name: 'alpha'})]}
                onSelect={jest.fn()}
            />,
        );

        const button = screen.getByRole('button', {name: 'Add attribute'});
        expect(button).toHaveAttribute('data-testid', `${SCOPE}.add--button`);
        expect(button).not.toHaveClass('PostAttributesModal__add');

        await userEvent.click(button);
        expect(screen.getByRole('menu', {name: 'Add an attribute'})).toBeInTheDocument();
    });

    // Compass's class names carry a build hash, so they are matched by their
    // readable part.
    test('both "Add attribute" buttons are grey Compass buttons, the modal\'s the height of its rows', async () => {
        renderWithContext(
            <>
                <PostAttributesFieldPicker
                    testIdScope={SCOPE}
                    fields={[makeField({id: 'f_a', name: 'alpha'})]}
                    onSelect={jest.fn()}
                />
                <PostAttributesFieldPicker
                    id='composerAdd'
                    testIdScope='composer'
                    compact={true}
                    fields={[makeField({id: 'f_a', name: 'alpha'})]}
                    onSelect={jest.fn()}
                />
            </>,
        );

        const modalAdd = screen.getByTestId(`${SCOPE}.add--button`);
        expect(modalAdd).toHaveClass('PostAttributesModal__add');
        expect(modalAdd.className).toMatch(/button--emphasis-dim/);
        expect(modalAdd.className).not.toMatch(/button--emphasis-tertiary/);
        expect(modalAdd.className).toMatch(/button--size-small/);
        expect(modalAdd.className).toMatch(/button--compact/);

        const composerAdd = screen.getByTestId('composer.add--button');
        expect(composerAdd.className).toMatch(/button--emphasis-dim/);
        expect(composerAdd.className).toMatch(/button--size-x-small/);
        expect(composerAdd.className).not.toMatch(/button--compact/);

        await userEvent.click(modalAdd);
        expect(screen.getByRole('menu', {name: 'Add an attribute'})).toBeInTheDocument();
    });
});
