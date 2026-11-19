// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ChangeEvent, ComponentType, KeyboardEvent, ReactNode} from 'react';
import React, {useCallback, useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {
    AccountMultipleOutlineIcon,
    AccountOutlineIcon,
    FormatListBulletedIcon,
    FormatListNumberedIcon,
    MenuDownIcon,
    MenuVariantIcon,
    PlusIcon,
} from '@mattermost/compass-icons/components';
import type IconProps from '@mattermost/compass-icons/components/props';
import {Button} from '@mattermost/compass-ui/components/button';
import {Icon} from '@mattermost/compass-ui/components/icon';
import {SearchInput} from '@mattermost/compass-ui/components/search-input';
import type {FieldType, PropertyField} from '@mattermost/types/properties';

import {getPropertyFieldLabel} from 'mattermost-redux/utils/property_utils';

import DisabledReasonTooltip from 'components/common/disabled_reason_tooltip';
import * as Menu from 'components/menu';

import './post_attributes_field_picker.scss';

type Props = {
    fields: PropertyField[];
    onSelect: (fieldId: string) => void;

    // The trigger's DOM id and test id. The defaults are the modal's, which
    // only ever has one picker on screen; every other caller can have several
    // (the composer's two controls, and a composer per centre channel and
    // thread sidebar), so it passes its own.
    id?: string;
    dataTestId?: string;

    // Replaces the labelled `+ Add attribute` button with an icon button, such
    // as the composer's `+`. The label is the button's accessible name and its
    // tooltip, and the menu opens upward from it.
    trigger?: {
        icon: ReactNode;
        label: string;
    };

    // Draws the labelled `+ Add attribute` at the composer's chip row size
    // (`x-small`, 24px) rather than the modal's (`small` compact, 28px).
    compact?: boolean;

    // Why no attribute can be added right now, such as the message being
    // burn-on-read. Disables the trigger and replaces its tooltip with the
    // reason.
    disabledReason?: string;
};

const IconTrigger = Menu.createMenuIconButtonTrigger({size: 'small'});

/*
 * `+ Add attribute` as a Compass `Button` with a plus, passed to the menu as
 * its trigger, built the way `createMenuIconButtonTrigger` builds an
 * `IconButton` one. The triggers are made at module scope so their identity is
 * stable across renders.
 */
function createAddTrigger(look: Pick<React.ComponentProps<typeof Button>, 'emphasis' | 'size' | 'compact'>) {
    return function AddTrigger({children, className, ...props}: Menu.MenuButtonComponentProps) {
        return (
            <Button
                {...props}
                {...look}
                className={className || undefined}
                leadingIcon={<Icon glyph={<PlusIcon/>}/>}
            >
                {children}
            </Button>
        );
    };
}

const ComposerAddTrigger = createAddTrigger({emphasis: 'dim', size: 'x-small'});
const ModalAddTrigger = createAddTrigger({emphasis: 'dim', size: 'small', compact: true});

// From this many fields up, the menu gets a search box: below it, the whole
// list fits without scrolling.
export const SEARCH_THRESHOLD = 5;

// Where the menu meets the action row's `+`: 4px clear of it, measured (the
// popover's own placement already overlaps the trigger by 4px), and
// right-aligned with it, since the `+` sits in the row's right-hand cluster
// and a 300px menu left-aligned to it would run off the window.
const UPWARD_ANCHOR = {vertical: -8, horizontal: 'right'} as const;
const UPWARD_TRANSFORM = {vertical: 'bottom', horizontal: 'right'} as const;

function matches(field: PropertyField, term: string): boolean {
    return getPropertyFieldLabel(field).toLowerCase().includes(term) || field.name.toLowerCase().includes(term);
}

/**
 * The `+ Add attribute` control and the menu behind it: the fields the channel
 * declares that this modal is not already showing.
 *
 * The candidate list arrives already filtered and already ordered — nothing is
 * decided here. In particular this does not re-sort: the rows and the menu read
 * in the same order, which is the channel's field order, so a field found in one
 * is where the other left it.
 */
export default function PostAttributesFieldPicker({fields, onSelect, id = 'postAttributesAdd', dataTestId = 'post-attributes-add', trigger, compact, disabledReason}: Props) {
    const {formatMessage} = useIntl();

    const searchable = fields.length >= SEARCH_THRESHOLD;
    const [search, setSearch] = useState('');
    const term = search.trim().toLowerCase();
    const shown = useMemo(() => (term ? fields.filter((field) => matches(field, term)) : fields), [fields, term]);

    // A fresh search each time the menu opens.
    const handleToggle = useCallback((open: boolean) => {
        if (!open) {
            setSearch('');
        }
    }, []);

    const handleSearchChange = useCallback((event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value), []);

    // The search box sits above the list, outside its keyboard handling, so
    // ArrowDown moves into the list from here. Escape reaches the popover,
    // which closes the menu.
    const handleSearchKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key !== 'ArrowDown') {
            return;
        }

        event.preventDefault();
        document.getElementById(`${id}Menu`)?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    }, [id]);

    // Inside the edit modal, the menu renders in the dialog: the modal takes
    // back any focus that leaves it, so a search box rendered in the page body
    // could never be typed into. Outside a dialog this finds nothing and the
    // menu renders in the body as usual. The same as `hierarchical_value_menu`.
    const getPopoverContainer = useCallback(() => document.getElementById(id)?.closest<HTMLElement>('[role="dialog"]') ?? null, [id]);

    const searchLabel = formatMessage({
        id: 'post_attributes.picker.search',
        defaultMessage: 'Search attributes',
        description: 'Placeholder and accessible name of the search box at the top of the menu that lists the attributes that can be added to a post. Filters the list as the user types.',
    });

    const addLabel = (
        <FormattedMessage
            id='post_attributes.modal.add'
            defaultMessage='Add attribute'
            description='Button text (after a + icon) at the bottom of the post attributes modal. It opens a menu listing the attributes that can be added to the post. Verb.'
        />
    );

    let menuButton;
    if (trigger) {
        menuButton = {
            id,
            dataTestId,
            as: IconTrigger,
            class: 'control',
            'aria-label': trigger.label,
            children: trigger.icon,
        };
    } else if (compact) {
        menuButton = {
            id,
            dataTestId,
            as: ComposerAddTrigger,
            children: addLabel,
        };
    } else {
        menuButton = {
            id,
            dataTestId,
            as: ModalAddTrigger,
            class: 'PostAttributesModal__add',
            children: addLabel,
        };
    }

    const searchBox = searchable ? (
        <div className='PostAttributesFieldPicker__search'>
            <SearchInput
                size='small'

                // The user just opened the menu to find a field, and the menu
                // moves focus into itself anyway; with a search box, that
                // focus belongs here.
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus={true}
                value={search}
                onChange={handleSearchChange}
                onKeyDown={handleSearchKeyDown}
                onClear={() => setSearch('')}
                data-testid={`${dataTestId}-search`}
                placeholder={searchLabel}
                aria-label={searchLabel}
            />
        </div>
    ) : undefined;

    const menu = (
        <Menu.Container
            menuButton={{...menuButton, disabled: Boolean(disabledReason)}}
            menuButtonTooltip={trigger && !disabledReason ? {text: trigger.label} : undefined}
            menuHeader={searchBox}

            // An icon trigger sits in the composer's bottom action row, so the
            // menu opens upward, as the other menus in that row do.
            anchorOrigin={trigger ? UPWARD_ANCHOR : undefined}
            transformOrigin={trigger ? UPWARD_TRANSFORM : undefined}
            menu={{
                id: `${id}Menu`,
                className: 'PostAttributesFieldPicker__menu',
                width: '300px',

                // With a search box, focus starts there rather than on the
                // first field.
                autoFocusItem: !searchable,
                onToggle: handleToggle,
                container: getPopoverContainer,
                'aria-label': formatMessage({
                    id: 'post_attributes.modal.picker.label',
                    defaultMessage: 'Add an attribute',
                    description: 'Accessible label (screen readers only) of the menu, opened by the add attribute button in the post attributes modal, that lists attributes which can be added to the post.',
                }),
            }}
        >
            {shown.map((field) => (
                <Menu.Item
                    key={field.id}
                    id={`postAttributeAdd-${field.id}`}
                    data-testid={`post-attribute-add-${field.name}`}
                    leadingElement={<FieldTypeIcon type={field.type}/>}
                    labels={<span>{getPropertyFieldLabel(field)}</span>}
                    onClick={() => onSelect(field.id)}
                />
            ))}
        </Menu.Container>
    );

    if (!disabledReason) {
        return menu;
    }

    return (
        <DisabledReasonTooltip
            reason={disabledReason}
            className='PostAttributesFieldPicker__blocked'
            data-testid={`${dataTestId}-blocked`}
        >
            {menu}
        </DisabledReasonTooltip>
    );
}

/*
 * One icon per field type, so the menu says what shape of control the row will
 * arrive with.
 */
const TYPE_ICONS: Partial<Record<FieldType, ComponentType<IconProps>>> = {
    select: MenuDownIcon,
    multiselect: FormatListBulletedIcon,
    rank: FormatListNumberedIcon,
    text: MenuVariantIcon,
    user: AccountOutlineIcon,
    multiuser: AccountMultipleOutlineIcon,
};

function FieldTypeIcon({type}: {type: FieldType}) {
    const Icon = TYPE_ICONS[type];

    /*
     * A type with no icon draws nothing rather than a stand-in: the entry is
     * already labelled, and a generic glyph on one of six reads as a type of
     * its own.
     */
    return Icon ? <Icon size={18}/> : null;
}
