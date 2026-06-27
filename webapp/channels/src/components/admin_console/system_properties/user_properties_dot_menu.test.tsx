// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';

import type {UserPropertyField} from '@mattermost/types/properties_user';

import {Client4} from 'mattermost-redux/client';

import ModalController from 'components/modal_controller';

import {renderWithContext, screen, userEvent, waitFor, within} from 'tests/react_testing_utils';

import DotMenu from './user_properties_dot_menu';
import {useUserPropertyFields} from './user_properties_utils';

describe('UserPropertyDotMenu', () => {
    const baseField: UserPropertyField = {
        id: 'test-id',
        name: 'Test Field',
        type: 'text',
        group_id: 'custom_profile_attributes',
        create_at: 1736541716295,
        delete_at: 0,
        update_at: 0,
        created_by: '',
        updated_by: '',
        target_id: '',
        target_type: '',
        object_type: '',
        attrs: {
            sort_order: 0,
            visibility: 'when_set',
            value_type: '',
        },
    };

    const updateField = jest.fn();
    const deleteField = jest.fn();
    const createField = jest.fn();
    const getFields = jest.spyOn(Client4, 'getCustomProfileAttributeFields');

    const renderComponent = (field: UserPropertyField = baseField, dotMenuProps?: Partial<ComponentProps<typeof DotMenu>>) => {
        return renderWithContext(
            (
                <div>
                    <DotMenu
                        field={field}
                        canCreate={true}
                        {...dotMenuProps}
                        updateField={updateField}
                        deleteField={deleteField}
                        createField={createField}
                    />
                    <ModalController/>
                </div>
            ),
        );
    };

    beforeEach(() => {
        jest.clearAllMocks();
        getFields.mockReset();
    });

    it('renders dot menu button', () => {
        renderComponent();

        const menuButton = screen.getByTestId(`user-property-field_dotmenu-${baseField.id}`);
        expect(menuButton).toBeInTheDocument();
    });

    it('disables menu button when field is marked for deletion', () => {
        const deletedField = {
            ...baseField,
            delete_at: 123456789,
        };

        renderComponent(deletedField);

        const menuButton = screen.getByTestId(`user-property-field_dotmenu-${baseField.id}`);
        expect(menuButton).toBeDisabled();
    });

    it('shows correct visibility option based on field setting', async () => {
        renderComponent();

        // Open the menu
        const menuButton = screen.getByTestId(`user-property-field_dotmenu-${baseField.id}`);
        await userEvent.click(menuButton);

        // Verify the current visibility option is shown
        expect(screen.getByText('Hide when empty')).toBeInTheDocument();
    });

    it('updates visibility when selecting a different option', async () => {
        renderComponent();

        // Open the menu
        const menuButton = screen.getByTestId(`user-property-field_dotmenu-${baseField.id}`);
        await userEvent.click(menuButton);

        // Open the visibility submenu
        const visibilityMenuItem = screen.getByRole('menuitem', {name: /Visibility/});
        await userEvent.hover(visibilityMenuItem);

        // Click "Always show" option
        const alwaysShowOption = screen.getByRole('menuitemradio', {name: /Always show/});
        await userEvent.click(alwaysShowOption);

        // Verify the field was updated with the new visibility
        expect(updateField).toHaveBeenCalledWith({
            ...baseField,
            attrs: {
                ...baseField.attrs,
                visibility: 'always',
            },
        });
    });

    it('displays LDAP and SAML link menu options for existing fields', async () => {
        renderComponent();

        // Open the menu
        const menuButton = screen.getByTestId(`user-property-field_dotmenu-${baseField.id}`);
        await userEvent.click(menuButton);

        // Verify both link options are shown
        expect(screen.getByText('Link attribute to AD/LDAP')).toBeInTheDocument();
        expect(screen.getByText('Link attribute to SAML')).toBeInTheDocument();
    });

    it('hides LDAP and SAML link menu options for pending fields', async () => {
        const pendingField = {
            ...baseField,
            create_at: 0, // Mark as pending creation
        };

        renderComponent(pendingField);

        // Open the menu
        const menuButton = screen.getByTestId(`user-property-field_dotmenu-${pendingField.id}`);
        await userEvent.click(menuButton);

        // Verify both link options are not shown
        expect(screen.queryByText('Link attribute to AD/LDAP')).not.toBeInTheDocument();
        expect(screen.queryByText('Link attribute to SAML')).not.toBeInTheDocument();
    });

    it('shows "Edit LDAP link" text when LDAP attribute is linked', async () => {
        const linkedField = {
            ...baseField,
            attrs: {
                ...baseField.attrs,
                ldap: 'employeeID',
            },
        };

        renderComponent(linkedField);

        // Open the menu
        const menuButton = screen.getByTestId(`user-property-field_dotmenu-${linkedField.id}`);
        await userEvent.click(menuButton);

        // Verify the LDAP link text shows the edit option
        expect(screen.getByText('Edit LDAP link')).toBeInTheDocument();
    });

    it('shows "Edit SAML link" text when SAML attribute is linked', async () => {
        const linkedField = {
            ...baseField,
            attrs: {
                ...baseField.attrs,
                saml: 'position',
            },
        };

        renderComponent(linkedField);

        // Open the menu
        const menuButton = screen.getByTestId(`user-property-field_dotmenu-${linkedField.id}`);
        await userEvent.click(menuButton);

        // Verify the SAML link text shows the edit option
        expect(screen.getByText('Edit SAML link')).toBeInTheDocument();
    });

    it('sets ldap from the modal without adding managed to an unmanaged field', async () => {
        renderComponent();

        const menuButton = screen.getByTestId(`user-property-field_dotmenu-${baseField.id}`);
        await userEvent.click(menuButton);
        await userEvent.click(screen.getByText('Link attribute to AD/LDAP'));

        await userEvent.type(await screen.findByRole('textbox'), 'employeeID');
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        expect(updateField).toHaveBeenCalledWith({
            ...baseField,
            type: 'text',
            attrs: {
                ...baseField.attrs,
                ldap: 'employeeID',
            },
        });
    });

    it('sets ldap from the modal without changing managed on an admin-managed field', async () => {
        const adminManagedField: UserPropertyField = {
            ...baseField,
            id: 'admin-managed-ldap-modal',
            attrs: {
                ...baseField.attrs,
                managed: 'admin',
            },
        };

        renderComponent(adminManagedField);

        const menuButton = screen.getByTestId(`user-property-field_dotmenu-${adminManagedField.id}`);
        await userEvent.click(menuButton);
        await userEvent.click(screen.getByText('Link attribute to AD/LDAP'));

        await userEvent.type(await screen.findByRole('textbox'), 'employeeID');
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        expect(updateField).toHaveBeenCalledWith({
            ...adminManagedField,
            type: 'text',
            attrs: {
                ...adminManagedField.attrs,
                ldap: 'employeeID',
            },
        });
    });

    it('clears admin-managed by setting managed to empty string, not by removing the key', async () => {
        const adminManagedField: UserPropertyField = {
            ...baseField,
            id: 'admin-managed-field',
            attrs: {
                ...baseField.attrs,
                managed: 'admin',
            },
        };

        renderComponent(adminManagedField);

        const menuButton = screen.getByTestId(`user-property-field_dotmenu-${adminManagedField.id}`);
        await userEvent.click(menuButton);

        const editableToggle = screen.getByRole('menuitemcheckbox', {name: /Editable by users/});
        await userEvent.click(editableToggle);

        // The server PATCH uses merge semantics: omitted keys are preserved. Toggling off
        // admin-managed must send managed: '' explicitly; deleting the key would silently
        // leave the field admin-managed on the server.
        expect(updateField).toHaveBeenCalledWith({
            ...adminManagedField,
            attrs: {
                sort_order: 0,
                visibility: 'when_set',
                value_type: '',
                managed: '',
            },
        });
    });

    it('keeps the "Editable by users" toggle enabled for an admin-managed field that is not synced', async () => {
        const adminManagedField: UserPropertyField = {
            ...baseField,
            id: 'admin-managed-unsynced',
            attrs: {
                ...baseField.attrs,
                managed: 'admin',
            },
        };

        renderComponent(adminManagedField);

        const menuButton = screen.getByTestId(`user-property-field_dotmenu-${adminManagedField.id}`);
        await userEvent.click(menuButton);

        const editableItem = screen.getByRole('menuitemcheckbox', {name: /Editable by users/});
        expect(editableItem).toHaveAttribute('aria-checked', 'false');
        expect(within(editableItem).getByRole('button')).toBeEnabled();
        expect(screen.queryByText('Synced attributes are managed by AD/LDAP or SAML')).not.toBeInTheDocument();
    });

    it('disables the "Editable by users" toggle and reports it off when the field is synced via LDAP', async () => {
        const ldapSyncedField: UserPropertyField = {
            ...baseField,
            id: 'ldap-synced-field',
            attrs: {
                ...baseField.attrs,
                ldap: 'employeeID',
            },
        };

        renderComponent(ldapSyncedField);

        const menuButton = screen.getByTestId(`user-property-field_dotmenu-${ldapSyncedField.id}`);
        await userEvent.click(menuButton);

        const editableItem = screen.getByRole('menuitemcheckbox', {name: /Editable by users/});
        expect(editableItem).toHaveAttribute('aria-checked', 'false');
        expect(within(editableItem).getByRole('button')).toBeDisabled();
        expect(screen.getByText('Synced attributes are managed by AD/LDAP or SAML')).toBeInTheDocument();
    });

    it('does not update a synced field when clicking the "Editable by users" toggle', async () => {
        const ldapSyncedField: UserPropertyField = {
            ...baseField,
            id: 'ldap-synced-toggle-click',
            attrs: {
                ...baseField.attrs,
                ldap: 'employeeID',
            },
        };

        renderComponent(ldapSyncedField);

        const menuButton = screen.getByTestId(`user-property-field_dotmenu-${ldapSyncedField.id}`);
        await userEvent.click(menuButton);

        const editableItem = screen.getByRole('menuitemcheckbox', {name: /Editable by users/});
        editableItem.click();

        expect(updateField).not.toHaveBeenCalled();
    });

    it('disables the "Editable by users" toggle when the field is synced via SAML', async () => {
        const samlSyncedField: UserPropertyField = {
            ...baseField,
            id: 'saml-synced-field',
            attrs: {
                ...baseField.attrs,
                saml: 'position',
            },
        };

        renderComponent(samlSyncedField);

        const menuButton = screen.getByTestId(`user-property-field_dotmenu-${samlSyncedField.id}`);
        await userEvent.click(menuButton);

        const editableItem = screen.getByRole('menuitemcheckbox', {name: /Editable by users/});
        expect(editableItem).toHaveAttribute('aria-checked', 'false');
        expect(within(editableItem).getByRole('button')).toBeDisabled();
        expect(screen.getByText('Synced attributes are managed by AD/LDAP or SAML')).toBeInTheDocument();
    });

    it('disables the "Editable by users" toggle when the field is both admin-managed and synced', async () => {
        const adminManagedSyncedField: UserPropertyField = {
            ...baseField,
            id: 'admin-managed-synced-field',
            attrs: {
                ...baseField.attrs,
                managed: 'admin',
                ldap: 'employeeID',
            },
        };

        renderComponent(adminManagedSyncedField);

        const menuButton = screen.getByTestId(`user-property-field_dotmenu-${adminManagedSyncedField.id}`);
        await userEvent.click(menuButton);

        const editableItem = screen.getByRole('menuitemcheckbox', {name: /Editable by users/});
        expect(editableItem).toHaveAttribute('aria-checked', 'false');
        expect(within(editableItem).getByRole('button')).toBeDisabled();
        expect(screen.getByText('Synced attributes are managed by AD/LDAP or SAML')).toBeInTheDocument();
    });

    it('handles field duplication', async () => {
        renderComponent();

        // Open the menu
        const menuButton = screen.getByTestId(`user-property-field_dotmenu-${baseField.id}`);
        await userEvent.click(menuButton);

        // Click the duplicate option
        await userEvent.click(screen.getByText(/Duplicate attribute/));

        // Wait for createField to be called
        await waitFor(() => {
            // Verify createField was called with the slugified snake_case name
            // ('Test Field' -> 'test_field') plus the _copy suffix.
            expect(createField).toHaveBeenCalledWith(expect.objectContaining({
                id: baseField.id,
                name: 'test_field_copy',
            }));
        });
    });

    it('duplicate produces _2 suffix when base name is already taken', async () => {
        const existingCopy = {
            ...baseField,
            id: 'copy-id',
            name: 'test_field_copy',
            attrs: {
                ...baseField.attrs,
                sort_order: 1,
            },
        };
        getFields.mockResolvedValueOnce([baseField, existingCopy]);

        const Harness = () => {
            const [fields, readIO,, itemOps] = useUserPropertyFields();

            if (readIO.loading || !fields.data[baseField.id]) {
                return null;
            }

            return (
                <div>
                    <DotMenu
                        field={fields.data[baseField.id]}
                        canCreate={true}
                        createField={itemOps.create}
                        updateField={itemOps.update}
                        deleteField={itemOps.delete}
                    />
                    {fields.order.map((id) => (
                        <span
                            key={id}
                            data-testid={`field-name-${id}`}
                        >
                            {fields.data[id].name}
                        </span>
                    ))}
                </div>
            );
        };

        renderWithContext(<Harness/>);

        const menuButton = await screen.findByTestId(`user-property-field_dotmenu-${baseField.id}`);
        await userEvent.click(menuButton);
        await userEvent.click(screen.getByText(/Duplicate attribute/));

        await waitFor(() => {
            expect(screen.getByText('test_field_copy_2')).toBeInTheDocument();
        });
    });

    it('hides field duplication when at field limit', async () => {
        renderComponent(undefined, {canCreate: false});

        // Open the menu
        const menuButton = screen.getByTestId(`user-property-field_dotmenu-${baseField.id}`);
        await userEvent.click(menuButton);

        // Verify duplicate option is not shown
        expect(screen.queryByText(/Duplicate attribute/)).not.toBeInTheDocument();
    });

    it('handles field deletion with confirmation when field exists in DB', async () => {
        renderComponent();

        // Open the menu
        const menuButton = screen.getByTestId(`user-property-field_dotmenu-${baseField.id}`);
        await userEvent.click(menuButton);

        // Click delete option
        const deleteOption = screen.getByRole('menuitem', {name: /Delete attribute/});
        await userEvent.click(deleteOption);

        await waitFor(() => {
            // Verify the delete modal is shown
            expect(screen.getByText('Delete Test Field attribute')).toBeInTheDocument();
        });

        // click delete confirm button
        const deleteConfirmButton = screen.getByRole('button', {name: /Delete/});
        await userEvent.click(deleteConfirmButton);

        await waitFor(() => {
            // Verify deleteField was called
            // promptDelete from the mock will resolve to true, triggering deleteField
            expect(deleteField).toHaveBeenCalledWith(baseField.id);
        });
    });

    it('skips confirmation when deleting a newly created field', async () => {
        const pendingField = {
            ...baseField,
            create_at: 0, // Mark as pending creation
        };

        renderComponent(pendingField);

        // Open the menu
        const menuButton = screen.getByTestId(`user-property-field_dotmenu-${pendingField.id}`);
        await userEvent.click(menuButton);

        // Click delete option
        const deleteOption = screen.getByRole('menuitem', {name: /Delete attribute/});
        await userEvent.click(deleteOption);

        await waitFor(() => {
            // Verify deleteField was called
            expect(deleteField).toHaveBeenCalledWith(pendingField.id);
        });
    });
});
