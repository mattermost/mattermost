// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent} from '@testing-library/react';
import {createMemoryHistory} from 'history';
import React from 'react';
import {Route} from 'react-router-dom';

import {ClientError} from '@mattermost/client';
import type {PropertyField} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';
import {DISPLAY_LABEL_HEADER} from 'mattermost-redux/constants/properties';

import ModalController from 'components/modal_controller';

import mergeObjects from 'packages/mattermost-redux/test/merge_objects';
import {renderWithContext, runPostRenderAct, screen, userEvent, waitFor, within} from 'tests/react_testing_utils';

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

        // The page lists user fields and templates on mount to resolve name
        // conflicts, whatever else a test is about. Unmocked that reaches the
        // network, and every case here would log the rejection the page catches.
        // Empty pages give the same outcome that failure did -- nothing to
        // collide with -- and end listPropertyFields' paging loop immediately.
        // A test with fields of its own replaces this wholesale.
        jest.spyOn(Client4, 'getPropertyFields').mockResolvedValue([]);
    });

    const ALL_RESOURCES_STATE = {entities: {general: {
        config: {FeatureFlagChannelAttributes: 'true', FeatureFlagChannelAttributesRequired: 'true', FeatureFlagPostAttributes: 'true'},
        license: {IsLicensed: 'true', SkuShortName: 'advanced'},
    }}};

    // Channels is only offered with its flag on and an Enterprise Advanced
    // licence, Posts only with PostAttributes on, and most cases here exercise
    // all three resources.
    const renderComponent = (graphEnabled = false) => renderWithContext(
        <div>
            <AttributeDetails/>
            <ModalController/>
        </div>,
        mergeObjects(ALL_RESOURCES_STATE, {
            entities: {
                general: {
                    config: {
                        FeatureFlagPropertyFieldGraph: graphEnabled ? 'true' : 'false',
                    },
                },
            },
        }),
    );

    it('renders Definition and Applies to as Compass AdminPanels', () => {
        const {container} = renderComponent();

        expect(container.querySelector('#attribute_definition.AdminPanel')).toBeInTheDocument();
        expect(container.querySelector('#attribute_applies_to.AdminPanel')).toBeInTheDocument();
        expect(screen.getByRole('heading', {name: 'Definition'})).toBeInTheDocument();
        expect(screen.getByText('Display name, type, and options.')).toBeInTheDocument();
        expect(screen.getByRole('heading', {name: 'Applies to'})).toBeInTheDocument();
        expect(screen.getByText('Resources this attribute applies to, and who can set the value on each.')).toBeInTheDocument();
    });

    it('renders the empty auto-slug caption as a dash, not the _copy sentinel', () => {
        renderComponent();
        expect(screen.getByTestId('admin.attribute.unique_name.caption--text')).toHaveTextContent('Unique name:');
        expect(screen.getByTestId('admin.attribute.unique_name.value--text')).toHaveTextContent('—');
    });

    it('updates the auto-slug caption live as the display name is typed', async () => {
        renderComponent();

        await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'My Attribute');

        expect(screen.getByTestId('admin.attribute.unique_name.value--text')).toHaveTextContent('my_attribute');
    });

    it('shows an inline error for an auto-slugged reserved word without clicking Edit, and disables Save', async () => {
        renderComponent();

        await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'For');

        expect(screen.getByTestId('admin.attribute.unique_name.value--text')).toHaveTextContent('for');
        expect(screen.getByTestId('admin.attribute.unique_name.error--alert')).toHaveTextContent('reserved word');
        expect(screen.getByTestId('admin.save--button')).toBeDisabled();
    });

    it('disables Save while the display name is empty', () => {
        renderComponent();
        expect(screen.getByTestId('admin.save--button')).toBeDisabled();
    });

    it('reveals a focused editable Name input seeded with the current slug when Edit is clicked', async () => {
        renderComponent();

        await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'My Attribute');
        await userEvent.click(screen.getByTestId('admin.attribute.unique_name.edit--button'));

        const nameInput = screen.getByTestId('admin.attribute.unique_name.input--textbox');
        expect(nameInput).toHaveValue('my_attribute');
        expect(nameInput).toHaveFocus();
    });

    it('swaps the Edit link to Done while editing, and back to Edit (keeping the typed value) when Done is clicked', async () => {
        renderComponent();

        await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'My Attribute');
        expect(screen.getByTestId('admin.attribute.unique_name.edit--button')).toHaveTextContent('Edit');

        await userEvent.click(screen.getByTestId('admin.attribute.unique_name.edit--button'));
        expect(screen.getByTestId('admin.attribute.unique_name.edit--button')).toHaveTextContent('Done');

        const nameInput = screen.getByTestId('admin.attribute.unique_name.input--textbox');
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'custom_name');

        await userEvent.click(screen.getByTestId('admin.attribute.unique_name.edit--button'));
        expect(screen.getByTestId('admin.attribute.unique_name.edit--button')).toHaveTextContent('Edit');
        expect(screen.getByTestId('admin.attribute.unique_name.value--text')).toHaveTextContent('custom_name');
        expect(screen.queryByTestId('admin.attribute.unique_name.input--textbox')).not.toBeInTheDocument();

        // Re-opening Edit must not re-seed from the (now stale) auto-slug.
        await userEvent.click(screen.getByTestId('admin.attribute.unique_name.edit--button'));
        expect(screen.getByTestId('admin.attribute.unique_name.input--textbox')).toHaveValue('custom_name');
    });

    it('keeps auto-derivation live if Done is clicked without changing the seeded value', async () => {
        renderComponent();

        await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'My Attribute');
        await userEvent.click(screen.getByTestId('admin.attribute.unique_name.edit--button'));
        await userEvent.click(screen.getByTestId('admin.attribute.unique_name.edit--button'));

        expect(screen.getByTestId('admin.attribute.unique_name.value--text')).toHaveTextContent('my_attribute');

        // Auto-derivation must still be live -- opening and closing Edit without
        // an actual change must not freeze the Name to the seeded snapshot.
        await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), ' Two');
        expect(screen.getByTestId('admin.attribute.unique_name.value--text')).toHaveTextContent('my_attribute_two');
    });

    it('exits edit mode on blur without pinning if the seeded value was not changed', async () => {
        renderComponent();

        await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'My Attribute');
        await userEvent.click(screen.getByTestId('admin.attribute.unique_name.edit--button'));
        await userEvent.click(screen.getByTestId('admin.attribute.display_name--textbox'));

        expect(screen.queryByTestId('admin.attribute.unique_name.input--textbox')).not.toBeInTheDocument();
        expect(screen.getByTestId('admin.attribute.unique_name.edit--button')).toHaveTextContent('Edit');
        expect(screen.getByTestId('admin.attribute.unique_name.value--text')).toHaveTextContent('my_attribute');

        await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), ' Two');
        expect(screen.getByTestId('admin.attribute.unique_name.value--text')).toHaveTextContent('my_attribute_two');
    });

    it('commits a typed Name on blur and stops auto-derivation', async () => {
        renderComponent();

        await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'My Attribute');
        await userEvent.click(screen.getByTestId('admin.attribute.unique_name.edit--button'));

        const nameInput = screen.getByTestId('admin.attribute.unique_name.input--textbox');
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'custom_name');
        await userEvent.click(screen.getByTestId('admin.attribute.display_name--textbox'));

        expect(screen.queryByTestId('admin.attribute.unique_name.input--textbox')).not.toBeInTheDocument();
        expect(screen.getByTestId('admin.attribute.unique_name.value--text')).toHaveTextContent('custom_name');

        await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), ' Two');
        expect(screen.getByTestId('admin.attribute.unique_name.value--text')).toHaveTextContent('custom_name');
    });

    it('reverts to auto-derived mode if Done is clicked with an empty field on the very first edit', async () => {
        renderComponent();

        await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'My Attribute');
        await userEvent.click(screen.getByTestId('admin.attribute.unique_name.edit--button'));
        await userEvent.clear(screen.getByTestId('admin.attribute.unique_name.input--textbox'));
        await userEvent.click(screen.getByTestId('admin.attribute.unique_name.edit--button'));

        expect(screen.queryByTestId('admin.attribute.unique_name.input--textbox')).not.toBeInTheDocument();
        expect(screen.getByTestId('admin.attribute.unique_name.value--text')).toHaveTextContent('my_attribute');

        // Auto-derivation should be live again -- further Display name edits update it.
        await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), ' Two');
        expect(screen.getByTestId('admin.attribute.unique_name.value--text')).toHaveTextContent('my_attribute_two');
    });

    it('restores the previously-committed Name if Done is clicked with an empty field on a later edit', async () => {
        renderComponent();

        await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'My Attribute');
        await userEvent.click(screen.getByTestId('admin.attribute.unique_name.edit--button'));
        await userEvent.clear(screen.getByTestId('admin.attribute.unique_name.input--textbox'));
        await userEvent.type(screen.getByTestId('admin.attribute.unique_name.input--textbox'), 'custom_name');
        await userEvent.click(screen.getByTestId('admin.attribute.unique_name.edit--button'));

        // Second edit session: clear it again and click Done.
        await userEvent.click(screen.getByTestId('admin.attribute.unique_name.edit--button'));
        await userEvent.clear(screen.getByTestId('admin.attribute.unique_name.input--textbox'));
        await userEvent.click(screen.getByTestId('admin.attribute.unique_name.edit--button'));

        expect(screen.getByTestId('admin.attribute.unique_name.value--text')).toHaveTextContent('custom_name');

        // Manual override must stay in effect -- further Display name edits do not overwrite it.
        await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), ' Two');
        expect(screen.getByTestId('admin.attribute.unique_name.value--text')).toHaveTextContent('custom_name');
    });

    it('shows an inline error for a charset-invalid or reserved-word Name after Edit, and disables Save', async () => {
        renderComponent();

        await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'My Attribute');
        await userEvent.click(screen.getByTestId('admin.attribute.unique_name.edit--button'));

        const nameInput = screen.getByTestId('admin.attribute.unique_name.input--textbox');
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'for');

        expect(screen.getByText(/reserved word/)).toBeInTheDocument();
        expect(screen.getByTestId('admin.save--button')).toBeDisabled();
    });

    it('refuses to commit an invalid Name via Done, Enter, or blur, keeping the editor open', async () => {
        renderComponent();

        await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'My Attribute');
        await userEvent.click(screen.getByTestId('admin.attribute.unique_name.edit--button'));

        const nameInput = screen.getByTestId('admin.attribute.unique_name.input--textbox');
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'for');

        const doneLink = screen.getByTestId('admin.attribute.unique_name.edit--button');
        expect(doneLink).toHaveAttribute('aria-disabled', 'true');
        expect(doneLink).toHaveAttribute('aria-describedby', 'attribute-unique-name-error');

        await userEvent.click(doneLink);
        expect(screen.getByTestId('admin.attribute.unique_name.input--textbox')).toHaveValue('for');
        expect(screen.getByTestId('admin.attribute.unique_name.edit--button')).toHaveTextContent('Done');

        await userEvent.type(screen.getByTestId('admin.attribute.unique_name.input--textbox'), '{Enter}');
        expect(screen.getByTestId('admin.attribute.unique_name.input--textbox')).toHaveValue('for');
        expect(screen.getByTestId('admin.attribute.unique_name.error--alert')).toHaveTextContent('reserved word');

        await userEvent.click(screen.getByTestId('admin.attribute.display_name--textbox'));
        expect(screen.getByTestId('admin.attribute.unique_name.input--textbox')).toHaveValue('for');
        expect(screen.getByTestId('admin.attribute.unique_name.edit--button')).toHaveTextContent('Done');
    });

    it('commits the Name once the invalid value is corrected', async () => {
        renderComponent();

        await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'My Attribute');
        await userEvent.click(screen.getByTestId('admin.attribute.unique_name.edit--button'));

        const nameInput = screen.getByTestId('admin.attribute.unique_name.input--textbox');
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'for');
        await userEvent.click(screen.getByTestId('admin.attribute.unique_name.edit--button'));
        expect(screen.getByTestId('admin.attribute.unique_name.input--textbox')).toBeInTheDocument();

        await userEvent.type(nameInput, '_each');

        const doneLink = screen.getByTestId('admin.attribute.unique_name.edit--button');
        expect(doneLink).not.toHaveAttribute('aria-disabled');

        await userEvent.click(doneLink);
        expect(screen.queryByTestId('admin.attribute.unique_name.input--textbox')).not.toBeInTheDocument();
        expect(screen.getByTestId('admin.attribute.unique_name.value--text')).toHaveTextContent('for_each');
        expect(screen.queryByTestId('admin.attribute.unique_name.error--alert')).not.toBeInTheDocument();
    });

    it('lets Done through on an emptied field even after an invalid value was typed, applying the usual revert', async () => {
        renderComponent();

        await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'My Attribute');
        await userEvent.click(screen.getByTestId('admin.attribute.unique_name.edit--button'));

        const nameInput = screen.getByTestId('admin.attribute.unique_name.input--textbox');
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'for');
        await userEvent.clear(nameInput);

        // An empty field has no validation error, so Done is live again -- this
        // is the escape hatch that keeps the blocked Done from being a trap.
        const doneLink = screen.getByTestId('admin.attribute.unique_name.edit--button');
        expect(doneLink).not.toHaveAttribute('aria-disabled');

        await userEvent.click(doneLink);
        expect(screen.queryByTestId('admin.attribute.unique_name.input--textbox')).not.toBeInTheDocument();
        expect(screen.getByTestId('admin.attribute.unique_name.value--text')).toHaveTextContent('my_attribute');
    });

    it('lets Escape out of an edit session left in an invalid state', async () => {
        renderComponent();

        await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'My Attribute');
        await userEvent.click(screen.getByTestId('admin.attribute.unique_name.edit--button'));

        const nameInput = screen.getByTestId('admin.attribute.unique_name.input--textbox');
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'for{Escape}');

        expect(screen.queryByTestId('admin.attribute.unique_name.input--textbox')).not.toBeInTheDocument();
        expect(screen.getByTestId('admin.attribute.unique_name.value--text')).toHaveTextContent('my_attribute');
        expect(screen.queryByTestId('admin.attribute.unique_name.error--alert')).not.toBeInTheDocument();
    });

    it('opens the Type menu showing Text, Phone, URL, Select, Multiselect, and Ranked, with Text checked and Email hidden', async () => {
        renderComponent();

        await userEvent.click(screen.getByTestId('admin.attribute.type--button'));

        expect(screen.getByRole('menuitemradio', {name: 'Text'})).toHaveAttribute('aria-checked', 'true');

        for (const label of ['Text', 'Phone', 'URL', 'Select', 'Multiselect', 'Ranked']) {
            const item = screen.getByRole('menuitemradio', {name: new RegExp(`^${label}$`)});
            expect(item).not.toHaveAttribute('aria-disabled', 'true');
            expect(item).not.toHaveTextContent('Coming soon');
        }
        expect(screen.queryByRole('menuitemradio', {name: 'Email'})).not.toBeInTheDocument();
    });

    it('selecting Select from the Type menu updates the button label and swaps in the options chip editor', async () => {
        renderComponent();

        await userEvent.click(screen.getByTestId('admin.attribute.type--button'));
        await userEvent.click(screen.getByRole('menuitemradio', {name: 'Select'}));

        expect(screen.getByTestId('admin.attribute.type--button')).toHaveTextContent('Select');
        expect(screen.getByTestId('admin.attribute.values')).toBeInTheDocument();
        expect(screen.queryByTestId('admin.attribute.options.help--text')).not.toBeInTheDocument();
    });

    it('selecting Rank from the Type menu swaps in the rank chip editor', async () => {
        renderComponent();

        await userEvent.click(screen.getByTestId('admin.attribute.type--button'));
        await userEvent.click(screen.getByRole('menuitemradio', {name: /Ranked/}));

        expect(screen.getByTestId('admin.attribute.ranks')).toBeInTheDocument();
    });

    it('selecting Phone or URL from the Type menu writes attrs.value_type on create and keeps the free-text options help', async () => {
        const createPropertyField = jest.spyOn(Client4, 'createPropertyField').mockResolvedValue({} as PropertyField);

        renderComponent();
        await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'Work phone');
        await userEvent.click(screen.getByTestId('admin.attribute.type--button'));
        await userEvent.click(screen.getByRole('menuitemradio', {name: 'Phone'}));

        expect(screen.getByTestId('admin.attribute.type--button')).toHaveTextContent('Phone');
        expect(screen.getByTestId('admin.attribute.options.help--text')).toBeInTheDocument();
        expect(screen.queryByTestId('admin.attribute.values')).not.toBeInTheDocument();

        await userEvent.click(screen.getByTestId('admin.save--button'));
        await waitFor(() => expect(mockHistoryPush).toHaveBeenCalled());
        expect(createPropertyField).toHaveBeenCalledWith('access_control', 'template', expect.objectContaining({
            type: 'text',
            attrs: {display_name: 'Work phone', value_type: 'phone'},
        }));
    });

    it('saves a URL attribute as type text with attrs.value_type url', async () => {
        const createPropertyField = jest.spyOn(Client4, 'createPropertyField').mockResolvedValue({} as PropertyField);

        renderComponent();
        await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'Homepage');
        await userEvent.click(screen.getByTestId('admin.attribute.type--button'));
        await userEvent.click(screen.getByRole('menuitemradio', {name: 'URL'}));
        await userEvent.click(screen.getByTestId('admin.save--button'));

        await waitFor(() => expect(mockHistoryPush).toHaveBeenCalled());
        expect(createPropertyField).toHaveBeenCalledWith('access_control', 'template', expect.objectContaining({
            type: 'text',
            attrs: {display_name: 'Homepage', value_type: 'url'},
        }));
    });

    it('preserves already-entered options across a Select -> Text -> Select round-trip', async () => {
        renderComponent();

        await userEvent.click(screen.getByTestId('admin.attribute.type--button'));
        await userEvent.click(screen.getByRole('menuitemradio', {name: 'Select'}));
        await userEvent.type(screen.getByTestId('admin.attribute.values.add--textbox'), 'Engineering{Enter}');
        expect(screen.getByText('Engineering')).toBeInTheDocument();

        await userEvent.click(screen.getByTestId('admin.attribute.type--button'));
        await userEvent.click(screen.getByRole('menuitemradio', {name: 'Text'}));
        expect(screen.queryByTestId('admin.attribute.values')).not.toBeInTheDocument();

        await userEvent.click(screen.getByTestId('admin.attribute.type--button'));
        await userEvent.click(screen.getByRole('menuitemradio', {name: 'Select'}));
        expect(screen.getByText('Engineering')).toBeInTheDocument();
    });

    it('assigns rank = index + 1 to every existing option when switching into Rank', async () => {
        renderComponent();

        await userEvent.click(screen.getByTestId('admin.attribute.type--button'));
        await userEvent.click(screen.getByRole('menuitemradio', {name: 'Select'}));
        await userEvent.type(screen.getByTestId('admin.attribute.values.add--textbox'), 'Low{Enter}');
        await userEvent.type(screen.getByTestId('admin.attribute.values.add--textbox'), 'High{Enter}');

        await userEvent.click(screen.getByTestId('admin.attribute.type--button'));
        await userEvent.click(screen.getByRole('menuitemradio', {name: /Ranked/}));

        const chips = screen.getAllByTestId('admin.attribute.ranks.option.label--text');
        expect(chips.map((chip) => chip.textContent)).toEqual(['Low', 'High']);
        expect(screen.getAllByTestId('admin.attribute.ranks.option.badge--text').map((badge) => badge.textContent)).toEqual(['1', '2']);
    });

    it('disables Save with an inline "at least one option is required" message for an option-bearing type with no options', async () => {
        renderComponent();
        await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'My Attribute');
        expect(screen.getByTestId('admin.save--button')).not.toBeDisabled();

        await userEvent.click(screen.getByTestId('admin.attribute.type--button'));
        await userEvent.click(screen.getByRole('menuitemradio', {name: 'Select'}));

        expect(screen.getByTestId('admin.attribute.options.required--alert')).toHaveTextContent('At least one option is required');
        expect(screen.getByTestId('admin.save--button')).toBeDisabled();

        await userEvent.type(screen.getByTestId('admin.attribute.values.add--textbox'), 'Engineering{Enter}');
        expect(screen.queryByTestId('admin.attribute.options.required--alert')).not.toBeInTheDocument();
        expect(screen.getByTestId('admin.save--button')).not.toBeDisabled();
    });

    it('typing an option without pressing Enter or Tab leaves Save disabled', async () => {
        renderComponent();
        await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'My Attribute');
        await userEvent.click(screen.getByTestId('admin.attribute.type--button'));
        await userEvent.click(screen.getByRole('menuitemradio', {name: 'Select'}));

        await userEvent.type(screen.getByTestId('admin.attribute.values.add--textbox'), 'Engineering');

        expect(screen.getByTestId('admin.attribute.options.required--alert')).toBeInTheDocument();
        expect(screen.getByTestId('admin.save--button')).toBeDisabled();
        expect(screen.queryAllByTestId(/^admin\.attribute\.values\.option:/)).toHaveLength(0);
    });

    it('a duplicate option name shows the inline uniqueness error and does not add a second chip', async () => {
        renderComponent();

        await userEvent.click(screen.getByTestId('admin.attribute.type--button'));
        await userEvent.click(screen.getByRole('menuitemradio', {name: 'Select'}));
        await userEvent.type(screen.getByTestId('admin.attribute.values.add--textbox'), 'Engineering{Enter}');
        await userEvent.type(screen.getByTestId('admin.attribute.values.add--textbox'), 'Engineering{Enter}');

        expect(screen.getByText('Values must be unique.')).toBeInTheDocument();
        expect(screen.getAllByTestId(/^admin\.attribute\.values\.option:/)).toHaveLength(1);
    });

    it('calls createAttributeField with the expected shape and navigates to the list on success', async () => {
        const createPropertyField = jest.spyOn(Client4, 'createPropertyField').mockResolvedValue({} as PropertyField);

        renderComponent();
        await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'My Attribute');
        await userEvent.click(screen.getByTestId('admin.save--button'));

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
        await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'My Attribute');
        await userEvent.click(screen.getByTestId('admin.save--button'));

        expect(screen.getByTestId('admin.save--button')).toBeDisabled();

        resolveCreate({} as PropertyField);
        await waitFor(() => expect(mockHistoryPush).toHaveBeenCalled());
    });

    it('saves a Select attribute with the expected attrs.options shape', async () => {
        const createPropertyField = jest.spyOn(Client4, 'createPropertyField').mockResolvedValue({} as PropertyField);

        renderComponent();
        await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'Department');
        await userEvent.click(screen.getByTestId('admin.attribute.type--button'));
        await userEvent.click(screen.getByRole('menuitemradio', {name: 'Select'}));
        await userEvent.type(screen.getByTestId('admin.attribute.values.add--textbox'), 'Engineering{Enter}');
        await userEvent.type(screen.getByTestId('admin.attribute.values.add--textbox'), 'Sales{Enter}');
        await userEvent.click(screen.getByTestId('admin.save--button'));

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
        await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'Clearance');
        await userEvent.click(screen.getByTestId('admin.attribute.type--button'));
        await userEvent.click(screen.getByRole('menuitemradio', {name: /Ranked/}));
        await userEvent.type(screen.getByTestId('admin.attribute.ranks.add--textbox'), 'Low{Enter}');
        await userEvent.type(screen.getByTestId('admin.attribute.ranks.add--textbox'), 'High{Enter}');
        await userEvent.click(screen.getByTestId('admin.save--button'));

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

    describe('applying an attribute to posts', () => {
        const withState = (initialState: Record<string, unknown>) => renderWithContext(
            <div>
                <AttributeDetails/>
                <ModalController/>
            </div>,
            initialState,
        );

        // Channels stays fully enabled here so the assertion below pins the two
        // gates as independent, rather than passing because everything is off.
        it('is not offered without the PostAttributes feature flag', async () => {
            withState(mergeObjects(ALL_RESOURCES_STATE, {entities: {general: {config: {FeatureFlagPostAttributes: 'false'}}}}));

            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.add--button'));

            expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Users', 'Channels']);
        });

        // No licence here: Posts is gated on its flag alone, unlike Channels.
        it('is offered with the PostAttributes feature flag, and adds a Posts row', async () => {
            withState({entities: {general: {config: {FeatureFlagPostAttributes: 'true'}}}});

            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.add--button'));
            expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Users', 'Posts']);

            await userEvent.click(screen.getByRole('menuitem', {name: 'Posts'}));

            expect(await screen.findByTestId('admin.attribute.applies_to.post')).toBeInTheDocument();
        });
    });

    describe('applying an attribute to channels', () => {
        const withoutChannelAttributes = () => renderWithContext(
            <div>
                <AttributeDetails/>
                <ModalController/>
            </div>,
        );

        const template = {id: 'template_id_1234567890abcdef', name: 'my_attribute', type: 'text', target_type: 'system', target_id: ''} as PropertyField;

        const addChannels = async () => {
            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.add--button'));
            await userEvent.click(screen.getByRole('menuitem', {name: 'Channels'}));
            await waitFor(() => expect(screen.getByTestId('admin.attribute.applies_to.channel')).toBeInTheDocument());
        };

        it('is not offered without the feature flag and an Enterprise Advanced licence', async () => {
            withoutChannelAttributes();

            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.add--button'));

            expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Users']);
        });

        it('creates only the template when Channels is not added', async () => {
            const createPropertyField = jest.spyOn(Client4, 'createPropertyField').mockResolvedValue(template);

            renderComponent();
            await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'My Attribute');
            await userEvent.click(screen.getByTestId('admin.save--button'));

            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalled());
            expect(createPropertyField).toHaveBeenCalledTimes(1);
        });

        it('carries the row\'s settings onto the linked channel field', async () => {
            const createPropertyField = jest.spyOn(Client4, 'createPropertyField').mockResolvedValue(template);

            renderComponent();
            await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'My Attribute');
            await addChannels();
            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.channel.toggle--button'));
            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.channel.settings.required--switch'));
            await userEvent.click(screen.getByTestId(`admin.attribute.applies_to.channel.settings.location:${DISPLAY_LABEL_HEADER}--checkbox`));
            await userEvent.click(screen.getByTestId('admin.save--button'));

            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalled());

            expect(createPropertyField).toHaveBeenNthCalledWith(1, 'access_control', 'template', expect.any(Object));
            expect(createPropertyField).toHaveBeenNthCalledWith(2, 'access_control', 'channel', expect.objectContaining({
                linked_field_id: template.id,
                attrs: expect.objectContaining({
                    required: true,
                    actions: [DISPLAY_LABEL_HEADER],
                }),
            }));
        });

        it('sends no channel keys for a row left at its defaults, so the field reads as one created before them', async () => {
            const createPropertyField = jest.spyOn(Client4, 'createPropertyField').mockResolvedValue(template);

            renderComponent();
            await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'My Attribute');
            await addChannels();
            await userEvent.click(screen.getByTestId('admin.save--button'));

            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalled());

            const channelCall = createPropertyField.mock.calls[1][2] as {attrs: Record<string, unknown>};
            expect(Object.keys(channelCall.attrs)).toEqual(['display_name']);
        });

        it('pins who may set the value, since the server would otherwise let any member', async () => {
            const createPropertyField = jest.spyOn(Client4, 'createPropertyField').mockResolvedValue(template);

            renderComponent();
            await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'My Attribute');
            await addChannels();
            await userEvent.click(screen.getByTestId('admin.save--button'));

            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalled());

            expect(createPropertyField).toHaveBeenNthCalledWith(2, 'access_control', 'channel', expect.objectContaining({
                permission_values: 'admin',
            }));

            // Only Channels pins it; the template must keep the server's default.
            expect(createPropertyField.mock.calls[0][2]).not.toHaveProperty('permission_values');
        });

        it('keeps the settings when Channels is removed and added back', async () => {
            const createPropertyField = jest.spyOn(Client4, 'createPropertyField').mockResolvedValue(template);

            renderComponent();
            await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'My Attribute');
            await addChannels();
            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.channel.toggle--button'));
            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.channel.settings.required--switch'));
            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.channel.remove--button'));
            await addChannels();
            await userEvent.click(screen.getByTestId('admin.save--button'));

            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalled());

            expect(createPropertyField).toHaveBeenNthCalledWith(2, 'access_control', 'channel', expect.objectContaining({
                attrs: expect.objectContaining({required: true}),
            }));
        });
    });

    it.each([
        ['model.cpa_field.name.invalid_charset.app_error', 'must start with a letter', undefined],
        ['model.cpa_field.name.reserved_word.app_error', 'reserved word', undefined],
        ['app.property_field.create.limit_reached.app_error', 'maximum number', undefined],
        ['app.property_field.invalid_attrs.app_error', 'problem with one or more options', undefined],
    ])('renders specific inline copy for %s', async (serverErrorId, expectedText, message) => {
        jest.spyOn(Client4, 'createPropertyField').mockRejectedValue(makeClientError(serverErrorId, message));

        renderComponent();
        await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'My Attribute');
        await userEvent.click(screen.getByTestId('admin.save--button'));

        expect(await screen.findByText(new RegExp(expectedText, 'i'))).toBeInTheDocument();
        expect(mockHistoryPush).not.toHaveBeenCalled();
        expect(screen.getByTestId('admin.save--button')).not.toBeDisabled();
    });

    it('renders the server\'s own message for a name conflict, since it names the specific field and level', async () => {
        const serverMessage = 'Cannot create property "classification": a property with this name already exists at the system level.';
        jest.spyOn(Client4, 'createPropertyField').mockRejectedValue(
            makeClientError('app.property_field.create.name_conflict.app_error', serverMessage),
        );

        renderComponent();
        await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'Classification');
        await userEvent.click(screen.getByTestId('admin.save--button'));

        expect(await screen.findByText(serverMessage)).toBeInTheDocument();
        expect(mockHistoryPush).not.toHaveBeenCalled();
        expect(screen.getByTestId('admin.save--button')).not.toBeDisabled();
    });

    it('renders the generic fallback for an unmapped or non-AppError failure and leaves the form usable', async () => {
        jest.spyOn(Client4, 'createPropertyField').mockRejectedValue(new Error('network error'));

        renderComponent();
        await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'My Attribute');
        await userEvent.click(screen.getByTestId('admin.save--button'));

        expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
        expect(screen.getByTestId('admin.save--button')).not.toBeDisabled();
    });

    it('dispatches setNavigationBlocked(true) on display name edits', async () => {
        renderComponent();
        await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'My Attribute');
        expect(mockSetNavigationBlocked).toHaveBeenCalledWith(true);
    });

    it('shows a warning and disables Save when a non-empty Display name auto-slugs to nothing usable', async () => {
        renderComponent();

        await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), '!!!');

        expect(screen.getByTestId('admin.attribute.unique_name.value--text')).toHaveTextContent('—');
        expect(screen.getByTestId('admin.attribute.unique_name.empty--alert')).toHaveTextContent("Couldn't generate a unique name");
        expect(screen.getByTestId('admin.save--button')).toBeDisabled();
    });

    it('pressing Enter in the manual Name input commits the value, same as clicking Done', async () => {
        renderComponent();

        await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'My Attribute');
        await userEvent.click(screen.getByTestId('admin.attribute.unique_name.edit--button'));

        const nameInput = screen.getByTestId('admin.attribute.unique_name.input--textbox');
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'custom_name{Enter}');

        expect(screen.queryByTestId('admin.attribute.unique_name.input--textbox')).not.toBeInTheDocument();
        expect(screen.getByTestId('admin.attribute.unique_name.value--text')).toHaveTextContent('custom_name');
        expect(screen.getByTestId('admin.attribute.unique_name.edit--button')).toHaveTextContent('Edit');
    });

    it('pressing Escape in the manual Name input discards the edit and exits edit mode', async () => {
        renderComponent();

        await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'My Attribute');
        await userEvent.click(screen.getByTestId('admin.attribute.unique_name.edit--button'));

        const nameInput = screen.getByTestId('admin.attribute.unique_name.input--textbox');
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'discarded_name{Escape}');

        expect(screen.queryByTestId('admin.attribute.unique_name.input--textbox')).not.toBeInTheDocument();

        // Reverts to the auto-derived slug, since this was the first-ever edit session.
        expect(screen.getByTestId('admin.attribute.unique_name.value--text')).toHaveTextContent('my_attribute');
    });

    it('pressing Escape after a manual name was already committed restores the committed value, not the auto-derived slug', async () => {
        renderComponent();

        await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'My Attribute');
        await userEvent.click(screen.getByTestId('admin.attribute.unique_name.edit--button'));

        let nameInput = screen.getByTestId('admin.attribute.unique_name.input--textbox');
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'committed_name{Enter}');
        expect(screen.getByTestId('admin.attribute.unique_name.value--text')).toHaveTextContent('committed_name');

        // Reopen the editor and change the value, then discard via Escape.
        await userEvent.click(screen.getByTestId('admin.attribute.unique_name.edit--button'));
        nameInput = screen.getByTestId('admin.attribute.unique_name.input--textbox');
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'discarded_name{Escape}');

        expect(screen.queryByTestId('admin.attribute.unique_name.input--textbox')).not.toBeInTheDocument();

        // Restores the previously-committed manual name, not the auto-derived slug.
        expect(screen.getByTestId('admin.attribute.unique_name.value--text')).toHaveTextContent('committed_name');

        // Still manually edited: a further Display name change must not
        // silently re-derive the Name back from it.
        await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), ' Extra');
        expect(screen.getByTestId('admin.attribute.unique_name.value--text')).toHaveTextContent('committed_name');
    });

    it('disables the Display name input and Edit link while saving', async () => {
        let resolveCreate: (value: PropertyField) => void = () => {};
        jest.spyOn(Client4, 'createPropertyField').mockReturnValue(new Promise((resolve) => {
            resolveCreate = resolve;
        }));

        renderComponent();
        await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'My Attribute');
        await userEvent.click(screen.getByTestId('admin.attribute.unique_name.edit--button'));
        await userEvent.click(screen.getByTestId('admin.save--button'));

        // Clicking Save blurs the Name input first, which commits like Done.
        expect(screen.getByTestId('admin.attribute.display_name--textbox')).toBeDisabled();
        expect(screen.queryByTestId('admin.attribute.unique_name.input--textbox')).not.toBeInTheDocument();
        expect(screen.getByTestId('admin.attribute.unique_name.edit--button')).toBeDisabled();

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
        await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'My Attribute');
        await userEvent.click(screen.getByTestId('admin.save--button'));

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
        await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'My Attribute');
        await userEvent.click(screen.getByTestId('admin.save--button'));

        expect(await screen.findByText(/already exists/i)).toBeInTheDocument();

        await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), ' Two');

        expect(screen.queryByText(/already exists/i)).not.toBeInTheDocument();
    });

    it('clears a stale server save error once the manual Name is edited again', async () => {
        jest.spyOn(Client4, 'createPropertyField').mockRejectedValue(makeClientError('app.property_field.create.name_conflict.app_error', 'An attribute with this name already exists.'));

        renderComponent();
        await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'My Attribute');
        await userEvent.click(screen.getByTestId('admin.save--button'));

        expect(await screen.findByText(/already exists/i)).toBeInTheDocument();

        await userEvent.click(screen.getByTestId('admin.attribute.unique_name.edit--button'));
        await userEvent.type(screen.getByTestId('admin.attribute.unique_name.input--textbox'), '2');

        expect(screen.queryByText(/already exists/i)).not.toBeInTheDocument();
    });

    it('exposes the unique name caption as a live region so the auto-slug is announced as it changes', () => {
        renderComponent();
        expect(screen.getByTestId('admin.attribute.unique_name.caption--text')).toHaveAttribute('aria-live', 'polite');
    });

    describe('external source linking', () => {
        // Opens the "add" trigger's menu item for `sourceNameRegex`, types
        // `value` into the modal, saves, and waits for the modal to fully
        // close (its onSave is async, and GenericModal's exit transition
        // needs a tick) before returning -- without this wait, a second
        // link/edit action in the same test can open a new modal while the
        // first is still mid-exit, racing react-overlays' focus trap.
        const linkViaMenu = async (sourceNameRegex: RegExp, value: string) => {
            await userEvent.click(screen.getByTestId('admin.attribute.external_source.link--button'));
            await userEvent.click(screen.getByRole('menuitem', {name: sourceNameRegex}));
            await userEvent.type(await screen.findByPlaceholderText('department'), value);
            await userEvent.click(screen.getByRole('button', {name: 'Save'}));
            await waitFor(() => expect(screen.queryByPlaceholderText('department')).not.toBeInTheDocument());
        };

        const addResourceAndExpand = async (label: string, type: string) => {
            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.add--button'));
            await userEvent.click(screen.getByRole('menuitem', {name: label}));
            await waitFor(() => expect(screen.getByTestId(`admin.attribute.applies_to.${type}`)).toBeInTheDocument());
            await userEvent.click(screen.getByTestId(`admin.attribute.applies_to.${type}.toggle--button`));
        };

        it('names the linked source as the Users resource\'s Managed-by value, and drops the row once the link is removed', async () => {
            renderComponent();
            await addResourceAndExpand('Users', 'user');

            expect(screen.queryByTestId('admin.attribute.applies_to.user.managed_by--button')).not.toBeInTheDocument();

            await linkViaMenu(/AD\/LDAP/, 'employeeID');

            const managedBy = screen.getByTestId('admin.attribute.applies_to.user.managed_by--button');
            expect(managedBy).toHaveTextContent('AD/LDAP');
            expect(screen.getByText('Not editable in Mattermost.')).toBeInTheDocument();

            // Compared against the Definition block's chip rather than a hard-coded
            // path, so the two glyphs cannot drift apart unnoticed.
            const chipIcon = screen.getByTestId('admin.attribute.external_source.source:ldap').querySelector('svg path');
            expect(chipIcon).not.toBeNull();
            expect(managedBy.querySelector('svg path')).toHaveAttribute('d', chipIcon!.getAttribute('d'));

            await userEvent.click(within(screen.getByTestId('admin.attribute.external_source.source:ldap')).getByTestId('admin.attribute.external_source.source.remove--button'));

            expect(screen.queryByTestId('admin.attribute.applies_to.user.managed_by--button')).not.toBeInTheDocument();
            expect(screen.queryByText('Not editable in Mattermost.')).not.toBeInTheDocument();
        });

        it('shows SAML as the Managed-by value when SAML is the only linked source', async () => {
            renderComponent();
            await addResourceAndExpand('Users', 'user');
            await linkViaMenu(/^SAML/, 'position');

            const managedBy = screen.getByTestId('admin.attribute.applies_to.user.managed_by--button');
            expect(managedBy).toHaveTextContent('SAML');
            expect(managedBy).not.toHaveTextContent('AD/LDAP');

            const chipIcon = screen.getByTestId('admin.attribute.external_source.source:saml').querySelector('svg path');
            expect(chipIcon).not.toBeNull();
            expect(managedBy.querySelector('svg path')).toHaveAttribute('d', chipIcon!.getAttribute('d'));
        });

        it('names AD/LDAP when both sources are linked, and falls back to the survivor once one is unlinked', async () => {
            renderComponent();
            await addResourceAndExpand('Users', 'user');
            await linkViaMenu(/AD\/LDAP/, 'employeeID');
            await linkViaMenu(/^SAML/, 'position');

            expect(screen.getByTestId('admin.attribute.applies_to.user.managed_by--button')).toHaveTextContent('AD/LDAP');

            await userEvent.click(within(screen.getByTestId('admin.attribute.external_source.source:ldap')).getByTestId('admin.attribute.external_source.source.remove--button'));

            expect(screen.getByTestId('admin.attribute.applies_to.user.managed_by--button')).toHaveTextContent('SAML');
        });

        it('reports the source on the Users card alone, leaving the Channels and Posts cards unmarked', async () => {
            renderComponent();
            await linkViaMenu(/AD\/LDAP/, 'employeeID');
            await addResourceAndExpand('Users', 'user');
            await addResourceAndExpand('Channels', 'channel');
            await addResourceAndExpand('Posts', 'post');

            expect(within(screen.getByTestId('admin.attribute.applies_to.user.body--region')).getByTestId('admin.attribute.applies_to.user.managed_by--button')).toBeInTheDocument();
            expect(within(screen.getByTestId('admin.attribute.applies_to.channel.body--region')).queryByText('Not editable in Mattermost.')).not.toBeInTheDocument();
            expect(within(screen.getByTestId('admin.attribute.applies_to.post.body--region')).queryByText('Not editable in Mattermost.')).not.toBeInTheDocument();
            expect(screen.getAllByText('Not editable in Mattermost.')).toHaveLength(1);
        });

        it('linking a source keeps a type the source can populate, and hands its options to the sync', async () => {
            renderComponent();

            await userEvent.click(screen.getByTestId('admin.attribute.type--button'));
            await userEvent.click(screen.getByRole('menuitemradio', {name: 'Select'}));
            expect(screen.getByTestId('admin.attribute.values.add--textbox')).toBeInTheDocument();
            mockSetNavigationBlocked.mockClear();

            await linkViaMenu(/AD\/LDAP/, 'employeeID');

            expect(screen.getByTestId('admin.attribute.type--button')).toHaveTextContent('Select');
            expect(screen.getByTestId('admin.attribute.type--button')).toBeDisabled();
            expect(screen.getByTestId('admin.attribute.type--button')).toHaveAccessibleName('Type: Select. Locked while linked to an external source.');
            expect(screen.getByTestId('admin.attribute.external_source.synced')).toHaveTextContent(/^Synced with/);
            expect(screen.getByTestId('admin.attribute.options.synced_help--text')).toHaveTextContent('Options are managed by the AD/LDAP sync.');
            expect(screen.queryByTestId('admin.attribute.values.add--textbox')).not.toBeInTheDocument();

            // The sync provisions the options, so an empty list does not block Save.
            expect(screen.queryByTestId('admin.attribute.options.required--alert')).not.toBeInTheDocument();
            expect(mockSetNavigationBlocked).toHaveBeenCalledWith(true);
        });

        it('holds Save on a synced Select until it applies to Users, whose sync provides its options', async () => {
            renderComponent();
            await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'Department');
            await userEvent.click(screen.getByTestId('admin.attribute.type--button'));
            await userEvent.click(screen.getByRole('menuitemradio', {name: 'Select'}));
            await linkViaMenu(/AD\/LDAP/, 'department');

            expect(screen.getByTestId('admin.attribute.options.need_users--alert')).toHaveTextContent('Add Users under Applies to. The AD/LDAP sync creates these options from the values it syncs to users.');
            expect(screen.getByTestId('admin.save--button')).toBeDisabled();

            await addResourceAndExpand('Users', 'user');

            expect(screen.queryByTestId('admin.attribute.options.need_users--alert')).not.toBeInTheDocument();
            expect(screen.getByTestId('admin.save--button')).not.toBeDisabled();
        });

        it('keeps Multiselect when a source is linked, naming SAML as the owner of its options', async () => {
            renderComponent();

            await userEvent.click(screen.getByTestId('admin.attribute.type--button'));
            await userEvent.click(screen.getByRole('menuitemradio', {name: 'Multiselect'}));
            await linkViaMenu(/^SAML/, 'memberOf');

            expect(screen.getByTestId('admin.attribute.type--button')).toHaveTextContent('Multiselect');
            expect(screen.getByTestId('admin.attribute.options.synced_help--text')).toHaveTextContent('Options are managed by the SAML sync.');
        });

        it('linking a source converts a type it cannot populate to Text and marks the page dirty', async () => {
            renderComponent();

            await userEvent.click(screen.getByTestId('admin.attribute.type--button'));
            await userEvent.click(screen.getByRole('menuitemradio', {name: 'Ranked'}));
            mockSetNavigationBlocked.mockClear();

            await linkViaMenu(/AD\/LDAP/, 'employeeID');

            expect(screen.getByTestId('admin.attribute.type--button')).toHaveTextContent('Text');
            expect(screen.getByTestId('admin.attribute.type--button')).toBeDisabled();
            expect(screen.queryByTestId('admin.attribute.options.help--text')).not.toBeInTheDocument();
            expect(screen.queryByTestId('admin.attribute.options.synced_help--text')).not.toBeInTheDocument();
            expect(mockSetNavigationBlocked).toHaveBeenCalledWith(true);
        });

        it('warns in the link modal only for a type the source cannot populate', async () => {
            renderComponent();

            await userEvent.click(screen.getByTestId('admin.attribute.type--button'));
            await userEvent.click(screen.getByRole('menuitemradio', {name: 'Select'}));
            await userEvent.click(screen.getByTestId('admin.attribute.external_source.link--button'));
            await userEvent.click(screen.getByRole('menuitem', {name: /AD\/LDAP/}));
            await screen.findByPlaceholderText('department');
            expect(screen.queryByText(/will be converted to a TEXT attribute/)).not.toBeInTheDocument();
            await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));
            await waitFor(() => expect(screen.queryByPlaceholderText('department')).not.toBeInTheDocument());

            await userEvent.click(screen.getByTestId('admin.attribute.type--button'));
            await userEvent.click(screen.getByRole('menuitemradio', {name: 'Ranked'}));
            await userEvent.click(screen.getByTestId('admin.attribute.external_source.link--button'));
            await userEvent.click(screen.getByRole('menuitem', {name: /AD\/LDAP/}));
            await screen.findByPlaceholderText('department');
            expect(screen.getByText(/will be converted to a TEXT attribute/)).toBeInTheDocument();
        });

        it('linking one source never affects the other -- both may be linked simultaneously', async () => {
            renderComponent();

            await linkViaMenu(/AD\/LDAP/, 'employeeID');
            await linkViaMenu(/^SAML/, 'position');

            expect(screen.getByTestId('admin.attribute.external_source.source:ldap')).toBeInTheDocument();
            expect(screen.getByTestId('admin.attribute.external_source.source:saml')).toBeInTheDocument();
        });

        it('disables the Type menu while a source is linked, and re-enables it after the last chip is removed', async () => {
            renderComponent();

            expect(screen.getByTestId('admin.attribute.type--button')).not.toBeDisabled();
            expect(screen.getByTestId('admin.attribute.options.help--text')).toBeInTheDocument();

            await linkViaMenu(/AD\/LDAP/, 'employeeID');
            expect(screen.getByTestId('admin.attribute.type--button')).toBeDisabled();
            expect(screen.getByTestId('admin.attribute.type--button')).toHaveTextContent('Text');
            expect(screen.queryByTestId('admin.attribute.options.help--text')).not.toBeInTheDocument();

            await linkViaMenu(/^SAML/, 'position');
            expect(screen.getByTestId('admin.attribute.type--button')).toBeDisabled();

            // Removing one of two links must keep Type locked
            await userEvent.click(within(screen.getByTestId('admin.attribute.external_source.source:ldap')).getByTestId('admin.attribute.external_source.source.remove--button'));
            expect(screen.getByTestId('admin.attribute.type--button')).toBeDisabled();

            await userEvent.click(within(screen.getByTestId('admin.attribute.external_source.source:saml')).getByTestId('admin.attribute.external_source.source.remove--button'));
            expect(screen.getByTestId('admin.attribute.type--button')).not.toBeDisabled();
            expect(screen.getByTestId('admin.attribute.options.help--text')).toBeInTheDocument();
            expect(screen.queryByTestId('admin.attribute.external_source.synced')).not.toBeInTheDocument();

            await userEvent.click(screen.getByTestId('admin.attribute.type--button'));
            await userEvent.click(screen.getByRole('menuitemradio', {name: 'Select'}));
            expect(screen.getByTestId('admin.attribute.type--button')).toHaveTextContent('Select');
        });

        it('shows a dedicated tooltip for the external-source type lock, not the accessible name', async () => {
            renderComponent();
            await linkViaMenu(/AD\/LDAP/, 'employeeID');

            expect(screen.getByTestId('admin.attribute.type--button')).toHaveAccessibleName('Type: Text. Locked while linked to an external source.');

            await userEvent.hover(screen.getByTestId('admin.attribute.type_locked'));
            const tooltip = await screen.findByRole('tooltip', {}, {timeout: 1000});
            expect(tooltip).toHaveTextContent('Type cannot be changed while this attribute is linked to an external source.');
            expect(tooltip).not.toHaveTextContent('Type: Text.');
        });

        it('re-saving a linked chip with the unchanged value is a no-op -- no extra dirty-marking dispatch', async () => {
            renderComponent();

            await linkViaMenu(/AD\/LDAP/, 'employeeID');
            mockSetNavigationBlocked.mockClear();

            await userEvent.click(within(screen.getByTestId('admin.attribute.external_source.source:ldap')).getByTestId('admin.attribute.external_source.source.edit--button'));
            await screen.findByPlaceholderText('department');
            await userEvent.click(screen.getByRole('button', {name: 'Save'}));
            await waitFor(() => expect(screen.queryByPlaceholderText('department')).not.toBeInTheDocument());

            expect(mockSetNavigationBlocked).not.toHaveBeenCalled();
        });

        it('sends attrs.openid in the create payload when an OpenID Connect claim is linked', async () => {
            const createPropertyField = jest.spyOn(Client4, 'createPropertyField').mockResolvedValue({} as PropertyField);

            renderWithContext(
                <div>
                    <AttributeDetails/>
                    <ModalController/>
                </div>,
                mergeObjects(ALL_RESOURCES_STATE, {
                    entities: {
                        admin: {config: {FeatureFlags: {OpenIdAttributeSync: true}, OpenIdSettings: {Enable: true}}},
                        general: {license: {IsLicensed: 'true', OpenId: 'true'}},
                    },
                }),
            );
            await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'Country');

            await linkViaMenu(/^OpenID Connect/, 'address.country');

            await userEvent.click(screen.getByTestId('admin.save--button'));

            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalled());
            const attrs = createPropertyField.mock.calls[0][2].attrs as Record<string, unknown>;
            expect(attrs).toEqual(expect.objectContaining({openid: 'address.country'}));
            expect(attrs).not.toHaveProperty('ldap');
            expect(attrs).not.toHaveProperty('saml');
        });

        it('sends attrs.ldap and attrs.saml in the create payload when linked, omitting both when not', async () => {
            const createPropertyField = jest.spyOn(Client4, 'createPropertyField').mockResolvedValue({} as PropertyField);

            renderComponent();
            await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'My Attribute');

            await linkViaMenu(/AD\/LDAP/, 'employeeID');

            await userEvent.click(screen.getByTestId('admin.save--button'));

            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalled());
            expect(createPropertyField).toHaveBeenCalledWith('access_control', 'template', expect.objectContaining({
                attrs: expect.objectContaining({ldap: 'employeeID'}),
            }));
            const attrs = createPropertyField.mock.calls[0][2].attrs as Record<string, unknown>;
            expect(attrs).not.toHaveProperty('saml');
        });
    });

    describe('hierarchical type', () => {
        function getGraphRow(optionName: string, parentName = '') {
            const row = screen.getAllByTestId(/^admin\.attribute\.graph\.row:/).find(
                (el) => el.getAttribute('data-option-name') === optionName && el.getAttribute('data-parent-name') === parentName,
            );
            if (!row) {
                throw new Error(`row not found: ${optionName} @ ${parentName || 'root'}`);
            }
            return row;
        }

        it('hides Hierarchical in the type menu when PropertyFieldGraph is off', async () => {
            renderComponent(false);
            await userEvent.click(screen.getByTestId('admin.attribute.type--button'));
            expect(screen.queryByRole('menuitemradio', {name: 'Hierarchical'})).not.toBeInTheDocument();
            for (const label of ['Text', 'Phone', 'URL', 'Select', 'Multiselect', 'Ranked']) {
                expect(screen.getByRole('menuitemradio', {name: new RegExp(`^${label}$`)})).toBeInTheDocument();
            }
        });

        it('shows Hierarchical in the type menu when PropertyFieldGraph is on', async () => {
            renderComponent(true);
            await userEvent.click(screen.getByTestId('admin.attribute.type--button'));
            expect(screen.getByRole('menuitemradio', {name: 'Hierarchical'})).toBeInTheDocument();
        });

        it('selecting Hierarchical shows the empty graph canvas, hides External source, and does not show optionsRequired', async () => {
            renderComponent(true);
            await userEvent.click(screen.getByTestId('admin.attribute.type--button'));
            await userEvent.click(screen.getByRole('menuitemradio', {name: 'Hierarchical'}));

            expect(screen.getByTestId('admin.attribute.type--button')).toHaveTextContent('Hierarchical');
            expect(screen.getByTestId('admin.attribute.graph.empty')).toBeInTheDocument();
            expect(screen.queryByTestId('admin.attribute.values')).not.toBeInTheDocument();
            expect(screen.queryByTestId('admin.attribute.options.help--text')).not.toBeInTheDocument();
            expect(screen.queryByTestId('admin.attribute.external_source')).not.toBeInTheDocument();
            expect(screen.queryByTestId('admin.attribute.options.required--alert')).not.toBeInTheDocument();
            expect(screen.queryByText('At least one option is required')).not.toBeInTheDocument();
            expect(screen.queryByText('List settings')).not.toBeInTheDocument();
        });

        it('clears select options when switching to Hierarchical, and clears graph options when switching away', async () => {
            renderComponent(true);

            await userEvent.click(screen.getByTestId('admin.attribute.type--button'));
            await userEvent.click(screen.getByRole('menuitemradio', {name: 'Select'}));
            await userEvent.type(screen.getByTestId('admin.attribute.values.add--textbox'), 'Engineering{Enter}');
            expect(screen.getByText('Engineering')).toBeInTheDocument();

            await userEvent.click(screen.getByTestId('admin.attribute.type--button'));
            await userEvent.click(screen.getByRole('menuitemradio', {name: 'Hierarchical'}));
            expect(screen.queryByText('Engineering')).not.toBeInTheDocument();
            expect(screen.getByTestId('admin.attribute.graph.empty')).toBeInTheDocument();

            await userEvent.type(screen.getByTestId('admin.attribute.graph.empty.name--textbox'), 'Root');
            await userEvent.click(screen.getByTestId('admin.attribute.graph.empty.add--button'));
            expect(screen.queryByTestId('admin.attribute.graph.empty')).not.toBeInTheDocument();
            expect(screen.getByText('Root')).toBeInTheDocument();

            await userEvent.click(screen.getByTestId('admin.attribute.type--button'));
            await userEvent.click(screen.getByRole('menuitemradio', {name: 'Select'}));
            expect(screen.queryByText('Root')).not.toBeInTheDocument();
            expect(screen.queryAllByTestId(/^admin\.attribute\.values\.option:/)).toHaveLength(0);
        });

        it('disables Save at 0 graph options with no extra copy, and enables Save after the first value', async () => {
            const createPropertyField = jest.spyOn(Client4, 'createPropertyField').mockResolvedValue({} as PropertyField);

            renderComponent(true);
            await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'My Attribute');
            expect(screen.getByTestId('admin.save--button')).not.toBeDisabled();

            await userEvent.click(screen.getByTestId('admin.attribute.type--button'));
            await userEvent.click(screen.getByRole('menuitemradio', {name: 'Hierarchical'}));

            expect(screen.getByTestId('admin.save--button')).toBeDisabled();
            expect(screen.queryByTestId('admin.attribute.options.required--alert')).not.toBeInTheDocument();
            expect(screen.queryByText('At least one option is required')).not.toBeInTheDocument();

            await userEvent.click(screen.getByTestId('admin.save--button'));
            expect(createPropertyField).not.toHaveBeenCalled();
            expect(mockHistoryPush).not.toHaveBeenCalled();

            await userEvent.type(screen.getByTestId('admin.attribute.graph.empty.name--textbox'), 'Root');
            await userEvent.click(screen.getByTestId('admin.attribute.graph.empty.add--button'));
            expect(screen.getByTestId('admin.save--button')).not.toBeDisabled();
            expect(createPropertyField).not.toHaveBeenCalled();
        });

        it('saves a Hierarchical attribute with root parents [] and child parents [Root]', async () => {
            const createPropertyField = jest.spyOn(Client4, 'createPropertyField').mockResolvedValue({} as PropertyField);

            renderComponent(true);
            await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'Org chart');
            await userEvent.click(screen.getByTestId('admin.attribute.type--button'));
            await userEvent.click(screen.getByRole('menuitemradio', {name: 'Hierarchical'}));

            await userEvent.type(screen.getByTestId('admin.attribute.graph.empty.name--textbox'), 'Root');
            await userEvent.click(screen.getByTestId('admin.attribute.graph.empty.add--button'));

            await userEvent.click(within(getGraphRow('Root')).getByTestId('admin.attribute.graph.row.add_child--button'));
            await userEvent.type(await screen.findByTestId('admin.attribute.graph.child_draft.name--textbox'), 'Child');
            await userEvent.click(screen.getByTestId('admin.attribute.graph.child_draft.add--button'));

            await userEvent.click(screen.getByTestId('admin.save--button'));

            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalledWith('/admin_console/system_attributes/manage_attributes'));

            expect(createPropertyField).toHaveBeenCalledTimes(1);
            expect(createPropertyField).toHaveBeenCalledWith('access_control', 'template', expect.objectContaining({
                name: 'org_chart',
                type: 'graph',
                attrs: expect.objectContaining({
                    display_name: 'Org chart',
                    options: [
                        {id: '', name: 'Root', parents: []},
                        {id: '', name: 'Child', parents: ['Root']},
                    ],
                }),
            }));

            const attrs = createPropertyField.mock.calls[0][2].attrs as {options: Array<Record<string, unknown>>};
            expect(attrs.options[0]).toHaveProperty('parents');
            expect(JSON.stringify(attrs.options[0])).toContain('"parents":[]');
            expect(JSON.stringify(attrs.options[1])).toContain('"parents":["Root"]');
        });
    });

    describe('applies to', () => {
        // Opens the header Add-resource menu and picks `label` -- a non-
        // checkbox/radio Menu.Item defers its onClick until after the menu's
        // close transition (menu_item.tsx), so callers must await the row
        // actually appearing rather than asserting immediately after the click.
        const addResource = async (label: string, resourceType: string) => {
            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.add--button'));
            await userEvent.click(screen.getByRole('menuitem', {name: label}));
            await waitFor(() => expect(screen.getByTestId(`admin.attribute.applies_to.${resourceType}`)).toBeInTheDocument());
        };

        it('creates one linked field per selected resource, in selection order, with linked_field_id and attrs populated', async () => {
            const createPropertyField = jest.spyOn(Client4, 'createPropertyField').
                mockResolvedValueOnce({id: 'template-id'} as PropertyField).
                mockResolvedValueOnce({id: 'user-field-id'} as PropertyField).
                mockResolvedValueOnce({id: 'channel-field-id'} as PropertyField);

            renderComponent();
            await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'My Attribute');
            await addResource('Users', 'user');
            await addResource('Channels', 'channel');
            await userEvent.click(screen.getByTestId('admin.save--button'));

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
                attrs: {display_name: 'My Attribute', visibility: 'when_set', managed: ''},
                permission_values: 'member',
            }));
            expect(createPropertyField).toHaveBeenNthCalledWith(3, 'access_control', 'channel', expect.objectContaining({
                linked_field_id: 'template-id',
                attrs: {display_name: 'My Attribute'},
            }));
        });

        it('copies attrs.value_type onto linked fields created for a Phone attribute', async () => {
            const createPropertyField = jest.spyOn(Client4, 'createPropertyField').
                mockResolvedValueOnce({id: 'template-id'} as PropertyField).
                mockResolvedValueOnce({id: 'user-field-id'} as PropertyField);

            renderComponent();
            await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'Work phone');
            await userEvent.click(screen.getByTestId('admin.attribute.type--button'));
            await userEvent.click(screen.getByRole('menuitemradio', {name: 'Phone'}));
            await addResource('Users', 'user');
            await userEvent.click(screen.getByTestId('admin.save--button'));

            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalled());
            expect(createPropertyField).toHaveBeenNthCalledWith(1, 'access_control', 'template', expect.objectContaining({
                type: 'text',
                attrs: expect.objectContaining({value_type: 'phone'}),
            }));
            expect(createPropertyField).toHaveBeenNthCalledWith(2, 'access_control', 'user', expect.objectContaining({
                type: 'text',
                attrs: expect.objectContaining({value_type: 'phone'}),
            }));
        });

        it('bundles the Users row config into its create request, never a separate patch, for a row added this session', async () => {
            const createPropertyField = jest.spyOn(Client4, 'createPropertyField').
                mockResolvedValueOnce({id: 'template-id'} as PropertyField).
                mockResolvedValueOnce({id: 'user-field-id'} as PropertyField);
            const patchPropertyField = jest.spyOn(Client4, 'patchPropertyField');

            renderComponent();
            await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'My Attribute');
            await addResource('Users', 'user');

            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.toggle--button'));
            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.profile_display:always--togglebutton'));
            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.who_can_set.admin--radio'));
            await userEvent.click(screen.getByTestId('admin.save--button'));

            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalled());
            expect(createPropertyField).toHaveBeenNthCalledWith(2, 'access_control', 'user', expect.objectContaining({
                attrs: expect.objectContaining({visibility: 'always', managed: 'admin'}),
                permission_values: 'sysadmin',
            }));
            expect(patchPropertyField).not.toHaveBeenCalled();
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
            await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'My Attribute');
            await addResource('Users', 'user');
            await addResource('Channels', 'channel');
            await userEvent.click(screen.getByTestId('admin.save--button'));

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
            await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'My Attribute');
            await addResource('Users', 'user');
            await addResource('Channels', 'channel');
            await userEvent.click(screen.getByTestId('admin.save--button'));

            await waitFor(() => expect(deletePropertyField).toHaveBeenCalledWith('access_control', 'user', 'user-field-id'));
            await waitFor(() => expect(deletePropertyField).toHaveBeenCalledWith('access_control', 'template', 'template-id'));

            expect(await screen.findByTestId('admin.attribute.save_error--alert')).toHaveTextContent('Channels');
            expect(mockHistoryPush).not.toHaveBeenCalled();
            expect(screen.getByTestId('admin.save--button')).not.toBeDisabled();
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
            await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'My Attribute');
            await addResource('Users', 'user');
            await addResource('Channels', 'channel');
            await addResource('Posts', 'post');
            await userEvent.click(screen.getByTestId('admin.save--button'));

            await waitFor(() => expect(deletePropertyField).toHaveBeenCalledTimes(2));
            expect(deletePropertyField).toHaveBeenNthCalledWith(1, 'access_control', 'user', 'user-field-id');
            expect(deletePropertyField).toHaveBeenNthCalledWith(2, 'access_control', 'channel', 'channel-field-id');
            expect(deletePropertyField).not.toHaveBeenCalledWith('access_control', 'template', 'template-id');

            const banner = await screen.findByTestId('admin.attribute.save_error--alert');
            expect(banner).toHaveTextContent('My Attribute');
            expect(banner).toHaveTextContent('Users');
            expect(mockHistoryPush).not.toHaveBeenCalled();
            expect(screen.getByTestId('admin.save--button')).not.toBeDisabled();
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
            await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'My Attribute');
            await addResource('Users', 'user');
            await userEvent.click(screen.getByTestId('admin.save--button'));

            expect(await screen.findByText(expectedText)).toBeInTheDocument();
            expect(mockHistoryPush).not.toHaveBeenCalled();
            expect(screen.getByTestId('admin.save--button')).not.toBeDisabled();

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
            await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'My Attribute');
            await addResource('Channels', 'channel');
            await userEvent.click(screen.getByTestId('admin.save--button'));

            const banner = await screen.findByTestId('admin.attribute.save_error--alert');
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
            await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'My Attribute');
            await addResource('Channels', 'channel');
            await userEvent.click(screen.getByTestId('admin.save--button'));

            const banner = await screen.findByTestId('admin.attribute.save_error--alert');
            expect(banner).toHaveTextContent('My Attribute');
            expect(banner).toHaveTextContent('could not be cleaned up');
            expect(banner).not.toHaveTextContent('Nothing was saved');
            expect(mockHistoryPush).not.toHaveBeenCalled();
            expect(screen.getByTestId('admin.save--button')).not.toBeDisabled();
        });

        it('leaves Save enabled with zero Applies-to resources selected (unchanged from current behavior)', async () => {
            jest.spyOn(Client4, 'createPropertyField').mockResolvedValue({id: 'template-id'} as PropertyField);

            renderComponent();
            await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'My Attribute');
            expect(screen.getByTestId('admin.save--button')).not.toBeDisabled();

            await userEvent.click(screen.getByTestId('admin.save--button'));
            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalled());
        });

        it('does not lock Type while unsaved Applies-to resources sit on a create form', async () => {
            renderComponent();
            await addResource('Users', 'user');

            expect(screen.getByTestId('admin.attribute.type--button')).not.toBeDisabled();
            expect(screen.queryByTestId('admin.attribute.type_locked')).not.toBeInTheDocument();

            await userEvent.click(screen.getByTestId('admin.attribute.type--button'));
            await userEvent.click(screen.getByRole('menuitemradio', {name: 'Select'}));
            expect(screen.getByTestId('admin.attribute.type--button')).toHaveTextContent('Select');
        });

        it('calls markDirty (navigation-blocked, error cleared) when a resource is added', async () => {
            jest.spyOn(Client4, 'createPropertyField').mockRejectedValue(makeClientError('app.property_field.create.name_conflict.app_error', 'already exists'));

            renderComponent();
            await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'My Attribute');
            await userEvent.click(screen.getByTestId('admin.save--button'));
            expect(await screen.findByText(/already exists/i)).toBeInTheDocument();

            mockSetNavigationBlocked.mockClear();
            await addResource('Users', 'user');

            expect(mockSetNavigationBlocked).toHaveBeenCalledWith(true);
            expect(screen.queryByText(/already exists/i)).not.toBeInTheDocument();
        });

        it('calls markDirty (navigation-blocked, error cleared) when a resource is removed', async () => {
            jest.spyOn(Client4, 'createPropertyField').mockRejectedValue(makeClientError('app.property_field.create.name_conflict.app_error', 'already exists'));

            renderComponent();
            await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'My Attribute');
            await addResource('Users', 'user');
            await userEvent.click(screen.getByTestId('admin.save--button'));
            expect(await screen.findByText(/already exists/i)).toBeInTheDocument();

            mockSetNavigationBlocked.mockClear();
            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.toggle--button'));
            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.remove--button'));

            expect(mockSetNavigationBlocked).toHaveBeenCalledWith(true);
            expect(screen.queryByText(/already exists/i)).not.toBeInTheDocument();
        });

        it('moves focus to the header Add-resource trigger after removing a resource', async () => {
            renderComponent();
            await addResource('Users', 'user');

            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.toggle--button'));
            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.remove--button'));

            await waitFor(() => expect(screen.getByTestId('admin.attribute.applies_to.add--button')).toHaveFocus());
        });

        it('moves focus to the just-added row after adding the 3rd (last) resource, since both triggers unmount in that same render', async () => {
            renderComponent();
            await addResource('Users', 'user');
            await addResource('Channels', 'channel');
            await addResource('Posts', 'post');

            expect(screen.queryByTestId('admin.attribute.applies_to.add--button')).not.toBeInTheDocument();
            expect(screen.queryByTestId('admin.attribute.applies_to.add_inline--button')).not.toBeInTheDocument();
            await waitFor(() => expect(screen.getByTestId('admin.attribute.applies_to.post.toggle--button')).toHaveFocus());
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
            await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'My Attribute');
            await addResource('Users', 'user');
            await addResource('Channels', 'channel');
            await userEvent.click(screen.getByTestId('admin.save--button'));

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
            await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'My Attribute');
            await addResource('Users', 'user');
            await userEvent.click(screen.getByTestId('admin.save--button'));

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

    // A user attribute can already carry the name being typed without showing up
    // anywhere in Attribute Management -- a template's linked user field is
    // hidden behind its template's row. Creating a template under that name is
    // legal (a Channels-only template becomes resource.attributes.<name>, which
    // CEL keeps apart from user.attributes.<name>), so the page warns. The one
    // combination the server refuses is applying to Users under a name an
    // existing user field holds exactly.
    describe('unique name already held by another attribute\'s user field', () => {
        const OWNER_TEMPLATE_ID = 'markingstemplateid0123456789ab';

        function makeUserField(name: string, overrides: Partial<PropertyField> = {}): PropertyField {
            return {
                id: `user-field-${name}`,
                name,
                type: 'text',
                group_id: 'accesscontrolgroupuuid001',
                object_type: 'user',
                target_id: '',
                target_type: 'system',
                create_at: 1,
                update_at: 1,
                delete_at: 0,
                created_by: '',
                updated_by: '',
                attrs: {display_name: name},
                ...overrides,
            } as PropertyField;
        }

        const OWNER_TEMPLATE = {
            id: OWNER_TEMPLATE_ID,
            name: 'markings',
            type: 'rank',
            group_id: 'accesscontrolgroupuuid001',
            object_type: 'template',
            target_id: '',
            target_type: 'system',
            create_at: 1,
            update_at: 1,
            delete_at: 0,
            created_by: '',
            updated_by: '',
            attrs: {display_name: 'Security Markings'},
        } as PropertyField;

        // The page lists user fields (what a name can collide with) and templates
        // (to name the owner of a linked one) on mount. listPropertyFields walks
        // pages with a cursor, so a cursor-bearing call has to come back empty or
        // the walk never terminates.
        function mockConflictFields(userFields: PropertyField[], templates: PropertyField[] = []) {
            return jest.spyOn(Client4, 'getPropertyFields').mockImplementation((_group, objectType, query) => {
                if (query?.cursorId) {
                    return Promise.resolve([]);
                }
                if (objectType === 'user') {
                    return Promise.resolve(userFields);
                }
                if (objectType === 'template') {
                    return Promise.resolve(templates);
                }
                return Promise.resolve([]);
            });
        }

        // Both listings land after first paint. Waiting them out keeps a "no
        // warning" assertion a statement about loaded data rather than about the
        // empty lists the page starts with.
        const renderCreate = async () => {
            renderComponent();

            await waitFor(() => {
                expect(Client4.getPropertyFields).toHaveBeenCalledWith('access_control', 'user', expect.objectContaining({targetType: 'system'}));
                expect(Client4.getPropertyFields).toHaveBeenCalledWith('access_control', 'template', expect.objectContaining({targetType: 'system'}));
            });
            await runPostRenderAct(3);
        };

        it('warns while the name is still being typed, naming the template that owns the colliding user field', async () => {
            const createPropertyField = jest.spyOn(Client4, 'createPropertyField');
            mockConflictFields(
                [makeUserField('clearance', {linked_field_id: OWNER_TEMPLATE_ID})],
                [OWNER_TEMPLATE],
            );

            await renderCreate();
            await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'Clearance');

            const warning = await screen.findByTestId('admin.attribute.unique_name.conflict--status');
            expect(warning).toHaveTextContent('Another attribute already uses this name.');

            // An exact match is the case the server rejects, so the notice reads
            // as a danger rather than a warning.
            expect(warning.querySelector('[class*="section-notice--type-danger"]')).toBeInTheDocument();
            expect(createPropertyField).not.toHaveBeenCalled();

            // * The warning appears and rewrites itself while the admin is still
            // typing, so a screen reader is only told about it at all if it is a
            // live region. Polite rather than assertive, which is why the role is
            // `status`: an alert on every keystroke would talk over the typing.
            expect(screen.getAllByRole('status')).toContain(warning);
        });

        it('warns when the catalog arrives after the name has already been typed', async () => {
            let resolveUserFields!: (fields: PropertyField[]) => void;
            const userFieldsPromise = new Promise<PropertyField[]>((resolve) => {
                resolveUserFields = resolve;
            });
            jest.spyOn(Client4, 'getPropertyFields').mockImplementation((_group, objectType, query) => {
                if (query?.cursorId) {
                    return Promise.resolve([]);
                }
                if (objectType === 'user') {
                    return userFieldsPromise;
                }
                return Promise.resolve([]);
            });

            renderComponent();
            await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'Clearance');
            expect(screen.queryByTestId('admin.attribute.unique_name.conflict--status')).not.toBeInTheDocument();

            resolveUserFields([makeUserField('clearance')]);
            expect(await screen.findByTestId('admin.attribute.unique_name.conflict--status')).toBeVisible();
        });

        it('shows no warning for a name no user field holds, and clears it again when a conflicting name is changed', async () => {
            mockConflictFields([makeUserField('clearance')]);

            await renderCreate();

            await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'Cost Centre');
            expect(screen.queryByTestId('admin.attribute.unique_name.conflict--status')).not.toBeInTheDocument();

            await userEvent.clear(screen.getByTestId('admin.attribute.display_name--textbox'));
            await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'Clearance');
            expect(await screen.findByTestId('admin.attribute.unique_name.conflict--status')).toBeVisible();

            // The warning tracks the name currently in the form, rather than
            // latching on the first collision seen.
            await userEvent.clear(screen.getByTestId('admin.attribute.display_name--textbox'));
            await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'Clearance Level');
            expect(screen.getByTestId('admin.attribute.unique_name.value--text')).toHaveTextContent('clearance_level');
            expect(screen.queryByTestId('admin.attribute.unique_name.conflict--status')).not.toBeInTheDocument();
        });

        it('warns on a case-only difference but leaves Users addable, since only an exact match collides on the server', async () => {
            mockConflictFields([makeUserField('clearance')]);

            await renderCreate();
            await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'Clearance Level');
            await userEvent.click(screen.getByTestId('admin.attribute.unique_name.edit--button'));
            const nameInput = screen.getByTestId('admin.attribute.unique_name.input--textbox');
            await userEvent.clear(nameInput);
            await userEvent.type(nameInput, 'Clearance');
            await userEvent.click(screen.getByTestId('admin.attribute.unique_name.edit--button'));
            expect(screen.getByTestId('admin.attribute.unique_name.value--text')).toHaveTextContent('Clearance');

            const warning = await screen.findByTestId('admin.attribute.unique_name.conflict--status');
            expect(warning).toHaveTextContent('Another attribute already uses this name.');

            // A case-only match does not collide on the server, so the notice
            // reads as a warning rather than a danger and Users stays addable.
            expect(warning.querySelector('[class*="section-notice--type-warning"]')).toBeInTheDocument();

            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.add--button'));
            const users = screen.getByRole('menuitem', {name: /^Users/});
            expect(users).not.toHaveAttribute('aria-disabled', 'true');
            expect(users).not.toHaveTextContent('Name already in use');
        });

        it('offers Users as a disabled Add-resource option on an exact match, and adds no row when it is clicked', async () => {
            mockConflictFields([makeUserField('clearance')]);

            await renderCreate();
            await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'Clearance');
            await screen.findByTestId('admin.attribute.unique_name.conflict--status');

            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.add--button'));
            const users = screen.getByRole('menuitem', {name: /^Users/});
            expect(users).toHaveAttribute('aria-disabled', 'true');
            expect(users).toHaveTextContent('Name already in use');

            // pointerEventsCheck off so the click really reaches the item: a
            // disabled MUI item is pointer-events: none, and letting userEvent
            // refuse the interaction would prove only that CSS. Closing the menu
            // afterwards gives Menu.Item's deferred onClick its chance to fire.
            await userEvent.click(users, {pointerEventsCheck: 0});
            await userEvent.keyboard('{Escape}');
            await waitFor(() => expect(screen.queryByRole('menuitem')).not.toBeInTheDocument());
            expect(screen.queryByTestId('admin.attribute.applies_to.user')).not.toBeInTheDocument();
        });

        it('disables Save only for the Users row, and re-enables it for Channels alone under the same name', async () => {
            mockConflictFields([makeUserField('clearance')]);

            await renderCreate();
            await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'Clearance Level');
            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.add--button'));
            await userEvent.click(screen.getByRole('menuitem', {name: 'Channels'}));
            await waitFor(() => expect(screen.getByTestId('admin.attribute.applies_to.channel')).toBeInTheDocument());
            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.add--button'));
            await userEvent.click(screen.getByRole('menuitem', {name: 'Users'}));
            await waitFor(() => expect(screen.getByTestId('admin.attribute.applies_to.user')).toBeInTheDocument());

            // Everything else the form needs is already in place under a name
            // nothing holds, so the rename below is the only thing that changes.
            expect(screen.getByTestId('admin.save--button')).toBeEnabled();

            await userEvent.click(screen.getByTestId('admin.attribute.unique_name.edit--button'));
            const nameInput = screen.getByTestId('admin.attribute.unique_name.input--textbox');
            await userEvent.clear(nameInput);
            await userEvent.type(nameInput, 'clearance');
            await userEvent.click(screen.getByTestId('admin.attribute.unique_name.edit--button'));

            expect(screen.getByTestId('admin.attribute.unique_name.value--text')).toHaveTextContent('clearance');
            expect(await screen.findByTestId('admin.attribute.unique_name.conflict--status')).toBeVisible();
            expect(screen.queryByTestId('admin.attribute.unique_name.error--alert')).not.toBeInTheDocument();
            expect(screen.getByTestId('admin.save--button')).toBeDisabled();

            // Only the Users row is unsaveable: a template applied to Channels
            // becomes resource.attributes.clearance, which CEL keeps apart from
            // the user.attributes.clearance the existing field holds. So dropping
            // Users is a repair on its own -- the name need not change.
            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.toggle--button'));
            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.remove--button'));

            expect(screen.queryByTestId('admin.attribute.applies_to.user')).not.toBeInTheDocument();
            expect(screen.getByTestId('admin.attribute.applies_to.channel')).toBeInTheDocument();
            expect(screen.getByTestId('admin.attribute.unique_name.value--text')).toHaveTextContent('clearance');
            expect(screen.getByTestId('admin.attribute.unique_name.conflict--status')).toBeVisible();
            expect(screen.getByTestId('admin.save--button')).toBeEnabled();
        });

        it('leaves the form fully usable when the listing the warning is built from fails', async () => {
            // Everything this warning knows comes from that one listing, and
            // nothing else on the page reads it. A failure therefore costs the
            // warning alone: the create still goes through, and the server's own
            // 409 is what actually stops a duplicate user field being made.
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            jest.spyOn(Client4, 'getPropertyFields').mockRejectedValue(new Error('network'));

            renderComponent();
            await waitFor(() => {
                expect(consoleSpy).toHaveBeenCalledWith('AttributeDetails-load-name-conflicts: ', expect.any(Error));
            });
            await runPostRenderAct(3);

            // The name every other case in this describe collides on, so the
            // silence below is the failed listing rather than a free name.
            await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'Clearance');

            expect(screen.queryByTestId('admin.attribute.unique_name.conflict--status')).not.toBeInTheDocument();
            expect(screen.getByTestId('admin.save--button')).toBeEnabled();

            // Users is the only resource an exact collision withholds, so it is
            // the one an unanswered listing would strand if the page treated
            // "not known" as "conflicting".
            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.add--button'));
            const users = screen.getByRole('menuitem', {name: /^Users/});
            expect(users).not.toHaveAttribute('aria-disabled', 'true');
            expect(users).not.toHaveTextContent('Name already in use');

            await userEvent.click(users);
            expect(await screen.findByTestId('admin.attribute.applies_to.user')).toBeInTheDocument();
            expect(screen.getByTestId('admin.save--button')).toBeEnabled();

            consoleSpy.mockRestore();
        });
    });

    describe('edit attribute', () => {
        const FIELD_ID = 'abcdefghijklmnopqrstuvwxyz';

        const addResource = async (label: string, resourceType: string) => {
            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.add--button'));
            await userEvent.click(screen.getByRole('menuitem', {name: label}));
            await waitFor(() => expect(screen.getByTestId(`admin.attribute.applies_to.${resourceType}`)).toBeInTheDocument());
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

        function makeLinked(objectType: 'user' | 'channel' | 'post', id: string, overrides: Partial<PropertyField> = {}): PropertyField {
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
                ...overrides,
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

        function makeNonTemplate(objectType: 'user' | 'channel' | 'post', overrides: Partial<PropertyField> = {}): PropertyField {
            return {
                id: FIELD_ID,
                name: 'department',
                type: 'text',
                group_id: 'accesscontrolgroupuuid001',
                object_type: objectType,
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

        function mockLoadedNonTemplateField(field: PropertyField) {
            jest.spyOn(Client4, 'getPropertyFields').mockImplementation((_group, objectType) => {
                if (objectType === field.object_type) {
                    return Promise.resolve([field]);
                }
                return Promise.resolve([]);
            });
        }

        const renderEdit = (initialState: Record<string, unknown> = {}, graphEnabled = false) => renderWithContext(
            <div>
                <Route path='/admin_console/system_attributes/manage_attributes/attribute_details/:field_id'>
                    <AttributeDetails/>
                </Route>
                <ModalController/>
            </div>,
            mergeObjects(ALL_RESOURCES_STATE, mergeObjects({
                entities: {
                    general: {
                        config: {
                            FeatureFlagPropertyFieldGraph: graphEnabled ? 'true' : 'false',
                        },
                    },
                },
            }, initialState)),
            {
                history: createMemoryHistory({
                    initialEntries: [`/admin_console/system_attributes/manage_attributes/attribute_details/${FIELD_ID}`],
                }),
            },
        );

        function makePluginOwnedTemplate(overrides: Partial<PropertyField> = {}): PropertyField {
            return makeTemplate({
                attrs: {display_name: 'Plugin field', source_plugin_id: 'com.example.plugin', protected: true},
                ...overrides,
            });
        }

        const waitForForm = () => waitFor(() => expect(screen.getByTestId('admin.attribute')).toBeInTheDocument());

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

            expect(screen.getByRole('heading', {name: 'Edit Department Attribute'})).toBeInTheDocument();
            expect(screen.getByTestId('admin.attribute.display_name--textbox')).toHaveValue('Department');
            expect(screen.getByTestId('admin.attribute.unique_name.value--text')).toHaveTextContent('department');
            expect(screen.getByTestId('admin.attribute.type--button')).toHaveTextContent('Select');
            expect(screen.getByTestId('admin.attribute.applies_to.user')).toBeInTheDocument();
            expect(screen.getByTestId('admin.save--button')).toBeDisabled();
            expect(mockSetNavigationBlocked).not.toHaveBeenCalled();
        });

        it('prefills Phone or URL from attrs.value_type on a text field', async () => {
            mockLoadedField(makeTemplate({
                type: 'text',
                attrs: {display_name: 'Work phone', value_type: 'phone'},
            }));

            renderEdit();
            await waitForForm();

            expect(screen.getByTestId('admin.attribute.type--button')).toHaveTextContent('Phone');
            expect(screen.getByTestId('admin.attribute.options.help--text')).toBeInTheDocument();
        });

        it('names an API-created email field Email and does not offer Email in the type menu', async () => {
            mockLoadedField(makeTemplate({
                type: 'text',
                attrs: {display_name: 'Work email', value_type: 'email'},
            }));

            renderEdit();
            await waitForForm();

            expect(screen.getByTestId('admin.attribute.type--button')).toHaveTextContent('Email');
            await userEvent.click(screen.getByTestId('admin.attribute.type--button'));
            expect(screen.queryByRole('menuitemradio', {name: 'Email'})).not.toBeInTheDocument();
        });

        it('PATCHes value_type when changing a text field to URL', async () => {
            mockLoadedField(makeTemplate({attrs: {display_name: 'Department'}}));
            const patchPropertyField = jest.spyOn(Client4, 'patchPropertyField').mockResolvedValue(makeTemplate());

            renderEdit();
            await waitForForm();

            await userEvent.click(screen.getByTestId('admin.attribute.type--button'));
            await userEvent.click(screen.getByRole('menuitemradio', {name: 'URL'}));
            await userEvent.click(screen.getByTestId('admin.save--button'));

            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalled());
            expect(patchPropertyField).toHaveBeenCalledWith('access_control', 'template', FIELD_ID, expect.objectContaining({
                type: 'text',
                attrs: expect.objectContaining({value_type: 'url'}),
            }));
        });

        it('round-trips a saved Users row config: loading an attribute shows its previously-saved Profile display / Who can set the value', async () => {
            mockLoadedField(makeTemplate(), [makeLinked('user', 'user-field', {attrs: {display_name: 'Department', visibility: 'always', managed: 'admin'}})]);

            renderEdit();
            await waitForForm();
            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.toggle--button'));

            expect(screen.getByTestId('admin.attribute.applies_to.user.profile_display:always--togglebutton')).toHaveAttribute('aria-pressed', 'true');
            expect(screen.getByTestId('admin.attribute.applies_to.user.who_can_set.admin--radio')).toBeChecked();
        });

        it('falls back to When set for an unexpected persisted visibility value, rather than leaving every segment unpressed', async () => {
            mockLoadedField(makeTemplate(), [makeLinked('user', 'user-field', {attrs: {display_name: 'Department', visibility: 'not_a_real_value'}})]);

            renderEdit();
            await waitForForm();
            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.toggle--button'));

            expect(screen.getByTestId('admin.attribute.applies_to.user.profile_display:when_set--togglebutton')).toHaveAttribute('aria-pressed', 'true');
        });

        it('does not move focus to an Applies-to row when loading a field that already applies to every resource type', async () => {
            mockLoadedField(makeTemplate(), [
                makeLinked('user', 'user-field'),
                makeLinked('channel', 'channel-field'),
                makeLinked('post', 'post-field'),
            ]);

            renderEdit();
            await waitForForm();

            await waitFor(() => expect(screen.getByTestId('admin.attribute.display_name--textbox')).toHaveFocus());
            expect(screen.getByTestId('admin.attribute.applies_to.post.toggle--button')).not.toHaveFocus();
        });

        it('does not re-slug Unique name when Display name changes', async () => {
            mockLoadedField(makeTemplate());
            renderEdit();
            await waitForForm();

            await userEvent.clear(screen.getByTestId('admin.attribute.display_name--textbox'));
            await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'New Label');

            expect(screen.getByTestId('admin.attribute.unique_name.value--text')).toHaveTextContent('department');
        });

        it('does not unpin Unique name after a no-op Edit/Done round-trip, even when the loaded name matches the current auto-slug', async () => {
            // 'department' is the auto-slug of 'Department' -- the loaded name and
            // the auto-derived one coincide, which is exactly what triggered the
            // regression: Done's "did the committed value change from the
            // auto-slug" heuristic must not unpin an edit-mode name just because
            // of that coincidence.
            mockLoadedField(makeTemplate());
            renderEdit();
            await waitForForm();

            await userEvent.click(screen.getByTestId('admin.attribute.unique_name.edit--button'));
            await userEvent.click(screen.getByTestId('admin.attribute.unique_name.edit--button'));
            expect(screen.getByTestId('admin.attribute.unique_name.value--text')).toHaveTextContent('department');

            await userEvent.clear(screen.getByTestId('admin.attribute.display_name--textbox'));
            await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'Cost Centre');

            expect(screen.getByTestId('admin.attribute.unique_name.value--text')).toHaveTextContent('department');
        });

        it('does not unpin Unique name after a no-op Edit/Escape round-trip', async () => {
            mockLoadedField(makeTemplate());
            renderEdit();
            await waitForForm();

            await userEvent.click(screen.getByTestId('admin.attribute.unique_name.edit--button'));
            await userEvent.keyboard('{Escape}');
            expect(screen.getByTestId('admin.attribute.unique_name.value--text')).toHaveTextContent('department');

            await userEvent.clear(screen.getByTestId('admin.attribute.display_name--textbox'));
            await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'Cost Centre');

            expect(screen.getByTestId('admin.attribute.unique_name.value--text')).toHaveTextContent('department');
        });

        it('skips name validation while Unique name is unchanged, then validates once it changes', async () => {
            mockLoadedField(makeTemplate({name: 'for', attrs: {display_name: 'For'}}));
            renderEdit();
            await waitForForm();

            expect(screen.queryByTestId('admin.attribute.unique_name.error--alert')).not.toBeInTheDocument();

            await userEvent.click(screen.getByTestId('admin.attribute.unique_name.edit--button'));
            const nameInput = screen.getByTestId('admin.attribute.unique_name.input--textbox');
            await userEvent.clear(nameInput);
            await userEvent.type(nameInput, 'if');

            expect(screen.getByTestId('admin.attribute.unique_name.error--alert')).toHaveTextContent('reserved word');
        });

        it('PATCHes the existing field and does not POST a new template', async () => {
            mockLoadedField(makeTemplate());
            const patchPropertyField = jest.spyOn(Client4, 'patchPropertyField').mockResolvedValue(makeTemplate());
            const createPropertyField = jest.spyOn(Client4, 'createPropertyField');

            renderEdit();
            await waitForForm();

            await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), ' 2');
            await userEvent.click(screen.getByTestId('admin.save--button'));

            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalledWith('/admin_console/system_attributes/manage_attributes'));
            expect(createPropertyField).not.toHaveBeenCalled();
            expect(patchPropertyField).toHaveBeenCalledWith('access_control', 'template', FIELD_ID, expect.objectContaining({
                type: 'text',
                attrs: expect.objectContaining({display_name: 'Department 2'}),
            }));
            expect(patchPropertyField.mock.calls[0][3]).not.toHaveProperty('name');
        });

        it('loads a non-template field into Definition without redirecting to the list', async () => {
            mockLoadedNonTemplateField(makeNonTemplate('user', {
                type: 'select',
                attrs: {display_name: 'Department', options: [{id: 'opt-1', name: 'Engineering'}]},
            }));

            renderEdit();
            await waitForForm();

            expect(screen.getByTestId('admin.attribute.display_name--textbox')).toHaveValue('Department');
            expect(screen.getByTestId('admin.attribute.unique_name.value--text')).toHaveTextContent('department');
            expect(screen.getByTestId('admin.attribute.type--button')).toHaveTextContent('Select');
            expect(mockHistoryPush).not.toHaveBeenCalled();
        });

        it('loads a user field with the channel scope skipped when channel attributes are unavailable', async () => {
            // Below Enterprise Advanced the channel GET 501s; fetchAttributeField
            // must skip it rather than reject and bounce a user-field edit to the
            // list. The channel reject below must never be reached.
            const getPropertyFields = jest.spyOn(Client4, 'getPropertyFields').mockImplementation((_group, objectType) => {
                if (objectType === 'channel') {
                    return Promise.reject(new Error('channel 501'));
                }
                if (objectType === 'user') {
                    return Promise.resolve([makeNonTemplate('user')]);
                }
                return Promise.resolve([]);
            });

            renderEdit({entities: {general: {config: {FeatureFlagChannelAttributes: 'false'}, license: {SkuShortName: 'professional'}}}});
            await waitForForm();

            expect(screen.getByTestId('admin.attribute.display_name--textbox')).toHaveValue('Department');
            expect(mockHistoryPush).not.toHaveBeenCalled();
            expect(getPropertyFields.mock.calls.every((call) => call[1] !== 'channel')).toBe(true);
        });

        it('loads a template with the channel scope skipped when channel attributes are unavailable', async () => {
            // fetchAttributeField already skips channel, but a template still
            // loads linked fields afterward. That later Promise.all used to
            // include channel unconditionally; a 501 there bounced the page
            // to the list. The channel reject below must never be reached.
            const getPropertyFields = jest.spyOn(Client4, 'getPropertyFields').mockImplementation((_group, objectType) => {
                if (objectType === 'channel') {
                    return Promise.reject(new Error('channel 501'));
                }
                if (objectType === 'template') {
                    return Promise.resolve([makeTemplate()]);
                }
                if (objectType === 'user') {
                    return Promise.resolve([makeLinked('user', 'user-field')]);
                }
                return Promise.resolve([]);
            });

            renderEdit({entities: {general: {config: {FeatureFlagChannelAttributes: 'false'}, license: {SkuShortName: 'professional'}}}});
            await waitForForm();

            expect(screen.getByTestId('admin.attribute.display_name--textbox')).toHaveValue('Department');
            expect(screen.getByTestId('admin.attribute.applies_to.user')).toBeInTheDocument();
            expect(screen.queryByTestId('admin.attribute.applies_to.channel')).not.toBeInTheDocument();
            expect(mockHistoryPush).not.toHaveBeenCalled();
            expect(getPropertyFields.mock.calls.every((call) => call[1] !== 'channel')).toBe(true);
        });

        it('redirects to the list for a non-template post field when the PostAttributes flag is off', async () => {
            const getPropertyFields = jest.spyOn(Client4, 'getPropertyFields').mockImplementation((_group, objectType) => {
                if (objectType === 'post') {
                    return Promise.resolve([makeNonTemplate('post')]);
                }
                return Promise.resolve([]);
            });

            renderEdit({entities: {general: {config: {FeatureFlagPostAttributes: 'false'}}}});

            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalledWith('/admin_console/system_attributes/manage_attributes'));
            expect(getPropertyFields.mock.calls.every((call) => call[1] !== 'post')).toBe(true);
        });

        it('loads a template with the post scope skipped when the PostAttributes flag is off', async () => {
            const getPropertyFields = jest.spyOn(Client4, 'getPropertyFields').mockImplementation((_group, objectType) => {
                if (objectType === 'template') {
                    return Promise.resolve([makeTemplate()]);
                }
                if (objectType === 'user') {
                    return Promise.resolve([makeLinked('user', 'user-field')]);
                }
                if (objectType === 'post') {
                    return Promise.resolve([makeLinked('post', 'post-field')]);
                }
                return Promise.resolve([]);
            });

            renderEdit({entities: {general: {config: {FeatureFlagPostAttributes: 'false'}}}});
            await waitForForm();

            expect(screen.getByTestId('admin.attribute.applies_to.user')).toBeInTheDocument();
            expect(screen.queryByTestId('admin.attribute.applies_to.post')).not.toBeInTheDocument();
            expect(getPropertyFields.mock.calls.every((call) => call[1] !== 'post')).toBe(true);
        });

        it('saves a non-template field with a PATCH to its own object type, not the template create/link path', async () => {
            mockLoadedNonTemplateField(makeNonTemplate('user'));
            const patchPropertyField = jest.spyOn(Client4, 'patchPropertyField').mockResolvedValue(makeNonTemplate('user'));
            const createPropertyField = jest.spyOn(Client4, 'createPropertyField');
            const deletePropertyField = jest.spyOn(Client4, 'deletePropertyField');

            renderEdit();
            await waitForForm();

            await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), ' 2');
            await userEvent.click(screen.getByTestId('admin.save--button'));

            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalledWith('/admin_console/system_attributes/manage_attributes'));
            expect(patchPropertyField).toHaveBeenCalledWith('access_control', 'user', FIELD_ID, expect.objectContaining({
                type: 'text',
                attrs: expect.objectContaining({display_name: 'Department 2'}),
            }));
            expect(patchPropertyField.mock.calls[0][3].attrs).not.toHaveProperty('visibility');
            expect(patchPropertyField.mock.calls[0][3].attrs).not.toHaveProperty('managed');
            expect(patchPropertyField.mock.calls[0][3]).not.toHaveProperty('permission_values');
            expect(createPropertyField).not.toHaveBeenCalled();
            expect(deletePropertyField).not.toHaveBeenCalled();
        });

        it('saves a standalone user field\'s Users row settings in the same PATCH as the definition', async () => {
            mockLoadedNonTemplateField(makeNonTemplate('user'));
            const patchPropertyField = jest.spyOn(Client4, 'patchPropertyField').mockResolvedValue(makeNonTemplate('user'));

            renderEdit();
            await waitForForm();

            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.toggle--button'));
            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.profile_display:hidden--togglebutton'));
            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.who_can_set.admin--radio'));
            await userEvent.click(screen.getByTestId('admin.save--button'));

            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalledWith('/admin_console/system_attributes/manage_attributes'));
            expect(patchPropertyField).toHaveBeenCalledTimes(1);
            expect(patchPropertyField).toHaveBeenCalledWith('access_control', 'user', FIELD_ID, expect.objectContaining({
                attrs: expect.objectContaining({visibility: 'hidden', managed: 'admin'}),
                permission_values: 'sysadmin',
            }));
        });

        it('surfaces a rejected PATCH for a non-template field and leaves Save usable', async () => {
            mockLoadedNonTemplateField(makeNonTemplate('user'));
            const patchPropertyField = jest.spyOn(Client4, 'patchPropertyField').mockRejectedValue(makeClientError('app.property_field.update.name_conflict.app_error'));

            renderEdit();
            await waitForForm();

            await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), ' 2');
            await userEvent.click(screen.getByTestId('admin.save--button'));

            expect(await screen.findByTestId('admin.attribute.save_error--alert')).toBeInTheDocument();
            expect(patchPropertyField).toHaveBeenCalledTimes(1);
            expect(mockHistoryPush).not.toHaveBeenCalled();
            expect(screen.getByTestId('admin.save--button')).not.toBeDisabled();
        });

        describe('non-template field applies-to', () => {
            it('shows only the field\'s own resource row, with neither Add-resource trigger', async () => {
                mockLoadedNonTemplateField(makeNonTemplate('user'));

                renderEdit();
                await waitForForm();

                expect(screen.getByTestId('admin.attribute.applies_to.user')).toBeInTheDocument();
                expect(screen.queryByTestId('admin.attribute.applies_to.channel')).not.toBeInTheDocument();
                expect(screen.queryByTestId('admin.attribute.applies_to.post')).not.toBeInTheDocument();
                expect(screen.queryByTestId('admin.attribute.applies_to.add--button')).not.toBeInTheDocument();
                expect(screen.queryByTestId('admin.attribute.applies_to.add_inline--button')).not.toBeInTheDocument();
            });

            it('shows the Channels row for a non-template channel field', async () => {
                mockLoadedNonTemplateField(makeNonTemplate('channel'));

                renderEdit();
                await waitForForm();

                expect(screen.getByTestId('admin.attribute.applies_to.channel')).toBeInTheDocument();
                expect(screen.queryByTestId('admin.attribute.applies_to.user')).not.toBeInTheDocument();
                expect(screen.queryByTestId('admin.attribute.applies_to.post')).not.toBeInTheDocument();
            });

            it('seeds the locked Channels row summary from the field, not the default config', async () => {
                mockLoadedNonTemplateField(makeNonTemplate('channel', {attrs: {display_name: 'Region', required: true}}));

                renderEdit();
                await waitForForm();

                // required:true parses to "Required"; the default config is "Optional",
                // so this proves the row reflects the field rather than the default.
                expect(screen.getByTestId('admin.attribute.applies_to.channel.summary--text')).toHaveTextContent('Required');
            });

            it('leaves a standalone user field\'s row toggle, Profile display and Who can set the value enabled, with Remove locked', async () => {
                mockLoadedNonTemplateField(makeNonTemplate('user'));

                renderEdit();
                await waitForForm();

                expect(screen.getByTestId('admin.attribute.applies_to.user.toggle--button')).toBeEnabled();
                expect(screen.queryByTestId('admin.attribute.applies_to.user.toggle_locked')).not.toBeInTheDocument();

                await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.toggle--button'));
                expect(screen.getByTestId('admin.attribute.applies_to.user.remove--button')).toBeDisabled();
                expect(screen.getByTestId('admin.attribute.applies_to.user.remove_locked')).toBeInTheDocument();
                expect(screen.getByTestId('admin.attribute.applies_to.user.profile_display:hidden--togglebutton')).toBeEnabled();
                expect(screen.getByTestId('admin.attribute.applies_to.user.who_can_set.admin--radio')).toBeEnabled();
                expect(screen.getByTestId('admin.attribute.applies_to.user.who_can_set.member--radio')).toBeEnabled();
            });

            it('keeps a standalone post field\'s row toggle disabled behind an explanatory lock tooltip', async () => {
                mockLoadedNonTemplateField(makeNonTemplate('post'));

                renderEdit();
                await waitForForm();

                expect(screen.getByTestId('admin.attribute.applies_to.post.toggle--button')).toBeDisabled();
                expect(screen.getByTestId('admin.attribute.applies_to.post.toggle_locked')).toBeInTheDocument();
            });

            it('leaves a standalone channel field\'s row toggle and settings enabled, with Remove locked', async () => {
                mockLoadedNonTemplateField(makeNonTemplate('channel'));

                renderEdit();
                await waitForForm();

                expect(screen.getByTestId('admin.attribute.applies_to.channel.toggle--button')).toBeEnabled();
                expect(screen.queryByTestId('admin.attribute.applies_to.channel.toggle_locked')).not.toBeInTheDocument();

                await userEvent.click(screen.getByTestId('admin.attribute.applies_to.channel.toggle--button'));
                expect(screen.getByTestId('admin.attribute.applies_to.channel.remove--button')).toBeDisabled();
                expect(screen.getByTestId('admin.attribute.applies_to.channel.remove_locked')).toBeInTheDocument();
                expect(screen.getByTestId('admin.attribute.applies_to.channel.settings.location:display_label_header--checkbox')).toBeEnabled();
            });

            it('saves a standalone channel field\'s row settings in the same PATCH as the definition', async () => {
                mockLoadedNonTemplateField(makeNonTemplate('channel'));
                const patchPropertyField = jest.spyOn(Client4, 'patchPropertyField').mockResolvedValue(makeNonTemplate('channel'));

                renderEdit();
                await waitForForm();

                await userEvent.click(screen.getByTestId('admin.attribute.applies_to.channel.toggle--button'));
                await userEvent.click(screen.getByTestId('admin.attribute.applies_to.channel.settings.required--switch'));
                await userEvent.click(screen.getByTestId('admin.save--button'));

                await waitFor(() => expect(mockHistoryPush).toHaveBeenCalledWith('/admin_console/system_attributes/manage_attributes'));
                expect(patchPropertyField).toHaveBeenCalledTimes(1);
                expect(patchPropertyField).toHaveBeenCalledWith('access_control', 'channel', FIELD_ID, expect.objectContaining({
                    attrs: expect.objectContaining({
                        display_name: 'Department',
                        required: true,
                        change_policy: expect.any(String),
                        editable: null,
                        actions: expect.any(Array),
                    }),
                }));
            });

            it('keeps a standalone channel field\'s loaded config when only the display name changes', async () => {
                mockLoadedNonTemplateField(makeNonTemplate('channel', {attrs: {display_name: 'Region', required: true}}));
                const patchPropertyField = jest.spyOn(Client4, 'patchPropertyField').mockResolvedValue(makeNonTemplate('channel'));

                renderEdit();
                await waitForForm();

                await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), ' 2');
                await userEvent.click(screen.getByTestId('admin.save--button'));

                await waitFor(() => expect(mockHistoryPush).toHaveBeenCalled());
                expect(patchPropertyField).toHaveBeenCalledWith('access_control', 'channel', FIELD_ID, expect.objectContaining({
                    attrs: expect.objectContaining({display_name: 'Region 2', required: true}),
                }));
            });

            it('keeps a plugin-created standalone user field\'s row toggle disabled', async () => {
                mockLoadedNonTemplateField(makeNonTemplate('user', {
                    attrs: {display_name: 'Plugin field', source_plugin_id: 'com.example.plugin', protected: true},
                }));

                renderEdit();
                await waitForForm();

                expect(screen.getByTestId('admin.attribute.applies_to.user.toggle--button')).toBeDisabled();
                expect(screen.getByTestId('admin.attribute.applies_to.user.toggle_locked')).toBeInTheDocument();
            });

            it('keeps a plugin-created standalone channel field\'s row toggle disabled', async () => {
                mockLoadedNonTemplateField(makeNonTemplate('channel', {
                    attrs: {display_name: 'Plugin field', source_plugin_id: 'com.example.plugin', protected: true},
                }));

                renderEdit();
                await waitForForm();

                expect(screen.getByTestId('admin.attribute.applies_to.channel.toggle--button')).toBeDisabled();
                expect(screen.getByTestId('admin.attribute.applies_to.channel.toggle_locked')).toBeInTheDocument();
            });

            it('leaves Type editable -- the single-resource lock must not regress the earlier applies-to-stays-editable guard', async () => {
                mockLoadedNonTemplateField(makeNonTemplate('user'));

                renderEdit();
                await waitForForm();

                expect(screen.getByTestId('admin.attribute.type--button')).not.toBeDisabled();
                expect(screen.queryByTestId('admin.attribute.type_locked')).not.toBeInTheDocument();
            });

            it('leaves a loaded template\'s Applies-to row enabled with its Add-resource trigger present', async () => {
                mockLoadedField(makeTemplate(), [makeLinked('user', 'user-field')]);

                renderEdit();
                await waitForForm();

                expect(screen.getByTestId('admin.attribute.applies_to.user.toggle--button')).not.toBeDisabled();
                expect(screen.queryByTestId('admin.attribute.applies_to.user.toggle_locked')).not.toBeInTheDocument();
                expect(screen.getByTestId('admin.attribute.applies_to.add--button')).toBeInTheDocument();
            });
        });

        describe('non-template field external source', () => {
            it('does not render the external-source editor for a non-template channel field', async () => {
                mockLoadedNonTemplateField(makeNonTemplate('channel'));

                renderEdit();
                await waitForForm();

                expect(screen.queryByTestId('admin.attribute.external_source')).not.toBeInTheDocument();
            });

            it('does not render the external-source editor for a non-template post field', async () => {
                mockLoadedNonTemplateField(makeNonTemplate('post'));

                renderEdit();
                await waitForForm();

                expect(screen.queryByTestId('admin.attribute.external_source')).not.toBeInTheDocument();
            });

            it('renders the external-source editor for a non-template user field', async () => {
                mockLoadedNonTemplateField(makeNonTemplate('user'));

                renderEdit();
                await waitForForm();

                expect(screen.getByTestId('admin.attribute.external_source')).toBeInTheDocument();
            });

            it('leaves a loaded template\'s external-source editor rendered with no resources applied', async () => {
                mockLoadedField(makeTemplate());

                renderEdit();
                await waitForForm();

                expect(screen.getByTestId('admin.attribute.external_source')).toBeInTheDocument();
            });

            it('names the persisted attrs.saml source as the loaded Users row\'s Managed-by value', async () => {
                mockLoadedField(
                    makeTemplate({attrs: {display_name: 'Department', saml: 'position'}}),
                    [makeLinked('user', 'user-field')],
                );

                renderEdit();
                await waitForForm();
                await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.toggle--button'));

                expect(screen.getByTestId('admin.attribute.applies_to.user.managed_by--button')).toHaveTextContent('SAML');
                expect(screen.getByText('Not editable in Mattermost.')).toBeInTheDocument();
            });

            it('omits the Managed-by row from a loaded Users row when the attribute is managed in Mattermost', async () => {
                mockLoadedField(makeTemplate(), [makeLinked('user', 'user-field')]);

                renderEdit();
                await waitForForm();
                await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.toggle--button'));

                expect(screen.getByTestId('admin.attribute.applies_to.user.body--region')).toBeInTheDocument();
                expect(screen.queryByTestId('admin.attribute.applies_to.user.managed_by--button')).not.toBeInTheDocument();
            });
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

            await userEvent.type(screen.getByTestId('admin.attribute.values.add--textbox'), 'Sales{Enter}');
            await userEvent.click(screen.getByTestId('admin.save--button'));

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

            expect(screen.getByTestId('admin.attribute.type--button')).toBeDisabled();
            expect(screen.getByTestId('admin.attribute.type_locked')).toBeInTheDocument();

            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.toggle--button'));
            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.remove--button'));

            await waitFor(() => expect(screen.queryByTestId('admin.attribute.applies_to.user')).not.toBeInTheDocument());
            expect(screen.getByTestId('admin.attribute.type--button')).not.toBeDisabled();
            expect(screen.queryByTestId('admin.attribute.type_locked')).not.toBeInTheDocument();
        });

        it('locks adding an external source while a pending Applies-to resource is on the form, so linking cannot silently change the type', async () => {
            mockLoadedField(makeTemplate({type: 'rank', attrs: {display_name: 'Clearance', options: [{id: 'opt-1', name: 'Secret', rank: 1}]}}), [makeLinked('user', 'user-field')]);
            renderEdit();
            await waitForForm();

            expect(screen.getByTestId('admin.attribute.external_source.link--button')).toBeDisabled();
            expect(screen.getByTestId('admin.attribute.external_source.link_locked')).toBeInTheDocument();

            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.toggle--button'));
            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.remove--button'));

            await waitFor(() => expect(screen.queryByTestId('admin.attribute.applies_to.user')).not.toBeInTheDocument());
            expect(screen.getByTestId('admin.attribute.external_source.link--button')).not.toBeDisabled();
            expect(screen.queryByTestId('admin.attribute.external_source.link_locked')).not.toBeInTheDocument();
        });

        it('keeps adding an external source available on an applied attribute whose type the source can populate', async () => {
            mockLoadedField(makeTemplate({type: 'select', attrs: {display_name: 'Department', options: [{id: 'opt-1', name: 'Engineering'}]}}), [makeLinked('user', 'user-field')]);
            renderEdit();
            await waitForForm();

            expect(screen.getByTestId('admin.attribute.external_source.link--button')).not.toBeDisabled();
            expect(screen.queryByTestId('admin.attribute.external_source.link_locked')).not.toBeInTheDocument();
        });

        it('lists a synced attribute\'s options read-only and leaves them out of the save, so the sync keeps owning them', async () => {
            mockLoadedField(makeTemplate({
                type: 'multiselect',
                attrs: {display_name: 'Department', ldap: 'memberOf', options: [{id: 'opt-1', name: 'Engineering'}, {id: 'opt-2', name: 'Sales'}]},
            }), [makeLinked('user', 'user-field', {type: 'multiselect', attrs: {display_name: 'Department', ldap: 'memberOf'}})]);
            const patchPropertyField = jest.spyOn(Client4, 'patchPropertyField').mockResolvedValue(makeTemplate());
            renderEdit();
            await waitForForm();

            const chips = screen.getAllByTestId(/^admin\.attribute\.values\.option:/);
            expect(chips.map((chip) => chip.textContent)).toEqual(['Engineering', 'Sales']);
            expect(screen.queryByTestId('admin.attribute.values.add--textbox')).not.toBeInTheDocument();
            expect(screen.queryByRole('button', {name: 'Remove option'})).not.toBeInTheDocument();

            const displayName = screen.getByTestId('admin.attribute.display_name--textbox');
            await userEvent.clear(displayName);
            await userEvent.type(displayName, 'Departments');
            await userEvent.click(screen.getByTestId('admin.save--button'));

            await waitFor(() => expect(patchPropertyField).toHaveBeenCalled());
            const attrs = patchPropertyField.mock.calls[0][3].attrs as Record<string, unknown>;
            expect(attrs).toEqual(expect.objectContaining({display_name: 'Departments', ldap: 'memberOf'}));
            expect(attrs).not.toHaveProperty('options');
        });

        it('still saves the options seeded before a source is linked for the first time', async () => {
            mockLoadedField(makeTemplate({
                type: 'select',
                attrs: {display_name: 'Department', options: [{id: 'opt-1', name: 'Engineering'}]},
            }), [makeLinked('user', 'user-field', {type: 'select'})]);
            const patchPropertyField = jest.spyOn(Client4, 'patchPropertyField').mockResolvedValue(makeTemplate());
            renderEdit();
            await waitForForm();

            await userEvent.click(screen.getByTestId('admin.attribute.external_source.link--button'));
            await userEvent.click(screen.getByRole('menuitem', {name: /AD\/LDAP/}));
            await userEvent.type(await screen.findByPlaceholderText('department'), 'department');
            await userEvent.click(screen.getByRole('button', {name: 'Save'}));
            await waitFor(() => expect(screen.queryByPlaceholderText('department')).not.toBeInTheDocument());
            await userEvent.click(screen.getByTestId('admin.save--button'));

            await waitFor(() => expect(patchPropertyField).toHaveBeenCalled());
            expect(patchPropertyField.mock.calls[0][3]).toEqual(expect.objectContaining({
                type: 'select',
                attrs: expect.objectContaining({ldap: 'department', options: [{id: 'opt-1', name: 'Engineering'}]}),
            }));
        });

        it('holds Save once Users is removed from a synced Select, until the link is removed too', async () => {
            mockLoadedField(makeTemplate({
                type: 'select',
                attrs: {display_name: 'Department', ldap: 'department', options: [{id: 'opt-1', name: 'Engineering'}]},
            }), [
                makeLinked('user', 'user-field', {type: 'select', attrs: {display_name: 'Department', ldap: 'department'}}),
                makeLinked('channel', 'channel-field', {type: 'select'}),
            ]);
            renderEdit();
            await waitForForm();

            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.toggle--button'));
            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.remove--button'));

            expect(screen.getByTestId('admin.attribute.options.need_users--alert')).toBeInTheDocument();
            expect(screen.getByTestId('admin.save--button')).toBeDisabled();

            await userEvent.click(within(screen.getByTestId('admin.attribute.external_source.source:ldap')).getByTestId('admin.attribute.external_source.source.remove--button'));

            expect(screen.queryByTestId('admin.attribute.options.need_users--alert')).not.toBeInTheDocument();
            expect(screen.getByTestId('admin.attribute.values.add--textbox')).toBeInTheDocument();
            expect(screen.getByTestId('admin.save--button')).not.toBeDisabled();
        });

        it('locks Name editing while the attribute is currently applied to a resource', async () => {
            mockLoadedField(makeTemplate(), [makeLinked('user', 'user-field')]);
            renderEdit();
            await waitForForm();

            expect(screen.getByTestId('admin.attribute.unique_name.edit--button')).toBeDisabled();
            expect(screen.getByTestId('admin.attribute.unique_name.edit_locked')).toBeInTheDocument();
        });

        it('does not DELETE a persisted resource until Save, then DELETEs only removed types', async () => {
            mockLoadedField(makeTemplate(), [makeLinked('user', 'user-field'), makeLinked('channel', 'channel-field')]);
            const deletePropertyField = jest.spyOn(Client4, 'deletePropertyField').mockResolvedValue({status: 'OK'});
            jest.spyOn(Client4, 'patchPropertyField').mockResolvedValue(makeTemplate());
            const createPropertyField = jest.spyOn(Client4, 'createPropertyField');

            renderEdit();
            await waitForForm();

            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.toggle--button'));
            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.remove--button'));
            await waitFor(() => expect(screen.queryByTestId('admin.attribute.applies_to.user')).not.toBeInTheDocument());
            expect(deletePropertyField).not.toHaveBeenCalled();

            await userEvent.click(screen.getByTestId('admin.save--button'));
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

            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.toggle--button'));
            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.remove--button'));
            await waitFor(() => expect(screen.queryByTestId('admin.attribute.applies_to.user')).not.toBeInTheDocument());

            await userEvent.click(screen.getByTestId('admin.save--button'));
            await userEvent.click(await screen.findByRole('button', {name: /^cancel$/i}));

            expect(deletePropertyField).not.toHaveBeenCalled();
            expect(patchPropertyField).not.toHaveBeenCalled();
            expect(mockHistoryPush).not.toHaveBeenCalled();
            expect(screen.getByTestId('admin.save--button')).toBeEnabled();
        });

        it('POSTs only newly added resource types and skips types that were already persisted', async () => {
            mockLoadedField(makeTemplate(), [makeLinked('user', 'user-field')]);
            jest.spyOn(Client4, 'patchPropertyField').mockResolvedValue(makeTemplate());
            const createPropertyField = jest.spyOn(Client4, 'createPropertyField').mockResolvedValue({id: 'channel-field'} as PropertyField);
            const deletePropertyField = jest.spyOn(Client4, 'deletePropertyField');

            renderEdit();
            await waitForForm();
            await addResource('Channels', 'channel');
            await userEvent.click(screen.getByTestId('admin.save--button'));

            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalled());
            expect(createPropertyField).toHaveBeenCalledTimes(1);
            expect(createPropertyField).toHaveBeenCalledWith('access_control', 'channel', expect.objectContaining({
                linked_field_id: FIELD_ID,
            }));
            expect(deletePropertyField).not.toHaveBeenCalled();
        });

        it('does not PATCH Users on retry after a later resource create failed', async () => {
            mockLoadedField(makeTemplate());
            const createPropertyField = jest.spyOn(Client4, 'createPropertyField').
                mockResolvedValueOnce({id: 'user-field-id'} as PropertyField).
                mockRejectedValueOnce(new Error('boom')).
                mockResolvedValueOnce({id: 'channel-field-id'} as PropertyField);
            const patchPropertyField = jest.spyOn(Client4, 'patchPropertyField').mockResolvedValue(makeTemplate());

            renderEdit();
            await waitForForm();
            await addResource('Users', 'user');
            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.toggle--button'));
            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.profile_display:always--togglebutton'));
            await addResource('Channels', 'channel');
            await userEvent.click(screen.getByTestId('admin.save--button'));

            expect(await screen.findByTestId('admin.attribute.save_error--alert')).toBeInTheDocument();
            expect(createPropertyField.mock.calls.filter((call) => call[1] === 'user')).toHaveLength(1);

            await userEvent.click(screen.getByTestId('admin.save--button'));
            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalled());

            expect(patchPropertyField).not.toHaveBeenCalledWith('access_control', 'user', expect.anything(), expect.anything());
            expect(createPropertyField.mock.calls.filter((call) => call[1] === 'user')).toHaveLength(1);
            expect(createPropertyField.mock.calls.filter((call) => call[1] === 'channel')).toHaveLength(2);
        });

        it('issues neither DELETE nor POST when a persisted resource is removed then re-added before Save', async () => {
            mockLoadedField(makeTemplate(), [makeLinked('user', 'user-field')]);
            jest.spyOn(Client4, 'patchPropertyField').mockResolvedValue(makeTemplate());
            const createPropertyField = jest.spyOn(Client4, 'createPropertyField');
            const deletePropertyField = jest.spyOn(Client4, 'deletePropertyField');

            renderEdit();
            await waitForForm();

            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.toggle--button'));
            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.remove--button'));
            await waitFor(() => expect(screen.queryByTestId('admin.attribute.applies_to.user')).not.toBeInTheDocument());
            await addResource('Users', 'user');

            await userEvent.click(screen.getByTestId('admin.save--button'));
            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalled());

            expect(deletePropertyField).not.toHaveBeenCalled();
            expect(createPropertyField).not.toHaveBeenCalled();
        });

        it('issues no Users patch when display name and Users config are unchanged', async () => {
            mockLoadedField(makeTemplate({
                type: 'select',
                attrs: {
                    display_name: 'Department',
                    options: [{id: 'opt-1', name: 'Engineering'}],
                },
            }), [makeLinked('user', 'user-field')]);
            const patchPropertyField = jest.spyOn(Client4, 'patchPropertyField').mockResolvedValue(makeTemplate({type: 'select'}));

            renderEdit();
            await waitForForm();

            // Dirty the page via Options only -- display name and Users config stay
            // put, so the linked Users row must not be patched.
            await userEvent.type(screen.getByTestId('admin.attribute.values.add--textbox'), 'Sales{Enter}');
            await userEvent.click(screen.getByTestId('admin.save--button'));

            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalled());
            expect(patchPropertyField).toHaveBeenCalledTimes(1);
            expect(patchPropertyField).toHaveBeenCalledWith('access_control', 'template', FIELD_ID, expect.anything());
            expect(patchPropertyField).not.toHaveBeenCalledWith('access_control', 'user', expect.anything(), expect.anything());
        });

        it('PATCHes matching linked Users display_name when the template display name changes', async () => {
            mockLoadedField(makeTemplate(), [makeLinked('user', 'user-field')]);
            const patchPropertyField = jest.spyOn(Client4, 'patchPropertyField').mockImplementation((_group, objectType) => (
                Promise.resolve(objectType === 'user' ? makeLinked('user', 'user-field', {attrs: {display_name: 'Department 2'}}) : makeTemplate({attrs: {display_name: 'Department 2'}}))
            ));

            renderEdit();
            await waitForForm();

            await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), ' 2');
            await userEvent.click(screen.getByTestId('admin.save--button'));

            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalled());
            expect(patchPropertyField).toHaveBeenCalledWith('access_control', 'template', FIELD_ID, expect.objectContaining({
                attrs: expect.objectContaining({display_name: 'Department 2'}),
            }));
            expect(patchPropertyField).toHaveBeenCalledWith('access_control', 'user', 'user-field', {
                attrs: {display_name: 'Department 2'},
            });
        });

        it('does not overwrite a linked Users display_name that already diverged from the template', async () => {
            mockLoadedField(makeTemplate(), [makeLinked('user', 'user-field', {attrs: {display_name: 'Custom Label'}})]);
            const patchPropertyField = jest.spyOn(Client4, 'patchPropertyField').mockResolvedValue(makeTemplate({attrs: {display_name: 'Department 2'}}));

            renderEdit();
            await waitForForm();

            await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), ' 2');
            await userEvent.click(screen.getByTestId('admin.save--button'));

            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalled());
            expect(patchPropertyField).toHaveBeenCalledTimes(1);
            expect(patchPropertyField).toHaveBeenCalledWith('access_control', 'template', FIELD_ID, expect.anything());
            expect(patchPropertyField).not.toHaveBeenCalledWith('access_control', 'user', expect.anything(), expect.anything());
        });

        it('mirrors the server-updated Users field into the CPA cache after a template options PATCH', async () => {
            const originalUser = makeLinked('user', 'user-field', {
                type: 'select',
                attrs: {display_name: 'Department', options: [{id: 'opt-1', name: 'Engineering'}]},
            });
            const refreshedUser = makeLinked('user', 'user-field', {
                type: 'select',
                attrs: {
                    display_name: 'Department',
                    options: [{id: 'opt-1', name: 'Engineering'}, {id: 'opt-2', name: 'Sales'}],
                },
            });
            const template = makeTemplate({
                type: 'select',
                attrs: {display_name: 'Department', options: [{id: 'opt-1', name: 'Engineering'}]},
            });

            let afterTemplatePatch = false;
            jest.spyOn(Client4, 'getPropertyFields').mockImplementation((_group, objectType) => {
                if (objectType === 'template') {
                    return Promise.resolve([template]);
                }
                if (objectType === 'user') {
                    return Promise.resolve([afterTemplatePatch ? refreshedUser : originalUser]);
                }
                return Promise.resolve([]);
            });
            jest.spyOn(Client4, 'patchPropertyField').mockImplementation(async () => {
                afterTemplatePatch = true;
                return template;
            });

            const {store} = renderEdit({
                entities: {
                    general: {
                        customProfileAttributes: {
                            [originalUser.id]: originalUser,
                        },
                    },
                },
            });
            await waitForForm();

            await userEvent.type(screen.getByTestId('admin.attribute.values.add--textbox'), 'Sales{Enter}');
            await userEvent.click(screen.getByTestId('admin.save--button'));

            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalled());
            expect(store.getState().entities.general.customProfileAttributes['user-field']).toEqual(refreshedUser);
        });

        it('still saves when the post-PATCH Users refetch fails', async () => {
            const originalUser = makeLinked('user', 'user-field', {
                type: 'select',
                attrs: {display_name: 'Department', options: [{id: 'opt-1', name: 'Engineering'}]},
            });
            const template = makeTemplate({
                type: 'select',
                attrs: {display_name: 'Department', options: [{id: 'opt-1', name: 'Engineering'}]},
            });

            let afterTemplatePatch = false;
            jest.spyOn(Client4, 'getPropertyFields').mockImplementation((_group, objectType) => {
                if (afterTemplatePatch) {
                    return Promise.reject(new Error('boom'));
                }
                if (objectType === 'template') {
                    return Promise.resolve([template]);
                }
                if (objectType === 'user') {
                    return Promise.resolve([originalUser]);
                }
                return Promise.resolve([]);
            });
            jest.spyOn(Client4, 'patchPropertyField').mockImplementation(async () => {
                afterTemplatePatch = true;
                return template;
            });

            renderEdit();
            await waitForForm();

            await userEvent.type(screen.getByTestId('admin.attribute.values.add--textbox'), 'Sales{Enter}');
            await userEvent.click(screen.getByTestId('admin.save--button'));

            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalled());
        });

        it('folds matching display_name into the existing Channels config PATCH', async () => {
            mockLoadedField(makeTemplate(), [makeLinked('channel', 'channel-field')]);
            const patchPropertyField = jest.spyOn(Client4, 'patchPropertyField').mockImplementation((_group, objectType) => (
                Promise.resolve(objectType === 'channel' ? makeLinked('channel', 'channel-field', {attrs: {display_name: 'Department 2'}}) : makeTemplate({attrs: {display_name: 'Department 2'}}))
            ));

            renderEdit();
            await waitForForm();

            await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), ' 2');
            await userEvent.click(screen.getByTestId('admin.save--button'));

            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalled());
            expect(patchPropertyField).toHaveBeenCalledWith('access_control', 'channel', 'channel-field', {
                attrs: expect.objectContaining({display_name: 'Department 2'}),
            });
        });

        it('does not overwrite a diverged Channels display_name when renaming the template', async () => {
            mockLoadedField(makeTemplate(), [makeLinked('channel', 'channel-field', {attrs: {display_name: 'Custom Channel Label'}})]);
            const patchPropertyField = jest.spyOn(Client4, 'patchPropertyField').mockImplementation((_group, objectType) => (
                Promise.resolve(objectType === 'channel' ? makeLinked('channel', 'channel-field', {attrs: {display_name: 'Custom Channel Label'}}) : makeTemplate({attrs: {display_name: 'Department 2'}}))
            ));

            renderEdit();
            await waitForForm();

            await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), ' 2');
            await userEvent.click(screen.getByTestId('admin.save--button'));

            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalled());
            const channelPatch = patchPropertyField.mock.calls.find((call) => call[1] === 'channel');
            expect(channelPatch).toBeDefined();
            expect(channelPatch?.[3]?.attrs).not.toHaveProperty('display_name');
        });

        it('PATCHes matching linked Posts display_name when the template display name changes', async () => {
            mockLoadedField(makeTemplate(), [makeLinked('post', 'post-field')]);
            const patchPropertyField = jest.spyOn(Client4, 'patchPropertyField').mockImplementation((_group, objectType) => (
                Promise.resolve(objectType === 'post' ? makeLinked('post', 'post-field', {attrs: {display_name: 'Department 2'}}) : makeTemplate({attrs: {display_name: 'Department 2'}}))
            ));

            renderEdit();
            await waitForForm();

            await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), ' 2');
            await userEvent.click(screen.getByTestId('admin.save--button'));

            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalled());
            expect(patchPropertyField).toHaveBeenCalledWith('access_control', 'post', 'post-field', {
                attrs: {display_name: 'Department 2'},
            });
        });

        it('issues exactly one config patch, carrying both values, for an already-persisted Users row whose config changed', async () => {
            mockLoadedField(makeTemplate(), [makeLinked('user', 'user-field')]);
            const patchPropertyField = jest.spyOn(Client4, 'patchPropertyField').mockImplementation((_group, objectType) => (
                Promise.resolve(objectType === 'user' ? makeLinked('user', 'user-field') : makeTemplate())
            ));

            renderEdit();
            await waitForForm();

            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.toggle--button'));
            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.profile_display:hidden--togglebutton'));
            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.who_can_set.admin--radio'));
            await userEvent.click(screen.getByTestId('admin.save--button'));

            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalled());
            expect(patchPropertyField).toHaveBeenCalledWith('access_control', 'user', 'user-field', {
                attrs: {visibility: 'hidden', managed: 'admin'},
                permission_values: 'sysadmin',
            });
            expect(patchPropertyField.mock.calls.filter((call) => call[1] === 'user')).toHaveLength(1);
        });

        it('PATCHes ldap/saml onto an already-persisted Users field when the template sync source changes', async () => {
            // Sync reads attrs.ldap/attrs.saml on the Users field, not the template.
            // Those attrs are only copied at linked-field create time, so Save must
            // cascade a later template edit onto the existing Users row.
            mockLoadedField(
                makeTemplate({attrs: {display_name: 'Department', ldap: 'oldDept'}}),
                [makeLinked('user', 'user-field', {attrs: {display_name: 'Department', ldap: 'oldDept'}})],
            );
            const patchPropertyField = jest.spyOn(Client4, 'patchPropertyField').mockImplementation((_group, objectType) => (
                Promise.resolve(objectType === 'user' ? makeLinked('user', 'user-field', {attrs: {ldap: 'newDept'}}) : makeTemplate({attrs: {display_name: 'Department', ldap: 'newDept'}}))
            ));

            renderEdit();
            await waitForForm();

            await userEvent.click(within(screen.getByTestId('admin.attribute.external_source.source:ldap')).getByTestId('admin.attribute.external_source.source.edit--button'));
            const input = await screen.findByPlaceholderText('department');
            await userEvent.clear(input);
            await userEvent.type(input, 'newDept');
            await userEvent.click(screen.getByRole('button', {name: 'Save'}));
            await waitFor(() => expect(screen.queryByPlaceholderText('department')).not.toBeInTheDocument());

            await userEvent.click(screen.getByTestId('admin.save--button'));

            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalled());
            expect(patchPropertyField).toHaveBeenCalledWith('access_control', 'template', FIELD_ID, expect.objectContaining({
                attrs: expect.objectContaining({ldap: 'newDept'}),
            }));
            expect(patchPropertyField).toHaveBeenCalledWith('access_control', 'user', 'user-field', {
                attrs: {ldap: 'newDept'},
            });
        });

        it('PATCHes a newly linked OpenID Connect claim onto the template and the already-persisted Users field', async () => {
            mockLoadedField(
                makeTemplate({type: 'multiselect', attrs: {display_name: 'Groups'}}),
                [makeLinked('user', 'user-field', {type: 'multiselect', attrs: {display_name: 'Groups'}})],
            );
            const patchPropertyField = jest.spyOn(Client4, 'patchPropertyField').mockImplementation((_group, objectType) => (
                Promise.resolve(objectType === 'user' ? makeLinked('user', 'user-field', {attrs: {openid: 'groups'}}) : makeTemplate({type: 'multiselect', attrs: {display_name: 'Groups', openid: 'groups'}}))
            ));

            renderEdit({
                entities: {
                    admin: {config: {FeatureFlags: {OpenIdAttributeSync: true}, OpenIdSettings: {Enable: true}}},
                    general: {license: {IsLicensed: 'true', OpenId: 'true'}},
                },
            });
            await waitForForm();

            await userEvent.click(screen.getByTestId('admin.attribute.external_source.link--button'));
            await userEvent.click(screen.getByRole('menuitem', {name: /^OpenID Connect/}));
            await userEvent.type(await screen.findByPlaceholderText('department'), 'groups');
            await userEvent.click(screen.getByRole('button', {name: 'Save'}));
            await waitFor(() => expect(screen.queryByPlaceholderText('department')).not.toBeInTheDocument());

            expect(screen.getByTestId('admin.attribute.type--button')).toHaveTextContent('Multiselect');
            expect(screen.getByTestId('admin.attribute.options.synced_help--text')).toHaveTextContent('Options are managed by the OpenID Connect sync.');

            await userEvent.click(screen.getByTestId('admin.save--button'));

            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalled());
            expect(patchPropertyField).toHaveBeenCalledWith('access_control', 'template', FIELD_ID, expect.objectContaining({
                attrs: expect.objectContaining({ldap: null, saml: null, openid: 'groups'}),
            }));
            expect(patchPropertyField).toHaveBeenCalledWith('access_control', 'user', 'user-field', {
                attrs: {openid: 'groups'},
            });
        });

        it('clears ldap/saml on an already-persisted Users field when the template sync source is removed', async () => {
            mockLoadedField(
                makeTemplate({attrs: {display_name: 'Department', ldap: 'oldDept'}}),
                [makeLinked('user', 'user-field', {attrs: {display_name: 'Department', ldap: 'oldDept'}})],
            );
            const patchPropertyField = jest.spyOn(Client4, 'patchPropertyField').mockImplementation((_group, objectType) => (
                Promise.resolve(objectType === 'user' ? makeLinked('user', 'user-field') : makeTemplate())
            ));

            renderEdit();
            await waitForForm();

            await userEvent.click(within(screen.getByTestId('admin.attribute.external_source.source:ldap')).getByTestId('admin.attribute.external_source.source.remove--button'));
            await userEvent.click(screen.getByTestId('admin.save--button'));

            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalled());
            expect(patchPropertyField).toHaveBeenCalledWith('access_control', 'user', 'user-field', {
                attrs: {ldap: null},
            });
        });

        it('renders a distinct "settings couldn\'t be updated" banner (not "couldn\'t be applied") when the config patch fails, since the row is already linked', async () => {
            mockLoadedField(makeTemplate(), [makeLinked('user', 'user-field')]);
            jest.spyOn(Client4, 'patchPropertyField').mockImplementation((_group, objectType) => (
                objectType === 'user' ? Promise.reject(new Error('boom')) : Promise.resolve(makeTemplate())
            ));

            renderEdit();
            await waitForForm();

            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.toggle--button'));
            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.who_can_set.admin--radio'));
            await userEvent.click(screen.getByTestId('admin.save--button'));

            const banner = await screen.findByTestId('admin.attribute.save_error--alert');
            expect(banner).toHaveTextContent('Users');
            expect(banner).toHaveTextContent('settings');
            expect(banner).not.toHaveTextContent('be applied');
            expect(screen.getByTestId('admin.save--button')).not.toBeDisabled();
        });

        it('renders a display-name update banner (not Profile display / Who can set) when only the linked display_name cascade fails', async () => {
            mockLoadedField(makeTemplate(), [makeLinked('user', 'user-field')]);
            jest.spyOn(Client4, 'patchPropertyField').mockImplementation((_group, objectType) => (
                objectType === 'user' ? Promise.reject(new Error('boom')) : Promise.resolve(makeTemplate({attrs: {display_name: 'Department 2'}}))
            ));

            renderEdit();
            await waitForForm();

            await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), ' 2');
            await userEvent.click(screen.getByTestId('admin.save--button'));

            const banner = await screen.findByTestId('admin.attribute.save_error--alert');
            expect(banner).toHaveTextContent('Users');
            expect(banner).toHaveTextContent('display name');
            expect(banner).not.toHaveTextContent('Profile display');
            expect(banner).not.toHaveTextContent('be applied');
            expect(screen.getByTestId('admin.save--button')).not.toBeDisabled();
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

            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.toggle--button'));
            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.remove--button'));
            await waitFor(() => expect(screen.getByTestId('admin.attribute.type--button')).not.toBeDisabled());

            await userEvent.click(screen.getByTestId('admin.attribute.type--button'));
            await userEvent.click(screen.getByRole('menuitemradio', {name: 'Select'}));
            await userEvent.type(screen.getByTestId('admin.attribute.values.add--textbox'), 'Engineering{Enter}');
            await userEvent.click(screen.getByTestId('admin.save--button'));
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

            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.toggle--button'));
            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.remove--button'));
            await waitFor(() => expect(screen.queryByTestId('admin.attribute.applies_to.user')).not.toBeInTheDocument());

            await userEvent.click(screen.getByTestId('admin.save--button'));
            await userEvent.click(await screen.findByRole('button', {name: /remove and save/i}));

            expect(await screen.findByTestId('admin.attribute.save_error--alert')).toBeInTheDocument();
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

            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.toggle--button'));
            await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.remove--button'));
            await waitFor(() => expect(screen.queryByTestId('admin.attribute.applies_to.user')).not.toBeInTheDocument());

            await userEvent.click(screen.getByTestId('admin.save--button'));
            await userEvent.click(await screen.findByRole('button', {name: /remove and save/i}));

            expect(patchPropertyField).toHaveBeenCalledTimes(1);
            expect(deletePropertyField).toHaveBeenCalledTimes(1);
            expect(mockHistoryPush).not.toHaveBeenCalled();

            const banner = await screen.findByTestId('admin.attribute.save_error--alert');
            expect(banner).toHaveTextContent('The attribute was saved');
            expect(banner).not.toHaveTextContent('Nothing else was saved');
        });

        describe('plugin-owned field', () => {
            const PLUGIN_ID = 'com.example.plugin';

            function mockPluginInstalled() {
                return jest.spyOn(Client4, 'getPluginStatuses').mockResolvedValue([{
                    plugin_id: PLUGIN_ID,
                    name: 'Example Plugin',
                    description: '',
                    version: '1.0.0',
                    cluster_id: '',
                    plugin_path: '',
                    state: 1,
                }]);
            }

            function mockPluginNotInstalled() {
                return jest.spyOn(Client4, 'getPluginStatuses').mockResolvedValue([]);
            }

            it('does not redirect to the listing (R1 regression)', async () => {
                mockPluginInstalled();
                mockLoadedField(makePluginOwnedTemplate());

                renderEdit();
                await waitForForm();

                expect(mockHistoryPush).not.toHaveBeenCalled();
            });

            it('renders every Definition control disabled, and suppresses the options-validation error', async () => {
                mockPluginInstalled();
                mockLoadedField(makePluginOwnedTemplate({
                    type: 'select',
                    attrs: {display_name: 'Plugin field', source_plugin_id: PLUGIN_ID, protected: true, options: [{id: 'opt-1', name: 'dup'}, {id: 'opt-2', name: 'dup'}]},
                }));

                renderEdit();
                await waitForForm();

                expect(screen.getByTestId('admin.attribute.display_name--textbox')).toBeDisabled();
                expect(screen.getByTestId('admin.attribute.type--button')).toBeDisabled();
                expect(screen.getByTestId('admin.attribute.values.add--textbox')).toBeDisabled();

                // A plugin-supplied template's options came from the plugin API, not
                // this form -- they aren't guaranteed to satisfy this UI's own shape
                // rules (duplicate names, here), and this page has no controls to act
                // on such an error anyway.
                expect(screen.queryByTestId('admin.attribute.options.required--alert')).not.toBeInTheDocument();
            });

            it('shows the plugin-owned Type lock reason (not "applies to a resource") when the field has zero applied resources', async () => {
                mockPluginInstalled();
                mockLoadedField(makePluginOwnedTemplate());

                renderEdit();
                await waitForForm();

                expect(screen.getByTestId('admin.attribute.type--button')).toHaveAccessibleName(/managed by a plugin/);
            });

            it('shows the plugin-owned Unique Name lock reason when the field has zero applied resources', async () => {
                mockPluginInstalled();
                mockLoadedField(makePluginOwnedTemplate());

                renderEdit();
                await waitForForm();

                expect(screen.getByTestId('admin.attribute.unique_name.edit--button')).toBeDisabled();
                expect(screen.getByTestId('admin.attribute.unique_name.edit--button')).toHaveAccessibleName(/managed by a plugin/);
            });

            it('renders AttributePluginSource instead of AttributeExternalSource, resolving the same plugin name the listing would show', async () => {
                mockPluginInstalled();
                mockLoadedField(makePluginOwnedTemplate());

                renderEdit();
                await waitForForm();

                expect(screen.queryByTestId('admin.attribute.external_source')).not.toBeInTheDocument();
                const pluginSource = await screen.findByTestId('admin.attribute.plugin_source');
                expect(pluginSource).toHaveTextContent('Example Plugin');
            });

            it('hides both Add-resource triggers even with fewer than 3 resource types applied', async () => {
                mockPluginInstalled();
                mockLoadedField(makePluginOwnedTemplate(), [makeLinked('user', 'user-field')]);

                renderEdit();
                await waitForForm();

                expect(screen.queryByTestId('admin.attribute.applies_to.add--button')).not.toBeInTheDocument();
                expect(screen.queryByTestId('admin.attribute.applies_to.add_inline--button')).not.toBeInTheDocument();
            });

            it('keeps existing Applies-to rows visible but disables their toggle', async () => {
                mockPluginInstalled();
                mockLoadedField(makePluginOwnedTemplate(), [makeLinked('user', 'user-field')]);

                renderEdit();
                await waitForForm();

                expect(screen.getByTestId('admin.attribute.applies_to.user')).toBeInTheDocument();
                expect(screen.getByTestId('admin.attribute.applies_to.user.toggle--button')).toBeDisabled();

                // The lock is permanent (not the transient `saving` case), so it
                // gets an explanatory tooltip, matching the Type/Unique-Name
                // lock convention elsewhere on this page.
                expect(screen.getByTestId('admin.attribute.applies_to.user.toggle_locked')).toBeInTheDocument();
            });

            it('does not show Managed by when leftover ldap/saml attrs are present on a plugin-owned field', async () => {
                mockPluginInstalled();
                mockLoadedField(makePluginOwnedTemplate({
                    attrs: {display_name: 'Plugin field', source_plugin_id: PLUGIN_ID, protected: true, ldap: 'dept', saml: 'department'},
                }), [makeLinked('user', 'user-field')]);

                renderEdit();
                await waitForForm();

                expect(screen.queryByTestId('admin.attribute.applies_to.user.managed_by--button')).not.toBeInTheDocument();
                expect(screen.queryByText('Managed by')).not.toBeInTheDocument();
                expect(screen.queryByText('Not editable in Mattermost.')).not.toBeInTheDocument();
            });

            it('keeps Save disabled regardless of otherwise-valid field state', async () => {
                mockPluginInstalled();
                mockLoadedField(makePluginOwnedTemplate());

                renderEdit();
                await waitForForm();

                // A freshly-loaded edit-mode field already has isDirty === false,
                // which alone would disable Save regardless of plugin ownership --
                // asserting disabled here alone wouldn't prove the plugin-owned lock
                // itself is doing anything. fireEvent.change (not userEvent.type,
                // which correctly refuses to type into a genuinely disabled input)
                // forces every other canSave clause true -- non-empty display name,
                // dirty, not saving, no validation/options error -- isolating
                // effectiveDisabled as the one remaining clause keeping Save disabled.
                fireEvent.change(screen.getByTestId('admin.attribute.display_name--textbox'), {target: {value: 'Renamed'}});

                expect(screen.getByTestId('admin.save--button')).toBeDisabled();
            });

            it('stays fully locked when the owning plugin is orphaned, and shows the orphaned Managed-by copy with no link', async () => {
                mockPluginNotInstalled();
                mockLoadedField(makePluginOwnedTemplate());

                renderEdit();
                await waitForForm();

                const pluginSource = await screen.findByTestId('admin.attribute.plugin_source');
                await waitFor(() => expect(pluginSource).toHaveTextContent('no longer installed'));
                expect(screen.queryByTestId('admin.attribute.plugin_source.settings--link')).not.toBeInTheDocument();

                expect(screen.getByTestId('admin.attribute.display_name--textbox')).toBeDisabled();
                expect(screen.getByTestId('admin.save--button')).toBeDisabled();
            });

            it('switches the Type and Unique Name lock reasons to the orphaned copy, not the plain "managed by a plugin" text', async () => {
                mockPluginNotInstalled();
                mockLoadedField(makePluginOwnedTemplate());

                renderEdit();
                await waitForForm();
                await waitFor(() => expect(screen.getByTestId('admin.attribute.plugin_source')).toHaveTextContent('no longer installed'));

                expect(screen.getByTestId('admin.attribute.type--button')).toHaveAccessibleName(/no longer installed/);
                expect(screen.getByTestId('admin.attribute.type--button')).not.toHaveAccessibleName(/managed by a plugin\./);
                expect(screen.getByTestId('admin.attribute.unique_name.edit--button')).toHaveAccessibleName(/no longer installed/);
            });

            it('keeps the Applies-to row locked (toggle disabled, Remove unreachable) when orphaned, even though the server would permit that delete', async () => {
                mockPluginNotInstalled();
                mockLoadedField(makePluginOwnedTemplate(), [makeLinked('user', 'user-field')]);

                renderEdit();
                await waitForForm();
                await waitFor(() => expect(screen.getByTestId('admin.attribute.plugin_source')).toHaveTextContent('no longer installed'));

                // Remove is only rendered once the row is expanded, and expanding it
                // requires clicking this same toggle -- asserting it stays disabled
                // (and that a click on it doesn't expand the row) is a stronger
                // guarantee than asserting Remove's own disabled attribute, since it
                // proves Remove can never even be reached in the DOM.
                const toggle = screen.getByTestId('admin.attribute.applies_to.user.toggle--button');
                expect(toggle).toBeDisabled();
                await userEvent.click(toggle);
                expect(screen.queryByTestId('admin.attribute.applies_to.user.remove--button')).not.toBeInTheDocument();
            });
        });

        describe('owned field', () => {
            const SCIM_ID = 'com.mattermost.scim';
            const scimOwner = {id: SCIM_ID, type: 'plugin', scopes: []};

            function mockScimStatus(installed: boolean) {
                return jest.spyOn(Client4, 'getPluginStatuses').mockResolvedValue(installed ? [{
                    plugin_id: SCIM_ID,
                    name: 'SCIM',
                    description: '',
                    version: '1.0.0',
                    cluster_id: '',
                    plugin_path: '',
                    state: 1,
                }] : []);
            }

            it('locks Type and Unique Name on an owned template, naming the owner instead of "applies to a resource"', async () => {
                const getPluginStatuses = mockScimStatus(true);
                mockLoadedField(makeTemplate(), [makeLinked('user', 'user-field', {attrs: {display_name: 'Department', owners: [scimOwner]}})]);

                renderEdit();
                await waitForForm();

                const typeButton = screen.getByTestId('admin.attribute.type--button');
                const nameLink = screen.getByTestId('admin.attribute.unique_name.edit--button');
                await waitFor(() => expect(typeButton).toHaveAccessibleName(/managed by SCIM/));
                expect(typeButton).toBeDisabled();
                expect(nameLink).toBeDisabled();
                expect(nameLink).toHaveAccessibleName(/managed by SCIM/);
                expect(typeButton).not.toHaveAccessibleName(/applies to a resource/);
                expect(nameLink).not.toHaveAccessibleName(/applies to a resource/);
                expect(getPluginStatuses).toHaveBeenCalled();
            });

            it('locks Type and Unique Name on an owned standalone user field', async () => {
                mockScimStatus(true);
                mockLoadedNonTemplateField(makeNonTemplate('user', {attrs: {display_name: 'Department', owners: [scimOwner]}}));

                renderEdit();
                await waitForForm();

                await waitFor(() => expect(screen.getByTestId('admin.attribute.type--button')).toHaveAccessibleName(/managed by SCIM/));
                expect(screen.getByTestId('admin.attribute.type--button')).toBeDisabled();
                expect(screen.getByTestId('admin.attribute.unique_name.edit--button')).toBeDisabled();
                expect(screen.getByTestId('admin.attribute.unique_name.edit--button')).toHaveAccessibleName(/managed by SCIM/);
            });

            it('stays locked and names the plugin ID when the owner plugin is not installed', async () => {
                mockScimStatus(false);
                mockLoadedField(makeTemplate(), [makeLinked('user', 'user-field', {attrs: {display_name: 'Department', owners: [scimOwner]}})]);

                renderEdit();
                await waitForForm();

                expect(screen.getByTestId('admin.attribute.type--button')).toBeDisabled();
                expect(screen.getByTestId('admin.attribute.type--button')).toHaveAccessibleName(new RegExp(`managed by ${SCIM_ID}`));
                expect(screen.getByTestId('admin.attribute.unique_name.edit--button')).toHaveAccessibleName(new RegExp(`managed by ${SCIM_ID}`));
            });

            it('names a service owner by its ID', async () => {
                mockLoadedField(makeTemplate(), [makeLinked('user', 'user-field', {attrs: {display_name: 'Department', owners: [{id: 'svc-sync', type: 'service', scopes: []}]}})]);

                renderEdit();
                await waitForForm();

                expect(screen.getByTestId('admin.attribute.type--button')).toHaveAccessibleName(/managed by svc-sync/);
                expect(screen.getByTestId('admin.attribute.unique_name.edit--button')).toHaveAccessibleName(/managed by svc-sync/);
            });

            it('keeps display name and options editable, and lets a display name change enable Save', async () => {
                mockScimStatus(true);
                mockLoadedField(makeTemplate({
                    type: 'select',
                    attrs: {display_name: 'Department', options: [{id: 'opt-1', name: 'Engineering'}]},
                }), [makeLinked('user', 'user-field', {type: 'select', attrs: {display_name: 'Department', options: [{id: 'opt-1', name: 'Engineering'}], owners: [scimOwner]}})]);

                renderEdit();
                await waitForForm();

                expect(screen.getByTestId('admin.attribute.display_name--textbox')).toBeEnabled();
                expect(screen.getByTestId('admin.attribute.values.add--textbox')).toBeEnabled();

                await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), ' Renamed');
                expect(screen.getByTestId('admin.save--button')).toBeEnabled();
            });

            it('keeps the plugin-created reasons when the linked Users field also has owners', async () => {
                mockScimStatus(true);
                mockLoadedField(makePluginOwnedTemplate(), [makeLinked('user', 'user-field', {attrs: {display_name: 'Plugin field', owners: [scimOwner]}})]);

                renderEdit();
                await waitForForm();

                expect(screen.getByTestId('admin.attribute.type--button')).toHaveAccessibleName(/managed by a plugin/);
                expect(screen.getByTestId('admin.attribute.unique_name.edit--button')).toHaveAccessibleName(/managed by a plugin/);
            });

            it('keeps the applies-to reasons when the linked Users field has no owners', async () => {
                mockLoadedField(makeTemplate(), [makeLinked('user', 'user-field')]);

                renderEdit();
                await waitForForm();

                expect(screen.getByTestId('admin.attribute.type--button')).toHaveAccessibleName(/applies to a resource/);
                expect(screen.getByTestId('admin.attribute.unique_name.edit--button')).toHaveAccessibleName(/applies to a resource/);
            });

            it('shows the owners note beside the external-source editor on an owned template', async () => {
                mockScimStatus(true);
                mockLoadedField(makeTemplate(), [makeLinked('user', 'user-field', {attrs: {display_name: 'Department', owners: [scimOwner]}})]);

                renderEdit();
                await waitForForm();

                await waitFor(() => expect(screen.getByTestId('admin.attribute.owners_source.managed_by--text')).toHaveTextContent('Managed by SCIM'));
                expect(screen.getByTestId('admin.attribute.external_source')).toBeInTheDocument();
                expect(screen.queryByTestId('admin.attribute.plugin_source')).not.toBeInTheDocument();
            });

            it('locks Who can set the value and names the owners on Remove for an owned standalone user field', async () => {
                mockScimStatus(true);
                mockLoadedNonTemplateField(makeNonTemplate('user', {attrs: {display_name: 'Department', owners: [scimOwner], managed: 'admin'}}));

                renderEdit();
                await waitForForm();
                await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.toggle--button'));

                expect(screen.getByTestId('admin.attribute.applies_to.user.who_can_set.admin--radio')).toBeDisabled();
                expect(screen.getByTestId('admin.attribute.applies_to.user.who_can_set.member--radio')).toBeDisabled();
                expect(screen.getByTestId('admin.attribute.applies_to.user.who_can_set_locked')).toBeInTheDocument();
                expect(screen.getByTestId('admin.attribute.applies_to.user.remove--button')).toBeDisabled();

                await userEvent.hover(screen.getByTestId('admin.attribute.applies_to.user.remove_locked'));
                expect(await screen.findByText(/managed by SCIM/)).toBeInTheDocument();
            });

            it('shows the owners note beside the external-source editor on an owned standalone user field', async () => {
                mockScimStatus(true);
                mockLoadedNonTemplateField(makeNonTemplate('user', {attrs: {display_name: 'Department', owners: [scimOwner]}}));

                renderEdit();
                await waitForForm();

                expect(screen.getByTestId('admin.attribute.owners_source')).toBeInTheDocument();
                expect(screen.getByTestId('admin.attribute.external_source')).toBeInTheDocument();
            });

            it('shows no owners note when the linked Users field has no owners', async () => {
                mockLoadedField(makeTemplate(), [makeLinked('user', 'user-field')]);

                renderEdit();
                await waitForForm();

                expect(screen.queryByTestId('admin.attribute.owners_source')).not.toBeInTheDocument();
            });

            it('shows only the plugin note, without the external-source editor, for a plugin-created template', async () => {
                mockScimStatus(true);
                mockLoadedField(makePluginOwnedTemplate(), [makeLinked('user', 'user-field', {attrs: {display_name: 'Plugin field', owners: [scimOwner]}})]);

                renderEdit();
                await waitForForm();

                expect(screen.getByTestId('admin.attribute.plugin_source')).toBeInTheDocument();
                expect(screen.queryByTestId('admin.attribute.owners_source')).not.toBeInTheDocument();
                expect(screen.queryByTestId('admin.attribute.external_source')).not.toBeInTheDocument();
            });

            it('locks Who can set the value on an owned template while Profile display stays editable', async () => {
                mockScimStatus(true);
                mockLoadedField(makeTemplate(), [makeLinked('user', 'user-field', {attrs: {display_name: 'Department', visibility: 'always', managed: 'admin', owners: [scimOwner]}})]);

                renderEdit();
                await waitForForm();
                await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.toggle--button'));

                expect(screen.getByTestId('admin.attribute.applies_to.user.who_can_set.admin--radio')).toBeChecked();
                expect(screen.getByTestId('admin.attribute.applies_to.user.who_can_set.admin--radio')).toBeDisabled();
                expect(screen.getByTestId('admin.attribute.applies_to.user.who_can_set.member--radio')).toBeDisabled();
                expect(screen.getByTestId('admin.attribute.applies_to.user.who_can_set_locked')).toBeInTheDocument();

                const hidden = screen.getByTestId('admin.attribute.applies_to.user.profile_display:hidden--togglebutton');
                expect(hidden).toBeEnabled();
                expect(screen.getByTestId('admin.save--button')).toBeDisabled();
                await userEvent.click(hidden);
                expect(hidden).toHaveAttribute('aria-pressed', 'true');
                expect(screen.getByTestId('admin.save--button')).toBeEnabled();
            });

            it('leaves Who can set the value editable when the linked Users field has no owners', async () => {
                mockLoadedField(makeTemplate(), [makeLinked('user', 'user-field', {attrs: {display_name: 'Department', visibility: 'always', managed: 'admin'}})]);

                renderEdit();
                await waitForForm();
                await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.toggle--button'));

                expect(screen.getByTestId('admin.attribute.applies_to.user.who_can_set.admin--radio')).toBeEnabled();
                expect(screen.getByTestId('admin.attribute.applies_to.user.who_can_set.member--radio')).toBeEnabled();
                expect(screen.queryByTestId('admin.attribute.applies_to.user.who_can_set_locked')).not.toBeInTheDocument();
            });

            describe('Remove lock and save', () => {
                const ownedAttrs = {display_name: 'Department', owners: [scimOwner], managed: 'admin', visibility: 'always'};

                function mockPatch() {
                    return jest.spyOn(Client4, 'patchPropertyField').mockImplementation((_group, objectType) => (
                        Promise.resolve(objectType === 'user' ? makeLinked('user', 'user-field', {attrs: ownedAttrs}) : makeTemplate())
                    ));
                }

                it('locks Remove on the Users row only, keeping Remove on other rows', async () => {
                    mockScimStatus(true);
                    mockLoadedField(makeTemplate(), [
                        makeLinked('user', 'user-field', {attrs: ownedAttrs}),
                        makeLinked('channel', 'channel-field'),
                    ]);

                    renderEdit();
                    await waitForForm();

                    await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.toggle--button'));
                    expect(screen.getByTestId('admin.attribute.applies_to.user.remove--button')).toBeDisabled();
                    expect(screen.getByTestId('admin.attribute.applies_to.user.remove_locked')).toBeInTheDocument();

                    await userEvent.click(screen.getByTestId('admin.attribute.applies_to.channel.toggle--button'));
                    expect(screen.getByTestId('admin.attribute.applies_to.channel.remove--button')).toBeEnabled();
                });

                it('unlocks Remove and deletes the Users field on save once the owner plugin is uninstalled', async () => {
                    mockScimStatus(false);
                    mockLoadedField(makeTemplate(), [makeLinked('user', 'user-field', {attrs: ownedAttrs})]);
                    jest.spyOn(Client4, 'patchPropertyField').mockResolvedValue(makeTemplate());
                    const deletePropertyField = jest.spyOn(Client4, 'deletePropertyField').mockResolvedValue({status: 'OK'});

                    renderEdit();
                    await waitForForm();

                    await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.toggle--button'));
                    await waitFor(() => expect(screen.getByTestId('admin.attribute.applies_to.user.remove--button')).toBeEnabled());
                    await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.remove--button'));
                    await userEvent.click(screen.getByTestId('admin.save--button'));
                    await userEvent.click(await screen.findByRole('button', {name: /remove and save/i}));

                    await waitFor(() => expect(mockHistoryPush).toHaveBeenCalled());
                    expect(deletePropertyField).toHaveBeenCalledWith('access_control', 'user', 'user-field');
                });

                it('leaves Remove enabled on an unowned Users row', async () => {
                    mockLoadedField(makeTemplate(), [makeLinked('user', 'user-field')]);

                    renderEdit();
                    await waitForForm();

                    await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.toggle--button'));
                    expect(screen.getByTestId('admin.attribute.applies_to.user.remove--button')).toBeEnabled();
                    expect(screen.queryByTestId('admin.attribute.applies_to.user.remove_locked')).not.toBeInTheDocument();
                });

                it('saves a Profile display change without sending owners or deleting the Users field', async () => {
                    mockScimStatus(true);
                    mockLoadedField(makeTemplate(), [makeLinked('user', 'user-field', {attrs: ownedAttrs})]);
                    const patchPropertyField = mockPatch();
                    const deletePropertyField = jest.spyOn(Client4, 'deletePropertyField');

                    renderEdit();
                    await waitForForm();

                    await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.toggle--button'));
                    await userEvent.click(screen.getByTestId('admin.attribute.applies_to.user.profile_display:hidden--togglebutton'));
                    await userEvent.click(screen.getByTestId('admin.save--button'));

                    await waitFor(() => expect(mockHistoryPush).toHaveBeenCalledWith('/admin_console/system_attributes/manage_attributes'));
                    expect(patchPropertyField).toHaveBeenCalledWith('access_control', 'user', 'user-field', {
                        attrs: {visibility: 'hidden', managed: 'admin'},
                        permission_values: 'sysadmin',
                    });
                    expect(deletePropertyField).not.toHaveBeenCalled();
                });

                it('saves a display name change without sending owners or managed', async () => {
                    mockScimStatus(true);
                    mockLoadedField(makeTemplate(), [makeLinked('user', 'user-field', {attrs: ownedAttrs})]);
                    const patchPropertyField = mockPatch();
                    const deletePropertyField = jest.spyOn(Client4, 'deletePropertyField');

                    renderEdit();
                    await waitForForm();

                    await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), ' 2');
                    await userEvent.click(screen.getByTestId('admin.save--button'));

                    await waitFor(() => expect(mockHistoryPush).toHaveBeenCalled());
                    expect(patchPropertyField).toHaveBeenCalledWith('access_control', 'user', 'user-field', {
                        attrs: {display_name: 'Department 2'},
                    });
                    expect(deletePropertyField).not.toHaveBeenCalled();
                });
            });
        });

        it('warns once an existing template is renamed onto a user field another attribute owns', async () => {
            // The collision is reachable by renaming, not only by creating: an
            // attribute that has always been `department` can be pointed at the
            // name Classification Markings gave its own linked user field.
            const owner = makeTemplate({
                id: 'markingstemplateid0123456789ab',
                name: 'markings',
                type: 'rank',
                attrs: {display_name: 'Security Markings'},
            });
            const foreignUserField = makeLinked('user', 'foreignuserfieldid0123456789', {
                name: 'clearance',
                linked_field_id: owner.id,
                attrs: {display_name: 'Clearance'},
            });
            jest.spyOn(Client4, 'getPropertyFields').mockImplementation((_group, objectType) => {
                if (objectType === 'template') {
                    return Promise.resolve([makeTemplate(), owner]);
                }
                if (objectType === 'user') {
                    return Promise.resolve([foreignUserField]);
                }
                return Promise.resolve([]);
            });

            renderEdit();
            await waitForForm();
            await runPostRenderAct(3);

            expect(screen.getByTestId('admin.attribute.unique_name.value--text')).toHaveTextContent('department');
            expect(screen.queryByTestId('admin.attribute.unique_name.conflict--status')).not.toBeInTheDocument();

            await userEvent.click(screen.getByTestId('admin.attribute.unique_name.edit--button'));
            const nameInput = screen.getByTestId('admin.attribute.unique_name.input--textbox');
            await userEvent.clear(nameInput);
            await userEvent.type(nameInput, 'clearance');
            await userEvent.click(screen.getByTestId('admin.attribute.unique_name.edit--button'));

            expect(screen.getByTestId('admin.attribute.unique_name.value--text')).toHaveTextContent('clearance');

            const warning = await screen.findByTestId('admin.attribute.unique_name.conflict--status');
            expect(warning).toHaveTextContent('Another attribute already uses this name.');
            expect(warning.querySelector('[class*="section-notice--type-danger"]')).toBeInTheDocument();

            // Still saveable: this template applies to nothing, so the rename
            // creates no second user field for the server to reject.
            expect(screen.getByTestId('admin.save--button')).toBeEnabled();
        });

        it('does not warn about the template\'s own linked user field, which shares its name by design', async () => {
            mockLoadedField(makeTemplate(), [makeLinked('user', 'user-field')]);

            renderEdit();
            await waitForForm();

            // The conflict lookup is a mount effect of its own, separate from the
            // field load -- let it settle before concluding nothing was flagged.
            await runPostRenderAct(3);

            expect(screen.getByTestId('admin.attribute.unique_name.value--text')).toHaveTextContent('department');
            expect(screen.getByTestId('admin.attribute.applies_to.user')).toBeInTheDocument();
            expect(screen.queryByTestId('admin.attribute.unique_name.conflict--status')).not.toBeInTheDocument();
        });

        it('redirects to the listing when the field is Classification Markings', async () => {
            mockLoadedField(makeTemplate({name: 'classification', type: 'rank'}));
            renderEdit();
            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalledWith('/admin_console/system_attributes/manage_attributes'));
            expect(screen.queryByTestId('admin.attribute')).not.toBeInTheDocument();
        });

        it('opens a wrong-typed template named classification here, since it is an ordinary attribute', async () => {
            // * This editor is the repair path the Classification Markings conflict error
            // points at: the name is only reserved for the rank-typed definition.
            mockLoadedField(makeTemplate({name: 'classification', type: 'text'}));
            renderEdit();
            expect(await screen.findByTestId('admin.attribute')).toBeInTheDocument();
            expect(mockHistoryPush).not.toHaveBeenCalled();

            // Reachable is not enough: the collision is on the unique name, so the
            // repair is renaming that, not the display name.
            expect(screen.getByTestId('admin.attribute.display_name--textbox')).toBeEnabled();
            expect(screen.getByTestId('admin.attribute.unique_name.edit--button')).toBeEnabled();
        });

        it('redirects to the listing when the field is missing', async () => {
            jest.spyOn(Client4, 'getPropertyFields').mockResolvedValue([]);
            renderEdit();
            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalledWith('/admin_console/system_attributes/manage_attributes'));
            expect(screen.queryByTestId('admin.attribute')).not.toBeInTheDocument();
        });

        it('loads a graph field for edit when PropertyFieldGraph is off', async () => {
            mockLoadedField(makeTemplate({
                type: 'graph',
                attrs: {
                    display_name: 'Org chart',
                    options: [{id: 'opt-1', name: 'Air'}, {id: 'opt-2', name: 'Fighter'}],
                },
            }));
            jest.spyOn(Client4, 'getPropertyFieldOptions').mockResolvedValue({
                options: [
                    {id: 'opt-1', name: 'Air', parents: []},
                    {id: 'opt-2', name: 'Fighter', parents: ['Air']},
                ],
                has_more: false,
            });

            renderEdit();
            await waitForForm();

            expect(screen.getByRole('heading', {name: 'Edit Org chart Attribute'})).toBeInTheDocument();
            expect(screen.getByTestId('admin.attribute.type--button')).toHaveTextContent('Hierarchical');

            // The lock comes from the server constraint, not the flag, so
            // turning PropertyFieldGraph off must not hand back a Type menu
            // whose every entry the server would reject.
            expect(screen.getByTestId('admin.attribute.type--button')).toBeDisabled();
            expect(mockHistoryPush).not.toHaveBeenCalled();
        });

        it('loads a graph field from the options route so parents survive field GET sanitization', async () => {
            mockLoadedField(makeTemplate({
                type: 'graph',
                attrs: {
                    display_name: 'Org chart',
                    options: [{id: 'opt-1', name: 'Air'}, {id: 'opt-2', name: 'Fighter'}],
                },
            }));
            const getPropertyFieldOptions = jest.spyOn(Client4, 'getPropertyFieldOptions').mockResolvedValue({
                options: [
                    {id: 'opt-1', name: 'Air', parents: []},
                    {id: 'opt-2', name: 'Fighter', parents: ['Air']},
                ],
                has_more: false,
            });

            renderEdit({}, true);
            await waitForForm();

            expect(getPropertyFieldOptions).toHaveBeenCalled();
            expect(screen.getByRole('heading', {name: 'Edit Org chart Attribute'})).toBeInTheDocument();
            expect(screen.getByTestId('admin.attribute.type--button')).toHaveTextContent('Hierarchical');
            expect(screen.getByTestId('admin.attribute.graph')).toBeInTheDocument();
            expect(screen.getAllByTestId(/^admin\.attribute\.graph\.row\.(?:name|rename)--/).map((el) => el.textContent)).toEqual(['Air', 'Fighter']);
            expect(screen.queryByTestId('admin.attribute.external_source.link--button')).not.toBeInTheDocument();
            expect(mockHistoryPush).not.toHaveBeenCalled();
        });

        // The server rejects a PATCH that converts a field to or from the graph
        // type outright (app.property_field.update.graph_type_change.app_error),
        // so neither direction may be reachable from this page.
        it('drops Hierarchical from the type menu of an existing non-graph field, even with PropertyFieldGraph on', async () => {
            mockLoadedField(makeTemplate({
                type: 'rank',
                attrs: {
                    display_name: 'Clearance Level',
                    options: [{id: 'opt-1', name: 'Low', rank: 1}],
                },
            }));

            renderEdit({}, true);
            await waitForForm();

            expect(screen.getByTestId('admin.attribute.type--button')).not.toBeDisabled();
            await userEvent.click(screen.getByTestId('admin.attribute.type--button'));

            expect(screen.queryByRole('menuitemradio', {name: 'Hierarchical'})).not.toBeInTheDocument();
            expect(screen.getAllByRole('menuitemradio').map((item) => item.textContent)).toEqual(['Text', 'Phone', 'URL', 'Select', 'Multiselect', 'Ranked']);
        });

        it('leaves a non-graph field free to change to another non-graph type, PATCHing that type', async () => {
            mockLoadedField(makeTemplate({
                type: 'rank',
                attrs: {
                    display_name: 'Clearance Level',
                    options: [{id: 'opt-1', name: 'Low', rank: 1}],
                },
            }));
            const patchPropertyField = jest.spyOn(Client4, 'patchPropertyField').mockResolvedValue(makeTemplate());

            renderEdit({}, true);
            await waitForForm();

            await userEvent.click(screen.getByTestId('admin.attribute.type--button'));
            await userEvent.click(screen.getByRole('menuitemradio', {name: 'Select'}));
            await userEvent.click(screen.getByTestId('admin.save--button'));

            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalled());
            expect(patchPropertyField).toHaveBeenCalledWith('access_control', 'template', FIELD_ID, expect.objectContaining({
                type: 'select',
                attrs: expect.objectContaining({
                    options: [expect.objectContaining({id: 'opt-1', name: 'Low'})],
                }),
            }));
        });

        it('locks the Type control of an existing graph field, offering no type to convert to', async () => {
            mockLoadedField(makeTemplate({
                type: 'graph',
                attrs: {
                    display_name: 'Org chart',
                    options: [{id: 'opt-1', name: 'Air'}],
                },
            }));
            jest.spyOn(Client4, 'getPropertyFieldOptions').mockResolvedValue({
                options: [{id: 'opt-1', name: 'Air', parents: []}],
                has_more: false,
            });

            renderEdit({}, true);
            await waitForForm();

            const typeButton = screen.getByTestId('admin.attribute.type--button');
            expect(typeButton).toHaveTextContent('Hierarchical');
            expect(typeButton).toBeDisabled();
            expect(typeButton).toHaveAccessibleName('Type: Hierarchical. Locked because a hierarchical attribute cannot be converted to another type.');

            await userEvent.hover(screen.getByTestId('admin.attribute.type_locked'));
            const tooltip = await screen.findByRole('tooltip', {}, {timeout: 1000});
            expect(tooltip).toHaveTextContent('Type cannot be changed — a hierarchical attribute cannot be converted to another type. Create a new attribute of the type you need instead.');
        });

        // The applies-to lock would otherwise win the reason chain here and tell
        // the admin to remove the resource first -- an unlock that never arrives.
        it('prefers the hierarchical Type lock reason over the applies-to one', async () => {
            mockLoadedField(makeTemplate({
                type: 'graph',
                attrs: {
                    display_name: 'Org chart',
                    options: [{id: 'opt-1', name: 'Air'}],
                },
            }), [makeLinked('user', 'user-field', {type: 'graph'})]);
            jest.spyOn(Client4, 'getPropertyFieldOptions').mockResolvedValue({
                options: [{id: 'opt-1', name: 'Air', parents: []}],
                has_more: false,
            });

            renderEdit({}, true);
            await waitForForm();
            await waitFor(() => expect(screen.getByTestId('admin.attribute.applies_to.user')).toBeInTheDocument());

            expect(screen.getByTestId('admin.attribute.type--button')).toHaveAccessibleName(/hierarchical attribute cannot be converted/);
            expect(screen.getByTestId('admin.attribute.type--button')).not.toHaveAccessibleName(/applies to a resource/);
        });

        it('keeps a graph field otherwise editable, PATCHing a renamed display name back as a graph field', async () => {
            mockLoadedField(makeTemplate({
                type: 'graph',
                attrs: {
                    display_name: 'Org chart',
                    options: [{id: 'opt-1', name: 'Air'}],
                },
            }));
            jest.spyOn(Client4, 'getPropertyFieldOptions').mockResolvedValue({
                options: [{id: 'opt-1', name: 'Air', parents: []}],
                has_more: false,
            });
            const patchPropertyField = jest.spyOn(Client4, 'patchPropertyField').mockResolvedValue(makeTemplate({type: 'graph'}));

            renderEdit({}, true);
            await waitForForm();

            await userEvent.clear(screen.getByTestId('admin.attribute.display_name--textbox'));
            await userEvent.type(screen.getByTestId('admin.attribute.display_name--textbox'), 'Reporting chart');
            await userEvent.click(screen.getByTestId('admin.save--button'));

            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalled());
            expect(patchPropertyField).toHaveBeenCalledWith('access_control', 'template', FIELD_ID, expect.objectContaining({
                type: 'graph',
                attrs: expect.objectContaining({display_name: 'Reporting chart'}),
            }));
        });
    });
});
