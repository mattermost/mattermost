// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo, useCallback, useMemo, useState} from 'react';
import {useIntl} from 'react-intl';

import {CheckIcon} from '@mattermost/compass-icons/components';
import type {FieldType} from '@mattermost/types/properties';

import * as Menu from 'components/menu';
import PropertyTypeIcon from 'components/property_value_editor/type_icon';
import 'components/widgets/inputs/labeled_select.scss';

import './property_field_type_menu.scss';

const ALL_TYPES: FieldType[] = ['text', 'date', 'select', 'multiselect', 'user', 'multiuser'];

export type Props = {
    inputId: string;
    value: FieldType;
    onChange: (value: FieldType) => void;
    disabled?: boolean;
    'aria-label'?: string;
    /** When true, opens above the trigger (popover / footer contexts). */
    menuOpensUpward?: boolean;
};

function PropertyFieldTypeMenu({
    inputId,
    value,
    onChange,
    disabled,
    'aria-label': ariaLabelProp,
    menuOpensUpward = true,
}: Props) {
    const {formatMessage} = useIntl();
    const [menuOpen, setMenuOpen] = useState(false);
    const [menuWidth, setMenuWidth] = useState<string | undefined>();

    const typeLegend = formatMessage({id: 'new_property_form.type', defaultMessage: 'Type'});
    const resolvedAria = ariaLabelProp ?? typeLegend;

    const labelsByType = useMemo((): Record<FieldType, string> => ({
        text: formatMessage({id: 'new_property_form.type.text', defaultMessage: 'Text'}),
        date: formatMessage({id: 'new_property_form.type.date', defaultMessage: 'Date'}),
        select: formatMessage({id: 'new_property_form.type.select', defaultMessage: 'Select'}),
        multiselect: formatMessage({id: 'new_property_form.type.multiselect', defaultMessage: 'Multi-select'}),
        user: formatMessage({id: 'new_property_form.type.user', defaultMessage: 'User'}),
        multiuser: formatMessage({id: 'new_property_form.type.multiuser', defaultMessage: 'Multi-user'}),
    }), [formatMessage]);

    const selectedLabel = labelsByType[value] ?? labelsByType.text;
    const showLegend = menuOpen || Boolean(value);

    const handlePick = useCallback((next: FieldType) => {
        onChange(next);
    }, [onChange]);

    const handleMenuToggle = useCallback((next: boolean) => {
        setMenuOpen(next);
        if (next) {
            const trigger = document.getElementById(`${inputId}-trigger`);
            if (trigger) {
                setMenuWidth(`${trigger.offsetWidth}px`);
            }
        }
    }, [inputId]);

    const anchorOrigin = menuOpensUpward ?
        {vertical: 'top' as const, horizontal: 'left' as const} :
        {vertical: 'bottom' as const, horizontal: 'left' as const};
    const transformOrigin = menuOpensUpward ?
        {vertical: 'bottom' as const, horizontal: 'left' as const} :
        {vertical: 'top' as const, horizontal: 'left' as const};

    return (
        <div className={classNames('PropertyFieldTypeMenu', 'Input_container', {disabled: Boolean(disabled)})}>
            <Menu.Container
                menuButton={{
                    id: `${inputId}-trigger`,
                    as: 'div',
                    class: classNames(
                        'style--none',
                        'Input_fieldset',
                        'PropertyFieldTypeMenu__trigger',
                        {
                            Input_fieldset___legend: showLegend,
                            'PropertyFieldTypeMenu__fieldset--open': menuOpen,
                        },
                    ),
                    disabled,
                    'aria-label': resolvedAria,
                    children: (
                        <>
                            <span
                                className={classNames('Input_legend', {Input_legend___focus: showLegend})}
                            >
                                {showLegend ? typeLegend : null}
                            </span>
                            <div className='Input_wrapper'>
                                <div className='PropertyFieldTypeMenu__menu-button'>
                                    <span className='LabeledSelect__single-value-row'>
                                        <span className='LabeledSelect__option-icon'>
                                            <PropertyTypeIcon type={value}/>
                                        </span>
                                        <span className='LabeledSelect__option-label'>
                                            {selectedLabel}
                                        </span>
                                    </span>
                                    <span className='PropertyFieldTypeMenu__indicators'>
                                        <i
                                            className='icon icon-chevron-down'
                                            aria-hidden={true}
                                        />
                                    </span>
                                </div>
                            </div>
                        </>
                    ),
                }}
                menu={{
                    id: `${inputId}-menu`,
                    'aria-label': resolvedAria,
                    className: 'property-field-type-menu__menu-list',
                    width: menuWidth,
                    onToggle: handleMenuToggle,
                }}
                anchorOrigin={anchorOrigin}
                transformOrigin={transformOrigin}
            >
                {ALL_TYPES.map((t) => {
                    const selected = t === value;
                    return (
                        <Menu.Item
                            key={t}
                            id={`${inputId}-type-${t}`}
                            role='menuitemradio'
                            aria-checked={selected}
                            forceCloseOnSelect={true}
                            leadingElement={(
                                <span className='post-property-picker__row-icon'>
                                    <PropertyTypeIcon type={t}/>
                                </span>
                            )}
                            labels={<span>{labelsByType[t]}</span>}
                            trailingElements={selected ? <CheckIcon size={16}/> : undefined}
                            onClick={() => handlePick(t)}
                        />
                    );
                })}
            </Menu.Container>
        </div>
    );
}

export default memo(PropertyFieldTypeMenu);
