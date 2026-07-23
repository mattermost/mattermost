// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import type {ComponentType} from 'react';
import React, {useMemo, useState} from 'react';
import type {MessageDescriptor} from 'react-intl';
import {defineMessage, FormattedMessage, useIntl} from 'react-intl';

import {CheckAllIcon, CheckIcon, ClockOutlineIcon, ElementOfIcon, EqualIcon, FunctionIcon, NotEqualVariantIcon} from '@mattermost/compass-icons/components';
import type IconProps from '@mattermost/compass-icons/components/props';
import type {IDMappedObjects} from '@mattermost/types/utilities';

import * as Menu from 'components/menu';

import {OperatorLabel} from '../shared';
import './selector_menus.scss';

// The compass icon set has no greater-than / less-than glyphs, so the ordinal
// ranked operators render their math symbol as text sized like an icon.
const symbolIcon = (symbol: string): ComponentType<IconProps> => {
    const SymbolIcon = ({size = 18, color, className}: IconProps) => (
        <span
            className={className}
            aria-hidden={true}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: typeof size === 'number' ? `${size}px` : size,
                height: typeof size === 'number' ? `${size}px` : size,
                fontSize: typeof size === 'number' ? `${size - 2}px` : size,
                fontWeight: 600,
                lineHeight: 1,
                color,
            }}
        >
            {symbol}
        </span>
    );
    return SymbolIcon;
};

const GreaterThanOrEqualIcon = symbolIcon('≥');
const GreaterThanIcon = symbolIcon('>');
const LessThanOrEqualIcon = symbolIcon('≤');
const LessThanIcon = symbolIcon('<');

interface OperatorSelectorProps {
    currentOperator: string;
    disabled: boolean;
    onChange: (operator: string) => void;
    attributeType?: string;

    // When provided (native attributes), the menu is restricted to exactly these
    // operator labels and the multiselect heuristic is bypassed.
    allowedOperators?: string[];
}

const OperatorSelectorMenu = ({currentOperator, disabled, onChange, attributeType, allowedOperators}: OperatorSelectorProps) => {
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

    // The operator set depends on the attribute type. Ranked attributes expose
    // the ordinal comparison operators (and reuse "is not"); multiselect exposes
    // only the set membership operators; everything else gets the default set.
    // Each list is ordered the way it should appear in the menu.
    const operatorIds = useMemo(() => {
        if (attributeType === 'multiselect') {
            return MULTISELECT_OPERATOR_ORDER;
        }
        if (attributeType === 'rank') {
            return RANK_OPERATOR_ORDER;
        }
        return DEFAULT_OPERATOR_ORDER;
    }, [attributeType]);

    const filteredOperators = useMemo(() => {
        const matchesFilter = (desc: OperatorDescriptor) =>
            formatMessage(desc.label).toLowerCase().includes(filter.toLowerCase());

        // Native attributes advertise an explicit, ordered operator set; unknown
        // labels are filtered out defensively.
        if (allowedOperators) {
            return allowedOperators.
                map((label) => OPERATOR_DESCRIPTORS[label as OperatorLabel] as OperatorDescriptor | undefined).
                filter((desc): desc is OperatorDescriptor => Boolean(desc)).
                filter(matchesFilter);
        }

        // Otherwise fall back to the per-attribute-type ordering (which already
        // excludes native-only operators such as "younger than").
        return operatorIds.
            map((id) => OPERATOR_DESCRIPTORS[id]).
            filter(matchesFilter);
    }, [operatorIds, allowedOperators, filter, formatMessage]);

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
    [OperatorLabel.HAS_ANY_OF]: {
        id: OperatorLabel.HAS_ANY_OF,
        icon: CheckIcon,
        label: defineMessage({
            id: 'admin.access_control.table_editor.operator.has_any_of',
            defaultMessage: 'has any of',
        }),
    },
    [OperatorLabel.HAS_ALL_OF]: {
        id: OperatorLabel.HAS_ALL_OF,
        icon: CheckAllIcon,
        label: defineMessage({
            id: 'admin.access_control.table_editor.operator.has_all_of',
            defaultMessage: 'has all of',
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
    [OperatorLabel.IS_EXACTLY]: {
        id: OperatorLabel.IS_EXACTLY,
        icon: EqualIcon,
        label: defineMessage({
            id: 'admin.access_control.table_editor.operator.is_exactly',
            defaultMessage: 'is exactly',
        }),
    },
    [OperatorLabel.IS_AT_LEAST]: {
        id: OperatorLabel.IS_AT_LEAST,
        icon: GreaterThanOrEqualIcon,
        label: defineMessage({
            id: 'admin.access_control.table_editor.operator.is_at_least',
            defaultMessage: 'is at least',
        }),
    },
    [OperatorLabel.IS_GREATER_THAN]: {
        id: OperatorLabel.IS_GREATER_THAN,
        icon: GreaterThanIcon,
        label: defineMessage({
            id: 'admin.access_control.table_editor.operator.is_greater_than',
            defaultMessage: 'is greater than',
        }),
    },
    [OperatorLabel.IS_AT_MOST]: {
        id: OperatorLabel.IS_AT_MOST,
        icon: LessThanOrEqualIcon,
        label: defineMessage({
            id: 'admin.access_control.table_editor.operator.is_at_most',
            defaultMessage: 'is at most',
        }),
    },
    [OperatorLabel.IS_LESS_THAN]: {
        id: OperatorLabel.IS_LESS_THAN,
        icon: LessThanIcon,
        label: defineMessage({
            id: 'admin.access_control.table_editor.operator.is_less_than',
            defaultMessage: 'is less than',
        }),
    },
    [OperatorLabel.YOUNGER_THAN]: {
        id: OperatorLabel.YOUNGER_THAN,
        icon: ClockOutlineIcon,
        label: defineMessage({
            id: 'admin.access_control.table_editor.operator.younger_than',
            defaultMessage: 'younger than (days)',
        }),
    },
};

// Operator ordering per attribute type. Ranked attributes lead with "is exactly"
// and "is not", then group the inclusive/strict inequality pairs (≥/> and ≤/<)
// so the sibling forms read together.
const DEFAULT_OPERATOR_ORDER: OperatorLabel[] = [
    OperatorLabel.IS,
    OperatorLabel.IS_NOT,
    OperatorLabel.IN,
    OperatorLabel.STARTS_WITH,
    OperatorLabel.ENDS_WITH,
    OperatorLabel.CONTAINS,
];

const MULTISELECT_OPERATOR_ORDER: OperatorLabel[] = [
    OperatorLabel.HAS_ANY_OF,
    OperatorLabel.HAS_ALL_OF,
];

const RANK_OPERATOR_ORDER: OperatorLabel[] = [
    OperatorLabel.IS_EXACTLY,
    OperatorLabel.IS_NOT,
    OperatorLabel.IS_AT_LEAST,
    OperatorLabel.IS_GREATER_THAN,
    OperatorLabel.IS_AT_MOST,
    OperatorLabel.IS_LESS_THAN,
];
