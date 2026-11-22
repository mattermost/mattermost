// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ChangeEvent, ComponentType, KeyboardEvent, MouseEvent, ReactNode} from 'react';
import React, {useCallback, useEffect, useState, useSyncExternalStore} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

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

import {getIsMobileView} from 'selectors/views/browser';

import DisabledReasonTooltip from 'components/common/disabled_reason_tooltip';
import * as Menu from 'components/menu';

import './post_attributes_field_picker.scss';

type Props = {
    fields: PropertyField[];
    onSelect: (fieldId: string) => void;

    // The trigger's DOM id. The default is the modal's, which only ever has
    // one picker on screen; every other caller can have several (the
    // composer's two controls, and a composer per centre channel and thread
    // sidebar), so it passes its own.
    id?: string;

    // The scope of the picker's test ids: the trigger is `<scope>.add--button`, the menu `<scope>.add_menu` with its
    // fields `<scope>.add_menu.field:<id>--menuitem`, its search box `.search--textbox` and its empty note
    // `.no_results--menuitem`, and the tooltip wrapper of a blocked picker `<scope>.add_blocked--group`. Without a
    // scope the picker carries no ids.
    testIdScope?: string;

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

type PickerState = {
    fields: PropertyField[];
    search: string;
    onSelect: (fieldId: string) => void;
};

type PickerStore = {
    get: () => PickerState;
    set: (patch: Partial<PickerState>) => void;
    subscribe: (listener: () => void) => () => void;
};

/*
 * The picker's fields, search text and select handler, kept outside React state
 * so the menu's contents can read them wherever they are rendered. In mobile
 * view `Menu` opens a modal and copies the header and the items into the
 * modal's props once, when it opens: contents built from the picker's own
 * render would stay as they were then, so the search box could neither show
 * what is typed nor filter the list. Contents that subscribe here re-render
 * from the current state instead.
 */
function createPickerStore(initial: PickerState): PickerStore {
    let state = initial;
    const listeners = new Set<() => void>();

    return {
        get: () => state,
        set: (patch) => {
            state = {...state, ...patch};
            listeners.forEach((listener) => listener());
        },
        subscribe: (listener) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
    };
}

function hasSearchBox(fields: PropertyField[]): boolean {
    return fields.length >= SEARCH_THRESHOLD;
}

// The search is ignored without a search box, such as when fields drop below
// the threshold while the menu is open: a filter the user can no longer see or
// clear would hide fields for no visible reason.
function searchFields(fields: PropertyField[], search: string) {
    const searchable = hasSearchBox(fields);
    const term = searchable ? search.trim().toLowerCase() : '';
    const shown = term ? fields.filter((field) => matches(field, term)) : fields;

    return {searchable, term, shown};
}

type ContentIds = {
    id: string;
    testIdScope?: string;
};

// A click inside the search box is not a choice: in mobile view the modal
// closes on any click that reaches its list, the header included.
function keepMenuOpen(event: MouseEvent<HTMLDivElement>) {
    event.stopPropagation();
}

// In mobile view the search box renders inside the menu list, which takes
// typed letters as a jump to the item they start and cancels them, and moves
// focus on the arrow, Home and End keys. Only Escape and Tab, which close or
// leave the modal, go on to it.
function keepKeysInSearch(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Escape' && event.key !== 'Tab') {
        event.stopPropagation();
    }
}

type SearchBoxProps = ContentIds & {
    search: string;
    onSearch: (search: string) => void;

    // Whether the box renders inside the menu list, as the mobile view's
    // modal draws it, rather than above it.
    inList?: boolean;
};

function PickerSearchBox({search, onSearch, id, testIdScope, inList = false}: SearchBoxProps) {
    const {formatMessage} = useIntl();

    const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => onSearch(event.target.value), [onSearch]);

    // The search box sits above the list, outside its keyboard handling, so
    // ArrowDown moves into the list from here. Escape reaches the popover,
    // which closes the menu.
    const handleKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key !== 'ArrowDown') {
            return;
        }

        event.preventDefault();
        document.getElementById(`${id}Menu`)?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    }, [id]);

    const searchLabel = formatMessage({
        id: 'post_attributes.picker.search',
        defaultMessage: 'Search attributes',
        description: 'Placeholder and accessible name of the search box at the top of the menu that lists the attributes that can be added to a post. Filters the list as the user types.',
    });

    // The wrapper only stops clicks and keys from reaching the menu around
    // it; the search box inside is the control.
    return (
        <div
            role='presentation'
            className='PostAttributesFieldPicker__search'
            onClick={keepMenuOpen}
            onKeyDown={inList ? keepKeysInSearch : undefined}
        >
            <SearchInput
                size='small'

                // The user just opened the menu to find a field, and the menu
                // moves focus into itself anyway; with a search box, that
                // focus belongs here.
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus={true}
                value={search}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onClear={() => onSearch('')}
                data-testid={testIdScope ? `${testIdScope}.add_menu.search--textbox` : undefined}
                placeholder={searchLabel}
                aria-label={searchLabel}
            />
        </div>
    );
}

type LiveContentProps = ContentIds & {
    store: PickerStore;
};

/*
 * The search box and the list as the mobile view's modal renders them: both
 * read the store rather than props, which the modal holds as they were when it
 * opened.
 */
function LivePickerSearchBox({store, id, testIdScope}: LiveContentProps) {
    const {fields, search} = useSyncExternalStore(store.subscribe, store.get);
    const handleSearch = useCallback((value: string) => store.set({search: value}), [store]);

    // The modal unmounts when it closes, so the next opening starts from an
    // empty search, as the popover's does.
    useEffect(() => () => store.set({search: ''}), [store]);

    if (!hasSearchBox(fields)) {
        return null;
    }

    return (
        <PickerSearchBox
            search={search}
            onSearch={handleSearch}
            id={id}
            testIdScope={testIdScope}
            inList={true}
        />
    );
}

function LivePickerItems({store, id, testIdScope}: LiveContentProps) {
    const {fields, search, onSelect} = useSyncExternalStore(store.subscribe, store.get);

    const {searchable, term, shown} = searchFields(fields, search);

    return (
        <>
            {shown.map((field) => (
                <Menu.Item
                    key={field.id}
                    id={`postAttributeAdd-${field.id}`}
                    data-testid={testIdScope ? `${testIdScope}.add_menu.field:${field.id}--menuitem` : undefined}
                    leadingElement={<FieldTypeIcon type={field.type}/>}
                    labels={<span>{getPropertyFieldLabel(field)}</span>}
                    onClick={() => onSelect(field.id)}
                />
            ))}
            {searchable && term && shown.length === 0 && (
                <Menu.Item
                    key='noResults'
                    id={`${id}NoResults`}
                    data-testid={testIdScope ? `${testIdScope}.add_menu.no_results--menuitem` : undefined}
                    disabled={true}
                    labels={
                        <FormattedMessage
                            id='post_attributes.picker.no_results'
                            defaultMessage='No matching attributes'
                            description='Shown in the add attribute menu, under its search box, when the search text matches no attribute.'
                        />
                    }
                />
            )}
        </>
    );
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
export default function PostAttributesFieldPicker({fields, onSelect, id = 'postAttributesAdd', testIdScope, trigger, compact, disabledReason}: Props) {
    const {formatMessage} = useIntl();
    const isMobileView = useSelector(getIsMobileView);

    const [store] = useState(() => createPickerStore({fields, search: '', onSelect}));
    useEffect(() => store.set({fields, onSelect}), [store, fields, onSelect]);

    const {search} = useSyncExternalStore(store.subscribe, store.get);
    const setSearch = useCallback((value: string) => store.set({search: value}), [store]);
    const searchable = hasSearchBox(fields);

    // A fresh search each time the menu opens.
    const handleToggle = useCallback((open: boolean) => {
        if (!open) {
            setSearch('');
        }
    }, [setSearch]);

    // Inside the edit modal, the menu renders in the dialog: the modal takes
    // back any focus that leaves it, so a search box rendered in the page body
    // could never be typed into. Outside a dialog this finds nothing and the
    // menu renders in the body as usual. The same as `hierarchical_value_menu`.
    const getPopoverContainer = useCallback(() => document.getElementById(id)?.closest<HTMLElement>('[role="dialog"]') ?? null, [id]);

    const addLabel = (
        <FormattedMessage
            id='post_attributes.modal.add'
            defaultMessage='Add attribute'
            description='Button text (after a + icon), at the bottom of the post attributes modal and after the attribute chips in the message composer. It opens a menu listing the attributes that can be added to the post. Verb.'
        />
    );

    const ids = {id, testIdScope};

    // In mobile view the contents subscribe to the store, since the modal they
    // render in never sees this component re-render. The popover does, so its
    // items stay direct children of the menu list, which reads them to manage
    // focus.
    let searchBox;
    let items;
    if (isMobileView) {
        searchBox = (
            <LivePickerSearchBox
                store={store}
                {...ids}
            />
        );
        items = (
            <LivePickerItems
                store={store}
                {...ids}
            />
        );
    } else {
        searchBox = searchable ? (
            <PickerSearchBox
                search={search}
                onSearch={setSearch}
                {...ids}
            />
        ) : undefined;

        // An array of elements, not a fragment or a component: the menu list reads its children to manage focus.
        const {term, shown} = searchFields(fields, search);
        items = shown.map((field) => (
            <Menu.Item
                key={field.id}
                id={`postAttributeAdd-${field.id}`}
                data-testid={testIdScope ? `${testIdScope}.add_menu.field:${field.id}--menuitem` : undefined}
                leadingElement={<FieldTypeIcon type={field.type}/>}
                labels={<span>{getPropertyFieldLabel(field)}</span>}
                onClick={() => onSelect(field.id)}
            />
        ));
        if (searchable && term && shown.length === 0) {
            items.push(
                <Menu.Item
                    key='noResults'
                    id={`${id}NoResults`}
                    data-testid={testIdScope ? `${testIdScope}.add_menu.no_results--menuitem` : undefined}
                    disabled={true}
                    labels={
                        <FormattedMessage
                            id='post_attributes.picker.no_results'
                            defaultMessage='No matching attributes'
                            description='Shown in the add attribute menu, under its search box, when the search text matches no attribute.'
                        />
                    }
                />,
            );
        }
    }

    let Trigger: React.ComponentType<Menu.MenuButtonComponentProps> = ModalAddTrigger;
    let triggerClass: string | undefined = 'PostAttributesModal__add';
    if (trigger) {
        Trigger = IconTrigger;
        triggerClass = 'control';
    } else if (compact) {
        Trigger = ComposerAddTrigger;
        triggerClass = undefined;
    }

    const menu = (
        <Menu.Container
            menuButton={{
                id,
                testId: testIdScope ? `${testIdScope}.add` : undefined,
                as: Trigger,
                class: triggerClass,
                'aria-label': trigger?.label,
                children: trigger ? trigger.icon : addLabel,
                disabled: Boolean(disabledReason),
            }}
            menuButtonTooltip={trigger && !disabledReason ? {text: trigger.label} : undefined}
            menuHeader={searchBox}

            // An icon trigger sits in the composer's bottom action row, so the
            // menu opens upward, as the other menus in that row do.
            anchorOrigin={trigger ? UPWARD_ANCHOR : undefined}
            transformOrigin={trigger ? UPWARD_TRANSFORM : undefined}
            menu={{
                id: `${id}Menu`,
                testId: testIdScope ? `${testIdScope}.add_menu` : undefined,
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
                    description: 'Accessible label (screen readers only) of the menu, opened by the add attribute buttons in the post attributes modal and in the message composer, that lists attributes which can be added to the post.',
                }),
            }}
        >
            {items}
        </Menu.Container>
    );

    if (!disabledReason) {
        return menu;
    }

    return (
        <DisabledReasonTooltip
            reason={disabledReason}
            className='PostAttributesFieldPicker__blocked'
            data-testid={testIdScope ? `${testIdScope}.add_blocked--group` : undefined}
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
