// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentType} from 'react';
import type {MessageDescriptor} from 'react-intl';
import {defineMessage} from 'react-intl';

import {ChevronDownCircleOutlineIcon, EmailOutlineIcon, FormatListBulletedIcon, LinkVariantIcon, MenuVariantIcon, PoundIcon, SitemapIcon, SortAscendingIcon} from '@mattermost/compass-icons/components';
import type IconProps from '@mattermost/compass-icons/components/props';
import type {FieldValueType} from '@mattermost/types/properties';
import type {IDMappedObjects} from '@mattermost/types/utilities';

// Server-persisted field.type values Global Attributes can create or edit.
export type AttributeFieldType = 'text' | 'select' | 'multiselect' | 'rank' | 'graph';

// Menu/type-selector ids. Phone/URL/email are text-field subtypes that write
// attrs.value_type while keeping field.type as 'text' — same model as CPA's
// TYPE_DESCRIPTOR in user_properties_type_menu.tsx.
export type AttributeTypeId = AttributeFieldType | 'phone' | 'url' | 'email';

export type AttributeTypeDescriptor = {
    id: AttributeTypeId;
    fieldType: AttributeFieldType;
    valueType: FieldValueType;
    icon: ComponentType<IconProps>;
    label: MessageDescriptor;
    hidden?: boolean;
};

export const ATTRIBUTE_TYPE_DESCRIPTOR: IDMappedObjects<AttributeTypeDescriptor> = {
    text: {
        id: 'text',
        fieldType: 'text',
        valueType: '',
        icon: MenuVariantIcon,
        label: defineMessage({id: 'admin.global_attributes.table.type.text', defaultMessage: 'Text'}),
    },
    email: {
        id: 'email',
        hidden: true,
        fieldType: 'text',
        valueType: 'email',
        icon: EmailOutlineIcon,
        label: defineMessage({id: 'admin.global_attributes.table.type.email', defaultMessage: 'Email'}),
    },
    phone: {
        id: 'phone',
        fieldType: 'text',
        valueType: 'phone',
        icon: PoundIcon,
        label: defineMessage({id: 'admin.global_attributes.table.type.phone', defaultMessage: 'Phone'}),
    },
    url: {
        id: 'url',
        fieldType: 'text',
        valueType: 'url',
        icon: LinkVariantIcon,
        label: defineMessage({id: 'admin.global_attributes.table.type.url', defaultMessage: 'URL'}),
    },
    select: {
        id: 'select',
        fieldType: 'select',
        valueType: '',
        icon: ChevronDownCircleOutlineIcon,
        label: defineMessage({id: 'admin.global_attributes.table.type.select', defaultMessage: 'Select'}),
    },
    multiselect: {
        id: 'multiselect',
        fieldType: 'multiselect',
        valueType: '',
        icon: FormatListBulletedIcon,
        label: defineMessage({id: 'admin.global_attributes.table.type.multiselect', defaultMessage: 'Multiselect'}),
    },
    rank: {
        id: 'rank',
        fieldType: 'rank',
        valueType: '',
        icon: SortAscendingIcon,
        label: defineMessage({id: 'admin.global_attributes.table.type.rank', defaultMessage: 'Ranked'}),
    },
    graph: {
        id: 'graph',
        fieldType: 'graph',
        valueType: '',
        icon: SitemapIcon,
        label: defineMessage({id: 'admin.global_attributes.table.type.graph', defaultMessage: 'Hierarchical'}),
    },
} as const;

export const ATTRIBUTE_TYPE_FALLBACK_LABEL: MessageDescriptor = defineMessage({
    id: 'admin.global_attributes.table.type.fallback',
    defaultMessage: 'Other',
});

export function getAttributeTypeDescriptor(field: {type: string; attrs?: {value_type?: unknown}}): AttributeTypeDescriptor {
    const valueType = typeof field.attrs?.value_type === 'string' ? field.attrs.value_type : '';
    const descriptors = Object.values(ATTRIBUTE_TYPE_DESCRIPTOR);

    for (const descriptor of descriptors) {
        if (descriptor.fieldType === field.type && descriptor.valueType === valueType) {
            return descriptor;
        }
    }

    // Unknown or leftover value_type: use the plain descriptor for this
    // field.type (Text, Select, …) rather than falling all the way through
    // to Text. A date/user FieldType has no descriptor and still lands on Text,
    // which getTypeLabelForField maps to "Other".
    for (const descriptor of descriptors) {
        if (descriptor.fieldType === field.type && descriptor.valueType === '') {
            return descriptor;
        }
    }

    return ATTRIBUTE_TYPE_DESCRIPTOR.text;
}

export function getTypeLabelForField(field: {type: string; attrs?: {value_type?: unknown}}): MessageDescriptor {
    const descriptor = getAttributeTypeDescriptor(field);
    if (descriptor.fieldType === field.type) {
        return descriptor.label;
    }
    return ATTRIBUTE_TYPE_FALLBACK_LABEL;
}

export function toServerFieldType(typeId: AttributeTypeId): AttributeFieldType {
    return ATTRIBUTE_TYPE_DESCRIPTOR[typeId].fieldType;
}

export function toValueType(typeId: AttributeTypeId): FieldValueType {
    return ATTRIBUTE_TYPE_DESCRIPTOR[typeId].valueType;
}
