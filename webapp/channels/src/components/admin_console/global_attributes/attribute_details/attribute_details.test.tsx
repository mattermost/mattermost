// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createMemoryHistory} from 'history';
import React from 'react';
import {Route} from 'react-router-dom';

import {ClientError} from '@mattermost/client';
import type {PropertyField} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';

import ModalController from 'components/modal_controller';

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

function makeClientError(serverErrorId: string, message = 'error'): ClientError {
    return new ClientError('https://example.com', {
        message,
        server_error_id: serverErrorId,
        status_code: 422,
        url: 'https://example.com/api/v4/properties/groups/access_control/template/fields',
    });
}

describe('AttributeDetails', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    const renderComponent = () => renderWithContext(
        <div>
            <AttributeDetails/>
            <ModalController/>
        </div>,
    );

    it('renders the empty auto-slug caption as a dash, not the _copy sentinel', () => {
        renderComponent();
        expect(screen.getByTestId('attributeUniqueNameCaption')).toHaveTextContent('Unique name:');
        expect(screen.getByTestId('attributeUniqueNameValue')).toHaveTextContent('—');
    });

    it('updates the auto-slug caption live as the display name is typed', async () => {
        renderComponent();

        await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'My Attribute');

        expect(screen.getByTestId('attributeUniqueNameValue')).toHaveTextContent('my_attribute');
    });

    it('shows an inline error for an auto-slugged reserved word without clicking Edit, and disables Save', async () => {
        renderComponent();

        await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'For');

        expect(screen.getByTestId('attributeUniqueNameValue')).toHaveTextContent('for');
        expect(screen.getByTestId('attributeUniqueNameError')).toHaveTextContent('reserved word');
        expect(screen.getByTestId('saveSetting')).toBeDisabled();
    });

    it('disables Save while the display name is empty', () => {
        renderComponent();
        expect(screen.getByTestId('saveSetting')).toBeDisabled();
    });

    it('reveals a focused editable Name input seeded with the current slug when Edit is clicked', async () => {
        renderComponent();

        await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'My Attribute');
        await userEvent.click(screen.getByTestId('attributeNameEditLink'));

        const nameInput = screen.getByTestId('attributeNameInput');
        expect(nameInput).toHaveValue('my_attribute');
        expect(nameInput).toHaveFocus();
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

    it('keeps auto-derivation live if Done is clicked without changing the seeded value', async () => {
        renderComponent();

        await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'My Attribute');
        await userEvent.click(screen.getByTestId('attributeNameEditLink'));
        await userEvent.click(screen.getByTestId('attributeNameEditLink'));

        expect(screen.getByTestId('attributeUniqueNameValue')).toHaveTextContent('my_attribute');

        // Auto-derivation must still be live -- opening and closing Edit without
        // an actual change must not freeze the Name to the seeded snapshot.
        await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), ' Two');
        expect(screen.getByTestId('attributeUniqueNameValue')).toHaveTextContent('my_attribute_two');
    });

    it('exits edit mode on blur without pinning if the seeded value was not changed', async () => {
        renderComponent();

        await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'My Attribute');
        await userEvent.click(screen.getByTestId('attributeNameEditLink'));
        await userEvent.click(screen.getByTestId('attributeDisplayNameInput'));

        expect(screen.queryByTestId('attributeNameInput')).not.toBeInTheDocument();
        expect(screen.getByTestId('attributeNameEditLink')).toHaveTextContent('Edit');
        expect(screen.getByTestId('attributeUniqueNameValue')).toHaveTextContent('my_attribute');

        await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), ' Two');
        expect(screen.getByTestId('attributeUniqueNameValue')).toHaveTextContent('my_attribute_two');
    });

    it('commits a typed Name on blur and stops auto-derivation', async () => {
        renderComponent();

        await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'My Attribute');
        await userEvent.click(screen.getByTestId('attributeNameEditLink'));

        const nameInput = screen.getByTestId('attributeNameInput');
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'custom_name');
        await userEvent.click(screen.getByTestId('attributeDisplayNameInput'));

        expect(screen.queryByTestId('attributeNameInput')).not.toBeInTheDocument();
        expect(screen.getByTestId('attributeUniqueNameValue')).toHaveTextContent('custom_name');

        await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), ' Two');
        expect(screen.getByTestId('attributeUniqueNameValue')).toHaveTextContent('custom_name');
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

    it('refuses to commit an invalid Name via Done, Enter, or blur, keeping the editor open', async () => {
        renderComponent();

        await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'My Attribute');
        await userEvent.click(screen.getByTestId('attributeNameEditLink'));

        const nameInput = screen.getByTestId('attributeNameInput');
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'for');

        const doneLink = screen.getByTestId('attributeNameEditLink');
        expect(doneLink).toHaveAttribute('aria-disabled', 'true');
        expect(doneLink).toHaveAttribute('aria-describedby', 'attribute-unique-name-error');

        await userEvent.click(doneLink);
        expect(screen.getByTestId('attributeNameInput')).toHaveValue('for');
        expect(screen.getByTestId('attributeNameEditLink')).toHaveTextContent('Done');

        await userEvent.type(screen.getByTestId('attributeNameInput'), '{Enter}');
        expect(screen.getByTestId('attributeNameInput')).toHaveValue('for');
        expect(screen.getByTestId('attributeUniqueNameError')).toHaveTextContent('reserved word');

        await userEvent.click(screen.getByTestId('attributeDisplayNameInput'));
        expect(screen.getByTestId('attributeNameInput')).toHaveValue('for');
        expect(screen.getByTestId('attributeNameEditLink')).toHaveTextContent('Done');
    });

    it('commits the Name once the invalid value is corrected', async () => {
        renderComponent();

        await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'My Attribute');
        await userEvent.click(screen.getByTestId('attributeNameEditLink'));

        const nameInput = screen.getByTestId('attributeNameInput');
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'for');
        await userEvent.click(screen.getByTestId('attributeNameEditLink'));
        expect(screen.getByTestId('attributeNameInput')).toBeInTheDocument();

        await userEvent.type(nameInput, '_each');

        const doneLink = screen.getByTestId('attributeNameEditLink');
        expect(doneLink).not.toHaveAttribute('aria-disabled');

        await userEvent.click(doneLink);
        expect(screen.queryByTestId('attributeNameInput')).not.toBeInTheDocument();
        expect(screen.getByTestId('attributeUniqueNameValue')).toHaveTextContent('for_each');
        expect(screen.queryByTestId('attributeUniqueNameError')).not.toBeInTheDocument();
    });

    it('lets Done through on an emptied field even after an invalid value was typed, applying the usual revert', async () => {
        renderComponent();

        await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'My Attribute');
        await userEvent.click(screen.getByTestId('attributeNameEditLink'));

        const nameInput = screen.getByTestId('attributeNameInput');
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'for');
        await userEvent.clear(nameInput);

        // An empty field has no validation error, so Done is live again -- this
        // is the escape hatch that keeps the blocked Done from being a trap.
        const doneLink = screen.getByTestId('attributeNameEditLink');
        expect(doneLink).not.toHaveAttribute('aria-disabled');

        await userEvent.click(doneLink);
        expect(screen.queryByTestId('attributeNameInput')).not.toBeInTheDocument();
        expect(screen.getByTestId('attributeUniqueNameValue')).toHaveTextContent('my_attribute');
    });

    it('lets Escape out of an edit session left in an invalid state', async () => {
        renderComponent();

        await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'My Attribute');
        await userEvent.click(screen.getByTestId('attributeNameEditLink'));

        const nameInput = screen.getByTestId('attributeNameInput');
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'for{Escape}');

        expect(screen.queryByTestId('attributeNameInput')).not.toBeInTheDocument();
        expect(screen.getByTestId('attributeUniqueNameValue')).toHaveTextContent('my_attribute');
        expect(screen.queryByTestId('attributeUniqueNameError')).not.toBeInTheDocument();
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

    it('typing an option without pressing Enter or Tab leaves Save disabled', async () => {
        renderComponent();
        await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'My Attribute');
        await userEvent.click(screen.getByTestId('attributeTypeMenuButton'));
        await userEvent.click(screen.getByRole('menuitemradio', {name: 'Select'}));

        await userEvent.type(screen.getByTestId('attributeOptionsValues__addInput'), 'Engineering');

        expect(screen.getByTestId('attributeOptionsRequiredError')).toBeInTheDocument();
        expect(screen.getByTestId('saveSetting')).toBeDisabled();
        expect(screen.queryAllByTestId('attributeOptionsValues__chip')).toHaveLength(0);
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
        ['model.cpa_field.name.invalid_charset.app_error', 'must start with a letter', undefined],
        ['model.cpa_field.name.reserved_word.app_error', 'reserved word', undefined],
        ['app.property_field.create.limit_reached.app_error', 'maximum number', undefined],
        ['app.property_field.invalid_attrs.app_error', 'problem with one or more options', undefined],
    ])('renders specific inline copy for %s', async (serverErrorId, expectedText, message) => {
        jest.spyOn(Client4, 'createPropertyField').mockRejectedValue(makeClientError(serverErrorId, message));

        renderComponent();
        await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'My Attribute');
        await userEvent.click(screen.getByTestId('saveSetting'));

        expect(await screen.findByText(new RegExp(expectedText, 'i'))).toBeInTheDocument();
        expect(mockHistoryPush).not.toHaveBeenCalled();
        expect(screen.getByTestId('saveSetting')).not.toBeDisabled();
    });

    it('renders the server\'s own message for a name conflict, since it names the specific field and level', async () => {
        const serverMessage = 'Cannot create property "classification": a property with this name already exists at the system level.';
        jest.spyOn(Client4, 'createPropertyField').mockRejectedValue(
            makeClientError('app.property_field.create.name_conflict.app_error', serverMessage),
        );

        renderComponent();
        await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'Classification');
        await userEvent.click(screen.getByTestId('saveSetting'));

        expect(await screen.findByText(serverMessage)).toBeInTheDocument();
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

        expect(screen.getByTestId('attributeUniqueNameValue')).toHaveTextContent('—');
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

    it('pressing Escape after a manual name was already committed restores the committed value, not the auto-derived slug', async () => {
        renderComponent();

        await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'My Attribute');
        await userEvent.click(screen.getByTestId('attributeNameEditLink'));

        let nameInput = screen.getByTestId('attributeNameInput');
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'committed_name{Enter}');
        expect(screen.getByTestId('attributeUniqueNameValue')).toHaveTextContent('committed_name');

        // Reopen the editor and change the value, then discard via Escape.
        await userEvent.click(screen.getByTestId('attributeNameEditLink'));
        nameInput = screen.getByTestId('attributeNameInput');
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'discarded_name{Escape}');

        expect(screen.queryByTestId('attributeNameInput')).not.toBeInTheDocument();

        // Restores the previously-committed manual name, not the auto-derived slug.
        expect(screen.getByTestId('attributeUniqueNameValue')).toHaveTextContent('committed_name');

        // Still manually edited: a further Display name change must not
        // silently re-derive the Name back from it.
        await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), ' Extra');
        expect(screen.getByTestId('attributeUniqueNameValue')).toHaveTextContent('committed_name');
    });

    it('disables the Display name input and Edit link while saving', async () => {
        let resolveCreate: (value: PropertyField) => void = () => {};
        jest.spyOn(Client4, 'createPropertyField').mockReturnValue(new Promise((resolve) => {
            resolveCreate = resolve;
        }));

        renderComponent();
        await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'My Attribute');
        await userEvent.click(screen.getByTestId('attributeNameEditLink'));
        await userEvent.click(screen.getByTestId('saveSetting'));

        // Clicking Save blurs the Name input first, which commits like Done.
        expect(screen.getByTestId('attributeDisplayNameInput')).toBeDisabled();
        expect(screen.queryByTestId('attributeNameInput')).not.toBeInTheDocument();
        expect(screen.getByTestId('attributeNameEditLink')).toBeDisabled();

        resolveCreate({} as PropertyField);
        await waitFor(() => expect(mockHistoryPush).toHaveBeenCalled());
    });

    it('does not navigate or update state if the save resolves after the component has unmounted', async () => {
        let resolveCreate: (value: PropertyField) => void = () => {};
        const createPromise = new Promise<PropertyField>((resolve) => {
            resolveCreate = resolve;
        });
        jest.spyOn(Client4, 'createPropertyField').mockReturnValue(createPromise);

        const {unmount} = renderComponent();
        await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'My Attribute');
        await userEvent.click(screen.getByTestId('saveSetting'));

        unmount();
        resolveCreate({} as PropertyField);

        // Await the hanging create, then one extra tick so handleSave's
        // await resumes and finalizeSave runs -- waitFor(() => Promise.resolve())
        // returns on the first check and can pass before the mount guard.
        await createPromise;
        await Promise.resolve();
        expect(mockHistoryPush).not.toHaveBeenCalled();
        expect(mockSetNavigationBlocked).not.toHaveBeenCalledWith(false);
    });

    it('clears a stale server save error once the display name is edited again', async () => {
        jest.spyOn(Client4, 'createPropertyField').mockRejectedValue(makeClientError('app.property_field.create.name_conflict.app_error', 'An attribute with this name already exists.'));

        renderComponent();
        await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'My Attribute');
        await userEvent.click(screen.getByTestId('saveSetting'));

        expect(await screen.findByText(/already exists/i)).toBeInTheDocument();

        await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), ' Two');

        expect(screen.queryByText(/already exists/i)).not.toBeInTheDocument();
    });

    it('clears a stale server save error once the manual Name is edited again', async () => {
        jest.spyOn(Client4, 'createPropertyField').mockRejectedValue(makeClientError('app.property_field.create.name_conflict.app_error', 'An attribute with this name already exists.'));

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

    describe('external source linking', () => {
        // Opens the "add" trigger's menu item for `sourceNameRegex`, types
        // `value` into the modal, saves, and waits for the modal to fully
        // close (its onSave is async, and GenericModal's exit transition
        // needs a tick) before returning -- without this wait, a second
        // link/edit action in the same test can open a new modal while the
        // first is still mid-exit, racing react-overlays' focus trap.
        const linkViaMenu = async (sourceNameRegex: RegExp, value: string) => {
            await userEvent.click(screen.getByTestId('attributeExternalSourceTrigger'));
            await userEvent.click(screen.getByRole('menuitem', {name: sourceNameRegex}));
            await userEvent.type(await screen.findByPlaceholderText('department'), value);
            await userEvent.click(screen.getByRole('button', {name: 'Save'}));
            await waitFor(() => expect(screen.queryByPlaceholderText('department')).not.toBeInTheDocument());
        };

        it('linking a source forces Type to Text and marks the page dirty', async () => {
            renderComponent();

            await userEvent.click(screen.getByTestId('attributeTypeMenuButton'));
            await userEvent.click(screen.getByRole('menuitemradio', {name: 'Select'}));
            mockSetNavigationBlocked.mockClear();

            await linkViaMenu(/AD\/LDAP/, 'employeeID');

            expect(screen.getByTestId('attributeTypeMenuButton')).toHaveTextContent('Text');
            expect(screen.getByTestId('attributeTypeMenuButton')).toBeDisabled();
            expect(screen.getByTestId('attributeExternalSourceSynced')).toHaveTextContent(/^Synced with/);
            expect(screen.queryByTestId('attributeOptionsHelp')).not.toBeInTheDocument();
            expect(mockSetNavigationBlocked).toHaveBeenCalledWith(true);
        });

        it('linking one source never affects the other -- both may be linked simultaneously', async () => {
            renderComponent();

            await linkViaMenu(/AD\/LDAP/, 'employeeID');
            await linkViaMenu(/^SAML/, 'position');

            expect(screen.getByTestId('attributeExternalSourceChip-ldap')).toBeInTheDocument();
            expect(screen.getByTestId('attributeExternalSourceChip-saml')).toBeInTheDocument();
        });

        it('disables the Type menu while a source is linked, and re-enables it after the last chip is removed', async () => {
            renderComponent();

            expect(screen.getByTestId('attributeTypeMenuButton')).not.toBeDisabled();
            expect(screen.getByTestId('attributeOptionsHelp')).toBeInTheDocument();

            await linkViaMenu(/AD\/LDAP/, 'employeeID');
            expect(screen.getByTestId('attributeTypeMenuButton')).toBeDisabled();
            expect(screen.getByTestId('attributeTypeMenuButton')).toHaveTextContent('Text');
            expect(screen.queryByTestId('attributeOptionsHelp')).not.toBeInTheDocument();

            await linkViaMenu(/^SAML/, 'position');
            expect(screen.getByTestId('attributeTypeMenuButton')).toBeDisabled();

            // Removing one of two links must keep Type locked
            await userEvent.click(screen.getByTestId('attributeExternalSourceChip-ldap-remove'));
            expect(screen.getByTestId('attributeTypeMenuButton')).toBeDisabled();

            await userEvent.click(screen.getByTestId('attributeExternalSourceChip-saml-remove'));
            expect(screen.getByTestId('attributeTypeMenuButton')).not.toBeDisabled();
            expect(screen.getByTestId('attributeOptionsHelp')).toBeInTheDocument();
            expect(screen.queryByTestId('attributeExternalSourceSynced')).not.toBeInTheDocument();

            await userEvent.click(screen.getByTestId('attributeTypeMenuButton'));
            await userEvent.click(screen.getByRole('menuitemradio', {name: 'Select'}));
            expect(screen.getByTestId('attributeTypeMenuButton')).toHaveTextContent('Select');
        });

        it('shows a dedicated tooltip for the external-source type lock, not the accessible name', async () => {
            renderComponent();
            await linkViaMenu(/AD\/LDAP/, 'employeeID');

            expect(screen.getByTestId('attributeTypeMenuButton')).toHaveAccessibleName('Type: Text. Locked while linked to an external source.');

            await userEvent.hover(screen.getByTestId('attributeTypeLockWrap'));
            const tooltip = await screen.findByRole('tooltip', {}, {timeout: 1000});
            expect(tooltip).toHaveTextContent('Type cannot be changed while this attribute is linked to an external source.');
            expect(tooltip).not.toHaveTextContent('Type: Text.');
        });

        it('re-saving a linked chip with the unchanged value is a no-op -- no extra dirty-marking dispatch', async () => {
            renderComponent();

            await linkViaMenu(/AD\/LDAP/, 'employeeID');
            mockSetNavigationBlocked.mockClear();

            await userEvent.click(screen.getByTestId('attributeExternalSourceChip-ldap-edit'));
            await screen.findByPlaceholderText('department');
            await userEvent.click(screen.getByRole('button', {name: 'Save'}));
            await waitFor(() => expect(screen.queryByPlaceholderText('department')).not.toBeInTheDocument());

            expect(mockSetNavigationBlocked).not.toHaveBeenCalled();
        });

        it('sends attrs.ldap and attrs.saml in the create payload when linked, omitting both when not', async () => {
            const createPropertyField = jest.spyOn(Client4, 'createPropertyField').mockResolvedValue({} as PropertyField);

            renderComponent();
            await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'My Attribute');

            await linkViaMenu(/AD\/LDAP/, 'employeeID');

            await userEvent.click(screen.getByTestId('saveSetting'));

            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalled());
            expect(createPropertyField).toHaveBeenCalledWith('access_control', 'template', expect.objectContaining({
                attrs: expect.objectContaining({ldap: 'employeeID'}),
            }));
            const attrs = createPropertyField.mock.calls[0][2].attrs as Record<string, unknown>;
            expect(attrs).not.toHaveProperty('saml');
        });
    });

    describe('applies to', () => {
        // Opens the header Add-resource menu and picks `label` -- a non-
        // checkbox/radio Menu.Item defers its onClick until after the menu's
        // close transition (menu_item.tsx), so callers must await the row
        // actually appearing rather than asserting immediately after the click.
        const addResource = async (label: string, resourceType: string) => {
            await userEvent.click(screen.getByTestId('attributeAppliesToAddResourceButtonHeader'));
            await userEvent.click(screen.getByRole('menuitem', {name: label}));
            await waitFor(() => expect(screen.getByTestId(`attributeAppliesToRow-${resourceType}`)).toBeInTheDocument());
        };

        it('creates one linked field per selected resource, in selection order, with linked_field_id and attrs populated', async () => {
            const createPropertyField = jest.spyOn(Client4, 'createPropertyField').
                mockResolvedValueOnce({id: 'template-id'} as PropertyField).
                mockResolvedValueOnce({id: 'user-field-id'} as PropertyField).
                mockResolvedValueOnce({id: 'channel-field-id'} as PropertyField);

            renderComponent();
            await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'My Attribute');
            await addResource('Users', 'user');
            await addResource('Channels', 'channel');
            await userEvent.click(screen.getByTestId('saveSetting'));

            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalled());

            expect(createPropertyField).toHaveBeenNthCalledWith(1, 'access_control', 'template', expect.objectContaining({
                name: 'my_attribute',
            }));
            expect(createPropertyField).toHaveBeenNthCalledWith(2, 'access_control', 'user', expect.objectContaining({
                name: 'my_attribute',
                type: 'text',
                target_type: 'system',
                target_id: '',
                linked_field_id: 'template-id',
                attrs: {display_name: 'My Attribute'},
            }));
            expect(createPropertyField).toHaveBeenNthCalledWith(3, 'access_control', 'channel', expect.objectContaining({
                linked_field_id: 'template-id',
                attrs: {display_name: 'My Attribute'},
            }));
        });

        it('picks up the current appliesTo value even though canSave does not depend on it (stale-closure regression)', async () => {
            const createPropertyField = jest.spyOn(Client4, 'createPropertyField').
                mockResolvedValueOnce({id: 'template-id'} as PropertyField).
                mockResolvedValueOnce({id: 'user-field-id'} as PropertyField).
                mockResolvedValueOnce({id: 'channel-field-id'} as PropertyField);

            renderComponent();

            // Display name is the only thing typed before resources are
            // added -- no other handleSave dependency changes after this,
            // so if appliesTo were missing from the dependency array,
            // handleSave would still close over the empty array it captured
            // on an earlier render.
            await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'My Attribute');
            await addResource('Users', 'user');
            await addResource('Channels', 'channel');
            await userEvent.click(screen.getByTestId('saveSetting'));

            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalled());
            expect(createPropertyField).toHaveBeenCalledTimes(3);
        });

        it('rolls back the already-created linked field and the template when a later linked-field create fails, and re-enables Save', async () => {
            const deletePropertyField = jest.spyOn(Client4, 'deletePropertyField').mockResolvedValue({status: 'OK'});
            jest.spyOn(Client4, 'createPropertyField').
                mockResolvedValueOnce({id: 'template-id'} as PropertyField).
                mockResolvedValueOnce({id: 'user-field-id'} as PropertyField).
                mockRejectedValueOnce(new Error('boom'));

            renderComponent();
            await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'My Attribute');
            await addResource('Users', 'user');
            await addResource('Channels', 'channel');
            await userEvent.click(screen.getByTestId('saveSetting'));

            await waitFor(() => expect(deletePropertyField).toHaveBeenCalledWith('access_control', 'user', 'user-field-id'));
            await waitFor(() => expect(deletePropertyField).toHaveBeenCalledWith('access_control', 'template', 'template-id'));

            expect(await screen.findByTestId('attributeSaveError')).toHaveTextContent('Channels');
            expect(mockHistoryPush).not.toHaveBeenCalled();
            expect(screen.getByTestId('saveSetting')).not.toBeDisabled();
        });

        it('continues rolling back every linked field even if one delete fails, skips the template delete, and names the survivor', async () => {
            const deletePropertyField = jest.spyOn(Client4, 'deletePropertyField').
                mockImplementationOnce(() => Promise.reject(new Error('delete failed'))).
                mockImplementationOnce(() => Promise.resolve({status: 'OK'}));
            jest.spyOn(Client4, 'createPropertyField').
                mockResolvedValueOnce({id: 'template-id'} as PropertyField).
                mockResolvedValueOnce({id: 'user-field-id'} as PropertyField).
                mockResolvedValueOnce({id: 'channel-field-id'} as PropertyField).
                mockRejectedValueOnce(new Error('boom'));

            renderComponent();
            await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'My Attribute');
            await addResource('Users', 'user');
            await addResource('Channels', 'channel');
            await addResource('Posts', 'post');
            await userEvent.click(screen.getByTestId('saveSetting'));

            await waitFor(() => expect(deletePropertyField).toHaveBeenCalledTimes(2));
            expect(deletePropertyField).toHaveBeenNthCalledWith(1, 'access_control', 'user', 'user-field-id');
            expect(deletePropertyField).toHaveBeenNthCalledWith(2, 'access_control', 'channel', 'channel-field-id');
            expect(deletePropertyField).not.toHaveBeenCalledWith('access_control', 'template', 'template-id');

            const banner = await screen.findByTestId('attributeSaveError');
            expect(banner).toHaveTextContent('My Attribute');
            expect(banner).toHaveTextContent('Users');
            expect(mockHistoryPush).not.toHaveBeenCalled();
            expect(screen.getByTestId('saveSetting')).not.toBeDisabled();
        });

        it.each([
            ['app.property_field.create.name_conflict.app_error', /already used by a User Attribute/i],
            ['app.property_field.create.limit_reached.app_error', /maximum number of User Attributes/i],
            ['app.property_field.create.group_limit_reached.app_error', /maximum number of User Attributes/i],
        ])('renders the distinct CPA banner for a Users-linked-field %s', async (serverErrorId, expectedText) => {
            const deletePropertyField = jest.spyOn(Client4, 'deletePropertyField').mockResolvedValue({status: 'OK'});
            jest.spyOn(Client4, 'createPropertyField').
                mockResolvedValueOnce({id: 'template-id'} as PropertyField).
                mockRejectedValueOnce(makeClientError(serverErrorId, 'server message'));

            renderComponent();
            await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'My Attribute');
            await addResource('Users', 'user');
            await userEvent.click(screen.getByTestId('saveSetting'));

            expect(await screen.findByText(expectedText)).toBeInTheDocument();
            expect(mockHistoryPush).not.toHaveBeenCalled();
            expect(screen.getByTestId('saveSetting')).not.toBeDisabled();

            // Rollback still runs even when the very first linked-field
            // create is the one that fails (createdLinkedFields is empty,
            // so the inner rollback loop runs zero iterations) -- confirms
            // the template itself is still cleaned up in this zero-survivor case.
            expect(deletePropertyField).toHaveBeenCalledWith('access_control', 'template', 'template-id');
        });

        it('renders the generic applies-to banner for a Channels-linked-field name conflict, not the CPA copy', async () => {
            const deletePropertyField = jest.spyOn(Client4, 'deletePropertyField').mockResolvedValue({status: 'OK'});
            jest.spyOn(Client4, 'createPropertyField').
                mockResolvedValueOnce({id: 'template-id'} as PropertyField).
                mockRejectedValueOnce(makeClientError('app.property_field.create.name_conflict.app_error', 'server message'));

            renderComponent();
            await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'My Attribute');
            await addResource('Channels', 'channel');
            await userEvent.click(screen.getByTestId('saveSetting'));

            const banner = await screen.findByTestId('attributeSaveError');
            expect(banner).toHaveTextContent('Channels');
            expect(banner).toHaveTextContent('Nothing was saved');
            expect(banner).not.toHaveTextContent('User Attribute');
            expect(deletePropertyField).toHaveBeenCalledWith('access_control', 'template', 'template-id');
        });

        it('reports the leftover template when linked-field rollback succeeds but the template delete fails', async () => {
            jest.spyOn(console, 'error').mockImplementation(() => {});
            jest.spyOn(Client4, 'deletePropertyField').mockRejectedValue(new Error('template delete failed'));
            jest.spyOn(Client4, 'createPropertyField').
                mockResolvedValueOnce({id: 'template-id'} as PropertyField).
                mockRejectedValueOnce(new Error('boom'));

            renderComponent();
            await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'My Attribute');
            await addResource('Channels', 'channel');
            await userEvent.click(screen.getByTestId('saveSetting'));

            const banner = await screen.findByTestId('attributeSaveError');
            expect(banner).toHaveTextContent('My Attribute');
            expect(banner).toHaveTextContent('could not be cleaned up');
            expect(banner).not.toHaveTextContent('Nothing was saved');
            expect(mockHistoryPush).not.toHaveBeenCalled();
            expect(screen.getByTestId('saveSetting')).not.toBeDisabled();
        });

        it('leaves Save enabled with zero Applies-to resources selected (unchanged from current behavior)', async () => {
            jest.spyOn(Client4, 'createPropertyField').mockResolvedValue({id: 'template-id'} as PropertyField);

            renderComponent();
            await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'My Attribute');
            expect(screen.getByTestId('saveSetting')).not.toBeDisabled();

            await userEvent.click(screen.getByTestId('saveSetting'));
            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalled());
        });

        it('does not lock Type while unsaved Applies-to resources sit on a create form', async () => {
            renderComponent();
            await addResource('Users', 'user');

            expect(screen.getByTestId('attributeTypeMenuButton')).not.toBeDisabled();
            expect(screen.queryByTestId('attributeTypeLockWrap')).not.toBeInTheDocument();

            await userEvent.click(screen.getByTestId('attributeTypeMenuButton'));
            await userEvent.click(screen.getByRole('menuitemradio', {name: 'Select'}));
            expect(screen.getByTestId('attributeTypeMenuButton')).toHaveTextContent('Select');
        });

        it('calls markDirty (navigation-blocked, error cleared) when a resource is added', async () => {
            jest.spyOn(Client4, 'createPropertyField').mockRejectedValue(makeClientError('app.property_field.create.name_conflict.app_error', 'already exists'));

            renderComponent();
            await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'My Attribute');
            await userEvent.click(screen.getByTestId('saveSetting'));
            expect(await screen.findByText(/already exists/i)).toBeInTheDocument();

            mockSetNavigationBlocked.mockClear();
            await addResource('Users', 'user');

            expect(mockSetNavigationBlocked).toHaveBeenCalledWith(true);
            expect(screen.queryByText(/already exists/i)).not.toBeInTheDocument();
        });

        it('calls markDirty (navigation-blocked, error cleared) when a resource is removed', async () => {
            jest.spyOn(Client4, 'createPropertyField').mockRejectedValue(makeClientError('app.property_field.create.name_conflict.app_error', 'already exists'));

            renderComponent();
            await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'My Attribute');
            await addResource('Users', 'user');
            await userEvent.click(screen.getByTestId('saveSetting'));
            expect(await screen.findByText(/already exists/i)).toBeInTheDocument();

            mockSetNavigationBlocked.mockClear();
            await userEvent.click(screen.getByTestId('attributeAppliesToRow-user-toggle'));
            await userEvent.click(screen.getByTestId('attributeAppliesToRow-user-remove'));

            expect(mockSetNavigationBlocked).toHaveBeenCalledWith(true);
            expect(screen.queryByText(/already exists/i)).not.toBeInTheDocument();
        });

        it('moves focus to the header Add-resource trigger after removing a resource', async () => {
            renderComponent();
            await addResource('Users', 'user');

            await userEvent.click(screen.getByTestId('attributeAppliesToRow-user-toggle'));
            await userEvent.click(screen.getByTestId('attributeAppliesToRow-user-remove'));

            await waitFor(() => expect(screen.getByTestId('attributeAppliesToAddResourceButtonHeader')).toHaveFocus());
        });

        it('moves focus to the just-added row after adding the 3rd (last) resource, since both triggers unmount in that same render', async () => {
            renderComponent();
            await addResource('Users', 'user');
            await addResource('Channels', 'channel');
            await addResource('Posts', 'post');

            expect(screen.queryByTestId('attributeAppliesToAddResourceButtonHeader')).not.toBeInTheDocument();
            expect(screen.queryByTestId('attributeAppliesToAddResourceButtonInline')).not.toBeInTheDocument();
            await waitFor(() => expect(screen.getByTestId('attributeAppliesToRow-post-toggle')).toHaveFocus());
        });

        it('does not skip the linked-field loop or rollback when unmounted mid-save, on a failing save', async () => {
            let resolveUserCreate: (value: PropertyField) => void = () => {};
            const deletePropertyField = jest.spyOn(Client4, 'deletePropertyField').mockResolvedValue({status: 'OK'});
            jest.spyOn(Client4, 'createPropertyField').
                mockResolvedValueOnce({id: 'template-id'} as PropertyField).
                mockReturnValueOnce(new Promise((resolve) => {
                    resolveUserCreate = resolve;
                })).
                mockRejectedValueOnce(new Error('boom'));

            const {unmount} = renderComponent();
            await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'My Attribute');
            await addResource('Users', 'user');
            await addResource('Channels', 'channel');
            await userEvent.click(screen.getByTestId('saveSetting'));

            // Unmount while the first linked-field create is still pending --
            // the rest of the sequence (this create resolving, the second
            // linked-field create rejecting, and the full rollback) must
            // still run to completion afterward.
            unmount();
            resolveUserCreate({id: 'user-field-id'} as PropertyField);

            await waitFor(() => expect(deletePropertyField).toHaveBeenCalledWith('access_control', 'user', 'user-field-id'));
            await waitFor(() => expect(deletePropertyField).toHaveBeenCalledWith('access_control', 'template', 'template-id'));
        });

        it('does not navigate or unblock navigation after unmounting mid-save, even when every create ultimately succeeds', async () => {
            // Unlike the failing-save test above (whose assertions only prove
            // the loop/rollback ran, since a failure outcome would never reach
            // navigate/dispatch even without the isMountedRef guard), this
            // scenario resolves every create successfully -- making
            // mockHistoryPush/mockSetNavigationBlocked(false) genuinely
            // load-bearing: without the guard in finalizeSave, both WOULD be
            // called once the pending create resolves post-unmount.
            let resolveUserCreate: (value: PropertyField) => void = () => {};
            const userCreatePromise = new Promise<PropertyField>((resolve) => {
                resolveUserCreate = resolve;
            });
            jest.spyOn(Client4, 'createPropertyField').
                mockResolvedValueOnce({id: 'template-id'} as PropertyField).
                mockReturnValueOnce(userCreatePromise);

            const {unmount} = renderComponent();
            await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'My Attribute');
            await addResource('Users', 'user');
            await userEvent.click(screen.getByTestId('saveSetting'));

            unmount();
            resolveUserCreate({id: 'user-field-id'} as PropertyField);

            // Await the hanging create, then one extra tick so handleSave's
            // await resumes and finalizeSave runs -- waitFor(() => Promise.resolve())
            // returns on the first check and can pass before the mount guard.
            await userCreatePromise;
            await Promise.resolve();
            expect(mockHistoryPush).not.toHaveBeenCalled();
            expect(mockSetNavigationBlocked).not.toHaveBeenCalledWith(false);
        });
    });

    describe('edit attribute', () => {
        const FIELD_ID = 'abcdefghijklmnopqrstuvwxyz';

        const addResource = async (label: string, resourceType: string) => {
            await userEvent.click(screen.getByTestId('attributeAppliesToAddResourceButtonHeader'));
            await userEvent.click(screen.getByRole('menuitem', {name: label}));
            await waitFor(() => expect(screen.getByTestId(`attributeAppliesToRow-${resourceType}`)).toBeInTheDocument());
        };

        function makeTemplate(overrides: Partial<PropertyField> = {}): PropertyField {
            return {
                id: FIELD_ID,
                name: 'department',
                type: 'text',
                group_id: 'accesscontrolgroupuuid001',
                object_type: 'template',
                target_id: '',
                target_type: 'system',
                create_at: 1,
                update_at: 1,
                delete_at: 0,
                created_by: '',
                updated_by: '',
                attrs: {display_name: 'Department'},
                ...overrides,
            } as PropertyField;
        }

        function makeLinked(objectType: 'user' | 'channel' | 'post', id: string): PropertyField {
            return {
                id,
                name: 'department',
                type: 'text',
                group_id: 'accesscontrolgroupuuid001',
                object_type: objectType,
                target_id: '',
                target_type: 'system',
                linked_field_id: FIELD_ID,
                create_at: 1,
                update_at: 1,
                delete_at: 0,
                created_by: '',
                updated_by: '',
                attrs: {display_name: 'Department'},
            } as PropertyField;
        }

        function mockLoadedField(field: PropertyField, linked: PropertyField[] = []) {
            jest.spyOn(Client4, 'getPropertyFields').mockImplementation((_group, objectType) => {
                if (objectType === 'template') {
                    return Promise.resolve([field]);
                }
                return Promise.resolve(linked.filter((linkedField) => linkedField.object_type === objectType));
            });
        }

        const renderEdit = () => renderWithContext(
            <div>
                <Route path='/admin_console/system_attributes/manage_attributes/attribute_details/:field_id'>
                    <AttributeDetails/>
                </Route>
                <ModalController/>
            </div>,
            {},
            {
                history: createMemoryHistory({
                    initialEntries: [`/admin_console/system_attributes/manage_attributes/attribute_details/${FIELD_ID}`],
                }),
            },
        );

        const waitForForm = () => waitFor(() => expect(screen.getByTestId('attributeDetails')).toBeInTheDocument());

        it('prefills Definition and Applies-to from the loaded field without marking the page dirty', async () => {
            mockLoadedField(makeTemplate({
                type: 'select',
                attrs: {
                    display_name: 'Department',
                    options: [{id: 'opt-1', name: 'Engineering'}],
                    ldap: 'dept',
                },
            }), [makeLinked('user', 'user-field')]);

            renderEdit();
            await waitForForm();

            expect(screen.getByRole('heading', {name: 'Edit attribute'})).toBeInTheDocument();
            expect(screen.getByTestId('attributeDisplayNameInput')).toHaveValue('Department');
            expect(screen.getByTestId('attributeUniqueNameValue')).toHaveTextContent('department');
            expect(screen.getByTestId('attributeTypeMenuButton')).toHaveTextContent('Select');
            expect(screen.getByTestId('attributeAppliesToRow-user')).toBeInTheDocument();
            expect(screen.getByTestId('saveSetting')).toBeDisabled();
            expect(mockSetNavigationBlocked).not.toHaveBeenCalled();
        });

        it('does not move focus to an Applies-to row when loading a field that already applies to every resource type', async () => {
            mockLoadedField(makeTemplate(), [
                makeLinked('user', 'user-field'),
                makeLinked('channel', 'channel-field'),
                makeLinked('post', 'post-field'),
            ]);

            renderEdit();
            await waitForForm();

            await waitFor(() => expect(screen.getByTestId('attributeDisplayNameInput')).toHaveFocus());
            expect(screen.getByTestId('attributeAppliesToRow-post-toggle')).not.toHaveFocus();
        });

        it('does not re-slug Unique name when Display name changes', async () => {
            mockLoadedField(makeTemplate());
            renderEdit();
            await waitForForm();

            await userEvent.clear(screen.getByTestId('attributeDisplayNameInput'));
            await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), 'New Label');

            expect(screen.getByTestId('attributeUniqueNameValue')).toHaveTextContent('department');
        });

        it('skips name validation while Unique name is unchanged, then validates once it changes', async () => {
            mockLoadedField(makeTemplate({name: 'for', attrs: {display_name: 'For'}}));
            renderEdit();
            await waitForForm();

            expect(screen.queryByTestId('attributeUniqueNameError')).not.toBeInTheDocument();

            await userEvent.click(screen.getByTestId('attributeNameEditLink'));
            const nameInput = screen.getByTestId('attributeNameInput');
            await userEvent.clear(nameInput);
            await userEvent.type(nameInput, 'if');

            expect(screen.getByTestId('attributeUniqueNameError')).toHaveTextContent('reserved word');
        });

        it('PATCHes the existing field and does not POST a new template', async () => {
            mockLoadedField(makeTemplate());
            const patchPropertyField = jest.spyOn(Client4, 'patchPropertyField').mockResolvedValue(makeTemplate());
            const createPropertyField = jest.spyOn(Client4, 'createPropertyField');

            renderEdit();
            await waitForForm();

            await userEvent.type(screen.getByTestId('attributeDisplayNameInput'), ' 2');
            await userEvent.click(screen.getByTestId('saveSetting'));

            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalledWith('/admin_console/system_attributes/manage_attributes'));
            expect(createPropertyField).not.toHaveBeenCalled();
            expect(patchPropertyField).toHaveBeenCalledWith('access_control', 'template', FIELD_ID, expect.objectContaining({
                type: 'text',
                attrs: expect.objectContaining({display_name: 'Department 2'}),
            }));
            expect(patchPropertyField.mock.calls[0][3]).not.toHaveProperty('name');
        });

        it('keeps existing option IDs on PATCH and sends an empty id for newly added options', async () => {
            mockLoadedField(makeTemplate({
                type: 'select',
                attrs: {
                    display_name: 'Department',
                    options: [{id: 'opt-1', name: 'Engineering'}],
                },
            }));
            const patchPropertyField = jest.spyOn(Client4, 'patchPropertyField').mockResolvedValue(makeTemplate({type: 'select'}));

            renderEdit();
            await waitForForm();

            await userEvent.type(screen.getByTestId('attributeOptionsValues__addInput'), 'Sales{Enter}');
            await userEvent.click(screen.getByTestId('saveSetting'));

            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalled());
            expect(patchPropertyField).toHaveBeenCalledWith('access_control', 'template', FIELD_ID, expect.objectContaining({
                attrs: expect.objectContaining({
                    options: [{id: 'opt-1', name: 'Engineering'}, {id: '', name: 'Sales'}],
                }),
            }));
        });

        it('locks Type while a pending Applies-to resource is on the form, and unlocks after local remove-all', async () => {
            mockLoadedField(makeTemplate(), [makeLinked('user', 'user-field')]);
            renderEdit();
            await waitForForm();

            expect(screen.getByTestId('attributeTypeMenuButton')).toBeDisabled();
            expect(screen.getByTestId('attributeTypeLockWrap')).toBeInTheDocument();

            await userEvent.click(screen.getByTestId('attributeAppliesToRow-user-toggle'));
            await userEvent.click(screen.getByTestId('attributeAppliesToRow-user-remove'));

            await waitFor(() => expect(screen.queryByTestId('attributeAppliesToRow-user')).not.toBeInTheDocument());
            expect(screen.getByTestId('attributeTypeMenuButton')).not.toBeDisabled();
            expect(screen.queryByTestId('attributeTypeLockWrap')).not.toBeInTheDocument();
        });

        it('locks Name editing while the attribute is currently applied to a resource', async () => {
            mockLoadedField(makeTemplate(), [makeLinked('user', 'user-field')]);
            renderEdit();
            await waitForForm();

            expect(screen.getByTestId('attributeNameEditLink')).toBeDisabled();
            expect(screen.getByTestId('attributeNameEditLinkLockWrap')).toBeInTheDocument();
        });

        it('does not DELETE a persisted resource until Save, then DELETEs only removed types', async () => {
            mockLoadedField(makeTemplate(), [makeLinked('user', 'user-field'), makeLinked('channel', 'channel-field')]);
            const deletePropertyField = jest.spyOn(Client4, 'deletePropertyField').mockResolvedValue({status: 'OK'});
            jest.spyOn(Client4, 'patchPropertyField').mockResolvedValue(makeTemplate());
            const createPropertyField = jest.spyOn(Client4, 'createPropertyField');

            renderEdit();
            await waitForForm();

            await userEvent.click(screen.getByTestId('attributeAppliesToRow-user-toggle'));
            await userEvent.click(screen.getByTestId('attributeAppliesToRow-user-remove'));
            await waitFor(() => expect(screen.queryByTestId('attributeAppliesToRow-user')).not.toBeInTheDocument());
            expect(deletePropertyField).not.toHaveBeenCalled();

            await userEvent.click(screen.getByTestId('saveSetting'));
            await userEvent.click(await screen.findByRole('button', {name: /remove and save/i}));
            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalled());

            expect(deletePropertyField).toHaveBeenCalledTimes(1);
            expect(deletePropertyField).toHaveBeenCalledWith('access_control', 'user', 'user-field');
            expect(createPropertyField).not.toHaveBeenCalled();
        });

        it('aborts the save without deleting anything when the remove-applies-to confirmation is declined', async () => {
            mockLoadedField(makeTemplate(), [makeLinked('user', 'user-field')]);
            const deletePropertyField = jest.spyOn(Client4, 'deletePropertyField').mockResolvedValue({status: 'OK'});
            const patchPropertyField = jest.spyOn(Client4, 'patchPropertyField');

            renderEdit();
            await waitForForm();

            await userEvent.click(screen.getByTestId('attributeAppliesToRow-user-toggle'));
            await userEvent.click(screen.getByTestId('attributeAppliesToRow-user-remove'));
            await waitFor(() => expect(screen.queryByTestId('attributeAppliesToRow-user')).not.toBeInTheDocument());

            await userEvent.click(screen.getByTestId('saveSetting'));
            await userEvent.click(await screen.findByRole('button', {name: /^cancel$/i}));

            expect(deletePropertyField).not.toHaveBeenCalled();
            expect(patchPropertyField).not.toHaveBeenCalled();
            expect(mockHistoryPush).not.toHaveBeenCalled();
            expect(screen.getByTestId('saveSetting')).toBeEnabled();
        });

        it('POSTs only newly added resource types and skips types that were already persisted', async () => {
            mockLoadedField(makeTemplate(), [makeLinked('user', 'user-field')]);
            jest.spyOn(Client4, 'patchPropertyField').mockResolvedValue(makeTemplate());
            const createPropertyField = jest.spyOn(Client4, 'createPropertyField').mockResolvedValue({id: 'channel-field'} as PropertyField);
            const deletePropertyField = jest.spyOn(Client4, 'deletePropertyField');

            renderEdit();
            await waitForForm();
            await addResource('Channels', 'channel');
            await userEvent.click(screen.getByTestId('saveSetting'));

            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalled());
            expect(createPropertyField).toHaveBeenCalledTimes(1);
            expect(createPropertyField).toHaveBeenCalledWith('access_control', 'channel', expect.objectContaining({
                linked_field_id: FIELD_ID,
            }));
            expect(deletePropertyField).not.toHaveBeenCalled();
        });

        it('issues neither DELETE nor POST when a persisted resource is removed then re-added before Save', async () => {
            mockLoadedField(makeTemplate(), [makeLinked('user', 'user-field')]);
            jest.spyOn(Client4, 'patchPropertyField').mockResolvedValue(makeTemplate());
            const createPropertyField = jest.spyOn(Client4, 'createPropertyField');
            const deletePropertyField = jest.spyOn(Client4, 'deletePropertyField');

            renderEdit();
            await waitForForm();

            await userEvent.click(screen.getByTestId('attributeAppliesToRow-user-toggle'));
            await userEvent.click(screen.getByTestId('attributeAppliesToRow-user-remove'));
            await waitFor(() => expect(screen.queryByTestId('attributeAppliesToRow-user')).not.toBeInTheDocument());
            await addResource('Users', 'user');

            await userEvent.click(screen.getByTestId('saveSetting'));
            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalled());

            expect(deletePropertyField).not.toHaveBeenCalled();
            expect(createPropertyField).not.toHaveBeenCalled();
        });

        it('DELETEs removed resources before PATCHing when type also changes', async () => {
            const callOrder: string[] = [];
            mockLoadedField(makeTemplate(), [makeLinked('user', 'user-field')]);
            const deletePropertyField = jest.spyOn(Client4, 'deletePropertyField').mockImplementation(async () => {
                callOrder.push('delete');
                return {status: 'OK'};
            });
            const patchPropertyField = jest.spyOn(Client4, 'patchPropertyField').mockImplementation(async () => {
                callOrder.push('patch');
                return makeTemplate({type: 'select'});
            });

            renderEdit();
            await waitForForm();

            await userEvent.click(screen.getByTestId('attributeAppliesToRow-user-toggle'));
            await userEvent.click(screen.getByTestId('attributeAppliesToRow-user-remove'));
            await waitFor(() => expect(screen.getByTestId('attributeTypeMenuButton')).not.toBeDisabled());

            await userEvent.click(screen.getByTestId('attributeTypeMenuButton'));
            await userEvent.click(screen.getByRole('menuitemradio', {name: 'Select'}));
            await userEvent.type(screen.getByTestId('attributeOptionsValues__addInput'), 'Engineering{Enter}');
            await userEvent.click(screen.getByTestId('saveSetting'));
            await userEvent.click(await screen.findByRole('button', {name: /remove and save/i}));

            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalled());
            expect(deletePropertyField).toHaveBeenCalled();
            expect(patchPropertyField).toHaveBeenCalled();
            expect(callOrder).toEqual(['delete', 'patch']);
        });

        it('PATCHes before DELETEing when the type has not changed, and does not delete on PATCH failure', async () => {
            mockLoadedField(makeTemplate(), [makeLinked('user', 'user-field')]);
            const callOrder: string[] = [];
            const deletePropertyField = jest.spyOn(Client4, 'deletePropertyField').mockImplementation(async () => {
                callOrder.push('delete');
                return {status: 'OK'};
            });
            const patchPropertyField = jest.spyOn(Client4, 'patchPropertyField').mockImplementation(async () => {
                callOrder.push('patch');
                throw makeClientError('app.property_field.update.name_conflict.app_error');
            });

            renderEdit();
            await waitForForm();

            await userEvent.click(screen.getByTestId('attributeAppliesToRow-user-toggle'));
            await userEvent.click(screen.getByTestId('attributeAppliesToRow-user-remove'));
            await waitFor(() => expect(screen.queryByTestId('attributeAppliesToRow-user')).not.toBeInTheDocument());

            await userEvent.click(screen.getByTestId('saveSetting'));
            await userEvent.click(await screen.findByRole('button', {name: /remove and save/i}));

            expect(await screen.findByTestId('attributeSaveError')).toBeInTheDocument();
            expect(patchPropertyField).toHaveBeenCalledTimes(1);
            expect(deletePropertyField).not.toHaveBeenCalled();
            expect(callOrder).toEqual(['patch']);
            expect(mockHistoryPush).not.toHaveBeenCalled();
        });

        it('reports a partial-save error, not "nothing else was saved", when the PATCH succeeds but the DELETE fails', async () => {
            mockLoadedField(makeTemplate(), [makeLinked('user', 'user-field')]);
            const patchPropertyField = jest.spyOn(Client4, 'patchPropertyField').mockResolvedValue(makeTemplate());
            const deletePropertyField = jest.spyOn(Client4, 'deletePropertyField').mockRejectedValue(new Error('delete failed'));

            renderEdit();
            await waitForForm();

            await userEvent.click(screen.getByTestId('attributeAppliesToRow-user-toggle'));
            await userEvent.click(screen.getByTestId('attributeAppliesToRow-user-remove'));
            await waitFor(() => expect(screen.queryByTestId('attributeAppliesToRow-user')).not.toBeInTheDocument());

            await userEvent.click(screen.getByTestId('saveSetting'));
            await userEvent.click(await screen.findByRole('button', {name: /remove and save/i}));

            expect(patchPropertyField).toHaveBeenCalledTimes(1);
            expect(deletePropertyField).toHaveBeenCalledTimes(1);
            expect(mockHistoryPush).not.toHaveBeenCalled();

            const banner = await screen.findByTestId('attributeSaveError');
            expect(banner).toHaveTextContent('The attribute was saved');
            expect(banner).not.toHaveTextContent('Nothing else was saved');
        });

        it('redirects to the listing when the field is plugin-owned', async () => {
            mockLoadedField(makeTemplate({
                attrs: {display_name: 'Plugin field', source_plugin_id: 'com.example.plugin', protected: true},
            }));

            renderEdit();

            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalledWith('/admin_console/system_attributes/manage_attributes'));
            expect(screen.queryByTestId('attributeDetails')).not.toBeInTheDocument();
        });

        it('redirects to the listing when the field is Classification Markings', async () => {
            mockLoadedField(makeTemplate({name: 'classification'}));
            renderEdit();
            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalledWith('/admin_console/system_attributes/manage_attributes'));
            expect(screen.queryByTestId('attributeDetails')).not.toBeInTheDocument();
        });

        it('redirects to the listing when the field is missing', async () => {
            jest.spyOn(Client4, 'getPropertyFields').mockResolvedValue([]);
            renderEdit();
            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalledWith('/admin_console/system_attributes/manage_attributes'));
            expect(screen.queryByTestId('attributeDetails')).not.toBeInTheDocument();
        });
    });
});
