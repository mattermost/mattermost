// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useMemo, useState, useEffect, useCallback, useRef} from 'react';
import {useIntl} from 'react-intl';

import {
    CheckIcon,
    MenuVariantIcon,
    ChevronDownCircleOutlineIcon,
    EmailOutlineIcon,
    FormatListBulletedIcon,
    LinkVariantIcon,
    PoundIcon,
    InformationOutlineIcon,
    SyncIcon,
    ShieldAlertOutlineIcon,
} from '@mattermost/compass-icons/components';
import type IconProps from '@mattermost/compass-icons/components/props';
import type {UserPropertyField} from '@mattermost/types/properties';

import * as Menu from 'components/menu';
import WithTooltip from 'components/with_tooltip';

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
    enableUserManagedAttributes: boolean;
}

const AttributeSelectorMenu = ({currentAttribute, availableAttributes, disabled, onChange, menuId, buttonId, autoOpen = false, onMenuOpened, enableUserManagedAttributes}: AttributeSelectorProps) => {
    const {formatMessage} = useIntl();
    const [filter, setFilter] = useState('');
    const prevAutoOpen = useRef(false);

    const onFilterChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
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
        if (autoOpen && !prevAutoOpen.current) {
            const buttonElement = document.getElementById(buttonId);
            buttonElement?.click();
            if (onMenuOpened) {
                onMenuOpened();
            }
        }
        prevAutoOpen.current = autoOpen;
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
                const hasSpaces = name.includes(' ');
                const isSynced = option.attrs?.ldap || option.attrs?.saml;
                const isAdminManaged = option.attrs?.managed === 'admin';
                const allowed = isSynced || isAdminManaged || enableUserManagedAttributes;

                const menuItem = (
                    <Menu.Item
                        id={`attribute-${name}`}
                        key={name}
                        role='menuitemradio'
                        forceCloseOnSelect={true}
                        aria-checked={name === currentAttribute}
                        onClick={hasSpaces ? undefined : () => handleAttributeChange(name)}
                        labels={<span>{name}</span>}
                        disabled={hasSpaces || !allowed}
                        leadingElement={
                            <AttributeIcon
                                attribute={option}
                                size={18}
                            />
                        }
                        trailingElements={(
                            <>
                                {hasSpaces && (
                                    <InformationOutlineIcon
                                        size={18}
                                    />
                                )}
                                {!allowed && !isSynced && (
                                    <ShieldAlertOutlineIcon
                                        size={18}
                                        color='rgba(var(--center-channel-color-rgb), 0.5)'
                                    />
                                )}
                                {isSynced && (
                                    <SyncIcon
                                        size={18}
                                        color='rgba(var(--center-channel-color-rgb), 0.5)'
                                    />
                                )}
                                {name === currentAttribute &&
                                    <CheckIcon/>
                                }
                            </>
                        )}
                    />
                );

                // Determine tooltip content based on conditions
                let tooltipContent = null;
                if (hasSpaces) {
                    tooltipContent = formatMessage({
                        id: 'admin.access_control.table_editor.attribute_spaces_not_supported',
                        defaultMessage: 'CEL is not compatible with variable names containing spaces',
                    });
                } else if (!allowed) {
                    tooltipContent = formatMessage({
                        id: 'admin.access_control.table_editor.not_safe_to_use',
                        defaultMessage: 'Values for this attribute are managed by users and should not be used for access control. Please link attribute to AD/LDAP for use in access policies.',
                    });
                } else if (isSynced) {
                    tooltipContent = formatMessage({
                        id: 'admin.access_control.table_editor.attribute_synced',
                        defaultMessage: 'This attribute is synced from an external source',
                    });
                }

                // Wrap in tooltip if needed
                if (tooltipContent) {
                    return (
                        <WithTooltip
                            key={name}
                            title={tooltipContent}
                        >
                            <div className='menu-item-tooltip-wrapper'>
                                {menuItem}
                            </div>
                        </WithTooltip>
                    );
                }

                return menuItem;
            })}
        </Menu.Container>
    );
};

export default AttributeSelectorMenu;
