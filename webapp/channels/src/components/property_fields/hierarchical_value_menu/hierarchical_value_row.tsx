// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * One occurrence row in the hierarchical value menu.
 *
 * This file exists as a file, rather than as a section of
 * `hierarchical_value_menu.tsx`, because three separate subtleties live here and
 * a file boundary is a more durable place to record them than a comment in the
 * middle of a long component:
 *
 * 1. **The MUI keyboard contract.** See `isKeydownSynthesisedClick` below. The
 *    row deliberately replaces `Menu.Item`'s internal keydown handling and owns
 *    the whole keyboard path, and that only works because of prop-spread order
 *    inside `menu_item.tsx`.
 * 2. **The hit split.** On a branch, the checkbox selects and *everything else*
 *    -- name, hint, count, chevron, the row's own padding -- expands. A leaf and
 *    a search row have nothing to expand, so they select wherever clicked. The
 *    polarity is the prototype's, and the stylesheet widens the checkbox to fill
 *    MUI's `.leading-element` slot so the select target is the whole column
 *    rather than the glyph.
 * 3. **The props-spread requirement.** MUI's `MenuList` clones whichever child is
 *    the active item and injects props into it, so this row must forward its rest
 *    props to `Menu.Item` or arrow navigation stops working.
 *
 * The row holds no state. All of the menu's state lives in
 * `HierarchicalValueMenu`, which is why the container was not split further.
 */

import type {MenuItemProps as MuiMenuItemProps} from '@mui/material/MenuItem';
import classNames from 'classnames';
import React from 'react';
import {defineMessages, useIntl} from 'react-intl';

import {
    CheckboxBlankOutlineIcon,
    CheckboxMarkedIcon,
    ChevronDownIcon,
    ChevronRightIcon,
} from '@mattermost/compass-icons/components';

import * as Menu from 'components/menu';

const messages = defineMessages({
    nInside: {
        id: 'property_fields.hierarchical_value_menu.n_inside',
        defaultMessage: '{count} inside',
    },
});

const ROW_BASE_INSET = 20;
const ROW_DEPTH_INSET = 16;

/**
 * Every `Menu.Item` that takes both `onKeyDown` and `onClick` has to call this
 * from its click handler. The reason is a two-part contract with `Menu.Item` and
 * MUI's `ButtonBase`:
 *
 * 1. `menu_item.tsx` destructures `onClick` and composes it into its own
 *    handler, but leaves `onKeyDown` in `otherProps`, which it spreads *last*
 *    (`menu_item.tsx:222`). A caller-supplied `onKeyDown` therefore **replaces**
 *    `Menu.Item`'s internal keydown handling rather than adding to it. That is
 *    what lets this row own Enter, Space, both arrows and typeahead -- and it is
 *    what makes the `stopPropagation()` pre-emption of MUI `MenuList`'s own
 *    typeahead possible. A prop-order change in `menu_item.tsx` would silently
 *    take all of that away: selection would keep working by accident, while
 *    `stopPropagation` stopped happening and MUI's row typeahead came back.
 * 2. Having called our `onKeyDown`, `ButtonBase` then synthesises a **click**
 *    from the same Enter keydown (`ButtonBase.js:210-232`), and
 *    `isCorrectKeyPressedOnMenuItem` accepts a keydown, so the composed click
 *    handler runs for a keystroke we have already handled. Without this guard
 *    Enter acts twice: on a leaf it fires `onSelectedIdsChange` twice, and on a
 *    branch it both selects and expands. Locked by `Enter toggles the focused
 *    row exactly once` and `Enter on a branch row selects without expanding`.
 *
 * Space is not affected and the guard is deliberately not widened to it:
 * `ButtonBase` synthesises Space's click on *keyup*, which
 * `isCorrectKeyPressedOnMenuItem` rejects for being neither a keydown nor a
 * click.
 *
 * `menu_item.tsx`'s own `lastHandledEventRef` dedupe looks like it covers this
 * and does not: because we replaced its keydown handler, it only ever sees one
 * invocation, so it never triggers.
 */
export const isKeydownSynthesisedClick = (event: React.SyntheticEvent) => event.type === 'keydown';

// MUI's MenuList clones whichever child is the active item, injecting exactly
// these two props (MenuList.js:205-215). They have to reach Menu.Item for arrow
// navigation to work, so the row spreads its rest props. Deliberately narrower
// than `Record<string, unknown>`, which would also accept a typo'd prop name and
// spread it onto the <li> as a stray DOM attribute.
type ForwardedMuiItemProps = Partial<Pick<MuiMenuItemProps, 'tabIndex' | 'autoFocus'>>;

export type HierarchicalValueRowProps = {
    rowId: string;
    label: string;
    hint: string | null;
    depth: number;
    isBranch: boolean;
    isExpanded: boolean;
    isSelected: boolean;
    insideCount: number;
    isFirstRow: boolean;
    onToggleSelect: () => void;
    onToggleExpand: () => void;
    onFocusSearch: (seedChar: string) => void;
    innerRef: (element: HTMLLIElement | null) => void;
} & ForwardedMuiItemProps;

export default function HierarchicalValueRow({
    rowId,
    label,
    hint,
    depth,
    isBranch,
    isExpanded,
    isSelected,
    insideCount,
    isFirstRow,
    onToggleSelect,
    onToggleExpand,
    onFocusSearch,
    innerRef,
    ...rest
}: HierarchicalValueRowProps) {
    const {formatMessage} = useIntl();
    const showInsideCount = isBranch && !isExpanded && insideCount > 0;
    const insideCountId = `${rowId}-inside`;

    // The hit split, prototype polarity: the checkbox selects, and on a branch
    // everything else -- name, hint, count, chevron, and the row's own padding --
    // expands. A leaf and a search row have nothing to expand, so they select
    // wherever they are clicked.
    const activate = (event: React.MouseEvent<HTMLLIElement> | React.KeyboardEvent<HTMLLIElement>) => {
        // The keyboard path belongs to handleKeyDown below. See
        // isKeydownSynthesisedClick: without this the row acts twice per Enter.
        if (isKeydownSynthesisedClick(event)) {
            return;
        }

        const target = event.target as HTMLElement | null;
        if (isBranch && !target?.closest('[data-hit="select"]')) {
            onToggleExpand();
            return;
        }

        onToggleSelect();
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLLIElement>) => {
        // Space and Enter select on a branch as much as on a leaf: the row is a
        // menuitemcheckbox and its activation is its checkbox.
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            onToggleSelect();
            return;
        }

        if (event.key === 'ArrowRight') {
            if (isBranch && !isExpanded) {
                event.preventDefault();
                event.stopPropagation();
                onToggleExpand();
            }
            return;
        }

        if (event.key === 'ArrowLeft') {
            if (isBranch && isExpanded) {
                event.preventDefault();
                event.stopPropagation();
                onToggleExpand();
            }
            return;
        }

        if (event.key === 'ArrowUp' && isFirstRow) {
            event.preventDefault();
            event.stopPropagation();
            onFocusSearch('');
            return;
        }

        // A printable key belongs to the search box. Stopping propagation is also
        // what pre-empts MUI MenuList's own typeahead, which would otherwise move
        // focus between rows by label text.
        if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
            event.preventDefault();
            event.stopPropagation();
            onFocusSearch(event.key);
        }

        // ArrowDown, ArrowUp on a later row, Home, End, Escape and Tab all fall
        // through to MUI's MenuList and to the Popover.
    };

    return (
        <Menu.Item
            id={rowId}
            ref={innerRef}
            role='menuitemcheckbox'
            forceCloseOnSelect={false}
            aria-checked={isSelected}
            aria-expanded={isBranch ? isExpanded : undefined}

            // Pins the accessible name to the label alone, so neither the hint
            // line nor the "{n} inside" count can leak into it.
            aria-label={label}
            aria-describedby={showInsideCount ? insideCountId : undefined}
            className={classNames('hierarchical-value-menu__row', {
                'hierarchical-value-menu__row--selected': isSelected,
            })}
            style={{paddingInlineStart: `${ROW_BASE_INSET + ((depth - 1) * ROW_DEPTH_INSET)}px`}}
            onClick={activate}

            // This *replaces* Menu.Item's own keydown handling rather than adding
            // to it, so this row owns the whole keyboard path -- and `activate`
            // has to ignore keydown-sourced clicks as the other half of the
            // bargain. Both halves are explained on isKeydownSynthesisedClick.
            onKeyDown={handleKeyDown}
            leadingElement={
                <span
                    className='hierarchical-value-menu__checkbox'
                    data-hit='select'
                    aria-hidden={true}
                >
                    {isSelected ? <CheckboxMarkedIcon size={16}/> : <CheckboxBlankOutlineIcon size={16}/>}
                </span>
            }
            labels={
                <span className='hierarchical-value-menu__labels'>
                    <span className='hierarchical-value-menu__label'>{label}</span>
                    {hint ? <span className='hierarchical-value-menu__hint'>{hint}</span> : null}
                </span>
            }
            trailingElements={
                <span className='hierarchical-value-menu__trailing'>
                    {showInsideCount ? (
                        <span
                            className='hierarchical-value-menu__count'
                            id={insideCountId}
                        >
                            {formatMessage(messages.nInside, {count: insideCount})}
                        </span>
                    ) : null}
                    {isBranch ? (
                        <span
                            className='hierarchical-value-menu__chevron'
                            aria-hidden={true}
                        >
                            {isExpanded ? <ChevronDownIcon size={16}/> : <ChevronRightIcon size={16}/>}
                        </span>
                    ) : null}
                </span>
            }
            {...rest}
        />
    );
}
