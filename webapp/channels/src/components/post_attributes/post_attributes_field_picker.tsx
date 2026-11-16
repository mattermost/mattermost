// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentType, ReactNode} from 'react';
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

    // The trigger's DOM id and test id. The defaults are the modal's, which
    // only ever has one picker on screen; every other caller can have several
    // (the composer's two controls, and a composer per centre channel and
    // thread sidebar), so it passes its own.
    id?: string;
    dataTestId?: string;

    // Replaces the labelled `+ Add attribute` button with an icon button, such
    // as the composer's `+`. The label is the button's accessible name and its
    // tooltip, and the menu opens upward from it.
    trigger?: {
        icon: ReactNode;
        label: string;
    };
};

const IconTrigger = Menu.createMenuIconButtonTrigger({size: 'small'});

/**
 * The `+ Add attribute` control and the menu behind it: the fields the channel
 * declares that this modal is not already showing.
 *
 * The candidate list arrives already filtered and already ordered — nothing is
 * decided here. In particular this does not re-sort: the rows and the menu read
 * in the same order, which is the channel's field order, so a field found in one
 * is where the other left it.
 */
export default function PostAttributesFieldPicker({fields, onSelect, id = 'postAttributesAdd', dataTestId = 'post-attributes-add', trigger}: Props) {
    const {formatMessage} = useIntl();

    const menuButton = trigger ? {
        id,
        dataTestId,
        as: IconTrigger,
        class: 'control',
        'aria-label': trigger.label,
        children: trigger.icon,
    } : {
        id,
        dataTestId,
        class: 'PostAttributesModal__add',
        children: (
            <>
                <PlusIcon size={16}/>
                <FormattedMessage
                    id='post_attributes.modal.add'
                    defaultMessage='Add attribute'
                    description='Button text (after a + icon) at the bottom of the post attributes modal. It opens a menu listing the attributes that can be added to the post. Verb.'
                />
            </>
        ),
    };

    return (
        <Menu.Container
            menuButton={menuButton}
            menuButtonTooltip={trigger ? {text: trigger.label} : undefined}

            // An icon trigger sits in the composer's bottom action row,
            // so the menu opens upward, as the other menus in that row do.
            anchorOrigin={trigger ? {vertical: 'top', horizontal: 'left'} : undefined}
            transformOrigin={trigger ? {vertical: 'bottom', horizontal: 'left'} : undefined}
            menu={{
                id: `${id}Menu`,
                'aria-label': formatMessage({
                    id: 'post_attributes.modal.picker.label',
                    defaultMessage: 'Add an attribute',
                    description: 'Accessible label (screen readers only) of the menu, opened by the add attribute button in the post attributes modal, that lists attributes which can be added to the post.',
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
