// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

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
 * Menu.Item spreads caller onKeyDown last, replacing its own handler. ButtonBase
 * then synthesises a click from the same Enter keydown, so onClick must ignore
 * event.type === 'keydown' or Enter fires twice (select + expand on a branch).
 */
export const isKeydownSynthesisedClick = (event: React.SyntheticEvent) => event.type === 'keydown';

// MenuList clones the active child and injects these; they must reach Menu.Item.
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

    const activate = (event: React.MouseEvent<HTMLLIElement> | React.KeyboardEvent<HTMLLIElement>) => {
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

        // Stop MenuList typeahead so the character goes to search instead.
        if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
            event.preventDefault();
            event.stopPropagation();
            onFocusSearch(event.key);
        }
    };

    return (
        <Menu.Item
            id={rowId}
            ref={innerRef}
            role='menuitemcheckbox'
            forceCloseOnSelect={false}
            aria-checked={isSelected}
            aria-expanded={isBranch ? isExpanded : undefined}
            aria-label={label}
            aria-describedby={showInsideCount ? insideCountId : undefined}
            className={classNames('hierarchical-value-menu__row', {
                'hierarchical-value-menu__row--selected': isSelected,
            })}
            style={{paddingInlineStart: `${ROW_BASE_INSET + ((depth - 1) * ROW_DEPTH_INSET)}px`}}
            onClick={activate}
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
