// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {ContentCopyIcon, DotsHorizontalIcon, TrashCanOutlineIcon} from '@mattermost/compass-icons/components';
import type {BoardsPropertyField} from '@mattermost/types/properties_board';

import * as Menu from 'components/menu';

import {useBoardAttributeFieldDelete} from './board_attributes_delete_modal';
import {isCreatePending} from './board_attributes_utils';

import '../system_properties/user_properties_dot_menu.scss';

type Props = {
    field: BoardsPropertyField;
    canCreate: boolean;
    createField: (field: BoardsPropertyField) => void;
    deleteField: (id: string) => void;
};

const menuId = 'board-attribute-field_dotmenu';

const DotMenu = ({
    field,
    canCreate,
    createField,
    deleteField,
}: Props) => {
    const {formatMessage} = useIntl();
    const {promptDelete} = useBoardAttributeFieldDelete();

    const isProtected = Boolean(field.protected);

    const handleDuplicate = () => {
        if (isProtected) {
            return;
        }

        // The create flow rewrites the name with a `(N)` suffix if needed,
        // so we pass the bare field name here (any existing `(copy)` or
        // `(N)` suffix is stripped to find the base name).
        createField({...field, attrs: {...field.attrs}, name: field.name});
    };

    const handleDelete = () => {
        if (isProtected) {
            return;
        }
        if (isCreatePending(field)) {
            // skip prompt when field is pending creation
            deleteField(field.id);
        } else {
            promptDelete().then((confirmed) => {
                if (confirmed) {
                    deleteField(field.id);
                }
            });
        }
    };

    const menuButton = (
        <Menu.Container
            menuButton={{
                id: `${menuId}-${field.id}`,
                class: 'btn btn-transparent user-property-field-dotmenu-menu-button',
                children: <DotsHorizontalIcon size={18}/>,
                dataTestId: `${menuId}-${field.id}`,
                disabled: field.delete_at !== 0,
            }}
            menu={{
                id: `${menuId}-${field.id}-menu`,
                'aria-label': formatMessage({
                    id: 'admin.board_attributes.dot_menu.label',
                    defaultMessage: 'Select an action',
                }),
                className: 'user-property-field-dotmenu-menu',
            }}
        >
            {canCreate && (
                <Menu.Item
                    id={`${menuId}_duplicate`}
                    onClick={handleDuplicate}
                    disabled={isProtected}
                    leadingElement={<ContentCopyIcon size={18}/>}
                    labels={(
                        <FormattedMessage
                            id='admin.board_attributes.dot_menu.duplicate'
                            defaultMessage='Duplicate'
                        />
                    )}
                />
            )}
            <Menu.Item
                id={`${menuId}_delete`}
                onClick={handleDelete}
                isDestructive={!isProtected}
                disabled={isProtected}
                leadingElement={<TrashCanOutlineIcon size={18}/>}
                labels={(
                    <FormattedMessage
                        id='admin.board_attributes.dot_menu.delete'
                        defaultMessage='Delete attribute'
                    />
                )}
            />
        </Menu.Container>
    );

    return menuButton;
};

export default DotMenu;
