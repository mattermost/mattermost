// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import type {ComponentType} from 'react';
import React, {useMemo, useState} from 'react';
import type {MessageDescriptor} from 'react-intl';
import {defineMessage, FormattedMessage, useIntl} from 'react-intl';

import {CheckIcon, ElementOfIcon, EqualIcon, FunctionIcon, NotEqualVariantIcon} from '@mattermost/compass-icons/components';
import type IconProps from '@mattermost/compass-icons/components/props';
import type {IDMappedObjects} from '@mattermost/types/utilities';

import * as Menu from 'components/menu';

import './selector_menus.scss';

interface OperatorSelectorProps {
    currentOperator: string;
    disabled: boolean;
    onChange: (operator: string) => void;
}

const OperatorSelectorMenu = ({currentOperator, disabled, onChange}: OperatorSelectorProps) => {
    const handleOperatorChange = (descriptor: OperatorDescriptor) => {
        onChange(descriptor.operatorValue);
        setFilter('');
    };

    const currentOperatorDescriptor = useMemo(() => {
        return getOperatorDescriptor(currentOperator);
    }, [currentOperator]);

    const CurrentOperatorIcon = currentOperatorDescriptor.icon;
    const {formatMessage} = useIntl();
    const [filter, setFilter] = useState('');

    const onFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFilter(e.target.value);
    };

    const filteredOperators = useMemo(() => {
        return Object.values(OPERATOR_DESCRIPTORS).filter((desc) => {
            const label = formatMessage(desc.label);
            return label.toLowerCase().includes(filter.toLowerCase());
        });
    }, [filter, formatMessage]);

    return (
        <Menu.Container
            menuButton={{
                id: 'operator-selector-button',
                class: classNames('btn btn-transparent field-selector-menu-button', {
                    disabled,
                }),
                children: (
                    <>
                        <CurrentOperatorIcon
                            size={18}
                            color='rgba(var(--center-channel-color-rgb), 0.64)'
                        />
                        <FormattedMessage {...currentOperatorDescriptor.label}/>
                    </>
                ),
                dataTestId: 'operatorSelectorMenuButton',
                disabled,
            }}
            menu={{
                id: 'operator-selector-menu',
                'aria-label': 'Select operator',
                className: 'select-operator-mui-menu',
            }}
        >
            <Menu.InputItem
                key='filter_operators'
                id='filter_operators'
                type='text'
                placeholder={formatMessage({id: 'admin.access_control.table_editor.selector.filter_operators', defaultMessage: 'Search operators...'})}
                className='attribute-selector-search'
                value={filter}
                onChange={onFilterChange}
            />
            {filteredOperators.map((descriptor) => {
                const {id, icon: Icon, label} = descriptor;

                return (
                    <Menu.Item
                        id={id}
                        key={id}
                        role='menuitemradio'
                        forceCloseOnSelect={true}
                        aria-checked={id === currentOperatorDescriptor.id}
                        onClick={() => handleOperatorChange(descriptor)}
                        labels={<FormattedMessage {...label}/>}
                        leadingElement={<Icon size={18}/>}
                        trailingElements={id === currentOperatorDescriptor.id && (
                            <CheckIcon/>
                        )}
                    />
                );
            })}
        </Menu.Container>
    );
};

export default OperatorSelectorMenu;

const getOperatorDescriptor = (operatorValue: string): OperatorDescriptor => {
    for (const descriptor of Object.values(OPERATOR_DESCRIPTORS)) {
        if (descriptor.operatorValue === operatorValue) {
            return descriptor;
        }
    }

    return OPERATOR_DESCRIPTORS.is;
};

type OperatorID = 'is' | 'is_not' | 'in' | 'starts_with' | 'ends_with' | 'contains';

type OperatorDescriptor = {
    id: OperatorID;
    operatorValue: string;
    icon: ComponentType<IconProps>;
    label: MessageDescriptor;
};

const OPERATOR_DESCRIPTORS: IDMappedObjects<OperatorDescriptor> = {
    is: {
        id: 'is',
        operatorValue: 'is',
        icon: EqualIcon,
        label: defineMessage({
            id: 'admin.access_control.table_editor.operator.is',
            defaultMessage: 'is',
        }),
    },
    is_not: {
        id: 'is_not',
        operatorValue: 'is not',
        icon: NotEqualVariantIcon,
        label: defineMessage({
            id: 'admin.access_control.table_editor.operator.is_not',
            defaultMessage: 'is not',
        }),
    },
    in: {
        id: 'in',
        operatorValue: 'in',
        icon: ElementOfIcon,
        label: defineMessage({
            id: 'admin.access_control.table_editor.operator.in',
            defaultMessage: 'in',
        }),
    },
    starts_with: {
        id: 'starts_with',
        operatorValue: 'starts with',
        icon: FunctionIcon,
        label: defineMessage({
            id: 'admin.access_control.table_editor.operator.starts_with',
            defaultMessage: 'starts with',
        }),
    },
    ends_with: {
        id: 'ends_with',
        operatorValue: 'ends with',
        icon: FunctionIcon,
        label: defineMessage({
            id: 'admin.access_control.table_editor.operator.ends_with',
            defaultMessage: 'ends with',
        }),
    },
    contains: {
        id: 'contains',
        operatorValue: 'contains',
        icon: FunctionIcon,
        label: defineMessage({
            id: 'admin.access_control.table_editor.operator.contains',
            defaultMessage: 'contains',
        }),
    },
};
