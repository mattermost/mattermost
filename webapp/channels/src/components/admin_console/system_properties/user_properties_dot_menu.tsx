// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {CheckIcon, ChevronRightIcon, DotsHorizontalIcon, EyeOutlineIcon, SyncIcon, TrashCanOutlineIcon, ContentCopyIcon} from '@mattermost/compass-icons/components';
import type {FieldVisibility, UserPropertyField} from '@mattermost/types/properties';

import * as Menu from 'components/menu';

import './user_properties_dot_menu.scss';
import {useUserPropertyFieldDelete} from './user_properties_delete_modal';
import {isCreatePending} from './user_properties_utils';
type Props = {
    field: UserPropertyField;
    canCreate: boolean;
    createField: (field: UserPropertyField) => void;
    updateField: (field: UserPropertyField) => void;
    deleteField: (id: string) => void;
}

const menuId = 'user-property-field_dotmenu';

const DotMenu = ({
    field,
    canCreate,
    createField,
    updateField,
    deleteField,
}: Props) => {
    const {formatMessage} = useIntl();
    const {promptDelete} = useUserPropertyFieldDelete();

    const handleDuplicate = () => {
        const name = formatMessage({
            id: 'admin.system_properties.user_properties.dotmenu.duplicate.name_copy',
            defaultMessage: '{fieldName} (copy)',
        }, {fieldName: field.name});

        createField({...field, attrs: {...field.attrs}, name});
    };

    const handleDelete = () => {
        if (isCreatePending(field)) {
            // skip prompt when field is pending creation
            deleteField(field.id);
        } else {
            promptDelete(field).then(() => deleteField(field.id));
        }
    };

    const handleVisibilityChange = (visibility: FieldVisibility) => {
        updateField({...field, attrs: {...field.attrs, visibility}});
    };

    let selectedVisibilityLabel;

    if (field.attrs.visibility === 'always') {
        selectedVisibilityLabel = (
            <FormattedMessage
                id='admin.system_properties.user_properties.dotmenu.visibility.always.label'
                defaultMessage='Always show'
            />
        );
    } else if (field.attrs.visibility === 'when_set') {
        selectedVisibilityLabel = (
            <FormattedMessage
                id='admin.system_properties.user_properties.dotmenu.visibility.when_set.label'
                defaultMessage='Hide when empty'
            />
        );
    } else if (field.attrs.visibility === 'hidden') {
        selectedVisibilityLabel = (
            <FormattedMessage
                id='admin.system_properties.user_properties.dotmenu.visibility.hidden.label'
                defaultMessage='Always hide'
            />
        );
    }

    return (
        <Menu.Container
            menuButton={{
                id: `${menuId}-${field.id}`,
                class: 'btn btn-transparent user-property-field-dotmenu-menu-button',
                children: (
                    <>
                        <DotsHorizontalIcon size={18}/>
                    </>
                ),
                dataTestId: `${menuId}-${field.id}`,
                disabled: field.delete_at !== 0,
            }}
            menu={{
                id: `${menuId}-menu`,
                'aria-label': 'Select an action',
                className: 'user-property-field-dotmenu-menu',
            }}
        >
            <Menu.SubMenu
                id={`${menuId}-${field.id}-visibility`}
                menuId={`${menuId}-${field.id}-visibility-menu`}
                leadingElement={<EyeOutlineIcon size='18'/>}
                labels={(
                    <FormattedMessage
                        id='admin.system_properties.user_properties.dotmenu.visibility.label'
                        defaultMessage='Visibility'
                    />
                )}
                trailingElements={(
                    <>
                        {selectedVisibilityLabel}
                        <ChevronRightIcon size={16}/>
                    </>
                )}
                forceOpenOnLeft={false}
            >
                <Menu.Item
                    id={`${menuId}_visibility-always`}
                    role='menuitemradio'
                    forceCloseOnSelect={true}
                    aria-checked={field.attrs.visibility === 'always'}
                    onClick={() => handleVisibilityChange('always')}
                    labels={(
                        <FormattedMessage
                            id='admin.system_properties.user_properties.dotmenu.visibility.always.label'
                            defaultMessage='Always show'
                        />
                    )}
                    trailingElements={field.attrs.visibility === 'always' && (
                        <CheckIcon
                            size={16}
                            color='var(--button-bg, #1c58d9)'
                        />
                    )}
                />
                <Menu.Item
                    id={`${menuId}_visibility-when_set`}
                    role='menuitemradio'
                    forceCloseOnSelect={true}
                    aria-checked={field.attrs.visibility === 'when_set'}
                    onClick={() => handleVisibilityChange('when_set')}
                    labels={(
                        <FormattedMessage
                            id='admin.system_properties.user_properties.dotmenu.visibility.when_set.label'
                            defaultMessage='Hide when empty'
                        />
                    )}
                    trailingElements={field.attrs.visibility === 'when_set' && (
                        <CheckIcon
                            size={16}
                            color='var(--button-bg, #1c58d9)'
                        />
                    )}
                />
                <Menu.Item
                    id={`${menuId}_visibility-hidden`}
                    role='menuitemradio'
                    forceCloseOnSelect={true}
                    aria-checked={field.attrs.visibility === 'hidden'}
                    onClick={() => handleVisibilityChange('hidden')}
                    labels={(
                        <FormattedMessage
                            id='admin.system_properties.user_properties.dotmenu.visibility.hidden.label'
                            defaultMessage='Always hide'
                        />
                    )}
                    trailingElements={field.attrs.visibility === 'hidden' && (
                        <CheckIcon
                            size={16}
                            color='var(--button-bg, #1c58d9)'
                        />
                    )}
                />
            </Menu.SubMenu>
            <Menu.LinkItem
                id={`${menuId}_link_ad-ldap`}
                to={`/admin_console/authentication/ldap#custom_profile_attribute-${field.name}`}
                leadingElement={<SyncIcon size={18}/>}
                labels={(
                    <FormattedMessage
                        id='admin.system_properties.user_properties.dotmenu.ad_ldap.link_property.label'
                        defaultMessage={'Link property to AD/LDAP'}
                    />
                )}
            />
            <Menu.LinkItem
                id={`${menuId}_link_ad-ldap`}
                to={`/admin_console/authentication/saml#custom_profile_attribute-${field.name}`}
                leadingElement={<SyncIcon size={18}/>}
                labels={(
                    <FormattedMessage
                        id='admin.system_properties.user_properties.dotmenu.saml.link_property.label'
                        defaultMessage={'Link property to SAML'}
                    />
                )}
            />
            <Menu.Separator/>
            {canCreate && (
                <Menu.Item
                    id={`${menuId}_duplicate`}
                    onClick={handleDuplicate}
                    leadingElement={<ContentCopyIcon size={18}/>}
                    labels={(
                        <FormattedMessage
                            id='admin.system_properties.user_properties.dotmenu.duplicate.label'
                            defaultMessage={'Duplicate property'}
                        />
                    )}
                />
            )}
            <Menu.Item
                id={`${menuId}_delete`}
                onClick={handleDelete}
                isDestructive={true}
                leadingElement={<TrashCanOutlineIcon size={18}/>}
                labels={(
                    <FormattedMessage
                        id='admin.system_properties.user_properties.dotmenu.delete.label'
                        defaultMessage={'Delete property'}
                    />
                )}
            />
        </Menu.Container>
    );
};

export default DotMenu;
