// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useMemo, useState, useEffect, useCallback, useRef} from 'react';
import {useIntl} from 'react-intl';

import {
    CheckIcon,
    CheckCircleOutlineIcon,
    MenuVariantIcon,
    ChevronDownCircleOutlineIcon,
    EmailOutlineIcon,
    FormatListBulletedIcon,
    LinkVariantIcon,
    PoundIcon,
    SyncIcon,
    ShieldAlertOutlineIcon,
} from '@mattermost/compass-icons/components';
import type IconProps from '@mattermost/compass-icons/components/props';
import type {UserPropertyField} from '@mattermost/types/properties';

import * as Menu from 'components/menu';
import WithTooltip from 'components/with_tooltip';

import {isCoreField, getCoreFieldDisplayName, CORE_FIELD_IS_BOT, CORE_FIELD_EMAIL_VERIFIED} from './table_editor';

import './selector_menus.scss';

// Define AttributeIcon outside the main component
const AttributeIcon = (props: IconProps & { attribute?: UserPropertyField }) => {
    const {attribute, ...iconProps} = props;
    if (attribute) {
        // Boolean core fields get a check-circle icon
        if (attribute.name === CORE_FIELD_IS_BOT || attribute.name === CORE_FIELD_EMAIL_VERIFIED) {
            return <CheckCircleOutlineIcon {...iconProps}/>;
        }

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
            const displayName = isCoreField(attr.name) ? getCoreFieldDisplayName(attr.name) : attr.name;
            return displayName.toLowerCase().includes(filter.toLowerCase());
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
                        {(() => {
                            if (!currentAttribute) {
                                return formatMessage({id: 'admin.access_control.table_editor.selector.select_attribute', defaultMessage: 'Select attribute'});
                            }
                            return isCoreField(currentAttribute) ? getCoreFieldDisplayName(currentAttribute) : currentAttribute;
                        })()}
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
                const isCore = isCoreField(name);
                const displayName = isCore ? getCoreFieldDisplayName(name) : name;
                const isSynced = option.attrs?.ldap || option.attrs?.saml;
                const isAdminManaged = option.attrs?.managed === 'admin';
                const isProtected = option.attrs?.protected;
                const allowed = isCore || isSynced || isAdminManaged || isProtected || enableUserManagedAttributes;

                const menuItem = (
                    <Menu.Item
                        id={`attribute-${name}`}
                        key={name}
                        role='menuitemradio'
                        forceCloseOnSelect={true}
                        aria-checked={name === currentAttribute}
                        onClick={allowed ? () => handleAttributeChange(name) : undefined}
                        labels={<span>{displayName}</span>}
                        disabled={!allowed}
                        leadingElement={
                            <AttributeIcon
                                attribute={option}
                                size={18}
                            />
                        }
                        trailingElements={(
                            <>
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
                if (!allowed) {
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
