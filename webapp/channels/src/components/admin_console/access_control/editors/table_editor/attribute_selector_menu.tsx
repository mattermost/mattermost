// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useMemo, useState, useEffect} from 'react';
import {useIntl} from 'react-intl';

import {
    CheckIcon,
    MenuVariantIcon,
    ChevronDownCircleOutlineIcon,
    EmailOutlineIcon,
    FormatListBulletedIcon,
    LinkVariantIcon,
    PoundIcon,
} from '@mattermost/compass-icons/components';
import type IconProps from '@mattermost/compass-icons/components/props';
import type {UserPropertyField} from '@mattermost/types/properties';

import * as Menu from 'components/menu';

import './selector_menus.scss';

// Define AttributeIcon outside the main component
const AttributeIcon = (props: IconProps & { attribute?: UserPropertyField }) => {
    const {attribute, ...iconProps} = props;
    if (attribute) {
        const valueType = attribute.attrs?.value_type;
        if (valueType === 'email') {
            return <EmailOutlineIcon {...iconProps}/>;
        }
        if (valueType === 'url') {
            return <LinkVariantIcon {...iconProps}/>;
        }
        if (valueType === 'phone') {
            return <PoundIcon {...iconProps}/>;
        }

        // If no specific value_type, check the field type
        switch (attribute.type) {
        case 'select':
            return <ChevronDownCircleOutlineIcon {...iconProps}/>;
        case 'multiselect':
            return <FormatListBulletedIcon {...iconProps}/>;
        case 'text':
        default:
            return <MenuVariantIcon {...iconProps}/>;
        }
    }
    return <MenuVariantIcon {...iconProps}/>;
};

interface AttributeSelectorProps {
    currentAttribute: string;
    availableAttributes: UserPropertyField[];
    disabled: boolean;
    onChange: (attribute: string) => void;
    menuId: string;
    buttonId: string;
    autoOpen?: boolean;
    onMenuOpened?: () => void;
}

const AttributeSelectorMenu = ({currentAttribute, availableAttributes, disabled, onChange, menuId, buttonId, autoOpen = false, onMenuOpened}: AttributeSelectorProps) => {
    const {formatMessage} = useIntl();
    const [filter, setFilter] = useState('');

    const onFilterChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setFilter(e.target.value);
    }, []); // setFilter is stable

    const options = useMemo(() => {
        return availableAttributes.filter((attr) => {
            return attr.name.toLowerCase().includes(filter.toLowerCase());
        });
    }, [availableAttributes, filter]);

    const handleAttributeChange = React.useCallback((attribute: string) => {
        onChange(attribute);
        setFilter(''); // Reset filter after selection
    }, [onChange]); // setFilter is stable, onChange is a dependency

    const selectedAttributeObject = useMemo(() => {
        return availableAttributes.find((attr) => attr.name === currentAttribute);
    }, [currentAttribute, availableAttributes]);

    useEffect(() => {
        if (autoOpen) {
            const buttonElement = document.getElementById(buttonId);
            if (buttonElement) {
                buttonElement.click();
            }
            if (onMenuOpened) {
                onMenuOpened();
            }
        }
    }, [autoOpen, buttonId, onMenuOpened]);

    return (
        <Menu.Container
            menuButton={{
                id: buttonId,
                class: classNames('btn btn-transparent field-selector-menu-button', {
                    disabled,
                }),
                children: (
                    <>
                        <AttributeIcon attribute={selectedAttributeObject}/>
                        {currentAttribute || formatMessage({id: 'admin.access_control.table_editor.selector.select_attribute', defaultMessage: 'Select attribute'})}
                    </>
                ),
                dataTestId: 'attributeSelectorMenuButton',
                disabled,
            }}
            menu={{
                id: menuId,
                'aria-label': 'Select attribute',
                className: 'select-attribute-mui-menu',
            }}
        >
            <Menu.InputItem
                key='filter_attributes'
                id='filter_attributes'
                type='text'
                placeholder={formatMessage({id: 'admin.access_control.table_editor.selector.filter_attributes', defaultMessage: 'Search attributes...'})}
                className='attribute-selector-search'
                value={filter}
                onChange={onFilterChange}
            />
            {options.map((option) => {
                const {name} = option;
                return (
                    <Menu.Item
                        id={`attribute-${name}`}
                        key={name}
                        role='menuitemradio'
                        forceCloseOnSelect={true}
                        aria-checked={name === currentAttribute}
                        onClick={() => handleAttributeChange(name)}
                        labels={<span>{name}</span>}
                        leadingElement={
                            <AttributeIcon
                                attribute={option}
                                size={18}
                            />}
                        trailingElements={name === currentAttribute && (
                            <CheckIcon/>
                        )}
                    />
                );
            })}
        </Menu.Container>
    );
};

export default AttributeSelectorMenu;
