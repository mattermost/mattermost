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

import {OperatorLabel} from '../shared';
import './selector_menus.scss';

interface OperatorSelectorProps {
    currentOperator: string;
    disabled: boolean;
    onChange: (operator: string) => void;
}

const OperatorSelectorMenu = ({currentOperator, disabled, onChange}: OperatorSelectorProps) => {
    const {formatMessage} = useIntl();
    const [filter, setFilter] = useState('');

    const handleOperatorChange = React.useCallback((descriptor: OperatorDescriptor) => {
        onChange(descriptor.id);
        setFilter('');
    }, [onChange]);

    const currentOperatorDescriptor = useMemo(() => {
        return getOperatorDescriptor(currentOperator);
    }, [currentOperator]);

    const CurrentOperatorIcon = currentOperatorDescriptor.icon;

    const onFilterChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setFilter(e.target.value);
    }, []);

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
        if (descriptor.id === operatorValue) {
            return descriptor;
        }
    }

    return OPERATOR_DESCRIPTORS.is;
};

type OperatorDescriptor = {
    id: OperatorLabel;
    icon: ComponentType<IconProps>;
    label: MessageDescriptor;
};

const OPERATOR_DESCRIPTORS: IDMappedObjects<OperatorDescriptor> = {
    [OperatorLabel.IS]: {
        id: OperatorLabel.IS,
        icon: EqualIcon,
        label: defineMessage({
            id: 'admin.access_control.table_editor.operator.is',
            defaultMessage: 'is',
        }),
    },
    [OperatorLabel.IS_NOT]: {
        id: OperatorLabel.IS_NOT,
        icon: NotEqualVariantIcon,
        label: defineMessage({
            id: 'admin.access_control.table_editor.operator.is_not',
            defaultMessage: 'is not',
        }),
    },
    [OperatorLabel.IN]: {
        id: OperatorLabel.IN,
        icon: ElementOfIcon,
        label: defineMessage({
            id: 'admin.access_control.table_editor.operator.in',
            defaultMessage: 'in',
        }),
    },
    [OperatorLabel.STARTS_WITH]: {
        id: OperatorLabel.STARTS_WITH,
        icon: FunctionIcon,
        label: defineMessage({
            id: 'admin.access_control.table_editor.operator.starts_with',
            defaultMessage: 'starts with',
        }),
    },
    [OperatorLabel.ENDS_WITH]: {
        id: OperatorLabel.ENDS_WITH,
        icon: FunctionIcon,
        label: defineMessage({
            id: 'admin.access_control.table_editor.operator.ends_with',
            defaultMessage: 'ends with',
        }),
    },
    [OperatorLabel.CONTAINS]: {
        id: OperatorLabel.CONTAINS,
        icon: FunctionIcon,
        label: defineMessage({
            id: 'admin.access_control.table_editor.operator.contains',
            defaultMessage: 'contains',
        }),
    },
};
