// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserPropertyField} from '@mattermost/types/properties_user';

import {fireEvent, renderWithContext, screen, userEvent, waitFor, within} from 'tests/react_testing_utils';
import {getHistory} from 'utils/browser_history';

import {emptyAttributesState} from './bot_attributes';
import type {BotAttributesState} from './bot_attributes';
import BotAttributesSection from './bot_attributes_section';
import type {BotAttributesSectionProps} from './bot_attributes_section';

const buildField = (overrides: Partial<UserPropertyField> = {}, attrs: Partial<UserPropertyField['attrs']> = {}): UserPropertyField => ({
    id: 'field-1',
    name: 'department',
    type: 'text',
    group_id: 'custom_profile_attributes',
    create_at: 0,
    update_at: 0,
    delete_at: 0,
    created_by: '',
    updated_by: '',
    target_id: '',
    target_type: '',
    object_type: 'user',
    ...overrides,
    attrs: {sort_order: 0, visibility: 'when_set', value_type: '', ...attrs},
});

const FIELDS = [
    buildField({id: 'dept', name: 'dept'}, {display_name: 'Department', sort_order: 2}),
    buildField({id: 'skills', name: 'skills', type: 'multiselect'}, {display_name: 'Skills', sort_order: 1, options: [{id: 's1', name: 'Go'}, {id: 's2', name: 'React'}]}),
    buildField({id: 'clearance', name: 'clearance', type: 'select'}, {display_name: 'Clearance', sort_order: 3, required: true, options: [{id: 'c1', name: 'Secret'}]}),
    buildField({id: 'badge', name: 'badge'}, {display_name: 'Badge', sort_order: 4, protected: true}),
    buildField({id: 'synced', name: 'synced'}, {display_name: 'Synced', sort_order: 5, ldap: 'title'}),
    buildField({id: 'adminOnly', name: 'adminOnly'}, {display_name: 'Admin Only', sort_order: 6, managed: 'admin'}),
    buildField({id: 'hidden', name: 'hidden'}, {display_name: 'Hidden', sort_order: 7, access_mode: 'source_only'}),
];

describe('components/integrations/bots/add_bot/BotAttributesSection', () => {
    const historyMock = getHistory();

    const baseProps: BotAttributesSectionProps = {
        fields: FIELDS,
        state: emptyAttributesState('ready'),
        disabled: false,
        canEditAdminManaged: true,
        onAdd: jest.fn(),
        onRemove: jest.fn(),
        onChange: jest.fn(),
        onRetry: jest.fn(),
    };

    type Overrides = Partial<Omit<BotAttributesSectionProps, 'state'> & BotAttributesState>;
    const renderSection = ({status = 'ready', rows = [], values = {}, initialValues = {}, errors = {}, ...overrides}: Overrides = {}) => renderWithContext(
        <BotAttributesSection
            {...baseProps}
            {...overrides}
            state={{status, rows, values, initialValues, errors}}
        />,
        {plugins: {plugins: {}}},
    );

    const getTrigger = () => screen.getByRole('button', {name: 'Add attribute'});
    const openMenu = async () => userEvent.click(getTrigger());

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('renders the title, description and an empty list', () => {
        renderSection();

        expect(screen.getByText('Attributes')).toBeInTheDocument();
        expect(screen.getByText('Configure attributes and values for this bot')).toBeInTheDocument();
        expect(screen.queryByTestId('bot-attribute-list')).not.toBeInTheDocument();
        expect(getTrigger()).toBeEnabled();
    });

    test('renders rows in sort order and skips hidden fields', () => {
        const {container} = renderSection({rows: ['dept', 'skills', 'hidden']});

        const labels = Array.from(container.querySelectorAll('[data-testid^="bot-attribute-label-"]')).map((el) => el.getAttribute('data-testid'));
        expect(labels).toEqual(['bot-attribute-label-skills', 'bot-attribute-label-dept']);
    });

    test('shows formatted errors on their rows', () => {
        renderSection({rows: ['dept'], errors: {dept: {id: 'x', defaultMessage: 'Bad value'}}});

        expect(within(screen.getByTestId('bot-attribute-label-dept')).getByRole('alert')).toHaveTextContent('Bad value');
    });

    test('shows trash only on removable, unlocked rows', () => {
        const {unmount} = renderSection({rows: ['dept', 'clearance', 'badge'], initialValues: {clearance: 'c1', badge: 'x'}});

        expect(screen.getByTestId('bot-attribute-remove-dept')).toBeInTheDocument();
        expect(screen.queryByTestId('bot-attribute-remove-clearance')).not.toBeInTheDocument();
        expect(screen.queryByTestId('bot-attribute-remove-badge')).not.toBeInTheDocument();
        unmount();

        renderSection({rows: ['dept', 'clearance', 'badge'], initialValues: {}});
        expect(screen.getByTestId('bot-attribute-remove-clearance')).toBeInTheDocument();
    });

    test('remove calls onRemove and focuses the Add trigger', async () => {
        const onRemove = jest.fn();
        renderSection({rows: ['dept'], onRemove});

        await userEvent.click(screen.getByRole('button', {name: 'Remove Department'}));

        expect(onRemove).toHaveBeenCalledWith('dept');
        expect(document.activeElement).toBe(getTrigger());
    });

    test('menu lists only addable fields in sort order', async () => {
        renderSection({rows: ['dept']});

        await openMenu();
        const items = await screen.findAllByRole('menuitem');

        expect(items.map((item) => item.textContent)).toEqual(['Skills', 'Clearance', 'Admin Only', 'Manage attributes']);
    });

    test('admin-managed fields are not offered without canEditAdminManaged', async () => {
        renderSection({canEditAdminManaged: false});

        await openMenu();
        await screen.findByRole('menuitem', {name: 'Skills'});

        expect(screen.queryByRole('menuitem', {name: 'Admin Only'})).not.toBeInTheDocument();
    });

    test('choosing a field calls onAdd', async () => {
        const onAdd = jest.fn();
        renderSection({onAdd});

        await openMenu();
        await userEvent.click(await screen.findByRole('menuitem', {name: 'Skills'}));

        await waitFor(() => expect(onAdd).toHaveBeenCalledWith('skills'));
    });

    test('shows a disabled empty item when nothing can be added', async () => {
        const onAdd = jest.fn();
        renderSection({rows: ['dept', 'skills', 'clearance', 'adminOnly'], onAdd});

        await openMenu();
        const empty = await screen.findByRole('menuitem', {name: 'No attributes available'});
        expect(empty).toHaveAttribute('aria-disabled', 'true');

        await userEvent.click(empty, {pointerEventsCheck: 0});
        expect(onAdd).not.toHaveBeenCalled();
    });

    test('Manage attributes is only offered with canEditAdminManaged', async () => {
        const {unmount} = renderSection();

        await openMenu();
        await userEvent.click(await screen.findByRole('menuitem', {name: 'Manage attributes'}));
        await waitFor(() => expect(historyMock.push).toHaveBeenCalledWith('/admin_console/system_attributes/manage_attributes'));
        unmount();

        renderSection({canEditAdminManaged: false});
        await openMenu();
        await screen.findByRole('menuitem', {name: 'Skills'});
        expect(screen.queryByRole('menuitem', {name: 'Manage attributes'})).not.toBeInTheDocument();
    });

    test('loading shows a disabled trigger and no rows', () => {
        renderSection({status: 'loading', rows: ['dept']});

        expect(getTrigger()).toBeDisabled();
        expect(screen.queryByTestId('bot-attribute-list')).not.toBeInTheDocument();
    });

    test('error shows the load error and a retry button, and no menu', async () => {
        const onRetry = jest.fn();
        renderSection({status: 'error', rows: ['dept'], onRetry});

        expect(screen.getByRole('alert')).toHaveTextContent('Attributes could not be loaded.');
        expect(screen.queryByRole('button', {name: 'Add attribute'})).not.toBeInTheDocument();
        expect(screen.queryByTestId('bot-attribute-list')).not.toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', {name: 'Try again'}));
        expect(onRetry).toHaveBeenCalledTimes(1);
    });

    test('disabled disables inputs, trash and the trigger', () => {
        renderSection({disabled: true, rows: ['dept']});

        expect(screen.getByRole('textbox', {name: 'Department'})).toBeDisabled();
        expect(screen.getByRole('button', {name: 'Remove Department'})).toBeDisabled();
        expect(getTrigger()).toBeDisabled();
    });

    test('typing calls onChange', () => {
        const onChange = jest.fn();
        renderSection({rows: ['dept'], onChange});

        fireEvent.change(screen.getByRole('textbox', {name: 'Department'}), {target: {value: 'Eng'}});

        expect(onChange).toHaveBeenCalledWith('dept', 'Eng');
    });
});
