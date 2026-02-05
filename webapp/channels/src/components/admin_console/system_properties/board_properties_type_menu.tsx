// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import type {ComponentType} from 'react';
import React, {useMemo, useState} from 'react';
import type {MessageDescriptor} from 'react-intl';
import {defineMessage, FormattedMessage, useIntl} from 'react-intl';
import {css} from 'styled-components';

import {AccountMultipleOutlineIcon, AccountOutlineIcon, CalendarOutlineIcon, CheckIcon, ChevronDownCircleOutlineIcon, FormatListBulletedIcon, MenuVariantIcon} from '@mattermost/compass-icons/components';
import type IconProps from '@mattermost/compass-icons/components/props';
import type {PropertyField} from '@mattermost/types/properties';
import type {IDMappedObjects} from '@mattermost/types/utilities';

import * as Menu from 'components/menu';

import './user_properties_type_menu.scss';

interface Props {
    field: PropertyField;
    updateField: (field: PropertyField) => void;
}

const BoardPropertiesTypeMenu = (props: Props) => {
    const {formatMessage} = useIntl();
    const [filter, setFilter] = useState('');

    const onFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFilter(e.target.value);
    };

    const handleTypeChange = (descriptor: TypeDescriptor) => {
        const attrs = {...props.field.attrs};

        // Clear options if not select/multiselect
        if (descriptor.fieldType !== 'select' && descriptor.fieldType !== 'multiselect') {
            Reflect.deleteProperty(attrs, 'options');
        }

        props.updateField({
            ...props.field,
            type: descriptor.fieldType,
            attrs,
        });
        setFilter('');
    };

    const options = useMemo(() => {
        return Object.values(TYPE_DESCRIPTOR).filter((descriptor) => {
            return formatMessage(descriptor.label).toLowerCase().includes(filter.toLowerCase());
        });
    }, [filter]);

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
                    placeholder={formatMessage({id: 'admin.system_properties.board_properties.table.filter_type', defaultMessage: 'Attribute type'})}
                    className='search-teams-selector-search'
                    value={filter}
                    onChange={onFilterChange}
                    customStyles={menuInputContainerStyles}
                />,
            ]}
            {options.map((descriptor) => {
                const {id, icon: Icon, label} = descriptor;

                return (
                    <Menu.Item
                        id={id}
                        key={id}
                        role='menuitemradio'
                        forceCloseOnSelect={true}
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

export default BoardPropertiesTypeMenu;

const getTypeDescriptor = (field: PropertyField): TypeDescriptor => {
    for (const descriptor of Object.values(TYPE_DESCRIPTOR)) {
        if (descriptor.fieldType === field.type) {
            return descriptor;
        }
    }

    return TYPE_DESCRIPTOR.text;
};

type TypeID = 'text' | 'select' | 'multiselect' | 'date' | 'user' | 'multiuser';

type TypeDescriptor = {
    id: TypeID;
    fieldType: PropertyField['type'];
    icon: ComponentType<IconProps>;
    label: MessageDescriptor;
};

const TYPE_DESCRIPTOR: IDMappedObjects<TypeDescriptor> = {
    text: {
        id: 'text',
        fieldType: 'text',
        icon: MenuVariantIcon,
        label: defineMessage({
            id: 'admin.system_properties.board_properties.table.select_type.text',
            defaultMessage: 'Text',
        }),
    },
    select: {
        id: 'select',
        fieldType: 'select',
        icon: ChevronDownCircleOutlineIcon,
        label: defineMessage({
            id: 'admin.system_properties.board_properties.table.select_type.select',
            defaultMessage: 'Select',
        }),
    },
    multiselect: {
        id: 'multiselect',
        fieldType: 'multiselect',
        icon: FormatListBulletedIcon,
        label: defineMessage({
            id: 'admin.system_properties.board_properties.table.select_type.multi_select',
            defaultMessage: 'Multi-select',
        }),
    },
    date: {
        id: 'date',
        fieldType: 'date',
        icon: CalendarOutlineIcon,
        label: defineMessage({
            id: 'admin.system_properties.board_properties.table.select_type.date',
            defaultMessage: 'Date',
        }),
    },
    user: {
        id: 'user',
        fieldType: 'user',
        icon: AccountOutlineIcon,
        label: defineMessage({
            id: 'admin.system_properties.board_properties.table.select_type.user',
            defaultMessage: 'User',
        }),
    },
    multiuser: {
        id: 'multiuser',
        fieldType: 'multiuser',
        icon: AccountMultipleOutlineIcon,
        label: defineMessage({
            id: 'admin.system_properties.board_properties.table.select_type.multi_user',
            defaultMessage: 'Multi-user',
        }),
    },
} as const;

const menuInputContainerStyles = css`
    padding: 0 12px;
`;
