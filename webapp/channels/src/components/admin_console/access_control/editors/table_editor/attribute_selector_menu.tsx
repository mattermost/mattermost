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
    SortAscendingIcon,
} from '@mattermost/compass-icons/components';
import type IconProps from '@mattermost/compass-icons/components/props';
import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {UserPropertyField} from '@mattermost/types/properties_user';

import * as Menu from 'components/menu';

import {getUserPropertyFieldLabel} from 'utils/properties';

import './selector_menus.scss';

type AttributeLabelProps = {
    displayName: string;
    name: string;
};

const AttributeLabel = ({displayName, name}: AttributeLabelProps) => (
    <span className='attribute-selector-label'>
        <span className='attribute-selector-label__display-name'>{displayName}</span>
        <span className='attribute-selector-label__unique-name'>{name}</span>
    </span>
);

// Define AttributeIcon outside the main component
const AttributeIcon = (props: IconProps & {attribute?: UserPropertyField}) => {
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
        case 'rank':
            return <SortAscendingIcon {...iconProps}/>;
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
        const q = filter.toLowerCase();
        return availableAttributes.filter((attr) => {
            return (
                attr.name.toLowerCase().includes(q) ||
                getUserPropertyFieldLabel(attr).toLowerCase().includes(q)
            );
        });
    }, [availableAttributes, filter]);

    const handleAttributeChange = React.useCallback((attribute: string) => {
        onChange(attribute);
        setFilter(''); // Reset filter after selection
    }, [onChange]); // setFilter is stable, onChange is a dependency

    const selectedAttributeObject = useMemo(() => {
        return availableAttributes.find((attr) => attr.name === currentAttribute);
    }, [currentAttribute, availableAttributes]);

    let selectedAttributeLabel;
    if (selectedAttributeObject) {
        selectedAttributeLabel = getUserPropertyFieldLabel(selectedAttributeObject);
    } else {
        selectedAttributeLabel = currentAttribute || formatMessage({id: 'admin.access_control.table_editor.selector.select_attribute', defaultMessage: 'Select attribute'});
    }

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

    // Native (built-in) attributes are visually separated from custom profile
    // attributes; both retain their per-attribute safety affordances.
    const nativeOptions = options.filter((option) => option.attrs?.native);
    const customOptions = options.filter((option) => !option.attrs?.native);

    const renderAttribute = (option: UserPropertyField): JSX.Element => {
        const {name} = option;
        const displayName = option.attrs?.display_name;

        // hasSpaces checks the CEL identifier (name), not the display label.
        // New fields cannot have spaces in name but leaving this check for backwards compatibility with grandfathered legacy fields.
        const hasSpaces = name.includes(' ');
        const isNative = option.attrs?.native;
        const isSynced = option.attrs?.ldap || option.attrs?.saml;
        const isAdminManaged = option.attrs?.managed === 'admin';
        const isProtected = option.attrs?.protected;
        const allowed = isNative || isSynced || isAdminManaged || isProtected || enableUserManagedAttributes;

        const menuItem = (
            <Menu.Item
                id={`attribute-${name}`}
                key={name}
                role='menuitemradio'
                forceCloseOnSelect={true}
                aria-checked={name === currentAttribute}
                onClick={hasSpaces ? undefined : () => handleAttributeChange(name)}
                labels={
                    displayName ? (
                        <AttributeLabel
                            displayName={displayName}
                            name={name}
                        />
                    ) : <span>{name}</span>
                }
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
    };

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
                        {selectedAttributeLabel}
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
            {nativeOptions.length > 0 ? (
                <>
                    <Menu.Title role='presentation'>
                        {formatMessage({id: 'admin.access_control.table_editor.selector.native_attributes', defaultMessage: 'Built-in attributes'})}
                    </Menu.Title>
                    {nativeOptions.map(renderAttribute)}
                    {customOptions.length > 0 && <Menu.Separator/>}
                    {customOptions.length > 0 && (
                        <Menu.Title role='presentation'>
                            {formatMessage({id: 'admin.access_control.table_editor.selector.custom_attributes', defaultMessage: 'Custom attributes'})}
                        </Menu.Title>
                    )}
                    {customOptions.map(renderAttribute)}
                </>
            ) : options.map(renderAttribute)}
        </Menu.Container>
    );
};

export default AttributeSelectorMenu;
