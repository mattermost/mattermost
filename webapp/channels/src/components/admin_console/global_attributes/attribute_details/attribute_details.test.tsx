// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {ClientError} from '@mattermost/client';
import type {PropertyField} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import AttributeDetails from './attribute_details';

const mockHistoryPush = jest.fn();
jest.mock('utils/browser_history', () => ({
    getHistory: () => ({
        push: mockHistoryPush,
    }),
}));

const mockSetNavigationBlocked = jest.fn();
jest.mock('actions/admin_actions', () => ({
    setNavigationBlocked: (blocked: boolean) => {
        mockSetNavigationBlocked(blocked);
        return {type: 'SET_NAVIGATION_BLOCKED', blocked};
    },
}));

function makeClientError(serverErrorId: string): ClientError {
    return new ClientError('https://example.com', {
        message: 'error',
        server_error_id: serverErrorId,
        status_code: 422,
        url: 'https://example.com/api/v4/properties/groups/access_control/template/fields',
    });
}

describe('AttributeDetails', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const renderComponent = () => renderWithContext(<AttributeDetails/>);

    it('renders the empty auto-slug caption as a dash, not the _copy sentinel', () => {
        renderComponent();
        expect(screen.getByTestId('attributeUniqueNameCaption')).toHaveTextContent('Unique name: —');
    });

    it('updates the auto-slug caption live as the display name is typed', async () => {
        renderComponent();

        await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'My Attribute');

        expect(screen.getByTestId('attributeUniqueNameCaption')).toHaveTextContent('Unique name: my_attribute');
    });

    it('shows an inline error for an auto-slugged reserved word without clicking Edit, and disables Save', async () => {
        renderComponent();

        await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'For');

        expect(screen.getByTestId('attributeUniqueNameCaption')).toHaveTextContent('Unique name: for');
        expect(screen.getByTestId('attributeUniqueNameError')).toHaveTextContent('reserved word');
        expect(screen.getByTestId('saveSetting')).toBeDisabled();
    });

    it('disables Save while the display name is empty', () => {
        renderComponent();
        expect(screen.getByTestId('saveSetting')).toBeDisabled();
    });

    it('reveals a focused editable Name input seeded with the current slug when Edit is clicked, and stops auto-updating it', async () => {
        renderComponent();

        await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'My Attribute');
        await userEvent.click(screen.getByTestId('attributeNameEditLink'));

        const nameInput = screen.getByTestId('attributeNameInput');
        expect(nameInput).toHaveValue('my_attribute');
        expect(nameInput).toHaveFocus();

        await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), ' Extra');
        expect(nameInput).toHaveValue('my_attribute');
    });

    it('swaps the Edit link to Done while editing, and back to Edit (keeping the typed value) when Done is clicked', async () => {
        renderComponent();

        await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'My Attribute');
        expect(screen.getByTestId('attributeNameEditLink')).toHaveTextContent('Edit');

        await userEvent.click(screen.getByTestId('attributeNameEditLink'));
        expect(screen.getByTestId('attributeNameEditLink')).toHaveTextContent('Done');

        const nameInput = screen.getByTestId('attributeNameInput');
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'custom_name');

        await userEvent.click(screen.getByTestId('attributeNameEditLink'));
        expect(screen.getByTestId('attributeNameEditLink')).toHaveTextContent('Edit');
        expect(screen.getByTestId('attributeUniqueNameValue')).toHaveTextContent('custom_name');
        expect(screen.queryByTestId('attributeNameInput')).not.toBeInTheDocument();

        // Re-opening Edit must not re-seed from the (now stale) auto-slug.
        await userEvent.click(screen.getByTestId('attributeNameEditLink'));
        expect(screen.getByTestId('attributeNameInput')).toHaveValue('custom_name');
    });

    it('reverts to auto-derived mode if Done is clicked with an empty field on the very first edit', async () => {
        renderComponent();

        await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'My Attribute');
        await userEvent.click(screen.getByTestId('attributeNameEditLink'));
        await userEvent.clear(screen.getByTestId('attributeNameInput'));
        await userEvent.click(screen.getByTestId('attributeNameEditLink'));

        expect(screen.queryByTestId('attributeNameInput')).not.toBeInTheDocument();
        expect(screen.getByTestId('attributeUniqueNameValue')).toHaveTextContent('my_attribute');

        // Auto-derivation should be live again -- further Display name edits update it.
        await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), ' Two');
        expect(screen.getByTestId('attributeUniqueNameValue')).toHaveTextContent('my_attribute_two');
    });

    it('restores the previously-committed Name if Done is clicked with an empty field on a later edit', async () => {
        renderComponent();

        await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'My Attribute');
        await userEvent.click(screen.getByTestId('attributeNameEditLink'));
        await userEvent.clear(screen.getByTestId('attributeNameInput'));
        await userEvent.type(screen.getByTestId('attributeNameInput'), 'custom_name');
        await userEvent.click(screen.getByTestId('attributeNameEditLink'));

        // Second edit session: clear it again and click Done.
        await userEvent.click(screen.getByTestId('attributeNameEditLink'));
        await userEvent.clear(screen.getByTestId('attributeNameInput'));
        await userEvent.click(screen.getByTestId('attributeNameEditLink'));

        expect(screen.getByTestId('attributeUniqueNameValue')).toHaveTextContent('custom_name');

        // Manual override must stay in effect -- further Display name edits do not overwrite it.
        await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), ' Two');
        expect(screen.getByTestId('attributeUniqueNameValue')).toHaveTextContent('custom_name');
    });

    it('shows an inline error for a charset-invalid or reserved-word Name after Edit, and disables Save', async () => {
        renderComponent();

        await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'My Attribute');
        await userEvent.click(screen.getByTestId('attributeNameEditLink'));

        const nameInput = screen.getByTestId('attributeNameInput');
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'for');

        expect(screen.getByText(/reserved word/)).toBeInTheDocument();
        expect(screen.getByTestId('saveSetting')).toBeDisabled();
    });

    it('opens the Type menu showing all four types selectable, Text checked by default', async () => {
        renderComponent();

        await userEvent.click(screen.getByTestId('attributeTypeMenuButton'));

        expect(screen.getByRole('menuitemradio', {name: 'Text'})).toHaveAttribute('aria-checked', 'true');

        for (const label of ['Text', 'Select', 'Multiselect', 'Ranked']) {
            const item = screen.getByRole('menuitemradio', {name: new RegExp(label)});
            expect(item).not.toHaveAttribute('aria-disabled', 'true');
            expect(item).not.toHaveTextContent('Coming soon');
        }
    });

    it('selecting Select from the Type menu updates the button label and swaps in the options chip editor', async () => {
        renderComponent();

        await userEvent.click(screen.getByTestId('attributeTypeMenuButton'));
        await userEvent.click(screen.getByRole('menuitemradio', {name: 'Select'}));

        expect(screen.getByTestId('attributeTypeMenuButton')).toHaveTextContent('Select');
        expect(screen.getByTestId('attributeOptionsValues')).toBeInTheDocument();
        expect(screen.queryByTestId('attributeOptionsHelp')).not.toBeInTheDocument();
    });

    it('selecting Rank from the Type menu swaps in the rank chip editor', async () => {
        renderComponent();

        await userEvent.click(screen.getByTestId('attributeTypeMenuButton'));
        await userEvent.click(screen.getByRole('menuitemradio', {name: /Ranked/}));

        expect(screen.getByTestId('attributeOptionsRankValues')).toBeInTheDocument();
    });

    it('preserves already-entered options across a Select -> Text -> Select round-trip', async () => {
        renderComponent();

        await userEvent.click(screen.getByTestId('attributeTypeMenuButton'));
        await userEvent.click(screen.getByRole('menuitemradio', {name: 'Select'}));
        await userEvent.type(screen.getByTestId('attributeOptionsValues__addInput'), 'Engineering{Enter}');
        expect(screen.getByText('Engineering')).toBeInTheDocument();

        await userEvent.click(screen.getByTestId('attributeTypeMenuButton'));
        await userEvent.click(screen.getByRole('menuitemradio', {name: 'Text'}));
        expect(screen.queryByTestId('attributeOptionsValues')).not.toBeInTheDocument();

        await userEvent.click(screen.getByTestId('attributeTypeMenuButton'));
        await userEvent.click(screen.getByRole('menuitemradio', {name: 'Select'}));
        expect(screen.getByText('Engineering')).toBeInTheDocument();
    });

    it('assigns rank = index + 1 to every existing option when switching into Rank', async () => {
        renderComponent();

        await userEvent.click(screen.getByTestId('attributeTypeMenuButton'));
        await userEvent.click(screen.getByRole('menuitemradio', {name: 'Select'}));
        await userEvent.type(screen.getByTestId('attributeOptionsValues__addInput'), 'Low{Enter}');
        await userEvent.type(screen.getByTestId('attributeOptionsValues__addInput'), 'High{Enter}');

        await userEvent.click(screen.getByTestId('attributeTypeMenuButton'));
        await userEvent.click(screen.getByRole('menuitemradio', {name: /Ranked/}));

        const chips = screen.getAllByTestId('attributeOptionsRankValues__chipLabel');
        expect(chips.map((chip) => chip.textContent)).toEqual(['Low', 'High']);
        expect(screen.getAllByTestId('rank-badge').map((badge) => badge.textContent)).toEqual(['1', '2']);
    });

    it('disables Save with an inline "at least one option is required" message for an option-bearing type with no options', async () => {
        renderComponent();
        await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'My Attribute');
        expect(screen.getByTestId('saveSetting')).not.toBeDisabled();

        await userEvent.click(screen.getByTestId('attributeTypeMenuButton'));
        await userEvent.click(screen.getByRole('menuitemradio', {name: 'Select'}));

        expect(screen.getByTestId('attributeOptionsRequiredError')).toHaveTextContent('At least one option is required');
        expect(screen.getByTestId('saveSetting')).toBeDisabled();

        await userEvent.type(screen.getByTestId('attributeOptionsValues__addInput'), 'Engineering{Enter}');
        expect(screen.queryByTestId('attributeOptionsRequiredError')).not.toBeInTheDocument();
        expect(screen.getByTestId('saveSetting')).not.toBeDisabled();
    });

    it('a duplicate option name shows the inline uniqueness error and does not add a second chip', async () => {
        renderComponent();

        await userEvent.click(screen.getByTestId('attributeTypeMenuButton'));
        await userEvent.click(screen.getByRole('menuitemradio', {name: 'Select'}));
        await userEvent.type(screen.getByTestId('attributeOptionsValues__addInput'), 'Engineering{Enter}');
        await userEvent.type(screen.getByTestId('attributeOptionsValues__addInput'), 'Engineering{Enter}');

        expect(screen.getByText('Values must be unique.')).toBeInTheDocument();
        expect(screen.getAllByTestId('attributeOptionsValues__chip')).toHaveLength(1);
    });

    it('calls createAttributeField with the expected shape and navigates to the list on success', async () => {
        const createPropertyField = jest.spyOn(Client4, 'createPropertyField').mockResolvedValue({} as PropertyField);

        renderComponent();
        await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'My Attribute');
        await userEvent.click(screen.getByTestId('saveSetting'));

        await waitFor(() => expect(mockHistoryPush).toHaveBeenCalledWith('/admin_console/system_attributes/manage_attributes'));

        expect(createPropertyField).toHaveBeenCalledWith('access_control', 'template', {
            name: 'my_attribute',
            type: 'text',
            target_type: 'system',
            target_id: '',
            attrs: {display_name: 'My Attribute'},
        });
        expect(mockSetNavigationBlocked).toHaveBeenCalledWith(false);
    });

    it('shows a saving state and disables re-submission while the request is in flight', async () => {
        let resolveCreate: (value: PropertyField) => void = () => {};
        jest.spyOn(Client4, 'createPropertyField').mockReturnValue(new Promise((resolve) => {
            resolveCreate = resolve;
        }));

        renderComponent();
        await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'My Attribute');
        await userEvent.click(screen.getByTestId('saveSetting'));

        expect(screen.getByTestId('saveSetting')).toBeDisabled();

        resolveCreate({} as PropertyField);
        await waitFor(() => expect(mockHistoryPush).toHaveBeenCalled());
    });

    it('saves a Select attribute with the expected attrs.options shape', async () => {
        const createPropertyField = jest.spyOn(Client4, 'createPropertyField').mockResolvedValue({} as PropertyField);

        renderComponent();
        await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'Department');
        await userEvent.click(screen.getByTestId('attributeTypeMenuButton'));
        await userEvent.click(screen.getByRole('menuitemradio', {name: 'Select'}));
        await userEvent.type(screen.getByTestId('attributeOptionsValues__addInput'), 'Engineering{Enter}');
        await userEvent.type(screen.getByTestId('attributeOptionsValues__addInput'), 'Sales{Enter}');
        await userEvent.click(screen.getByTestId('saveSetting'));

        await waitFor(() => expect(mockHistoryPush).toHaveBeenCalled());
        expect(createPropertyField).toHaveBeenCalledWith('access_control', 'template', expect.objectContaining({
            type: 'select',
            attrs: expect.objectContaining({
                options: [
                    {id: '', name: 'Engineering'},
                    {id: '', name: 'Sales'},
                ],
            }),
        }));
    });

    it('saves a Rank attribute with rank always explicitly present', async () => {
        const createPropertyField = jest.spyOn(Client4, 'createPropertyField').mockResolvedValue({} as PropertyField);

        renderComponent();
        await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'Clearance');
        await userEvent.click(screen.getByTestId('attributeTypeMenuButton'));
        await userEvent.click(screen.getByRole('menuitemradio', {name: /Ranked/}));
        await userEvent.type(screen.getByTestId('attributeOptionsRankValues__addInput'), 'Low{Enter}');
        await userEvent.type(screen.getByTestId('attributeOptionsRankValues__addInput'), 'High{Enter}');
        await userEvent.click(screen.getByTestId('saveSetting'));

        await waitFor(() => expect(mockHistoryPush).toHaveBeenCalled());
        expect(createPropertyField).toHaveBeenCalledWith('access_control', 'template', expect.objectContaining({
            type: 'rank',
            attrs: expect.objectContaining({
                options: [
                    {id: '', name: 'Low', rank: 1},
                    {id: '', name: 'High', rank: 2},
                ],
            }),
        }));
    });

    it.each([
        ['app.property_field.create.name_conflict.app_error', 'already exists'],
        ['model.cpa_field.name.invalid_charset.app_error', 'must start with a letter'],
        ['model.cpa_field.name.reserved_word.app_error', 'reserved word'],
        ['app.property_field.create.limit_reached.app_error', 'maximum number'],
        ['app.property_field.invalid_attrs.app_error', 'problem with one or more options'],
    ])('renders specific inline copy for %s', async (serverErrorId, expectedText) => {
        jest.spyOn(Client4, 'createPropertyField').mockRejectedValue(makeClientError(serverErrorId));

        renderComponent();
        await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'My Attribute');
        await userEvent.click(screen.getByTestId('saveSetting'));

        expect(await screen.findByText(new RegExp(expectedText, 'i'))).toBeInTheDocument();
        expect(mockHistoryPush).not.toHaveBeenCalled();
        expect(screen.getByTestId('saveSetting')).not.toBeDisabled();
    });

    it('renders the generic fallback for an unmapped or non-AppError failure and leaves the form usable', async () => {
        jest.spyOn(Client4, 'createPropertyField').mockRejectedValue(new Error('network error'));

        renderComponent();
        await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'My Attribute');
        await userEvent.click(screen.getByTestId('saveSetting'));

        expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
        expect(screen.getByTestId('saveSetting')).not.toBeDisabled();
    });

    it('dispatches setNavigationBlocked(true) on display name edits', async () => {
        renderComponent();
        await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'My Attribute');
        expect(mockSetNavigationBlocked).toHaveBeenCalledWith(true);
    });

    it('shows a warning and disables Save when a non-empty Display name auto-slugs to nothing usable', async () => {
        renderComponent();

        await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), '!!!');

        expect(screen.getByTestId('attributeUniqueNameCaption')).toHaveTextContent('Unique name: —');
        expect(screen.getByTestId('attributeUniqueNameEmptyWarning')).toHaveTextContent("Couldn't generate a unique name");
        expect(screen.getByTestId('saveSetting')).toBeDisabled();
    });

    it('pressing Enter in the manual Name input commits the value, same as clicking Done', async () => {
        renderComponent();

        await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'My Attribute');
        await userEvent.click(screen.getByTestId('attributeNameEditLink'));

        const nameInput = screen.getByTestId('attributeNameInput');
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'custom_name{Enter}');

        expect(screen.queryByTestId('attributeNameInput')).not.toBeInTheDocument();
        expect(screen.getByTestId('attributeUniqueNameValue')).toHaveTextContent('custom_name');
        expect(screen.getByTestId('attributeNameEditLink')).toHaveTextContent('Edit');
    });

    it('pressing Escape in the manual Name input discards the edit and exits edit mode', async () => {
        renderComponent();

        await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'My Attribute');
        await userEvent.click(screen.getByTestId('attributeNameEditLink'));

        const nameInput = screen.getByTestId('attributeNameInput');
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'discarded_name{Escape}');

        expect(screen.queryByTestId('attributeNameInput')).not.toBeInTheDocument();

        // Reverts to the auto-derived slug, since this was the first-ever edit session.
        expect(screen.getByTestId('attributeUniqueNameValue')).toHaveTextContent('my_attribute');
    });

    it('disables the Display name input, Name input, and Edit/Done link while saving', async () => {
        let resolveCreate: (value: PropertyField) => void = () => {};
        jest.spyOn(Client4, 'createPropertyField').mockReturnValue(new Promise((resolve) => {
            resolveCreate = resolve;
        }));

        renderComponent();
        await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'My Attribute');
        await userEvent.click(screen.getByTestId('attributeNameEditLink'));
        await userEvent.click(screen.getByTestId('saveSetting'));

        expect(screen.getByTestId('attributeDisplayNameInput')).toBeDisabled();
        expect(screen.getByTestId('attributeNameInput')).toBeDisabled();
        expect(screen.getByTestId('attributeNameEditLink')).toBeDisabled();

        resolveCreate({} as PropertyField);
        await waitFor(() => expect(mockHistoryPush).toHaveBeenCalled());
    });

    it('does not navigate or update state if the save resolves after the component has unmounted', async () => {
        let resolveCreate: (value: PropertyField) => void = () => {};
        jest.spyOn(Client4, 'createPropertyField').mockReturnValue(new Promise((resolve) => {
            resolveCreate = resolve;
        }));

        const {unmount} = renderComponent();
        await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'My Attribute');
        await userEvent.click(screen.getByTestId('saveSetting'));

        unmount();
        resolveCreate({} as PropertyField);

        // Flush the resolved promise's continuation without triggering an
        // act() warning or a post-unmount navigation/dispatch.
        await waitFor(() => Promise.resolve());
        expect(mockHistoryPush).not.toHaveBeenCalled();
        expect(mockSetNavigationBlocked).not.toHaveBeenCalledWith(false);
    });

    it('clears a stale server save error once the display name is edited again', async () => {
        jest.spyOn(Client4, 'createPropertyField').mockRejectedValue(makeClientError('app.property_field.create.name_conflict.app_error'));

        renderComponent();
        await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'My Attribute');
        await userEvent.click(screen.getByTestId('saveSetting'));

        expect(await screen.findByText(/already exists/i)).toBeInTheDocument();

        await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), ' Two');

        expect(screen.queryByText(/already exists/i)).not.toBeInTheDocument();
    });

    it('clears a stale server save error once the manual Name is edited again', async () => {
        jest.spyOn(Client4, 'createPropertyField').mockRejectedValue(makeClientError('app.property_field.create.name_conflict.app_error'));

        renderComponent();
        await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'My Attribute');
        await userEvent.click(screen.getByTestId('saveSetting'));

        expect(await screen.findByText(/already exists/i)).toBeInTheDocument();

        await userEvent.click(screen.getByTestId('attributeNameEditLink'));
        await userEvent.type(screen.getByTestId('attributeNameInput'), '2');

        expect(screen.queryByText(/already exists/i)).not.toBeInTheDocument();
    });

    it('exposes the unique name caption as a live region so the auto-slug is announced as it changes', () => {
        renderComponent();
        expect(screen.getByTestId('attributeUniqueNameCaption')).toHaveAttribute('aria-live', 'polite');
    });
});
