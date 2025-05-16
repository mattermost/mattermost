// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import type {ComponentType} from 'react';
import React, {useMemo, useState} from 'react';
import type {MessageDescriptor} from 'react-intl';
import {defineMessage, FormattedMessage, useIntl} from 'react-intl';
import {css} from 'styled-components';

import {CheckIcon, ChevronDownCircleOutlineIcon, EmailOutlineIcon, FormatListBulletedIcon, LinkVariantIcon, MenuVariantIcon, PoundIcon} from '@mattermost/compass-icons/components';
import type IconProps from '@mattermost/compass-icons/components/props';
import type {FieldType, FieldValueType, UserPropertyField} from '@mattermost/types/properties';
import type {IDMappedObjects} from '@mattermost/types/utilities';

import * as Menu from 'components/menu';

import './user_properties_type_menu.scss';

interface Props {
    field: UserPropertyField;
    updateField: (field: UserPropertyField) => void;
}

const SelectType = (props: Props) => {
    const {formatMessage} = useIntl();
    const [filter, setFilter] = useState('');

    const onFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFilter(e.target.value);
    };

    const handleTypeChange = (descriptor: TypeDescriptor) => {
        props.updateField({...props.field, type: descriptor.fieldType, attrs: {...props.field.attrs, value_type: descriptor.valueType}});
        setFilter('');
    };

    const options = useMemo(() => {
        return Object.values(TYPE_DESCRIPTOR).filter((descriptor) => {
            return formatMessage(descriptor.label).toLowerCase().includes(filter.toLowerCase());
        });
    }, [TYPE_DESCRIPTOR, filter]);

    const currentTypeDescriptor = useMemo(() => {
        return getTypeDescriptor(props.field);
    }, [props.field]);
    const CurrentTypeIcon = currentTypeDescriptor.icon;

    return (
        <Menu.Container
            menuButton={{
                id: `type-button-${props.field.id}`,
                class: classNames('btn btn-transparent field-type-selector-menu-button'),
                children: (
                    <>
                        <CurrentTypeIcon
                            size={18}
                            color='rgba(var(--center-channel-color-rgb), 0.64)'
                        />
                        <FormattedMessage {...currentTypeDescriptor.label}/>
                    </>
                ),
                dataTestId: 'fieldTypeSelectorMenuButton',
                disabled: props.field.delete_at !== 0,
            }}
            menu={{
                id: 'type-selector-menu',
                'aria-label': 'Select type',
                className: 'select-type-mui-menu',
            }}
        >
            {[
                <Menu.InputItem
                    key='filter_types'
                    id='filter_types'
                    type='text'
                    placeholder={formatMessage({id: 'admin.system_properties.user_properties.table.filter_type', defaultMessage: 'Property type'})}
                    className='search-teams-selector-search'
                    value={filter}
                    onChange={onFilterChange}
                    customStyles={menuInputContainerStyles}
                />,
            ]}
            {options.map((descriptor) => {
                const {id, icon: Icon, label, hidden, canSync} = descriptor;

                if (hidden) {
                    return null;
                }

                const isSyncing = props.field.attrs.ldap || props.field.attrs.saml;
                const disabled = Boolean(isSyncing && !canSync);

                return (
                    <Menu.Item
                        id={id}
                        key={id}
                        role='menuitemradio'
                        forceCloseOnSelect={true}
                        disabled={disabled}
                        aria-checked={id === currentTypeDescriptor.id}
                        onClick={() => handleTypeChange(descriptor)}
                        labels={<FormattedMessage {...label}/>}
                        leadingElement={<Icon size={18}/>}
                        trailingElements={id === currentTypeDescriptor.id && (
                            <CheckIcon
                                size={16}
                                color='var(--button-bg, #1c58d9)'
                            />
                        )}
                    />
                );
            })}
        </Menu.Container>
    );
};

export default SelectType;

const getTypeDescriptor = (field: UserPropertyField): TypeDescriptor => {
    for (const descriptor of Object.values(TYPE_DESCRIPTOR)) {
        if (
            descriptor.fieldType === field.type &&
            descriptor.valueType === (field.attrs?.value_type ?? '')
        ) {
            return descriptor;
        }
    }

    return TYPE_DESCRIPTOR.text;
};

type TypeID = 'text' | 'email' | 'phone' | 'url' | 'select' | 'multiselect';

type TypeDescriptor = {
    id: TypeID;
    fieldType: FieldType;
    valueType: FieldValueType;
    icon: ComponentType<IconProps>;
    label: MessageDescriptor;

    hidden?: boolean;
    canSync?: boolean; // ldap/saml
};

const TYPE_DESCRIPTOR: IDMappedObjects<TypeDescriptor> = {
    text: {
        id: 'text',
        fieldType: 'text',
        valueType: '',
        icon: MenuVariantIcon,
        label: defineMessage({
            id: 'admin.system_properties.user_properties.table.select_type.text',
            defaultMessage: 'Text',
        }),
        canSync: true,
    },
    email: {
        id: 'email',
        hidden: true,
        fieldType: 'text',
        valueType: 'email',
        icon: EmailOutlineIcon,
        label: defineMessage({
            id: 'admin.system_properties.user_properties.table.select_type.email',
            defaultMessage: 'Email',
        }),
    },
    phone: {
        id: 'phone',
        fieldType: 'text',
        valueType: 'phone',
        icon: PoundIcon,
        label: defineMessage({id: 'admin.system_properties.user_properties.table.select_type.phone', defaultMessage: 'Phone'}),
    },
    url: {
        id: 'url',
        fieldType: 'text',
        valueType: 'url',
        icon: LinkVariantIcon,
        label: defineMessage({
            id: 'admin.system_properties.user_properties.table.select_type.url',
            defaultMessage: 'URL',
        }),
    },
    select: {
        id: 'select',
        fieldType: 'select',
        valueType: '',
        icon: ChevronDownCircleOutlineIcon,
        label: defineMessage({
            id: 'admin.system_properties.user_properties.table.select_type.select',
            defaultMessage: 'Select',
        }),
    },
    multiselect: {
        id: 'multiselect',
        fieldType: 'multiselect',
        valueType: '',
        icon: FormatListBulletedIcon,
        label: defineMessage({
            id: 'admin.system_properties.user_properties.table.select_type.multi_select',
            defaultMessage: 'Multi-select',
        }),
    },
} as const;

const menuInputContainerStyles = css`
    padding: 0 12px;
`;
