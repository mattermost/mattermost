// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {useIntl} from 'react-intl';

import {PencilOutlineIcon, TrashCanOutlineIcon} from '@mattermost/compass-icons/components';
import type {FieldType, PropertyField} from '@mattermost/types/properties';

import PropertyTypeIcon from 'components/property_value_editor/type_icon';
import Tag from 'components/widgets/tag/tag';

type Props = {
    field: PropertyField;
    onEditRequest: (field: PropertyField) => void;
    onDeleteRequest: (fieldId: string) => void;
};

const TYPES_WITH_OPTIONS: FieldType[] = ['select', 'multiselect'];

function getFieldOptions(field: PropertyField) {
    return field.attrs?.options ?? [];
}

export default function ManageRow({field, onEditRequest, onDeleteRequest}: Props) {
    const {formatMessage} = useIntl();

    const typeLabels = useMemo((): Record<FieldType, string> => ({
        text: formatMessage({id: 'new_property_form.type.text', defaultMessage: 'Text'}),
        date: formatMessage({id: 'new_property_form.type.date', defaultMessage: 'Date'}),
        select: formatMessage({id: 'new_property_form.type.select', defaultMessage: 'Select'}),
        multiselect: formatMessage({id: 'new_property_form.type.multiselect', defaultMessage: 'Multi-select'}),
        user: formatMessage({id: 'new_property_form.type.user', defaultMessage: 'User'}),
        multiuser: formatMessage({id: 'new_property_form.type.multiuser', defaultMessage: 'Multi-user'}),
    }), [formatMessage]);

    const readModeTypeLabel = typeLabels[field.type] ?? typeLabels.text;
    const fieldOptions = getFieldOptions(field);

    const editLabel = formatMessage(
        {id: 'manage_post_properties_modal.edit_aria', defaultMessage: 'Edit {id}'},
        {id: field.id},
    );
    const deleteLabel = formatMessage(
        {id: 'manage_post_properties_modal.delete_aria', defaultMessage: 'Delete {id}'},
        {id: field.id},
    );

    return (
        <div
            className='manage-row'
            data-property-field-id={field.id}
        >
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
                    onClick={() => onEditRequest(field)}
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
    );
}
