// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import type {ComponentType} from 'react';
import React, {useMemo, useState} from 'react';
import type {MessageDescriptor} from 'react-intl';
import {defineMessage, FormattedMessage, useIntl} from 'react-intl';

import {ArrowDownBoldCircleOutlineIcon, ArrowDownIcon, ArrowUpBoldCircleOutlineIcon, ArrowUpIcon, CheckAllIcon, CheckIcon, ClockOutlineIcon, ElementOfIcon, EqualIcon, FunctionIcon, NotEqualVariantIcon} from '@mattermost/compass-icons/components';
import type IconProps from '@mattermost/compass-icons/components/props';
import {WithTooltip} from '@mattermost/shared/components/tooltip';
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

    const currentOperatorLabel = useMemo(() => {
        return formatMessage(currentOperatorDescriptor.label);
    }, [currentOperatorDescriptor, formatMessage]);

    const CurrentOperatorIcon = currentOperatorDescriptor.icon;

    const onFilterChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setFilter(e.target.value);
    }, []);

    // The operator set depends on the attribute type. Ranked attributes expose
    // the ordinal comparison operators (and reuse "is not"); multiselect exposes
    // only the set membership operators; everything else gets the default set.
    // Each list is ordered the way it should appear in the menu. Graph is absent
    // because its operators come grouped — see GRAPH_OPERATOR_GROUPS.
    const operatorIds = useMemo(() => {
        if (attributeType === 'multiselect') {
            return MULTISELECT_OPERATOR_ORDER;
        }
        if (attributeType === 'rank') {
            return RANK_OPERATOR_ORDER;
        }
        return DEFAULT_OPERATOR_ORDER;
    }, [attributeType]);

    const matchesFilter = React.useCallback(
        (desc: OperatorDescriptor) => formatMessage(desc.label).toLowerCase().includes(filter.toLowerCase()),
        [filter, formatMessage],
    );

    const filteredOperators = useMemo(() => {
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
    }, [operatorIds, allowedOperators, matchesFilter]);

    // The graph menu is the only one split into titled groups and the only one
    // carrying help text, because the hierarchy is what makes its operators hard
    // to tell apart.
    const isGraphMenu = !allowedOperators && attributeType === 'graph';

    const sections = useMemo((): MenuSection[] => {
        if (!isGraphMenu) {
            return [{key: 'operators', entries: filteredOperators.map((descriptor) => ({descriptor}))}];
        }

        return GRAPH_OPERATOR_GROUPS.
            map((group) => ({
                key: group.key,
                title: group.title,
                entries: group.operators.
                    map((operator) => ({...operator, descriptor: OPERATOR_DESCRIPTORS[operator.id]})).
                    filter(({descriptor}) => matchesFilter(descriptor)),
            })).

            // A group whose every operator was filtered out loses its title too,
            // so a narrowed menu never shows a heading over nothing.
            filter((section) => section.entries.length > 0);
    }, [isGraphMenu, filteredOperators, matchesFilter]);

    // One flat array rather than a fragment per section: MUI's MenuList walks
    // React.Children to prepare its items, which flattens arrays but does not
    // descend into fragments. The sibling attribute menu interleaves its titles
    // the same way.
    const menuItems: React.ReactNode[] = [];
    for (const section of sections) {
        if (section.title) {
            menuItems.push(
                <Menu.Title
                    key={`${section.key}-title`}
                    role='presentation'
                >
                    {formatMessage(section.title)}
                </Menu.Title>,
            );
        }

        for (const {descriptor, description, functionName} of section.entries) {
            const {id, icon: Icon, label} = descriptor;

            menuItems.push(
                <Menu.Item
                    id={id}
                    key={id}
                    role='menuitemradio'
                    forceCloseOnSelect={true}
                    aria-checked={id === currentOperatorDescriptor.id}
                    onClick={() => handleOperatorChange(descriptor)}
                    labels={description ? (
                        <>
                            <span><FormattedMessage {...label}/></span>
                            <span>
                                <FormattedMessage
                                    {...description}
                                    values={{
                                        functionName: (
                                            <span className='operator-selector-menu__function-name'>
                                                {`(${functionName})`}
                                            </span>
                                        ),
                                    }}
                                />
                            </span>
                        </>
                    ) : <FormattedMessage {...label}/>}
                    leadingElement={<Icon size={18}/>}
                    trailingElements={id === currentOperatorDescriptor.id && (
                        <CheckIcon/>
                    )}
                />,
            );
        }
    }

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
                        <WithTooltip title={currentOperatorLabel}>
                            <span className='field-selector-menu-button__label'>{currentOperatorLabel}</span>
                        </WithTooltip>
                    </>
                ),
                dataTestId: 'operatorSelectorMenuButton',
                disabled,
            }}
            menu={{
                id: 'operator-selector-menu',
                'aria-label': 'Select operator',
                className: classNames('select-operator-mui-menu', {
                    'select-operator-mui-menu--described': isGraphMenu,
                }),
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
            {menuItems}
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
    [OperatorLabel.IN_CIDR]: {
        id: OperatorLabel.IN_CIDR,
        icon: FunctionIcon,
        label: defineMessage({
            id: 'admin.access_control.table_editor.operator.in_cidr',
            defaultMessage: 'in IP range',
        }),
    },
    [OperatorLabel.VERSION_IS]: {
        id: OperatorLabel.VERSION_IS,
        icon: EqualIcon,
        label: defineMessage({
            id: 'admin.access_control.table_editor.operator.version_is',
            defaultMessage: 'version is',
        }),
    },
    [OperatorLabel.VERSION_GREATER_THAN]: {
        id: OperatorLabel.VERSION_GREATER_THAN,
        icon: GreaterThanIcon,
        label: defineMessage({
            id: 'admin.access_control.table_editor.operator.version_greater_than',
            defaultMessage: 'version is greater than',
        }),
    },
    [OperatorLabel.VERSION_AT_LEAST]: {
        id: OperatorLabel.VERSION_AT_LEAST,
        icon: GreaterThanOrEqualIcon,
        label: defineMessage({
            id: 'admin.access_control.table_editor.operator.version_at_least',
            defaultMessage: 'version is at least',
        }),
    },
    [OperatorLabel.VERSION_LESS_THAN]: {
        id: OperatorLabel.VERSION_LESS_THAN,
        icon: LessThanIcon,
        label: defineMessage({
            id: 'admin.access_control.table_editor.operator.version_less_than',
            defaultMessage: 'version is less than',
        }),
    },
    [OperatorLabel.VERSION_AT_MOST]: {
        id: OperatorLabel.VERSION_AT_MOST,
        icon: LessThanOrEqualIcon,
        label: defineMessage({
            id: 'admin.access_control.table_editor.operator.version_at_most',
            defaultMessage: 'version is at most',
        }),
    },

    // The hierarchy predicates. The arrow points the way the holder's options
    // sit relative to the options the rule names — up for "covers" (at or
    // above), down for "within" (at or below) — and the circled variant marks
    // the all-of form, the stricter sibling of the plain any-of one.
    //
    // Their string ids read as the function rather than as the wording, and are
    // kept that way deliberately: a renamed id orphans its entry in all 21
    // translated catalogues, which the i18n check rejects and only Weblate may
    // clean up.
    [OperatorLabel.COVERS_ALL]: {
        id: OperatorLabel.COVERS_ALL,
        icon: ArrowUpBoldCircleOutlineIcon,
        label: defineMessage({
            id: 'admin.access_control.table_editor.operator.covers_all',
            defaultMessage: 'has each of or a parent of',
        }),
    },
    [OperatorLabel.COVERS_ANY]: {
        id: OperatorLabel.COVERS_ANY,
        icon: ArrowUpIcon,
        label: defineMessage({
            id: 'admin.access_control.table_editor.operator.covers_any',
            defaultMessage: 'has any of or a parent of',
        }),
    },
    [OperatorLabel.WITHIN_ALL]: {
        id: OperatorLabel.WITHIN_ALL,
        icon: ArrowDownBoldCircleOutlineIcon,
        label: defineMessage({
            id: 'admin.access_control.table_editor.operator.within_all',
            defaultMessage: 'is entirely within',
        }),
    },
    [OperatorLabel.WITHIN_ANY]: {
        id: OperatorLabel.WITHIN_ANY,
        icon: ArrowDownIcon,
        label: defineMessage({
            id: 'admin.access_control.table_editor.operator.within_any',
            defaultMessage: 'has any of or a child of',
        }),
    },
};

type MenuEntry = {
    descriptor: OperatorDescriptor;
    description?: MessageDescriptor;
    functionName?: string;
};

type MenuSection = {
    key: string;
    title?: MessageDescriptor;
    entries: MenuEntry[];
};

// The graph menu's groups, which also fix the order the graph operators appear
// in: the hierarchy predicates lead, paired by direction, with the
// exact-membership operators last because they ignore the hierarchy, which is
// the reason a graph attribute exists.
//
// The help text lives here rather than on the descriptors because "has any of"
// and "has all of" are shared with the multiselect menu, which stays a bare
// list of labels. Each description closes with the CEL function the operator
// maps to, so an admin who writes policy expressions by hand can connect the
// menu to what gets saved without the labels themselves naming a function.
const GRAPH_OPERATOR_GROUPS: Array<{
    key: string;
    title: MessageDescriptor;
    operators: Array<Required<Omit<MenuEntry, 'descriptor'>> & {id: OperatorLabel}>;
}> = [
    {
        key: 'graph-parents',
        title: defineMessage({
            id: 'admin.access_control.table_editor.operator.graph.group.parents',
            defaultMessage: 'Parents (any level)',
        }),
        operators: [
            {
                id: OperatorLabel.COVERS_ALL,
                functionName: 'Covers All',
                description: defineMessage({
                    id: 'admin.access_control.table_editor.operator.covers_all.description',
                    // eslint-disable-next-line formatjs/enforce-placeholders -- functionName provided by the menu item that renders it
                    defaultMessage: 'The user has each selected value, or a parent of it. {functionName}',
                }),
            },
            {
                id: OperatorLabel.COVERS_ANY,
                functionName: 'Covers Any',
                description: defineMessage({
                    id: 'admin.access_control.table_editor.operator.covers_any.description',
                    // eslint-disable-next-line formatjs/enforce-placeholders -- functionName provided by the menu item that renders it
                    defaultMessage: 'The user has at least one selected value, or a parent of it. {functionName}',
                }),
            },
        ],
    },
    {
        key: 'graph-children',
        title: defineMessage({
            id: 'admin.access_control.table_editor.operator.graph.group.children',
            defaultMessage: 'Children (any level)',
        }),
        operators: [
            {
                id: OperatorLabel.WITHIN_ALL,
                functionName: 'Within All',
                description: defineMessage({
                    id: 'admin.access_control.table_editor.operator.within_all.description',
                    // eslint-disable-next-line formatjs/enforce-placeholders -- functionName provided by the menu item that renders it
                    defaultMessage: 'The user has at least one value, and each is a selected value or a child of one. {functionName}',
                }),
            },
            {
                id: OperatorLabel.WITHIN_ANY,
                functionName: 'Within Any',
                description: defineMessage({
                    id: 'admin.access_control.table_editor.operator.within_any.description',
                    // eslint-disable-next-line formatjs/enforce-placeholders -- functionName provided by the menu item that renders it
                    defaultMessage: 'At least one value the user has is a selected value, or a child of one. {functionName}',
                }),
            },
        ],
    },
    {
        key: 'graph-exact',
        title: defineMessage({
            id: 'admin.access_control.table_editor.operator.graph.group.exact',
            defaultMessage: 'Exact match',
        }),
        operators: [
            {
                id: OperatorLabel.HAS_ANY_OF,
                functionName: 'Has Any Of',
                description: defineMessage({
                    id: 'admin.access_control.table_editor.operator.graph.has_any_of.description',
                    // eslint-disable-next-line formatjs/enforce-placeholders -- functionName provided by the menu item that renders it
                    defaultMessage: 'The user has at least one selected value. A parent or a child is not enough. {functionName}',
                }),
            },
            {
                id: OperatorLabel.HAS_ALL_OF,
                functionName: 'Has All Of',
                description: defineMessage({
                    id: 'admin.access_control.table_editor.operator.graph.has_all_of.description',
                    // eslint-disable-next-line formatjs/enforce-placeholders -- functionName provided by the menu item that renders it
                    defaultMessage: 'The user has every selected value. A parent or a child is not enough. {functionName}',
                }),
            },
        ],
    },
];

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
