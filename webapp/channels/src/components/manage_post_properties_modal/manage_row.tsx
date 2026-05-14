// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {
    CheckIcon,
    CloseIcon,
    PencilOutlineIcon,
    TrashCanOutlineIcon,
} from '@mattermost/compass-icons/components';
import type {FieldType, PropertyField, PropertyFieldOption} from '@mattermost/types/properties';

import {patchChannelPostPropertyField} from 'mattermost-redux/actions/properties';

import PropertyTypeIcon from 'components/property_value_editor/type_icon';
import Input from 'components/widgets/inputs/input/input';
import LabeledSelect from 'components/widgets/inputs/labeled_select';
import type {LabeledSelectOption} from 'components/widgets/inputs/labeled_select';
import Tag from 'components/widgets/tag/tag';

import type {DispatchFunc} from 'types/store';

type Props = {
    field: PropertyField;
    onDeleteRequest: (fieldId: string) => void;
};

const TYPES_WITH_OPTIONS: FieldType[] = ['select', 'multiselect'];

function generateOptionId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `opt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getFieldOptions(field: PropertyField): PropertyFieldOption[] {
    return (field.attrs?.options as PropertyFieldOption[] | undefined) ?? [];
}

function optionsEqual(a: PropertyFieldOption[], b: PropertyFieldOption[]): boolean {
    if (a.length !== b.length) {
        return false;
    }
    for (let i = 0; i < a.length; i++) {
        if (a[i].id !== b[i].id || a[i].name !== b[i].name) {
            return false;
        }
    }
    return true;
}

export default function ManageRow({field, onDeleteRequest}: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch<DispatchFunc>();

    const [editing, setEditing] = useState(false);
    const [draftName, setDraftName] = useState(field.name);
    const [draftType, setDraftType] = useState<FieldType>(field.type);
    const initialOptions = useMemo(() => getFieldOptions(field), [field]);
    const [draftOptions, setDraftOptions] = useState<PropertyFieldOption[]>(initialOptions);

    const typeOptions = useMemo<Array<LabeledSelectOption<FieldType>>>(() => [
        {value: 'text', label: formatMessage({id: 'new_property_form.type.text', defaultMessage: 'Text'}), icon: <PropertyTypeIcon type='text'/>},
        {value: 'date', label: formatMessage({id: 'new_property_form.type.date', defaultMessage: 'Date'}), icon: <PropertyTypeIcon type='date'/>},
        {value: 'select', label: formatMessage({id: 'new_property_form.type.select', defaultMessage: 'Select'}), icon: <PropertyTypeIcon type='select'/>},
        {value: 'multiselect', label: formatMessage({id: 'new_property_form.type.multiselect', defaultMessage: 'Multi-select'}), icon: <PropertyTypeIcon type='multiselect'/>},
        {value: 'user', label: formatMessage({id: 'new_property_form.type.user', defaultMessage: 'User'}), icon: <PropertyTypeIcon type='user'/>},
    ], [formatMessage]);

    const readModeTypeLabel = (typeOptions.find((o) => o.value === field.type) ?? typeOptions[0]).label;

    const fieldOptions = getFieldOptions(field);

    const enterEdit = () => {
        // Capture drafts from the current field state.
        setDraftName(field.name);
        setDraftType(field.type);
        setDraftOptions(getFieldOptions(field));
        setEditing(true);
    };

    const exitEdit = () => {
        setEditing(false);
    };

    const handleCancel = () => {
        setDraftName(field.name);
        setDraftType(field.type);
        setDraftOptions(getFieldOptions(field));
        exitEdit();
    };

    const handleTypeChange = (next: LabeledSelectOption<FieldType> | Array<LabeledSelectOption<FieldType>> | null) => {
        if (!next || Array.isArray(next)) {
            return;
        }
        const nextType = next.value;
        const wantsOptions = TYPES_WITH_OPTIONS.includes(nextType);
        const hadOptions = TYPES_WITH_OPTIONS.includes(draftType);
        setDraftType(nextType);
        if (wantsOptions && !hadOptions) {
            // Switching INTO select/multiselect — start with an empty options list.
            setDraftOptions([]);
        } else if (!wantsOptions) {
            // Switching AWAY from select/multiselect — drop the options draft.
            setDraftOptions([]);
        }
    };

    const handleAddOption = () => {
        setDraftOptions((prev) => [...prev, {id: generateOptionId(), name: ''}]);
    };

    const handleOptionNameChange = (id: string, value: string) => {
        setDraftOptions((prev) => prev.map((o) => (o.id === id ? {...o, name: value} : o)));
    };

    const handleRemoveOption = (id: string) => {
        setDraftOptions((prev) => prev.filter((o) => o.id !== id));
    };

    const supportsOptions = TYPES_WITH_OPTIONS.includes(draftType);
    const trimmedName = draftName.trim();
    const nameDirty = trimmedName !== field.name;
    const nameValid = trimmedName.length > 0;
    const trimmedOptions = useMemo(
        () => draftOptions.map((o) => ({...o, name: o.name.trim()})),
        [draftOptions],
    );
    const typeDirty = draftType !== field.type;
    const optionsDirty =
        supportsOptions &&
        (typeDirty || !optionsEqual(initialOptions, trimmedOptions));
    const optionsValid =
        !supportsOptions ||
        (trimmedOptions.length > 0 && trimmedOptions.every((o) => o.name.length > 0));
    const dirty = nameDirty || typeDirty || optionsDirty;
    const canSave = dirty && nameValid && optionsValid;

    const handleSave = () => {
        if (!canSave) {
            return;
        }
        const patch: {name?: string; type?: FieldType; attrs?: PropertyField['attrs']} = {};
        if (nameDirty) {
            patch.name = trimmedName;
        }
        if (typeDirty) {
            patch.type = draftType;
        }
        if (supportsOptions && (typeDirty || optionsDirty)) {
            patch.attrs = {...(field.attrs ?? {}), options: trimmedOptions};
        } else if (!supportsOptions && typeDirty && getFieldOptions(field).length > 0) {
            // Strip stale options when moving off select/multiselect.
            patch.attrs = {...(field.attrs ?? {}), options: []};
        }
        dispatch(patchChannelPostPropertyField(field.id, patch));
        exitEdit();
    };

    const editLabel = formatMessage(
        {id: 'manage_post_properties_modal.edit_aria', defaultMessage: 'Edit {id}'},
        {id: field.id},
    );
    const cancelEditLabel = formatMessage(
        {id: 'manage_post_properties_modal.cancel_edit_aria', defaultMessage: 'Cancel edit {id}'},
        {id: field.id},
    );
    const saveLabel = formatMessage(
        {id: 'manage_post_properties_modal.save_aria', defaultMessage: 'Save {id}'},
        {id: field.id},
    );
    const deleteLabel = formatMessage(
        {id: 'manage_post_properties_modal.delete_aria', defaultMessage: 'Delete {id}'},
        {id: field.id},
    );

    const selectedTypeOption = typeOptions.find((o) => o.value === draftType) ?? typeOptions[0];

    if (editing) {
        return (
            <div
                className='manage-row manage-row--editing'
                data-property-field-id={field.id}
            >
                <div className='manage-row__main'>
                    <span className='manage-row__icon'>
                        <PropertyTypeIcon type={draftType}/>
                    </span>
                    <Input
                        type='text'
                        useLegend={false}
                        containerClassName='manage-row__name-input'
                        value={draftName}
                        aria-label={field.name}
                        onChange={(e) => setDraftName(e.target.value)}
                    />
                    <div className='manage-row__type-input'>
                        <LabeledSelect<FieldType>
                            inputId={`manage-row-type-${field.id}`}
                            aria-label={formatMessage({
                                id: 'manage_post_properties_modal.type_aria',
                                defaultMessage: 'Type',
                            })}
                            value={selectedTypeOption}
                            options={typeOptions}
                            onChange={handleTypeChange}
                            isSearchable={false}
                        />
                    </div>
                    <div className='manage-row__actions'>
                        <button
                            type='button'
                            className='manage-row__action-btn manage-row__action-btn--save'
                            aria-label={saveLabel}
                            disabled={!canSave}
                            onClick={handleSave}
                        >
                            <CheckIcon size={18}/>
                        </button>
                        <button
                            type='button'
                            className='manage-row__action-btn manage-row__action-btn--cancel'
                            aria-label={cancelEditLabel}
                            onClick={handleCancel}
                        >
                            <CloseIcon size={18}/>
                        </button>
                    </div>
                </div>
                {supportsOptions && (
                    <div className='manage-row__options-edit'>
                        {draftOptions.map((opt, idx) => (
                            <div
                                key={opt.id}
                                className='manage-row__option-edit-row'
                            >
                                <Input
                                    type='text'
                                    useLegend={false}
                                    aria-label={formatMessage(
                                        {id: 'manage_post_properties_modal.option_name', defaultMessage: 'Option name {n}'},
                                        {n: idx + 1},
                                    )}
                                    value={opt.name}
                                    onChange={(e) => handleOptionNameChange(opt.id, e.target.value)}
                                />
                                <button
                                    type='button'
                                    className='manage-row__option-remove'
                                    aria-label={formatMessage(
                                        {id: 'manage_post_properties_modal.remove_option_n', defaultMessage: 'Remove option {n}'},
                                        {n: idx + 1},
                                    )}
                                    onClick={() => handleRemoveOption(opt.id)}
                                >
                                    <CloseIcon size={14}/>
                                </button>
                            </div>
                        ))}
                        <button
                            type='button'
                            className='manage-row__add-option'
                            onClick={handleAddOption}
                        >
                            {formatMessage({
                                id: 'manage_post_properties_modal.add_option',
                                defaultMessage: 'Add option',
                            })}
                        </button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div
            className='manage-row'
            data-property-field-id={field.id}
        >
            <div className='manage-row__main'>
                <span className='manage-row__icon'>
                    <PropertyTypeIcon type={field.type}/>
                </span>
                <span className='manage-row__name'>{field.name}</span>
                <span className='manage-row__type-label'>{readModeTypeLabel}</span>
                <span className='manage-row__chips'>
                    {TYPES_WITH_OPTIONS.includes(field.type) && fieldOptions.map((opt) => (
                        <Tag
                            key={opt.id}
                            text={opt.name}
                            color={opt.color}
                            size='sm'
                        />
                    ))}
                </span>
                <div className='manage-row__actions'>
                    <button
                        type='button'
                        className='manage-row__action-btn manage-row__action-btn--edit'
                        aria-label={editLabel}
                        onClick={enterEdit}
                    >
                        <PencilOutlineIcon size={18}/>
                    </button>
                    <button
                        type='button'
                        className='manage-row__action-btn manage-row__action-btn--delete'
                        aria-label={deleteLabel}
                        onClick={() => onDeleteRequest(field.id)}
                    >
                        <TrashCanOutlineIcon size={18}/>
                    </button>
                </div>
            </div>
        </div>
    );
}
