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

import {render, renderWithContext, screen, waitFor} from 'tests/react_testing_utils';

import PostAttributesFieldPicker from './post_attributes_field_picker';

const GROUP_ID = 'group_id';
const CHANNEL_ID = 'channel_id';

function makeField(overrides: Partial<PropertyField> = {}): PropertyField {
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
            fields={fields}
            onSelect={onSelect}
        />,
    );
}

async function openPicker() {
    await userEvent.click(screen.getByTestId('post-attributes-add'));
}

describe('PostAttributesFieldPicker', () => {
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
            'post-attribute-add-caveats',
            'post-attribute-add-alpha',
            'post-attribute-add-beta',
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
            const icon = iconIn(screen.getByTestId(`post-attribute-add-${type}`));

            expect(icon?.querySelector('path')?.getAttribute('d')).toBe(paths[index]);
            expect(icon).toHaveAttribute('height', '16');
        });

        /*
         * `date` has no icon because it has no control that could write it, so
         * the candidate hook never offers one and this menu never sees it. If a
         * `date` control ever lands, the field becomes a candidate and this
         * assertion is what says the icon table has to grow with it.
         */
        expect(iconIn(screen.getByTestId('post-attribute-add-date'))).toBeNull();
    });

    test('calls onSelect once with the field id of the item clicked', async () => {
        const onSelect = jest.fn();

        renderPicker([makeField({id: 'f_a', name: 'alpha'}), makeField({id: 'f_b', name: 'beta'})], onSelect);

        await openPicker();
        await userEvent.click(screen.getByTestId('post-attribute-add-beta'));

        // A plain `menuitem` defers its `onClick` until the close animation has
        // run, so the call has not happened yet at the point the click returns.
        await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1));
        expect(onSelect).toHaveBeenCalledWith('f_b');
    });
});
