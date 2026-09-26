// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentType} from 'react';
import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {
    AccountMultipleOutlineIcon,
    AccountOutlineIcon,
    FormatListBulletedIcon,
    FormatListNumberedIcon,
    MenuDownIcon,
    MenuVariantIcon,
    PlusIcon,
} from '@mattermost/compass-icons/components';
import type IconProps from '@mattermost/compass-icons/components/props';
import type {FieldType, PropertyField} from '@mattermost/types/properties';

import {getPropertyFieldLabel} from 'mattermost-redux/utils/property_utils';

import * as Menu from 'components/menu';

type Props = {
    fields: PropertyField[];
    onSelect: (fieldId: string) => void;
};

/**
 * The `+ Add attribute` control and the menu behind it: the fields the channel
 * declares that this modal is not already showing.
 *
 * The candidate list arrives already filtered and already ordered — nothing is
 * decided here. In particular this does not re-sort: the rows and the menu read
 * in the same order, which is the channel's field order, so a field found in one
 * is where the other left it.
 */
export default function PostAttributesFieldPicker({fields, onSelect}: Props) {
    const {formatMessage} = useIntl();

    return (
        <Menu.Container
            menuButton={{
                id: 'postAttributesAdd',
                dataTestId: 'post-attributes-add',
                class: 'PostAttributesModal__add',
                children: (
                    <>
                        <PlusIcon size={16}/>
                        <FormattedMessage
                            id='post_attributes.modal.add'
                            defaultMessage='Add attribute'
                        />
                    </>
                ),
            }}
            menu={{
                id: 'postAttributesAddMenu',
                'aria-label': formatMessage({
                    id: 'post_attributes.modal.picker.label',
                    defaultMessage: 'Add an attribute',
                }),
            }}
        >
            {fields.map((field) => (
                <Menu.Item
                    key={field.id}
                    id={`postAttributeAdd-${field.id}`}
                    data-testid={`post-attribute-add-${field.name}`}
                    leadingElement={<FieldTypeIcon type={field.type}/>}
                    labels={<span>{getPropertyFieldLabel(field)}</span>}
                    onClick={() => onSelect(field.id)}
                />
            ))}
        </Menu.Container>
    );
}

/*
 * One icon per field type, so the menu says what shape of control the row will
 * arrive with.
 */
const TYPE_ICONS: Partial<Record<FieldType, ComponentType<IconProps>>> = {
    select: MenuDownIcon,
    multiselect: FormatListBulletedIcon,
    rank: FormatListNumberedIcon,
    text: MenuVariantIcon,
    user: AccountOutlineIcon,
    multiuser: AccountMultipleOutlineIcon,
};

function FieldTypeIcon({type}: {type: FieldType}) {
    const Icon = TYPE_ICONS[type];

    /*
     * A type with no icon draws nothing rather than a stand-in: the entry is
     * already labelled, and a generic glyph on one of six reads as a type of
     * its own.
     */
    return Icon ? <Icon size={16}/> : null;
}
