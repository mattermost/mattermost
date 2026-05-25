// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {CheckIcon} from '@mattermost/compass-icons/components';
import type {FieldType, PropertyField} from '@mattermost/types/properties';

import {patchChannelPostPropertyField} from 'mattermost-redux/actions/properties';

import PropertyTypeIcon from 'components/property_value_editor/type_icon';
import Input from 'components/widgets/inputs/input/input';
import LabeledSelect from 'components/widgets/inputs/labeled_select';
import type {LabeledSelectOption} from 'components/widgets/inputs/labeled_select';

import type {DispatchFunc} from 'types/store';

type Props = {
    field: PropertyField;
    onExit: () => void;
};

export default function EditPropertyRow({field, onExit}: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch<DispatchFunc>();
    const rowRef = useRef<HTMLLIElement>(null);

    const [draftName, setDraftName] = useState(field.name);
    const [draftType, setDraftType] = useState<FieldType>(field.type);

    const typeOptions = useMemo<Array<LabeledSelectOption<FieldType>>>(() => [
        {value: 'text', label: formatMessage({id: 'new_property_form.type.text', defaultMessage: 'Text'}), icon: <PropertyTypeIcon type='text'/>},
        {value: 'date', label: formatMessage({id: 'new_property_form.type.date', defaultMessage: 'Date'}), icon: <PropertyTypeIcon type='date'/>},
        {value: 'select', label: formatMessage({id: 'new_property_form.type.select', defaultMessage: 'Select'}), icon: <PropertyTypeIcon type='select'/>},
        {value: 'multiselect', label: formatMessage({id: 'new_property_form.type.multiselect', defaultMessage: 'Multi-select'}), icon: <PropertyTypeIcon type='multiselect'/>},
        {value: 'user', label: formatMessage({id: 'new_property_form.type.user', defaultMessage: 'User'}), icon: <PropertyTypeIcon type='user'/>},
        {value: 'multiuser', label: formatMessage({id: 'new_property_form.type.multiuser', defaultMessage: 'Multi-user'}), icon: <PropertyTypeIcon type='multiuser'/>},
    ], [formatMessage]);

    const selectedTypeOption = typeOptions.find((o) => o.value === draftType) ?? typeOptions[0];

    const trimmedName = draftName.trim();
    const nameValid = trimmedName.length > 0;
    const dirty = trimmedName !== field.name || draftType !== field.type;

    const handleSave = useCallback((e?: React.SyntheticEvent) => {
        e?.stopPropagation();
        if (!nameValid) {
            onExit();
            return;
        }
        if (dirty) {
            const patch: {name?: string; type?: FieldType} = {};
            if (trimmedName !== field.name) {
                patch.name = trimmedName;
            }
            if (draftType !== field.type) {
                patch.type = draftType;
            }
            dispatch(patchChannelPostPropertyField(field.id, patch));
        }
        onExit();
    }, [dirty, nameValid, trimmedName, draftType, field.id, field.name, field.type, dispatch, onExit]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const target = e.target as Node | null;
            if (!target) {
                return;
            }
            if (rowRef.current?.contains(target)) {
                return;
            }

            // Allow clicks inside the LabeledSelect's portaled dropdown.
            const el = target as HTMLElement;
            if (el.closest?.('.LabeledSelect__menu, .LabeledSelect__menu-portal')) {
                return;
            }
            onExit();
        };
        document.addEventListener('mousedown', handler, true);
        return () => document.removeEventListener('mousedown', handler, true);
    }, [onExit]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            e.stopPropagation();
            onExit();
            return;
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            handleSave();
            return;
        }

        // Prevent MUI MenuList from intercepting typing keys.
        e.stopPropagation();
    }, [onExit, handleSave]);

    const handleTypeChange = useCallback((next: LabeledSelectOption<FieldType> | Array<LabeledSelectOption<FieldType>> | null) => {
        if (!next || Array.isArray(next)) {
            return;
        }
        setDraftType(next.value);
    }, []);

    return (
        <li
            ref={rowRef}
            className='post-property-picker__edit-row'
            onKeyDown={handleKeyDown}
            onKeyUp={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
        >
            <span className='post-property-picker__edit-row-icon'>
                <PropertyTypeIcon type={draftType}/>
            </span>
            <div className='post-property-picker__edit-row-name'>
                <Input
                    type='text'
                    useLegend={false}
                    value={draftName}
                    aria-label={formatMessage({id: 'post_property_picker.edit_name_aria', defaultMessage: 'Property name'})}
                    onChange={(e) => setDraftName(e.target.value)}
                    autoFocus={true}
                />
            </div>
            <div className='post-property-picker__edit-row-type'>
                <LabeledSelect<FieldType>
                    inputId={`post-property-picker-edit-type-${field.id}`}
                    aria-label={formatMessage({id: 'post_property_picker.edit_type_aria', defaultMessage: 'Property type'})}
                    value={selectedTypeOption}
                    options={typeOptions}
                    onChange={handleTypeChange}
                    isSearchable={false}
                    menuPortalTarget={typeof document === 'undefined' ? null : document.body}
                />
            </div>
            <button
                type='button'
                className='post-property-picker__edit-row-action'
                aria-label={formatMessage({id: 'post_property_picker.save_edit_aria', defaultMessage: 'Save changes'})}
                onClick={handleSave}
            >
                <CheckIcon size={16}/>
            </button>
        </li>
    );
}
