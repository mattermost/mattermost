// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {ContentCopyIcon, DotsHorizontalIcon, TrashCanOutlineIcon} from '@mattermost/compass-icons/components';
import type {PropertyField} from '@mattermost/types/properties';

import * as Menu from 'components/menu';

type Props = {
    field: PropertyField;
    canCreate: boolean;
    createField: (field: PropertyField) => void;
    updateField: (field: PropertyField) => void;
    deleteField: (id: string) => void;
}

export default function BoardPropertiesDotMenu({
    field,
    canCreate,
    createField,
    deleteField,
}: Props) {
    const {formatMessage} = useIntl();
    const menuId = `board-property-field-dotmenu-${field.id}`;

    const handleDuplicate = () => {
        const name = formatMessage({
            id: 'admin.system_properties.board_properties.dotmenu.duplicate.name_copy',
            defaultMessage: '{fieldName} (copy)',
        }, {fieldName: field.name});

        // Clear option IDs when duplicating (server will assign new ones)
        const attrs = {...field.attrs};
        if (attrs.options && Array.isArray(attrs.options)) {
            attrs.options = attrs.options.map((option: {id?: string; name: string}) => ({
                ...option,
                id: '',
            }));
        }

        // Create a new field with a new ID and reset create_at/delete_at to mark it as pending
        createField({
            ...field,
            id: `temp_${Date.now()}`,
            name,
            attrs,
            create_at: 0,
            delete_at: 0,
            update_at: 0,
            created_by: '',
            updated_by: '',
        });
    };

    const handleDelete = () => {
        deleteField(field.id);
    };

    return (
        <Menu.Container
            menuButton={{
                id: menuId,
                class: 'btn btn-transparent board-property-field-dotmenu-menu-button',
                children: <DotsHorizontalIcon size={18}/>,
                dataTestId: menuId,
                disabled: field.delete_at !== 0,
            }}
            menu={{
                id: menuId,
                'aria-label': formatMessage({id: 'admin.system_properties.board_properties.table.actions', defaultMessage: 'Actions'}),
            }}
        >
            {canCreate && (
                <Menu.Item
                    id={`${menuId}_duplicate`}
                    onClick={handleDuplicate}
                    leadingElement={<ContentCopyIcon size={18}/>}
                    labels={(
                        <FormattedMessage
                            id='admin.system_properties.board_properties.dotmenu.duplicate.label'
                            defaultMessage='Duplicate attribute'
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
                        id='admin.system_properties.board_properties.dotmenu.delete.label'
                        defaultMessage='Delete'
                    />
                )}
            />
        </Menu.Container>
    );
}
