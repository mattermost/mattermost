// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import type {ComponentType} from 'react';
import React, {useMemo, useState} from 'react';
import type {MessageDescriptor} from 'react-intl';
import {defineMessage, FormattedMessage, useIntl} from 'react-intl';

import {CheckIcon} from '@mattermost/compass-icons/components';
import type IconProps from '@mattermost/compass-icons/components/props';
import type {IDMappedObjects} from '@mattermost/types/utilities';

import * as Menu from 'components/menu';

import {OperatorLabel} from '../shared';
import './selector_menus.scss';

// TODO: Use Compass icons once a newer version is released
const AlphaEIcon: React.FC<IconProps> = ({size, color, ...rest}: IconProps): JSX.Element => (
    <svg
        xmlns='http://www.w3.org/2000/svg'
        version='1.1'
        width={size || '1em'}
        height={size || '1em'}
        fill={color || 'currentColor'}
        viewBox='0 0 24 24'
        transform='rotate(90)'
        {...rest}
    >
        <path d='M9,17A2,2 0 0,1 7,15V7H9V15H11V8H13V15H15V7H17V15A2,2 0 0,1 15,17H9Z'/>
    </svg>
);

const EqualIcon: React.FC<IconProps> = ({size, color, ...rest}: IconProps): JSX.Element => (
    <svg
        xmlns='http://www.w3.org/2000/svg'
        version='1.1'
        width={size || '1em'}
        height={size || '1em'}
        fill={color || 'currentColor'}
        viewBox='0 0 24 24'
        {...rest}
    >
        <path d='M19,10H5V8H19V10M19,16H5V14H19V16Z'/>
    </svg>
);

const FunctionIcon: React.FC<IconProps> = ({size, color, ...rest}: IconProps): JSX.Element => (
    <svg
        xmlns='http://www.w3.org/2000/svg'
        version='1.1'
        width={size || '1em'}
        height={size || '1em'}
        fill={color || 'currentColor'}
        viewBox='0 0 24 24'
        {...rest}
    >
        <path d='M15.6,5.29C14.5,5.19 13.53,6 13.43,7.11L13.18,10H16V12H13L12.56,17.07C12.37,19.27 10.43,20.9 8.23,20.7C6.92,20.59 5.82,19.86 5.17,18.83L6.67,17.33C6.91,18.07 7.57,18.64 8.4,18.71C9.5,18.81 10.47,18 10.57,16.89L11,12H8V10H11.17L11.44,6.93C11.63,4.73 13.57,3.1 15.77,3.3C17.08,3.41 18.18,4.14 18.83,5.17L17.33,6.67C17.09,5.93 16.43,5.36 15.6,5.29Z'/>
    </svg>
);

const NotEqualIcon: React.FC<IconProps> = ({size, color, ...rest}: IconProps): JSX.Element => (
    <svg
        xmlns='http://www.w3.org/2000/svg'
        version='1.1'
        width={size || '1em'}
        height={size || '1em'}
        fill={color || 'currentColor'}
        viewBox='0 0 24 24'
        {...rest}
    >
        <path d='M21,10H9V8H21V10M21,16H9V14H21V16M4,5H6V16H4V5M6,18V20H4V18H6Z'/>
    </svg>
);

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

type OperatorID = OperatorLabel.IS | OperatorLabel.IS_NOT | OperatorLabel.IN | OperatorLabel.STARTS_WITH | OperatorLabel.ENDS_WITH | OperatorLabel.CONTAINS;

type OperatorDescriptor = {
    id: OperatorID;
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
        icon: NotEqualIcon,
        label: defineMessage({
            id: 'admin.access_control.table_editor.operator.is_not',
            defaultMessage: 'is not',
        }),
    },
    [OperatorLabel.IN]: {
        id: OperatorLabel.IN,
        icon: AlphaEIcon,
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
