// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import type {ComponentType} from 'react';
import React, {useMemo, useState} from 'react';
import type {MessageDescriptor} from 'react-intl';
import {defineMessage, FormattedMessage, useIntl} from 'react-intl';
import {css} from 'styled-components';

import {AccountOutlineIcon, CalendarOutlineIcon, CheckIcon, ChevronDownCircleOutlineIcon, FormatListBulletedIcon, MenuVariantIcon} from '@mattermost/compass-icons/components';
import type IconProps from '@mattermost/compass-icons/components/props';
import type {FieldType} from '@mattermost/types/properties';
import type {BoardsPropertyField} from '@mattermost/types/properties_board';
import type {IDMappedObjects} from '@mattermost/types/utilities';

import * as Menu from 'components/menu';

import {isPropertyDisabled} from './board_attributes_utils';

import '../system_properties/user_properties_type_menu.scss';

interface Props {
    field: BoardsPropertyField;
    updateField: (field: BoardsPropertyField) => void;
}

const SelectType = (props: Props) => {
    const {formatMessage} = useIntl();
    const [filter, setFilter] = useState('');

    const onFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFilter(e.target.value);
    };

    const handleTypeChange = (descriptor: TypeDescriptor) => {
        props.updateField({...props.field, type: descriptor.fieldType});
        setFilter('');
    };

    const options = useMemo(() => {
        return Object.values(TYPE_DESCRIPTOR).filter((descriptor) => {
            return formatMessage(descriptor.label).toLowerCase().includes(filter.toLowerCase());
        });
    }, [filter, formatMessage]);

    const currentTypeDescriptor = useMemo(() => {
        return getTypeDescriptor(props.field);
    }, [props.field]);
    const CurrentTypeIcon = currentTypeDescriptor.icon;

    const isDisabled = isPropertyDisabled(props.field);

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
                disabled: isDisabled,
            }}
            menu={{
                id: `type-selector-menu-${props.field.id}`,
                'aria-label': formatMessage({
                    id: 'admin.board_attributes.type_menu.label',
                    defaultMessage: 'Select type',
                }),
                className: 'select-type-mui-menu',
            }}
        >
            {[
                <Menu.InputItem
                    key='filter_types'
                    id='filter_types'
                    type='text'
                    placeholder={formatMessage({id: 'admin.board_attributes.table.filter_type', defaultMessage: 'Attribute type'})}
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
                                color='var(--button-bg)'
                            />
                        )}
                    />
                );
            })}
        </Menu.Container>
    );
};

export default SelectType;

const getTypeDescriptor = (field: BoardsPropertyField): TypeDescriptor => {
    for (const descriptor of Object.values(TYPE_DESCRIPTOR)) {
        if (descriptor.fieldType === field.type) {
            return descriptor;
        }
    }

    return TYPE_DESCRIPTOR.text;
};

// The property types Integrated Boards supports. Enumerated explicitly (a
// deliberate subset of FieldType) so the IDMappedObjects typing on
// TYPE_DESCRIPTOR forces a descriptor entry for each supported type.
type TypeID = 'text' | 'select' | 'multiselect' | 'date' | 'user';

type TypeDescriptor = {
    id: TypeID;
    fieldType: FieldType;
    icon: ComponentType<IconProps>;
    label: MessageDescriptor;
};

const TYPE_DESCRIPTOR: IDMappedObjects<TypeDescriptor> = {
    text: {
        id: 'text',
        fieldType: 'text',
        icon: MenuVariantIcon,
        label: defineMessage({
            id: 'admin.board_attributes.table.select_type.text',
            defaultMessage: 'Text',
        }),
    },
    select: {
        id: 'select',
        fieldType: 'select',
        icon: ChevronDownCircleOutlineIcon,
        label: defineMessage({
            id: 'admin.board_attributes.table.select_type.select',
            defaultMessage: 'Select',
        }),
    },
    multiselect: {
        id: 'multiselect',
        fieldType: 'multiselect',
        icon: FormatListBulletedIcon,
        label: defineMessage({
            id: 'admin.board_attributes.table.select_type.multi_select',
            defaultMessage: 'Multi-select',
        }),
    },
    date: {
        id: 'date',
        fieldType: 'date',
        icon: CalendarOutlineIcon,
        label: defineMessage({
            id: 'admin.board_attributes.table.select_type.date',
            defaultMessage: 'Date',
        }),
    },
    user: {
        id: 'user',
        fieldType: 'user',
        icon: AccountOutlineIcon,
        label: defineMessage({
            id: 'admin.board_attributes.table.select_type.user',
            defaultMessage: 'User',
        }),
    },
} as const;

const menuInputContainerStyles = css`
    padding: 0 12px;
`;
