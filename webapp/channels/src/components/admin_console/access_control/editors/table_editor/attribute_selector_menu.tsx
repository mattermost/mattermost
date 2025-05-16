// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useMemo, useState} from 'react';
import {useIntl} from 'react-intl';

import {CheckIcon, MenuVariantIcon} from '@mattermost/compass-icons/components';
import type IconProps from '@mattermost/compass-icons/components/props';

import * as Menu from 'components/menu';

import './selector_menus.scss';

interface AttributeOption {
    attribute: string;
    values: string[];
}

interface AttributeSelectorProps {
    currentAttribute: string;
    availableAttributes: AttributeOption[];
    disabled: boolean;
    onChange: (attribute: string) => void;
}

const AttributeSelectorMenu = ({currentAttribute, availableAttributes, disabled, onChange}: AttributeSelectorProps) => {
    const {formatMessage} = useIntl();
    const [filter, setFilter] = useState('');

    const onFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFilter(e.target.value);
    };

    const options = useMemo(() => {
        return availableAttributes.filter((attr) => {
            return attr.attribute.toLowerCase().includes(filter.toLowerCase());
        });
    }, [availableAttributes, filter]);

    const handleAttributeChange = (attribute: string) => {
        onChange(attribute);
        setFilter('');
    };

    // TODO: We can use different icons for different attributes types
    const AttributeIcon = (props: IconProps) => <MenuVariantIcon {...props}/>;

    return (
        <Menu.Container
            menuButton={{
                id: 'attribute-selector-button',
                class: classNames('btn btn-transparent field-selector-menu-button', {
                    disabled,
                }),
                children: (
                    <>
                        <AttributeIcon/>
                        {currentAttribute || formatMessage({id: 'admin.access_control.table_editor.selector.select_attribute', defaultMessage: 'Select attribute'})}
                    </>
                ),
                dataTestId: 'attributeSelectorMenuButton',
                disabled,
            }}
            menu={{
                id: 'attribute-selector-menu',
                'aria-label': 'Select attribute',
                className: 'select-attribute-mui-menu',
            }}
        >
            {[
                <Menu.InputItem
                    key='filter_attributes'
                    id='filter_attributes'
                    type='text'
                    placeholder={formatMessage({id: 'admin.access_control.table_editor.selector.filter_attributes', defaultMessage: 'Search attributes...'})}
                    className='attribute-selector-search'
                    value={filter}
                    onChange={onFilterChange}
                />,
            ]}
            {options.map((option) => {
                const {attribute} = option;
                return (
                    <Menu.Item
                        id={`attribute-${attribute}`}
                        key={attribute}
                        role='menuitemradio'
                        forceCloseOnSelect={true}
                        aria-checked={attribute === currentAttribute}
                        onClick={() => handleAttributeChange(attribute)}
                        labels={<span>{attribute}</span>}
                        leadingElement={<AttributeIcon size={18}/>}
                        trailingElements={attribute === currentAttribute && (
                            <CheckIcon/>
                        )}
                    />
                );
            })}
        </Menu.Container>
    );
};

export default AttributeSelectorMenu;
