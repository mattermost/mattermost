// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {CheckIcon, ChevronRightIcon, DotsHorizontalIcon, EyeOutlineIcon, FormatListNumberedIcon, LockOutlineIcon, PencilOutlineIcon, SyncIcon, TrashCanOutlineIcon, ContentCopyIcon} from '@mattermost/compass-icons/components';
import type {FieldVisibility} from '@mattermost/types/properties';
import type {UserPropertyField} from '@mattermost/types/properties_user';

import {openModal} from 'actions/views/modals';

import * as Menu from 'components/menu';
import Toggle from 'components/toggle';

import {ModalIdentifiers} from 'utils/constants';
import {slugifyForCEL} from 'utils/properties';

import AttributeModal from './attribute_modal';
import RankedSchemaModal from './ranked_schema_modal';
import {useUserPropertyFieldDelete} from './user_properties_delete_modal';
import {isCreatePending} from './user_properties_utils';

import './user_properties_dot_menu.scss';

type Props = {
    field: UserPropertyField;
    canCreate: boolean;
    createField: (field: UserPropertyField) => void;
    updateField: (field: UserPropertyField) => void;
    deleteField: (id: string) => void;
};

export const useAttributeLinkModal = (field: UserPropertyField, updateField: Props['updateField']) => {
    const dispatch = useDispatch();

    const promptEditLdapLink = () => {
        dispatch(openModal({
            modalId: ModalIdentifiers.ATTRIBUTE_MODAL_LDAP,
            dialogType: AttributeModal,
            dialogProps: {
                initialValue: field.attrs.ldap || '',
                fieldType: field.type,
                onExited: () => {},
                onSave: async (newValue: string) => {
                    updateField({
                        ...field,
                        type: 'text',
                        attrs: {
                            ...field.attrs,
                            ldap: newValue,
                        },
                    });
                },
                error: null,
                helpText: (
                    <FormattedMessage
                        id='admin.system_properties.user_properties.dotmenu.ad_ldap.modal.helpText'
                        defaultMessage="The attribute in the AD/LDAP server used to sync as a custom attribute in user's profile in Mattermost."
                    />
                ),
                modalHeaderText: (
                    <FormattedMessage
                        id='admin.system_properties.user_properties.dotmenu.ad_ldap.link_property.label'
                        defaultMessage='Link attribute to AD/LDAP'
                    />
                ),
            },
        }));
    };

    const promptEditSamlLink = () => {
        dispatch(openModal({
            modalId: ModalIdentifiers.ATTRIBUTE_MODAL_SAML,
            dialogType: AttributeModal,
            dialogProps: {
                initialValue: field.attrs.saml || '',
                fieldType: field.type,
                onExited: () => {},
                onSave: async (newValue: string) => {
                    updateField({
                        ...field,
                        type: 'text',
                        attrs: {
                            ...field.attrs,
                            saml: newValue,
                        },
                    });
                },
                error: null,
                helpText: (
                    <FormattedMessage
                        id='admin.system_properties.user_properties.dotmenu.saml.modal.helpText'
                        defaultMessage="The attribute in the SAML server used to sync as a custom attribute in user's profile in Mattermost."
                    />
                ),
                modalHeaderText: (
                    <FormattedMessage
                        id='admin.system_properties.user_properties.dotmenu.saml.modal.title'
                        defaultMessage='Link attribute to SAML'
                    />
                ),
            },
        }));
    };

    return {promptEditLdapLink, promptEditSamlLink};
};

const menuId = 'user-property-field_dotmenu';

const DotMenu = ({
    field,
    canCreate,
    createField,
    updateField,
    deleteField,
}: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const {promptDelete} = useUserPropertyFieldDelete();
    const {promptEditLdapLink, promptEditSamlLink} = useAttributeLinkModal(field, updateField);

    const isProtected = Boolean(field.attrs?.protected);

    const promptEditRanking = () => {
        dispatch(openModal({
            modalId: ModalIdentifiers.RANKED_SCHEMA_MODAL,
            dialogType: RankedSchemaModal,
            dialogProps: {
                field,
                onSave: updateField,
                onExited: () => {},
            },
        }));
    };

    const isSynced = Boolean(field.attrs.ldap || field.attrs.saml);
    const isEditableByUsers = !isSynced && field.attrs.managed !== 'admin';

    const handleDuplicate = () => {
        const name = `${slugifyForCEL(field.name)}_copy`;
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

    const handleEditableByUsersToggle = () => {
        if (isSynced) {
            return;
        }

        const newAttrs = {...field.attrs};

        if (field.attrs.managed === 'admin') {
            // Server PATCH merges attrs and preserves keys absent from the body, so we
            // assign '' rather than deleting the key — otherwise managed='admin' would
            // silently persist on the server.
            newAttrs.managed = '';
        } else {
            newAttrs.managed = 'admin';
        }

        updateField({...field, attrs: newAttrs});
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
                        {isProtected ? <LockOutlineIcon size={18}/> : <DotsHorizontalIcon size={18}/>}
                    </>
                ),
                dataTestId: `${menuId}-${field.id}`,
                disabled: field.delete_at !== 0 || isProtected,
            }}
            menu={{
                id: `${menuId}-${field.id}-menu`,
                'aria-label': formatMessage({
                    id: 'admin.system_properties.user_properties.dotmenu.label',
                    defaultMessage: 'Select an action',
                }),
                className: 'user-property-field-dotmenu-menu',
            }}
        >
            {field.type === 'rank' && (
                <Menu.Item
                    id={`${menuId}_edit-ranking`}
                    onClick={promptEditRanking}
                    leadingElement={<FormatListNumberedIcon size={18}/>}
                    labels={(
                        <FormattedMessage
                            id='admin.system_properties.user_properties.dotmenu.edit_ranking.label'
                            defaultMessage='Edit ranking'
                        />
                    )}
                />
            )}
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
            <Menu.Item
                id={`${menuId}_editable-by-users`}
                role='menuitemcheckbox'
                disabled={isSynced}
                aria-checked={isEditableByUsers}
                onClick={handleEditableByUsersToggle}
                leadingElement={<PencilOutlineIcon size={18}/>}
                labels={isSynced ? (
                    <>
                        <span>
                            <FormattedMessage
                                id='admin.system_properties.user_properties.dotmenu.editable_by_users.label'
                                defaultMessage='Editable by users'
                            />
                        </span>
                        <span>
                            <FormattedMessage
                                id='admin.system_properties.user_properties.dotmenu.editable_by_users.synced_help'
                                defaultMessage='Synced attributes are managed by AD/LDAP or SAML'
                            />
                        </span>
                    </>
                ) : (
                    <FormattedMessage
                        id='admin.system_properties.user_properties.dotmenu.editable_by_users.label'
                        defaultMessage='Editable by users'
                    />
                )}
                trailingElements={(
                    <Toggle
                        size='btn-sm'
                        disabled={isSynced}
                        onToggle={handleEditableByUsersToggle}
                        toggled={isEditableByUsers}
                        toggleClassName='btn-toggle-primary'
                        tabIndex={-1}
                    />
                )}
            />
            {field.create_at !== 0 && ([
                <Menu.Item
                    key={`${menuId}_link_ad-ldap`}
                    id={`${menuId}_link_ad-ldap`}
                    leadingElement={<SyncIcon size={18}/>}
                    onClick={() => promptEditLdapLink()}
                    labels={field.attrs.ldap ? (
                        <FormattedMessage
                            id='admin.system_properties.user_properties.dotmenu.ad_ldap.edit_link.label'
                            defaultMessage='Edit LDAP link'
                        />
                    ) : (
                        <FormattedMessage
                            id='admin.system_properties.user_properties.dotmenu.ad_ldap.link_property.label'
                            defaultMessage='Link attribute to AD/LDAP'
                        />
                    )}
                />,
                <Menu.Item
                    key={`${menuId}_link_saml`}
                    id={`${menuId}_link_saml`}
                    leadingElement={<SyncIcon size={18}/>}
                    onClick={() => promptEditSamlLink()}
                    labels={field.attrs.saml ? (
                        <FormattedMessage
                            id='admin.system_properties.user_properties.dotmenu.saml.edit_link.label'
                            defaultMessage='Edit SAML link'
                        />
                    ) : (
                        <FormattedMessage
                            id='admin.system_properties.user_properties.dotmenu.saml.link_property.label'
                            defaultMessage='Link attribute to SAML'
                        />
                    )}
                />,
            ])}
            <Menu.Separator/>
            {canCreate && (
                <Menu.Item
                    id={`${menuId}_duplicate`}
                    onClick={handleDuplicate}
                    leadingElement={<ContentCopyIcon size={18}/>}
                    labels={(
                        <FormattedMessage
                            id='admin.system_properties.user_properties.dotmenu.duplicate.label'
                            defaultMessage={'Duplicate attribute'}
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
                        defaultMessage={'Delete attribute'}
                    />
                )}
            />
        </Menu.Container>
    );
};

export default DotMenu;
