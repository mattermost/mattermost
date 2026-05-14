// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent, render, screen, within} from '@testing-library/react';
import React from 'react';
import {IntlProvider} from 'react-intl';

import type {PropertyField} from '@mattermost/types/properties';

import SelectEditor from './select_editor';

function wrap(ui: React.ReactElement) {
    return <IntlProvider locale='en'>{ui}</IntlProvider>;
}

// Colors picked so the YIQ contrast helper resolves predictably:
// - #abcdef: light → black text
// - #123456: dark  → white text
// - #fedcba: light → black text
const OPT1_COLOR = '#abcdef';
const OPT2_COLOR = '#123456';
const OPT3_COLOR = '#fedcba';

function makeSelectField(overrides: Partial<PropertyField> = {}): PropertyField {
    return {
        id: 'f1',
        group_id: 'g1',
        name: 'Status',
        type: 'select',
        attrs: {
            options: [
                {id: 'opt1', name: 'Open', color: OPT1_COLOR},
                {id: 'opt2', name: 'In Progress', color: OPT2_COLOR},
                {id: 'opt3', name: 'Done', color: OPT3_COLOR},
            ],
        },
        target_id: 'channel-1',
        target_type: 'channel',
        object_type: 'post',
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        created_by: 'u1',
        updated_by: 'u1',
        ...overrides,
    };
}

function openMenu() {
    const combobox = screen.getByRole('combobox');
    fireEvent.mouseDown(combobox);
    fireEvent.focus(combobox);
}

// Resolve a Tag element by its text label inside a given container.
function findTagByText(container: HTMLElement, text: string): HTMLElement {
    const node = within(container).getByText(text);
    const tag = node.closest('.Tag') as HTMLElement | null;
    if (!tag) {
        throw new Error(`No .Tag ancestor for text '${text}' in container`);
    }
    return tag;
}

describe('components/property_value_editor/SelectEditor (single)', () => {
    test('renders a combobox', () => {
        render(wrap(
            <SelectEditor
                field={makeSelectField()}
                value=''
                onChange={jest.fn()}
                multi={false}
            />,
        ));

        expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    test('shows the option matching the current value', () => {
        render(wrap(
            <SelectEditor
                field={makeSelectField()}
                value='opt2'
                onChange={jest.fn()}
                multi={false}
            />,
        ));
        expect(screen.getByText('In Progress')).toBeInTheDocument();
    });

    test('renders the selected single value as a colored Tag chip', () => {
        const {container} = render(wrap(
            <SelectEditor
                field={makeSelectField()}
                value='opt2'
                onChange={jest.fn()}
                multi={false}
            />,
        ));

        // The control area (everything except the menu) holds the SingleValue.
        const tag = findTagByText(container, 'In Progress');
        expect(tag).toHaveStyle({backgroundColor: OPT2_COLOR});
    });

    test('renders all options in the menu when opened', () => {
        render(wrap(
            <SelectEditor
                field={makeSelectField()}
                value=''
                onChange={jest.fn()}
                multi={false}
            />,
        ));

        openMenu();

        expect(screen.getByRole('option', {name: 'Open'})).toBeInTheDocument();
        expect(screen.getByRole('option', {name: 'In Progress'})).toBeInTheDocument();
        expect(screen.getByRole('option', {name: 'Done'})).toBeInTheDocument();
    });

    test('renders each menu option as a colored Tag', () => {
        render(wrap(
            <SelectEditor
                field={makeSelectField()}
                value=''
                onChange={jest.fn()}
                multi={false}
            />,
        ));

        openMenu();

        const openOpt = screen.getByRole('option', {name: 'Open'});
        const inProgressOpt = screen.getByRole('option', {name: 'In Progress'});
        const doneOpt = screen.getByRole('option', {name: 'Done'});

        expect(findTagByText(openOpt, 'Open')).toHaveStyle({backgroundColor: OPT1_COLOR});
        expect(findTagByText(inProgressOpt, 'In Progress')).toHaveStyle({backgroundColor: OPT2_COLOR});
        expect(findTagByText(doneOpt, 'Done')).toHaveStyle({backgroundColor: OPT3_COLOR});
    });

    test('calls onChange with the option id when an option is selected', () => {
        const onChange = jest.fn();
        render(wrap(
            <SelectEditor
                field={makeSelectField()}
                value=''
                onChange={onChange}
                multi={false}
            />,
        ));

        openMenu();
        fireEvent.click(screen.getByRole('option', {name: 'Open'}));

        expect(onChange).toHaveBeenCalledWith('opt1');
    });

    test('renders a placeholder when field has no options', () => {
        render(wrap(
            <SelectEditor
                field={makeSelectField({attrs: {options: []}})}
                value=''
                onChange={jest.fn()}
                multi={false}
            />,
        ));
        expect(screen.getByText(/no options/i)).toBeInTheDocument();
    });
});

describe('components/property_value_editor/SelectEditor (multi)', () => {
    test('renders a combobox with multi selection', () => {
        render(wrap(
            <SelectEditor
                field={makeSelectField()}
                value={[]}
                onChange={jest.fn()}
                multi={true}
            />,
        ));

        expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    test('shows pills for the option ids in the value array', () => {
        render(wrap(
            <SelectEditor
                field={makeSelectField()}
                value={['opt1', 'opt3']}
                onChange={jest.fn()}
                multi={true}
            />,
        ));

        expect(screen.getByText('Open')).toBeInTheDocument();
        expect(screen.getByText('Done')).toBeInTheDocument();
        expect(screen.queryByText('In Progress')).not.toBeInTheDocument();
    });

    test('renders each selected multi value as a colored Tag chip', () => {
        const {container} = render(wrap(
            <SelectEditor
                field={makeSelectField()}
                value={['opt1', 'opt3']}
                onChange={jest.fn()}
                multi={true}
            />,
        ));

        const openTag = findTagByText(container, 'Open');
        const doneTag = findTagByText(container, 'Done');

        expect(openTag).toHaveStyle({backgroundColor: OPT1_COLOR});
        expect(doneTag).toHaveStyle({backgroundColor: OPT3_COLOR});
    });

    test('adds an option id to the array when picked from the menu', () => {
        const onChange = jest.fn();
        render(wrap(
            <SelectEditor
                field={makeSelectField()}
                value={['opt1']}
                onChange={onChange}
                multi={true}
            />,
        ));

        openMenu();
        fireEvent.click(screen.getByRole('option', {name: 'In Progress'}));

        expect(onChange).toHaveBeenCalledWith(['opt1', 'opt2']);
    });

    test('per-chip × removes only that option from the value array', () => {
        const onChange = jest.fn();
        render(wrap(
            <SelectEditor
                field={makeSelectField()}
                value={['opt1', 'opt2', 'opt3']}
                onChange={onChange}
                multi={true}
            />,
        ));

        // react-select renders MultiValueRemove with aria-label `Remove <name>`.
        // Use the accessible label to target the right per-chip × handle.
        const removeBtn = screen.getByLabelText('Remove In Progress');

        // react-select handles removal on mousedown with the primary button.
        fireEvent.mouseDown(removeBtn);
        fireEvent.click(removeBtn);

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(['opt1', 'opt3']);
    });
});
