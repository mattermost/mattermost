// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentType, JSX} from 'react';
import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {FormattedMessage} from 'react-intl';

import type IconProps from '@mattermost/compass-icons/components/props';

import * as Menu from 'components/menu';

import './attribute_select.scss';

export type AttributeSelectOption<T extends string> = {
    id: T;
    icon: ComponentType<IconProps>;
    label: MessageDescriptor;
};

type Props<T extends string> = {

    // Button id is `${idPrefix}-menu-button`, menu id `${idPrefix}-menu` and
    // each option's id `${idPrefix}-${option.id}`.
    idPrefix: string;
    dataTestId: string;

    // What the trigger shows. Kept separate from `options` because a value can
    // outlive its menu entry -- an attribute whose type is hidden from, or no
    // longer offered by, the picker still has to name that type.
    selected: AttributeSelectOption<T>;

    // Menu contents. Omitted by a `locked` select, which has no menu.
    options?: Array<AttributeSelectOption<T>>;
    ariaLabel: string;

    // Names the popup itself. Unused by a `locked` select, which has none.
    menuAriaLabel?: string;
    onChange?: (id: T) => void;

    // Transiently unavailable (saving, no write permission): still a menu
    // trigger, just not pressable right now, so the chevron stays.
    disabled?: boolean;

    // The value can never change here. Renders a plain disabled button with no
    // chevron and no menu at all, rather than a trigger that could never open.
    locked?: boolean;
};

// The single-select control the attribute detail page uses for Type and for
// the Users row's Managed-by indicator. Callers own the tooltip that explains
// a `locked` state.
function AttributeSelect<T extends string>({
    idPrefix,
    dataTestId,
    selected,
    options = [],
    ariaLabel,
    menuAriaLabel,
    onChange,
    disabled = false,
    locked = false,
}: Props<T>): JSX.Element {
    const SelectedIcon = selected.icon;
    const buttonId = `${idPrefix}-menu-button`;

    const value = (
        <span className='AttributeSelect__value'>
            <SelectedIcon size={18}/>
            <FormattedMessage {...selected.label}/>
        </span>
    );

    if (locked) {
        return (
            <button
                type='button'
                id={buttonId}
                className='AttributeSelect'
                disabled={true}
                aria-label={ariaLabel}
                data-testid={dataTestId}
            >
                {value}
            </button>
        );
    }

    return (
        <Menu.Container
            menuButton={{
                id: buttonId,
                class: 'AttributeSelect',
                disabled,
                'aria-label': ariaLabel,
                children: (
                    <>
                        {value}
                        <i className='icon icon-chevron-down'/>
                    </>
                ),
                dataTestId,
            }}
            menu={{
                id: `${idPrefix}-menu`,
                'aria-label': menuAriaLabel,
            }}
        >
            {options.map((option) => {
                const OptionIcon = option.icon;

                return (
                    <Menu.Item
                        id={`${idPrefix}-${option.id}`}
                        key={option.id}
                        role='menuitemradio'
                        forceCloseOnSelect={true}
                        aria-checked={option.id === selected.id}
                        onClick={() => onChange?.(option.id)}
                        leadingElement={<OptionIcon size={18}/>}
                        labels={<FormattedMessage {...option.label}/>}
                    />
                );
            })}
        </Menu.Container>
    );
}

export default AttributeSelect;
